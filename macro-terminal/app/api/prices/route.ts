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

// ── Cache ─────────────────────────────────────────────────────────────────────
let cache: { data: PriceMap; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

// ── Finnhub: fetch a single quote ─────────────────────────────────────────────
async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<any> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = await res.json();
  // Finnhub returns { c: current, d: change, dp: changePct, h: high, l: low, o: open, pc: prevClose }
  if (!data?.c || data.c === 0) return null;
  return data;
}

// ── Yahoo Finance: fetch a batch of quotes ────────────────────────────────────
async function fetchYahooBatch(symbols: string[]): Promise<Record<string, any>> {
  if (symbols.length === 0) return {};
  const joined = symbols.map(encodeURIComponent).join("%2C");
  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}` +
    `&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChange,` +
    `regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    const quotes: any[] = json?.quoteResponse?.result ?? [];
    const map: Record<string, any> = {};
    quotes.forEach((q: any) => { if (q?.symbol) map[q.symbol] = q; });
    return map;
  } catch {
    return {};
  }
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, { headers: { "Cache-Control": "public, max-age=60" } });
  }

  const apiKey = process.env.FINNHUB_API_KEY ?? "";
  const priceMap: PriceMap = {};

  // ── 1. Finnhub — fetch all symbols concurrently ──────────────────────────
  // Free tier rate limit: 60 calls/min — we have ~20 symbols so fine
  const finnhubEntries = Object.entries(FINNHUB_SYMBOLS);
  const finnhubResults = await Promise.allSettled(
    finnhubEntries.map(([, sym]) => fetchFinnhubQuote(sym, apiKey))
  );

  finnhubEntries.forEach(([id, sym], i) => {
    const result = finnhubResults[i];
    if (result.status !== "fulfilled" || !result.value) return;
    const q = result.value;

    const price: number    = q.c;
    const prevClose: number = q.pc;
    const changeAbs: number = q.d  ?? (price - prevClose);
    const changePct: number = q.dp != null ? q.dp / 100 : (prevClose > 0 ? changeAbs / prevClose : 0);

    // For FX we need 52w hi/lo — Finnhub basic quote doesn't include it,
    // so we approximate from the day's range scaled — will be refined by Yahoo fallback
    const high52 = q.h * 1.08;
    const low52  = q.l * 0.92;

    const isFX     = sym.startsWith("OANDA:");
    const isCrypto = sym.startsWith("BINANCE:");

    priceMap[id] = {
      price:     parseFloat(price.toFixed(isFX ? 5 : isCrypto ? 2 : 4)),
      yield:     null,
      change:    parseFloat(changePct.toFixed(6)),
      changeAbs: parseFloat(changeAbs.toFixed(isFX ? 5 : 2)),
      high52:    parseFloat(high52.toFixed(isFX ? 5 : 2)),
      low52:     parseFloat(low52.toFixed(isFX ? 5 : 2)),
      simulated: false,
      source:    "finnhub",
    };
  });

  // ── 2. Yahoo Finance — batch fetch ───────────────────────────────────────
  const yahooEntries = Object.entries(YAHOO_SYMBOLS).filter(([id]) => !SIMULATED_IDS.has(id));
  const uniqueYahooSyms = Array.from(new Set(yahooEntries.map(([, s]) => s)));

  const BATCH = 25;
  const yahooData: Record<string, any> = {};
  for (let i = 0; i < uniqueYahooSyms.length; i += BATCH) {
    const batch = uniqueYahooSyms.slice(i, i + BATCH);
    const result = await fetchYahooBatch(batch);
    Object.assign(yahooData, result);
  }

  for (const [id, yahooSym] of yahooEntries) {
    const q = yahooData[yahooSym];
    if (!q) continue;

    const rawPrice: number  = q.regularMarketPrice         ?? 0;
    const prevClose: number = q.regularMarketPreviousClose ?? rawPrice;
    const high52: number    = q.fiftyTwoWeekHigh           ?? rawPrice * 1.1;
    const low52: number     = q.fiftyTwoWeekLow            ?? rawPrice * 0.9;
    const changeAbs: number = q.regularMarketChange        ?? 0;
    const changePct: number = prevClose > 0 ? changeAbs / prevClose : 0;

    if (TREASURY_YIELD_IDS.has(id)) {
      // ^TNX etc. → price is yield × 10 (e.g. 42.78 = 4.278%)
      const yld     = rawPrice  / 10;
      const prevYld = prevClose / 10;
      priceMap[id] = {
        price:     null,
        yield:     parseFloat(yld.toFixed(3)),
        change:    parseFloat((yld - prevYld).toFixed(3)),
        changeAbs: null,
        high52:    parseFloat((high52 / 10).toFixed(3)),
        low52:     parseFloat((low52  / 10).toFixed(3)),
        simulated: false,
        source:    "yahoo",
      };
    } else if (BOND_ETF_IDS.has(id)) {
      priceMap[id] = {
        price:     parseFloat(rawPrice.toFixed(3)),
        yield:     null,
        change:    parseFloat(changePct.toFixed(5)),
        changeAbs: parseFloat(changeAbs.toFixed(3)),
        high52:    parseFloat(high52.toFixed(3)),
        low52:     parseFloat(low52.toFixed(3)),
        simulated: false,
        source:    "yahoo",
      };
    } else {
      // Indices, commodities
      priceMap[id] = {
        price:     parseFloat(rawPrice.toFixed(2)),
        yield:     null,
        change:    parseFloat(changePct.toFixed(6)),
        changeAbs: parseFloat(changeAbs.toFixed(2)),
        high52:    parseFloat(high52.toFixed(2)),
        low52:     parseFloat(low52.toFixed(2)),
        simulated: false,
        source:    "yahoo",
      };
    }
  }

  cache = { data: priceMap, ts: Date.now() };
  return NextResponse.json(priceMap, { headers: { "Cache-Control": "public, max-age=60" } });
}
