import { NextResponse } from "next/server";
import {
  FINNHUB_SYMBOLS,
  YAHOO_SYMBOLS,
  SIMULATED_IDS,
  TREASURY_YIELD_IDS,
  BOND_ETF_IDS,
} from "../../data/symbols";

export const runtime = "nodejs";

export interface PriceResult {
  price:     number | null;
  yield:     number | null;
  change:    number;
  changeAbs: number | null;
  high52:    number;
  low52:     number;
  simulated: boolean;
  source:    "finnhub" | "yahoo" | "sim";
}
export type PriceMap = Record<string, PriceResult>;

let cache: { data: PriceMap; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

// ── Finnhub ───────────────────────────────────────────────────────────────────
async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<any> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return (!d?.c || d.c === 0) ? null : d;
  } catch { return null; }
}

// ── Yahoo v8 — single symbol ─────────────────────────────────────────────────
async function fetchYahooV8(symbol: string): Promise<{ price: number; prevClose: number; high52: number; low52: number } | null> {
  try {
    // Use query2 (non-rate-limited path used by Yahoo's own apps)
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta   = result.meta ?? {};
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((c: any) => c != null) as number[];
    if (closes.length === 0) return null;
    const price     = (meta.regularMarketPrice ?? closes[closes.length - 1]) as number;
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2] ?? price) as number;
    const high52    = (meta.fiftyTwoWeekHigh ?? price * 1.1) as number;
    const low52     = (meta.fiftyTwoWeekLow  ?? price * 0.9) as number;
    if (!price || price === 0) return null;
    return { price, prevClose, high52, low52 };
  } catch { return null; }
}

function classify(id: string) {
  return {
    isFX:        ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP"].includes(id),
    isCrypto:    ["BTC","ETH"].includes(id),
    isIndex:     ["SPX","NDX","DJIA","SX5E","UKX","NKY","KOSPI","MSCI"].includes(id),
    isCommodity: ["CL2","GC","SI","HG"].includes(id),
    isTreasury:  TREASURY_YIELD_IDS.has(id),
    isBondETF:   BOND_ETF_IDS.has(id),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, { headers: { "Cache-Control": "public, max-age=60" } });
  }

  const apiKey   = process.env.FINNHUB_API_KEY ?? "";
  const priceMap: PriceMap = {};

  // ── 1. Finnhub — Mag 7 (small batch, reliable) ───────────────────────────
  await Promise.all(Object.entries(FINNHUB_SYMBOLS).map(async ([id, sym]) => {
    const q = await fetchFinnhubQuote(sym, apiKey);
    if (!q) return;
    const price = q.c as number;
    const chgAbs = (q.d ?? 0) as number;
    const chgPct = q.dp != null ? (q.dp as number) / 100 : 0;
    priceMap[id] = {
      price: Math.round(price * 100) / 100,
      yield: null,
      change: chgPct,
      changeAbs: Math.round(chgAbs * 100) / 100,
      high52: Math.round(price * 1.08 * 100) / 100,
      low52:  Math.round(price * 0.92 * 100) / 100,
      simulated: false,
      source: "finnhub",
    };
  }));

  // ── 2. Yahoo v8 — stagger requests to avoid rate limiting ────────────────
  // Fetch in small parallel groups with a tiny gap between groups
  const yahooEntries = Object.entries(YAHOO_SYMBOLS).filter(([id]) => !SIMULATED_IDS.has(id) && !priceMap[id]);

  const PARALLEL = 5; // fetch 5 at a time
  for (let i = 0; i < yahooEntries.length; i += PARALLEL) {
    const batch = yahooEntries.slice(i, i + PARALLEL);
    await Promise.all(batch.map(async ([id, sym]) => {
      const q = await fetchYahooV8(sym);
      if (!q) return;

      const { price, prevClose, high52, low52 } = q;
      const chgAbs = price - prevClose;
      const chgPct = prevClose > 0 ? chgAbs / prevClose : 0;
      const { isFX, isCrypto, isIndex, isCommodity, isTreasury, isBondETF } = classify(id);

      if (isTreasury) {
        const yld = price / 10, prevYld = prevClose / 10;
        priceMap[id] = { price: null, yield: Math.round(yld*1000)/1000, change: Math.round((yld-prevYld)*1000)/1000, changeAbs: null, high52: Math.round(high52/10*1000)/1000, low52: Math.round(low52/10*1000)/1000, simulated: false, source: "yahoo" };
      } else if (isFX) {
        priceMap[id] = { price: Math.round(price*100000)/100000, yield: null, change: Math.round(chgAbs*100000)/100000, changeAbs: Math.round(chgAbs*100000)/100000, high52: Math.round(high52*100000)/100000, low52: Math.round(low52*100000)/100000, simulated: false, source: "yahoo" };
      } else if (isCrypto) {
        priceMap[id] = { price: Math.round(price), yield: null, change: chgPct, changeAbs: Math.round(chgAbs*100)/100, high52: Math.round(high52), low52: Math.round(low52), simulated: false, source: "yahoo" };
      } else if (isCommodity) {
        priceMap[id] = { price: Math.round(price*100)/100, yield: null, change: Math.round(chgAbs*100)/100, changeAbs: Math.round(chgAbs*100)/100, high52: Math.round(high52*100)/100, low52: Math.round(low52*100)/100, simulated: false, source: "yahoo" };
      } else {
        // index, equity, bond ETF
        priceMap[id] = { price: Math.round(price*100)/100, yield: null, change: chgPct, changeAbs: Math.round(chgAbs*100)/100, high52: Math.round(high52*100)/100, low52: Math.round(low52*100)/100, simulated: false, source: "yahoo" };
      }
    }));
  }

  const keys = Object.keys(priceMap);
  console.log(`[prices] built priceMap with ${keys.length} entries:`, keys.join(","));

  // Only cache if we got a meaningful number of results
  if (keys.length > 5) {
    cache = { data: priceMap, ts: Date.now() };
  }
  return NextResponse.json(priceMap, { headers: { "Cache-Control": "public, max-age=60" } });
}
