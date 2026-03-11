// ── FINNHUB symbols (real-time, free tier) ───────────────────────────────────
export const FINNHUB_SYMBOLS: Record<string, string> = {
  // Mag 7
  NVDA:  "NVDA",
  AAPL:  "AAPL",
  MSFT:  "MSFT",
  AMZN:  "AMZN",
  GOOGL: "GOOGL",
  META:  "META",
  TSLA:  "TSLA",

  // US Indices
  SPX:  "^GSPC",
  NDX:  "^NDX",
  DJIA: "^DJI",

  // FX — Finnhub OANDA format
  EURUSD: "OANDA:EUR_USD",
  GBPUSD: "OANDA:GBP_USD",
  USDJPY: "OANDA:USD_JPY",
  USDCHF: "OANDA:USD_CHF",
  AUDUSD: "OANDA:AUD_USD",
  USDCAD: "OANDA:USD_CAD",
  NZDUSD: "OANDA:NZD_USD",
  EURGBP: "OANDA:EUR_GBP",

  // Crypto
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
};

// ── YAHOO FINANCE symbols (15-min delay) ─────────────────────────────────────
export const YAHOO_SYMBOLS: Record<string, string> = {
  // US Treasury yields (Yahoo quotes as e.g. 42.78 = 4.278%)
  UST_5Y:  "^FVX",
  UST_10Y: "^TNX",
  UST_30Y: "^TYX",

  // European & Asian indices
  SX5E:  "^STOXX50E",
  UKX:   "^FTSE",
  NKY:   "^N225",
  KOSPI: "^KS11",
  MSCI:  "URTH",

  // Commodities
  CL2: "CL=F",
  GC:  "GC=F",
  SI:  "SI=F",
  HG:  "HG=F",

  // Bond ETF proxies
  BUND_10Y: "EXVM.DE",
  BUND_30Y: "EXHG.DE",
  GILT_10Y: "IGLT.L",
  GILT_30Y: "IGLO.L",
  BTP_10Y:  "ITPS.MI",
};

// Instruments with no real data — stay simulated
export const SIMULATED_IDS = new Set([
  "SOFR_Z6","SOFR_Z7","SOFR_Z8","SOFR_H6","SOFR_M6","SOFR_U6",
  "EUR_Z6","EUR_Z7","EUR_Z8","EUR_H6","EUR_M6","EUR_U6",
  "SONIA_Z6","SONIA_Z7","SONIA_Z8","SONIA_H6","SONIA_M6","SONIA_U6",
  "SOFRSW_2Y","SOFRSW_5Y","SOFRSW_10Y","SOFRSW_30Y",
  "EURSW_2Y","EURSW_5Y","EURSW_10Y","EURSW_30Y",
  "GBPSW_2Y","GBPSW_5Y","GBPSW_10Y","GBPSW_30Y",
  "JPYSW_2Y","JPYSW_5Y","JPYSW_10Y","JPYSW_30Y",
  "UST_2Y",
  "OAT_2Y","OAT_5Y","OAT_10Y","OAT_30Y",
  "BTP_2Y","BTP_5Y","BTP_30Y",
  "JGB_2Y","JGB_5Y","JGB_10Y","JGB_30Y",
  "BUND_2Y","BUND_5Y","GILT_2Y","GILT_5Y",
  "TTF",
]);

export const TREASURY_YIELD_IDS = new Set(["UST_5Y", "UST_10Y", "UST_30Y"]);
export const BOND_ETF_IDS = new Set(["BUND_10Y","BUND_30Y","GILT_10Y","GILT_30Y","BTP_10Y"]);
