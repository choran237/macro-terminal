import { NextResponse } from "next/server";
import { YAHOO_SYMBOLS, SIMULATED_IDS } from "../../data/symbols";

export const runtime = "nodejs";

// ── In-memory cache — 60 s TTL ───────────────────────────────────────────────
let cache: { data: PriceMap; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export interface YahooPriceResult {
  price:     number | null;
  yield:     number | null;
  change:    number;
  changeAbs: number | null;
  high52:    number;
  low52:     number;
  simulated: boolean;
}
export type PriceMap = Record<string, YahooPriceResult>;

// Treasury yield tickers — Yahoo quotes these as e.g. 42.78 meaning 4.278 %
const YIELD_IDS = new Set(["UST_5Y", "UST_10Y", "UST_30Y"]);

// Bond ETFs — show NAV price, no yield field
const BOND_ETF_IDS = new Set([
  "BUND_2Y","BUND_5Y","BUND_10Y","BUND_30Y",
  "GILT_2Y","GILT_5Y","GILT_10Y","GILT_30Y",
  "BTP_10Y",
]);

// ── Fetch a batch of symbols from Yahoo Finance v8 (no library) ──────────────
async function fetchYahooBatch(symbols: string[]): Promise<Record<string, any>> {
  if (symbols.length === 0) return {};

  const joined = symbols.map(encodeURIComponent).join("%2C");
  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}` +
    `&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChange,` +
    `regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow`;

  const res = await fetch(url, {
    headers: {
      // Mimic a browser request so Yahoo doesn't reject it
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 }, // don't use Next.js cache — we manage it ourselves
  });

  if (!res.ok) {
    console.warn(`Yahoo batch fetch failed: ${res.status} ${res.statusText}`);
    return {};
  }

  const json = await res.json();
  const quotes: any[] = json?.quoteResponse?.result ?? [];
  const map: Record<string, any> = {};
  quotes.forEach((q: any) => { if (q?.symbol) map[q.symbol] = q; });
  return map;
}

// ── API route ────────────────────────────────────────────────────────────────
export async function GET() {
  // Serve cache if still fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  // Instruments we actually want to fetch (exclude simulated ones)
  const idToYahoo = Object.entries(YAHOO_SYMBOLS).filter(
    ([id]) => !SIMULATED_IDS.has(id)
  );
  const uniqueSymbols = [...new Set(idToYahoo.map(([, sym]) => sym))];

  // Fetch in batches of 25
  const BATCH = 25;
  const yahooData: Record<string, any> = {};
  for (let i = 0; i < uniqueSymbols.length; i += BATCH) {
    try {
      const batch = uniqueSymbols.slice(i, i + BATCH);
      const result = await fetchYahooBatch(batch);
      Object.assign(yahooData, result);
    } catch (e) {
      console.error("Yahoo batch error:", e);
    }
  }

  // Map Yahoo responses back to our instrument IDs
  const priceMap: PriceMap = {};

  for (const [id, yahooSymbol] of idToYahoo) {
    const q = yahooData[yahooSymbol];
    if (!q) continue;

    const rawPrice: number  = q.regularMarketPrice          ?? 0;
    const prevClose: number = q.regularMarketPreviousClose  ?? rawPrice;
    const high52: number    = q.fiftyTwoWeekHigh            ?? rawPrice * 1.1;
    const low52: number     = q.fiftyTwoWeekLow             ?? rawPrice * 0.9;
    const changeAbs: number = q.regularMarketChange         ?? 0;
    const changePct: number = prevClose > 0 ? changeAbs / prevClose : 0;

    if (YIELD_IDS.has(id)) {
      // ^TNX etc. quote yield × 10, e.g. 42.78 = 4.278 %
      const yieldVal  = rawPrice  / 10;
      const prevYield = prevClose / 10;
      priceMap[id] = {
        price:     null,
        yield:     parseFloat(yieldVal.toFixed(3)),
        change:    parseFloat((yieldVal - prevYield).toFixed(3)),
        changeAbs: null,
        high52:    parseFloat((high52 / 10).toFixed(3)),
        low52:     parseFloat((low52  / 10).toFixed(3)),
        simulated: false,
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
      };
    } else {
      priceMap[id] = {
        price:     parseFloat(rawPrice.toFixed(5)),
        yield:     null,
        change:    parseFloat(changePct.toFixed(6)),
        changeAbs: parseFloat(changeAbs.toFixed(4)),
        high52:    parseFloat(high52.toFixed(5)),
        low52:     parseFloat(low52.toFixed(5)),
        simulated: false,
      };
    }
  }

  cache = { data: priceMap, ts: Date.now() };

  return NextResponse.json(priceMap, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
