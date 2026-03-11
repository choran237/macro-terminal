export interface Contract {
  id: string;
  label: string;
  price: number | null;
  yield: number | null;
  change: number;         // yield change for bonds/rates; pct for equity/fx/crypto; abs for cmdty
  changeAbs?: number;     // absolute $ change for equities/crypto
  high52: number;
  low52: number;
  isYield?: boolean;
  isEquity?: boolean;
  isFX?: boolean;
  isCommodity?: boolean;
  isCrypto?: boolean;
}

export interface Group {
  id: string;
  label: string;
  currency: string;
  contracts: Contract[];
}

export interface Section {
  label: string;
  groups: Group[];
}

export type DataStore = Record<string, Section>;

const D: DataStore = {
  rates: {
    label: "INTEREST RATE FUTURES",
    groups: [
      {
        id: "sofr", label: "SOFR", currency: "USD",
        contracts: [
          { id: "SOFR_Z6",    label: "Z6", price: 95.4450, yield: 4.555, change: -0.032, high52: 95.8800, low52: 94.1200 },
          { id: "SOFR_Z7",    label: "Z7", price: 96.1100, yield: 3.890, change: -0.018, high52: 96.4500, low52: 94.8800 },
          { id: "SOFR_Z8",    label: "Z8", price: 96.5200, yield: 3.480, change: +0.005, high52: 96.7200, low52: 95.3100 },
          { id: "SOFR_H6",    label: "H6", price: 95.5200, yield: 4.480, change: -0.029, high52: 95.9100, low52: 94.2100 },
          { id: "SOFR_M6",    label: "M6", price: 95.6800, yield: 4.320, change: -0.024, high52: 96.0200, low52: 94.5500 },
          { id: "SOFR_U6",    label: "U6", price: 95.7900, yield: 4.210, change: -0.021, high52: 96.1100, low52: 94.7700 },
        ],
      },
      {
        id: "euribor", label: "EURIBOR", currency: "EUR",
        contracts: [
          { id: "EUR_Z6",  label: "Z6", price: 97.3300, yield: 2.670, change: -0.014, high52: 97.6200, low52: 96.1100 },
          { id: "EUR_Z7",  label: "Z7", price: 97.6800, yield: 2.320, change: -0.008, high52: 97.8900, low52: 96.5500 },
          { id: "EUR_Z8",  label: "Z8", price: 97.8800, yield: 2.120, change: +0.003, high52: 97.9800, low52: 96.8800 },
          { id: "EUR_H6",  label: "H6", price: 97.4100, yield: 2.590, change: -0.011, high52: 97.7000, low52: 96.2200 },
          { id: "EUR_M6",  label: "M6", price: 97.5500, yield: 2.450, change: -0.009, high52: 97.8200, low52: 96.4000 },
          { id: "EUR_U6",  label: "U6", price: 97.4800, yield: 2.520, change: -0.010, high52: 97.7500, low52: 96.3300 },
        ],
      },
      {
        id: "sonia", label: "SONIA", currency: "GBP",
        contracts: [
          { id: "SONIA_Z6", label: "Z6", price: 95.1800, yield: 4.820, change: -0.022, high52: 95.5500, low52: 93.9900 },
          { id: "SONIA_Z7", label: "Z7", price: 95.7200, yield: 4.280, change: -0.011, high52: 95.9800, low52: 94.6600 },
          { id: "SONIA_Z8", label: "Z8", price: 96.0500, yield: 3.950, change: +0.002, high52: 96.2200, low52: 95.1100 },
          { id: "SONIA_H6", label: "H6", price: 95.2500, yield: 4.750, change: -0.019, high52: 95.6200, low52: 94.0800 },
          { id: "SONIA_M6", label: "M6", price: 95.4100, yield: 4.590, change: -0.016, high52: 95.7800, low52: 94.3300 },
          { id: "SONIA_U6", label: "U6", price: 95.5600, yield: 4.440, change: -0.014, high52: 95.9100, low52: 94.5500 },
        ],
      },
    ],
  },

  govbonds: {
    label: "GOVERNMENT BONDS",
    groups: [
      {
        id: "ust", label: "US TREASURIES", currency: "USD",
        contracts: [
          { id: "UST_2Y",  label: "2Y",  price: 99.8812, yield: 4.321, change: -0.041, high52: 5.198, low52: 3.871, isYield: true },
          { id: "UST_5Y",  label: "5Y",  price: 98.3344, yield: 4.156, change: -0.028, high52: 4.988, low52: 3.654, isYield: true },
          { id: "UST_10Y", label: "10Y", price: 96.7812, yield: 4.278, change: -0.019, high52: 4.988, low52: 3.612, isYield: true },
          { id: "UST_30Y", label: "30Y", price: 91.2344, yield: 4.521, change: -0.012, high52: 5.178, low52: 3.952, isYield: true },
        ],
      },
      {
        id: "bund", label: "GERMAN BUNDS", currency: "EUR",
        contracts: [
          { id: "BUND_2Y",  label: "2Y",  price: 101.220, yield: 2.088, change: -0.031, high52: 3.388, low52: 1.821, isYield: true },
          { id: "BUND_5Y",  label: "5Y",  price: 99.880,  yield: 2.201, change: -0.022, high52: 3.011, low52: 1.988, isYield: true },
          { id: "BUND_10Y", label: "10Y", price: 97.220,  yield: 2.488, change: -0.018, high52: 3.011, low52: 1.988, isYield: true },
          { id: "BUND_30Y", label: "30Y", price: 88.440,  yield: 2.788, change: -0.009, high52: 3.211, low52: 2.311, isYield: true },
        ],
      },
      {
        id: "oat", label: "FRENCH OATs", currency: "EUR",
        contracts: [
          { id: "OAT_2Y",  label: "2Y",  price: 100.450, yield: 2.488, change: -0.033, high52: 3.711, low52: 2.088, isYield: true },
          { id: "OAT_5Y",  label: "5Y",  price: 97.880,  yield: 2.788, change: -0.024, high52: 3.611, low52: 2.388, isYield: true },
          { id: "OAT_10Y", label: "10Y", price: 93.220,  yield: 3.188, change: -0.019, high52: 3.888, low52: 2.688, isYield: true },
          { id: "OAT_30Y", label: "30Y", price: 77.440,  yield: 3.811, change: -0.011, high52: 4.311, low52: 3.111, isYield: true },
        ],
      },
      {
        id: "btp", label: "ITALIAN BTPs", currency: "EUR",
        contracts: [
          { id: "BTP_2Y",  label: "2Y",  price: 99.110, yield: 2.988, change: -0.044, high52: 4.211, low52: 2.611, isYield: true },
          { id: "BTP_5Y",  label: "5Y",  price: 96.440, yield: 3.311, change: -0.031, high52: 4.511, low52: 2.888, isYield: true },
          { id: "BTP_10Y", label: "10Y", price: 89.880, yield: 3.688, change: -0.022, high52: 4.811, low52: 3.088, isYield: true },
          { id: "BTP_30Y", label: "30Y", price: 74.220, yield: 4.211, change: -0.011, high52: 5.211, low52: 3.511, isYield: true },
        ],
      },
      {
        id: "gilt", label: "UK GILTS", currency: "GBP",
        contracts: [
          { id: "GILT_2Y",  label: "2Y",  price: 98.880, yield: 4.488, change: -0.038, high52: 5.388, low52: 3.988, isYield: true },
          { id: "GILT_5Y",  label: "5Y",  price: 95.110, yield: 4.611, change: -0.024, high52: 5.288, low52: 3.888, isYield: true },
          { id: "GILT_10Y", label: "10Y", price: 89.220, yield: 4.722, change: -0.017, high52: 5.111, low52: 3.988, isYield: true },
          { id: "GILT_30Y", label: "30Y", price: 74.880, yield: 5.011, change: -0.008, high52: 5.388, low52: 4.211, isYield: true },
        ],
      },
      {
        id: "jgb", label: "JAPANESE JGBs", currency: "JPY",
        contracts: [
          { id: "JGB_2Y",  label: "2Y",  price: 99.980, yield: 0.688, change: +0.008, high52: 0.788, low52: 0.088, isYield: true },
          { id: "JGB_5Y",  label: "5Y",  price: 99.220, yield: 0.888, change: +0.011, high52: 1.011, low52: 0.288, isYield: true },
          { id: "JGB_10Y", label: "10Y", price: 97.880, yield: 1.488, change: +0.018, high52: 1.588, low52: 0.511, isYield: true },
          { id: "JGB_30Y", label: "30Y", price: 88.440, yield: 2.388, change: +0.022, high52: 2.511, low52: 1.388, isYield: true },
        ],
      },
    ],
  },

  swaps: {
    label: "INTEREST RATE SWAPS",
    groups: [
      {
        id: "sofr_sw", label: "SOFR SWAPS", currency: "USD",
        contracts: [
          { id: "SOFRSW_2Y",  label: "2Y",  price: null, yield: 4.288, change: -0.038, high52: 5.111, low52: 3.788, isYield: true },
          { id: "SOFRSW_5Y",  label: "5Y",  price: null, yield: 4.111, change: -0.022, high52: 4.888, low52: 3.611, isYield: true },
          { id: "SOFRSW_10Y", label: "10Y", price: null, yield: 4.222, change: -0.016, high52: 4.888, low52: 3.511, isYield: true },
          { id: "SOFRSW_30Y", label: "30Y", price: null, yield: 4.488, change: -0.009, high52: 5.111, low52: 3.888, isYield: true },
        ],
      },
      {
        id: "eur_sw", label: "EUR SWAPS", currency: "EUR",
        contracts: [
          { id: "EURSW_2Y",  label: "2Y",  price: null, yield: 2.111, change: -0.028, high52: 3.511, low52: 1.888, isYield: true },
          { id: "EURSW_5Y",  label: "5Y",  price: null, yield: 2.311, change: -0.018, high52: 3.311, low52: 2.011, isYield: true },
          { id: "EURSW_10Y", label: "10Y", price: null, yield: 2.588, change: -0.013, high52: 3.211, low52: 2.111, isYield: true },
          { id: "EURSW_30Y", label: "30Y", price: null, yield: 2.788, change: -0.007, high52: 3.211, low52: 2.388, isYield: true },
        ],
      },
      {
        id: "gbp_sw", label: "GBP SWAPS", currency: "GBP",
        contracts: [
          { id: "GBPSW_2Y",  label: "2Y",  price: null, yield: 4.111, change: -0.031, high52: 5.011, low52: 3.711, isYield: true },
          { id: "GBPSW_5Y",  label: "5Y",  price: null, yield: 4.222, change: -0.021, high52: 4.888, low52: 3.811, isYield: true },
          { id: "GBPSW_10Y", label: "10Y", price: null, yield: 4.388, change: -0.015, high52: 4.988, low52: 3.888, isYield: true },
          { id: "GBPSW_30Y", label: "30Y", price: null, yield: 4.688, change: -0.008, high52: 5.111, low52: 4.111, isYield: true },
        ],
      },
      {
        id: "jpy_sw", label: "JPY SWAPS", currency: "JPY",
        contracts: [
          { id: "JPYSW_2Y",  label: "2Y",  price: null, yield: 0.788, change: +0.009, high52: 0.888, low52: 0.188, isYield: true },
          { id: "JPYSW_5Y",  label: "5Y",  price: null, yield: 0.988, change: +0.012, high52: 1.088, low52: 0.388, isYield: true },
          { id: "JPYSW_10Y", label: "10Y", price: null, yield: 1.588, change: +0.019, high52: 1.688, low52: 0.611, isYield: true },
          { id: "JPYSW_30Y", label: "30Y", price: null, yield: 2.411, change: +0.024, high52: 2.511, low52: 1.411, isYield: true },
        ],
      },
    ],
  },

  equities: {
    label: "EQUITY INDICES",
    groups: [
      {
        id: "us_eq", label: "US INDICES", currency: "USD",
        contracts: [
          { id: "SPX",  label: "S&P 500",   price: 5888.44,  yield: null, change: +0.0088, changeAbs: +51.22,   high52: 6147.43,  low52: 4835.04, isEquity: true },
          { id: "NDX",  label: "NASDAQ",    price: 20888.11, yield: null, change: +0.0111, changeAbs: +228.88,  high52: 22222.61, low52: 16542.21, isEquity: true },
          { id: "DJIA", label: "DOW JONES", price: 43188.11, yield: null, change: +0.0068, changeAbs: +288.44,  high52: 45073.63, low52: 37611.11, isEquity: true },
        ],
      },
      {
        id: "eu_eq", label: "EUROPEAN INDICES", currency: "EUR/GBP",
        contracts: [
          { id: "SX5E", label: "EURO STOXX", price: 5188.22,  yield: null, change: +0.0044, changeAbs: +22.88,   high52: 5522.31,  low52: 4288.11, isEquity: true },
          { id: "UKX",  label: "FTSE 100",   price: 8388.11,  yield: null, change: -0.0022, changeAbs: -18.88,   high52: 8888.55,  low52: 7188.11, isEquity: true },
          { id: "MSCI", label: "MSCI WORLD", price: 3688.44,  yield: null, change: +0.0055, changeAbs: +20.22,   high52: 3888.11,  low52: 2988.44, isEquity: true },
        ],
      },
      {
        id: "asia_eq", label: "ASIA INDICES", currency: "JPY/KRW",
        contracts: [
          { id: "NKY",   label: "NIKKEI 225", price: 38888.11, yield: null, change: +0.0088, changeAbs: +338.88,  high52: 42426.77, low52: 31156.12, isEquity: true },
          { id: "KOSPI", label: "KOSPI",       price: 2488.88,  yield: null, change: -0.0033, changeAbs: -8.22,    high52: 2888.11,  low52: 2211.44, isEquity: true },
        ],
      },
    ],
  },

  fx: {
    label: "FOREIGN EXCHANGE",
    groups: [
      {
        id: "majors", label: "MAJOR PAIRS", currency: "USD",
        contracts: [
          { id: "EURUSD", label: "EUR/USD", price: 1.08822, yield: null, change: +0.00088, high52: 1.12211, low52: 1.01888, isFX: true },
          { id: "GBPUSD", label: "GBP/USD", price: 1.28811, yield: null, change: -0.00188, high52: 1.33388, low52: 1.23211, isFX: true },
          { id: "USDJPY", label: "USD/JPY", price: 148.822, yield: null, change: +0.48800, high52: 161.988, low52: 140.888, isFX: true },
          { id: "USDCHF", label: "USD/CHF", price: 0.88822, yield: null, change: +0.00188, high52: 0.93388, low52: 0.84411, isFX: true },
          { id: "AUDUSD", label: "AUD/USD", price: 0.63388, yield: null, change: +0.00088, high52: 0.69388, low52: 0.59888, isFX: true },
          { id: "USDCAD", label: "USD/CAD", price: 1.43388, yield: null, change: -0.00188, high52: 1.47388, low52: 1.31888, isFX: true },
          { id: "NZDUSD", label: "NZD/USD", price: 0.57388, yield: null, change: +0.00058, high52: 0.63888, low52: 0.54388, isFX: true },
          { id: "EURGBP", label: "EUR/GBP", price: 0.84488, yield: null, change: +0.00088, high52: 0.87888, low52: 0.82388, isFX: true },
        ],
      },
    ],
  },

  commodities: {
    label: "COMMODITIES",
    groups: [
      {
        id: "energy", label: "ENERGY", currency: "USD",
        contracts: [
          { id: "CL2",  label: "WTI CRUDE M2", price: 71.88,  yield: null, change: -0.388, high52: 93.88, low52: 64.88, isCommodity: true },
          { id: "TTF",  label: "TTF GAS FRONT", price: 38.888, yield: null, change: +0.888, high52: 55.88, low52: 22.88, isCommodity: true },
        ],
      },
      {
        id: "metals", label: "METALS", currency: "USD",
        contracts: [
          { id: "GC", label: "GOLD",   price: 2888.44, yield: null, change:  +8.88, high52: 2988.88, low52: 1988.88, isCommodity: true },
          { id: "SI", label: "SILVER", price:   32.888, yield: null, change:  +0.288, high52:   34.88, low52:   21.88, isCommodity: true },
          { id: "HG", label: "COPPER", price:    4.488, yield: null, change: +0.0188, high52:    5.18, low52:    3.48, isCommodity: true },
        ],
      },
    ],
  },

  crypto: {
    label: "CRYPTO",
    groups: [
      {
        id: "crypto_main", label: "DIGITAL ASSETS", currency: "USD",
        contracts: [
          { id: "BTC", label: "BTC/USD", price: 88888.88, yield: null, change: +0.0188, changeAbs: +1638.88, high52: 108888.88, low52: 49888.88, isCrypto: true },
          { id: "ETH", label: "ETH/USD", price:  2888.88, yield: null, change: +0.0228, changeAbs:   +64.88, high52:   4888.88, low52:  1488.88, isCrypto: true },
        ],
      },
    ],
  },

  mag7: {
    label: "MAG 7",
    groups: [
      {
        id: "mag7_stocks", label: "MAGNIFICENT 7", currency: "USD",
        contracts: [
          { id: "NVDA",  label: "NVDA",  price: 888.88, yield: null, change: +0.0288, changeAbs:  +24.88, high52:  988.88, low52:  388.88, isEquity: true },
          { id: "AAPL",  label: "AAPL",  price: 228.88, yield: null, change: +0.0088, changeAbs:   +1.98, high52:  238.88, low52:  168.88, isEquity: true },
          { id: "MSFT",  label: "MSFT",  price: 388.88, yield: null, change: -0.0088, changeAbs:   -3.44, high52:  468.35, low52:  344.79, isEquity: true },
          { id: "AMZN",  label: "AMZN",  price: 228.88, yield: null, change: +0.0188, changeAbs:   +4.22, high52:  242.52, low52:  156.79, isEquity: true },
          { id: "GOOGL", label: "GOOGL", price: 178.88, yield: null, change: -0.0118, changeAbs:   -2.14, high52:  208.70, low52:  140.53, isEquity: true },
          { id: "META",  label: "META",  price: 588.88, yield: null, change: +0.0148, changeAbs:   +8.58, high52:  638.40, low52:  353.96, isEquity: true },
          { id: "TSLA",  label: "TSLA",  price: 288.88, yield: null, change: +0.0388, changeAbs:  +10.84, high52:  488.54, low52:  138.80, isEquity: true },
        ],
      },
    ],
  },
};

export default D;
