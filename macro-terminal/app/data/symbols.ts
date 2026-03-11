// Maps our internal instrument IDs to Yahoo Finance ticker symbols.
// Instruments NOT listed here stay as simulated data (swaps, rate futures strips, TTF).

export const YAHOO_SYMBOLS: Record<string, string> = {
  // ── US TREASURIES (Yahoo uses these bond yield tickers) ──
  UST_2Y:   "^IRX",   // 13-week proxy; best available free
  UST_5Y:   "^FVX",   // 5-year treasury yield
  UST_10Y:  "^TNX",   // 10-year treasury yield
  UST_30Y:  "^TYX",   // 30-year treasury yield

  // ── GERMAN BUNDS (ETF proxies — closest free option) ──
  BUND_2Y:  "EXX6.DE",   // iShares € Govt 1-3yr
  BUND_5Y:  "IBCX.DE",   // iShares Core € Govt Bond
  BUND_10Y: "EXVM.DE",   // iShares € Govt 7-10yr
  BUND_30Y: "EXHG.DE",   // iShares € Govt 15-30yr

  // ── UK GILTS (ETF proxies) ──
  GILT_2Y:  "IGLS.L",    // iShares UK Gilts 0-5yr
  GILT_5Y:  "IGLT.L",    // iShares Core UK Gilts
  GILT_10Y: "IGLT.L",
  GILT_30Y: "IGLO.L",    // iShares Over 15yr UK Gilts

  // ── ITALIAN BTPs (ETF proxies) ──
  BTP_10Y:  "ITPS.MI",   // Lyxor BTP 10Y

  // ── EQUITY INDICES ──
  SPX:   "^GSPC",    // S&P 500
  NDX:   "^NDX",     // Nasdaq 100
  DJIA:  "^DJI",     // Dow Jones
  SX5E:  "^STOXX50E",// Euro Stoxx 50
  UKX:   "^FTSE",    // FTSE 100
  NKY:   "^N225",    // Nikkei 225
  KOSPI: "^KS11",    // KOSPI
  MSCI:  "URTH",     // iShares MSCI World ETF

  // ── FX ──
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X",
  EURGBP: "EURGBP=X",

  // ── COMMODITIES ──
  CL2: "CL=F",    // WTI Crude front month
  GC:  "GC=F",    // Gold
  SI:  "SI=F",    // Silver
  HG:  "HG=F",    // Copper

  // ── CRYPTO ──
  BTC: "BTC-USD",
  ETH: "ETH-USD",

  // ── MAG 7 ──
  NVDA:  "NVDA",
  AAPL:  "AAPL",
  MSFT:  "MSFT",
  AMZN:  "AMZN",
  GOOGL: "GOOGL",
  META:  "META",
  TSLA:  "TSLA",
};

// These instrument IDs have no Yahoo symbol — they stay as simulated data
export const SIMULATED_IDS = new Set([
  // Rate futures strips
  "SOFR_Z6","SOFR_Z7","SOFR_Z8","SOFR_H6","SOFR_M6","SOFR_U6",
  "EUR_Z6","EUR_Z7","EUR_Z8","EUR_H6","EUR_M6","EUR_U6",
  "SONIA_Z6","SONIA_Z7","SONIA_Z8","SONIA_H6","SONIA_M6","SONIA_U6",
  // Swaps
  "SOFRSW_2Y","SOFRSW_5Y","SOFRSW_10Y","SOFRSW_30Y",
  "EURSW_2Y","EURSW_5Y","EURSW_10Y","EURSW_30Y",
  "GBPSW_2Y","GBPSW_5Y","GBPSW_10Y","GBPSW_30Y",
  "JPYSW_2Y","JPYSW_5Y","JPYSW_10Y","JPYSW_30Y",
  // No free intraday
  "TTF",
  "OAT_2Y","OAT_5Y","OAT_10Y","OAT_30Y",
  "BTP_2Y","BTP_5Y","BTP_30Y",
  "JGB_2Y","JGB_5Y","JGB_10Y","JGB_30Y",
  "BUND_2Y","BUND_5Y",
  "UST_2Y", // IRX is 13-week, mark as sim
]);
