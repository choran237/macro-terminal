import { NextResponse } from "next/server";
import { FINNHUB_SYMBOLS, YAHOO_SYMBOLS, SIMULATED_IDS } from "../../data/symbols";

export const runtime = "nodejs";

// Returns ~30 daily closes for a list of instrument IDs
// Used by the sparkline mini-charts on the main dashboard

function getYahooSymbol(id: string): string | null {
  if (YAHOO_SYMBOLS[id]) return YAHOO_SYMBOLS[id];
  const fh = FINNHUB_SYMBOLS[id];
  if (!fh) return null;
  if (!fh.includes(":")) return fh; // plain stock ticker
  if (fh.startsWith("OANDA:")) {
    const pair = fh.replace("OANDA:", "").replace("_", "");
    if (pair.startsWith("USD")) return `${pair.slice(3)}=X`;
    return `${pair}=X`;
  }
  if (fh.startsWith("BINANCE:")) {
    return fh.replace("BINANCE:", "").replace("USDT", "-USD");
  }
  return null;
}

async function fetchCloses(symbol: string): Promise<number[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=1mo&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c != null);
  } catch {
    return [];
  }
}

// Cache: sparklineData keyed by instrumentId, expires every 5 minutes
const cache: Map<string, { closes: number[]; ts: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 30);

  const result: Record<string, number[]> = {};

  await Promise.all(ids.map(async (id) => {
    if (SIMULATED_IDS.has(id)) { result[id] = []; return; }

    const cached = cache.get(id);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      result[id] = cached.closes;
      return;
    }

    const sym = getYahooSymbol(id);
    if (!sym) { result[id] = []; return; }

    const closes = await fetchCloses(sym);
    cache.set(id, { closes, ts: Date.now() });
    result[id] = closes;
  }));

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
