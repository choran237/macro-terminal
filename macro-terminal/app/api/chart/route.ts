import { NextResponse } from "next/server";
import { FINNHUB_SYMBOLS, YAHOO_SYMBOLS } from "../../data/symbols";

export const runtime = "nodejs";

// Chart modes:
//   3d  → 3 days of 15-min bars  (Yahoo interval=15m, range=5d  then trim)
//   30d → 30 days of 1-hour bars  (Yahoo interval=1h,  range=1mo)
//   6m  → 6 months of daily bars  (Yahoo interval=1d,  range=6mo)

function getYahooSymbol(instrumentId: string): string | null {
  // Check Yahoo symbols first
  if (YAHOO_SYMBOLS[instrumentId]) return YAHOO_SYMBOLS[instrumentId];
  // Fall back to Finnhub stocks which Yahoo also carries
  const fh = FINNHUB_SYMBOLS[instrumentId];
  if (fh && !fh.includes(":")) return fh; // plain ticker like AAPL
  // FX
  if (fh?.startsWith("OANDA:")) {
    // Convert OANDA:EUR_USD → EURUSD=X
    const pair = fh.replace("OANDA:", "").replace("_", "");
    // Special case: USD pairs are inverted on Yahoo
    if (pair.startsWith("USD")) return `${pair.slice(3)}=X`;
    return `${pair}=X`;
  }
  // Crypto: BINANCE:BTCUSDT → BTC-USD
  if (fh?.startsWith("BINANCE:")) {
    const sym = fh.replace("BINANCE:", "").replace("USDT", "-USD").replace("BTC", "BTC").replace("ETH", "ETH");
    return sym.includes("-USD") ? sym : `${sym}-USD`;
  }
  return null;
}

function modeToYahooParams(mode: string): { interval: string; range: string } {
  switch (mode) {
    case "3d":  return { interval: "15m", range: "5d"  };
    case "30d": return { interval: "60m", range: "1mo" };
    case "6m":  return { interval: "1d",  range: "6mo" };
    default:    return { interval: "1d",  range: "1mo" };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instrumentId = searchParams.get("id") ?? "";
  const mode         = searchParams.get("mode") ?? "30d";

  const yahooSym = getYahooSymbol(instrumentId);
  if (!yahooSym) {
    return NextResponse.json({ points: [], simulated: true });
  }

  const { interval, range } = modeToYahooParams(mode);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ points: [], simulated: true, error: `Yahoo ${res.status}` });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ points: [], simulated: true });
    }

    const timestamps: number[]  = result.timestamp ?? [];
    const closes: number[]      = result.indicators?.quote?.[0]?.close ?? [];
    const opens: number[]       = result.indicators?.quote?.[0]?.open  ?? [];
    const highs: number[]       = result.indicators?.quote?.[0]?.high  ?? [];
    const lows: number[]        = result.indicators?.quote?.[0]?.low   ?? [];
    const volumes: number[]     = result.indicators?.quote?.[0]?.volume ?? [];

    // For 3d mode, only keep last 3 trading days worth of bars
    let startIdx = 0;
    if (mode === "3d" && timestamps.length > 0) {
      const cutoff = Date.now() / 1000 - 3 * 24 * 60 * 60;
      startIdx = timestamps.findIndex(t => t >= cutoff);
      if (startIdx < 0) startIdx = 0;
    }

    const points = [];
    for (let i = startIdx; i < timestamps.length; i++) {
      if (closes[i] == null) continue; // skip null bars (market closed)
      points.push({
        t: timestamps[i] * 1000, // convert to ms
        o: opens[i]   ?? closes[i],
        h: highs[i]   ?? closes[i],
        l: lows[i]    ?? closes[i],
        c: closes[i],
        v: volumes[i] ?? 0,
      });
    }

    return NextResponse.json({ points, simulated: false }, {
      headers: { "Cache-Control": "public, max-age=120" },
    });

  } catch (e) {
    console.error("Chart fetch error:", e);
    return NextResponse.json({ points: [], simulated: true, error: String(e) });
  }
}
