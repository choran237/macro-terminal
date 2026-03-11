import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { YAHOO_SYMBOLS, SIMULATED_IDS } from "../../data/symbols";

export const runtime = "nodejs";

// Cache results for 60 seconds to avoid hammering Yahoo
let cache: { data: PriceMap; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export interface YahooPriceResult {
  price: number | null;
  yield: number | null;
  change: number;          // pct change from prev close (as decimal 0.01 = 1%)
  changeAbs: number | null;
  high52: number;
  low52: number;
  simulated: boolean;
}

export type PriceMap = Record<string, YahooPriceResult>;

// Treasury yield tickers return yield directly as the "price"
const YIELD_IDS = new Set(["UST_5Y", "UST_10Y", "UST_30Y"]);

// Instruments where Yahoo price IS the yield (bond ETFs use NAV, not yield)
const BOND_ETF_IDS = new Set([
  "BUND_2Y","BUND_5Y","BUND_10Y","BUND_30Y",
  "GILT_2Y","GILT_5Y","GILT_10Y","GILT_30Y",
  "BTP_10Y",
]);

async function fetchYahoo(symbols: string[]): Promise<Record<string, any>> {
  if (symbols.length === 0) return {};
  try {
    // yahoo-finance2 quoteSummary is more reliable than quote for batch
    const results = await yahooFinance.quote(symbols, {}, { validateResult: false });
    const map: Record<string, any> = {};
    if (Array.isArray(results)) {
      results.forEach(r => { if (r?.symbol) map[r.symbol] = r; });
    } else if (results?.symbol) {
      map[(results as any).symbol] = results;
    }
    return map;
  } catch (e) {
    console.error("Yahoo fetch error:", e);
    return {};
  }
}

export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  // Build list of Yahoo symbols to fetch (deduplicated)
  const idToYahoo = Object.entries(YAHOO_SYMBOLS).filter(
    ([id]) => !SIMULATED_IDS.has(id)
  );
  const uniqueYahooSymbols = [...new Set(idToYahoo.map(([, y]) => y))];

  // Fetch in batches of 20 to be safe
  const BATCH = 20;
  const yahooData: Record<string, any> = {};
  for (let i = 0; i < uniqueYahooSymbols.length; i += BATCH) {
    const batch = uniqueYahooSymbols.slice(i, i + BATCH);
    const result = await fetchYahoo(batch);
    Object.assign(yahooData, result);
  }

  // Build output map keyed by our instrument ID
  const priceMap: PriceMap = {};

  for (const [id, yahooSymbol] of idToYahoo) {
    const q = yahooData[yahooSymbol];
    if (!q) continue;

    const rawPrice: number = q.regularMarketPrice ?? 0;
    const prevClose: number = q.regularMarketPreviousClose ?? rawPrice;
    const high52: number = q.fiftyTwoWeekHigh ?? rawPrice * 1.1;
    const low52: number = q.fiftyTwoWeekLow ?? rawPrice * 0.9;
    const changeAbs: number = q.regularMarketChange ?? 0;
    const changePct: number = prevClose > 0 ? changeAbs / prevClose : 0;

    if (YIELD_IDS.has(id)) {
      // Treasury yield tickers: price field IS the yield in %
      const yieldVal = rawPrice / 10; // ^TNX quotes as e.g. 42.78 meaning 4.278%
      const prevYield = prevClose / 10;
      priceMap[id] = {
        price: null,
        yield: parseFloat(yieldVal.toFixed(3)),
        change: parseFloat((yieldVal - prevYield).toFixed(3)), // bp-style change
        changeAbs: null,
        high52: parseFloat((high52 / 10).toFixed(3)),
        low52: parseFloat((low52 / 10).toFixed(3)),
        simulated: false,
      };
    } else if (BOND_ETF_IDS.has(id)) {
      // Bond ETFs: show ETF price, no yield
      priceMap[id] = {
        price: parseFloat(rawPrice.toFixed(3)),
        yield: null,
        change: parseFloat(changePct.toFixed(5)),
        changeAbs: parseFloat(changeAbs.toFixed(3)),
        high52: parseFloat(high52.toFixed(3)),
        low52: parseFloat(low52.toFixed(3)),
        simulated: false,
      };
    } else {
      priceMap[id] = {
        price: parseFloat(rawPrice.toFixed(5)),
        yield: null,
        change: parseFloat(changePct.toFixed(6)),
        changeAbs: parseFloat(changeAbs.toFixed(4)),
        high52: parseFloat(high52.toFixed(5)),
        low52: parseFloat(low52.toFixed(5)),
        simulated: false,
      };
    }
  }

  cache = { data: priceMap, ts: Date.now() };

  return NextResponse.json(priceMap, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
