import type { Contract } from "../data/instruments";

export function fmtPrice(c: Contract): string {
  if (c.price === null) return "—";
  if (c.isFX)       return c.price.toFixed(c.price > 10 ? 3 : 5);
  if (c.isCrypto)   return c.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (c.isEquity)   return c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c.isCommodity) return c.price.toFixed(c.price < 10 ? 3 : 2);
  if (c.isYield)    return "—";     // bonds: show yield, not price, in main col
  return c.price.toFixed(4);
}

export function fmtYield(c: Contract): string {
  if (c.yield === null) return "—";
  return c.yield.toFixed(3);
}

export function fmtChange(c: Contract): string {
  if (c.isEquity || c.isCrypto) {
    const sign = c.change >= 0 ? "+" : "";
    const abs  = c.changeAbs != null
      ? ` (${c.changeAbs >= 0 ? "+" : ""}${c.changeAbs.toFixed(2)})`
      : "";
    return `${sign}${(c.change * 100).toFixed(2)}%${abs}`;
  }
  if (c.isFX) {
    const sign = c.change >= 0 ? "+" : "";
    return `${sign}${c.change.toFixed(5)}`;
  }
  if (c.isCommodity) {
    const sign = c.change >= 0 ? "+" : "";
    return `${sign}${c.change.toFixed(c.price && c.price < 10 ? 4 : 2)}`;
  }
  // rates / bonds / swaps → yield change in bps
  const sign = c.change >= 0 ? "+" : "";
  return `${sign}${c.change.toFixed(3)}`;
}

/** Value used for the range bar */
export function rangeValue(c: Contract): number {
  if (c.isYield && c.yield !== null) return c.yield;
  return c.price ?? 0;
}
