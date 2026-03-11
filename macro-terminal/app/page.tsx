"use client";

import { useState, useEffect, useRef } from "react";
import INITIAL_DATA, { Contract, DataStore } from "./data/instruments";
import { SIMULATED_IDS, YAHOO_SYMBOLS, TREASURY_YIELD_IDS, FINNHUB_SYMBOLS } from "./data/symbols";
import { fmtPrice, fmtYield, fmtChange, rangeValue } from "./lib/format";

// ── Fetch latest price directly from Yahoo chart (client-side, same as chart modal) ──
async function fetchYahooPrice(yahooSymbol: string): Promise<{
  price: number; prevClose: number; high52: number; low52: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d&includePrePost=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((c: any) => c != null) as number[];
    if (closes.length === 0) return null;
    const meta      = result.meta ?? {};
    const price     = closes[closes.length - 1];
    const prevClose = closes.length > 1 ? closes[closes.length - 2] : price;
    const high52    = (meta.fiftyTwoWeekHigh ?? price * 1.1) as number;
    const low52     = (meta.fiftyTwoWeekLow  ?? price * 0.9) as number;
    return { price, prevClose, high52, low52 };
  } catch { return null; }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ─── YAHOO POLLING HOOK ───────────────────────────────────────────────────────
// Polls /api/prices every 60 s. Merges real data into the data store.
// Instruments not covered by Yahoo keep their previous value and get a
// lightweight random simulation so the UI never looks frozen.

// Module-level so Sparkline can call it without prop-drilling
let _applySparklinePrice: ((id: string, last: number, prev: number) => void) | null = null;
function onPriceUpdate(id: string, last: number, prev: number) {
  _applySparklinePrice?.(id, last, prev);
}

function useLivePrices(initial: DataStore) {
  const [data, setData]       = useState<DataStore>(deepClone(initial));
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const [dataSource, setDataSource] = useState<"sim" | "live">("sim");
  const prevPrices = useRef<Record<string, number>>({});

  // ── Merge a price result into the data store ──────────────────────────────
  function applyPrice(
    id: string,
    price: number | null,
    yld: number | null,
    change: number,
    changeAbs: number | null,
    high52: number,
    low52: number,
  ) {
    const newVal = price ?? yld ?? 0;
    const prev   = prevPrices.current[id];
    const flash  = prev !== undefined && newVal !== prev
      ? (newVal > prev ? "up" : "down") as "up" | "down"
      : undefined;
    prevPrices.current[id] = newVal;

    setData(prev => {
      const next = deepClone(prev);
      Object.values(next).forEach((section: any) =>
        section.groups.forEach((group: any) =>
          group.contracts.forEach((c: Contract) => {
            if (c.id !== id) return;
            if (price     !== null) c.price     = price;
            if (yld       !== null) c.yield     = yld;
            c.change  = change;
            c.high52  = high52;
            c.low52   = low52;
            if (changeAbs !== null) c.changeAbs = changeAbs;
          })
        )
      );
      return next;
    });
    if (flash) {
      setFlashes(prev => ({ ...prev, [id]: flash }));
      setTimeout(() => setFlashes(prev => { const n = { ...prev }; delete n[id]; return n; }), 600);
    }
  }

  // ── 1. Finnhub — Mag 7 (server-side, avoids CORS) ────────────────────────
  useEffect(() => {
    async function pollFinnhub() {
      try {
        const res = await fetch("/api/prices");
        if (!res.ok) return;
        const map: Record<string, any> = await res.json();
        Object.entries(map).forEach(([id, live]: [string, any]) => {
          if (!live || live.simulated) return;
          applyPrice(id, live.price, live.yield, live.change, live.changeAbs, live.high52, live.low52);
          setDataSource("live");
        });
      } catch {}
    }
    pollFinnhub();
    const id = setInterval(pollFinnhub, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── 2. Yahoo — fetched client-side (browser → Yahoo, no server involved) ──
  useEffect(() => {
    const isFX        = (id: string) => ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP"].includes(id);
    const isCrypto    = (id: string) => ["BTC","ETH"].includes(id);
    const isCommodity = (id: string) => ["CL2","GC","SI","HG"].includes(id);

    async function pollYahoo() {
      const entries = Object.entries(YAHOO_SYMBOLS).filter(([id]) => !SIMULATED_IDS.has(id));
      await Promise.all(entries.map(async ([id, sym]) => {
        const q = await fetchYahooPrice(sym);
        if (!q) return;
        const { price, prevClose, high52, low52 } = q;
        const chgAbs = price - prevClose;
        const chgPct = prevClose > 0 ? chgAbs / prevClose : 0;

        if (TREASURY_YIELD_IDS.has(id)) {
          // v8 chart closes already return the actual yield (e.g. 4.86), no scaling needed
          const chgYld = price - prevClose;
          applyPrice(id, null, Math.round(price*1000)/1000, Math.round(chgYld*1000)/1000, null, Math.round(high52*1000)/1000, Math.round(low52*1000)/1000);
        } else if (isFX(id)) {
          applyPrice(id, Math.round(price*100000)/100000, null, Math.round(chgAbs*100000)/100000, Math.round(chgAbs*100000)/100000, Math.round(high52*100000)/100000, Math.round(low52*100000)/100000);
        } else if (isCrypto(id)) {
          applyPrice(id, Math.round(price), null, chgPct, Math.round(chgAbs*100)/100, Math.round(high52), Math.round(low52));
        } else if (isCommodity(id)) {
          applyPrice(id, Math.round(price*100)/100, null, Math.round(chgAbs*100)/100, Math.round(chgAbs*100)/100, Math.round(high52*100)/100, Math.round(low52*100)/100);
        } else {
          // indices, bond ETFs
          applyPrice(id, Math.round(price*100)/100, null, chgPct, Math.round(chgAbs*100)/100, Math.round(high52*100)/100, Math.round(low52*100)/100);
        }
        setDataSource("live");
      }));
    }

    pollYahoo();
    const id = setInterval(pollYahoo, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── 3. Simulate tick for SIM-only instruments ─────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const simFlashes: Record<string, "up" | "down"> = {};
      setData(prev => {
        const next = deepClone(prev);
        Object.values(next).forEach((section: any) => {
          section.groups.forEach((group: any) => {
            group.contracts.forEach((c: Contract) => {
              if (!SIMULATED_IDS.has(c.id)) return;
              if (Math.random() > 0.4) return;
              const dir = Math.random() > 0.5 ? 1 : -1;
              if (c.isFX) {
                c.price = parseFloat(((c.price ?? 0) + dir * Math.random() * 0.00012).toFixed(5));
                c.change += dir * 0.00008;
              } else if (c.isEquity || c.isCrypto) {
                const delta = dir * (c.price ?? 100) * Math.random() * 0.0004;
                c.price = parseFloat(((c.price ?? 0) + delta).toFixed(2));
                c.changeAbs = (c.changeAbs ?? 0) + delta;
                c.change += delta / (c.price ?? 1);
              } else if (c.isCommodity) {
                c.price = parseFloat(((c.price ?? 0) + dir * Math.random() * 0.06).toFixed(2));
                c.change += dir * 0.04;
              } else {
                const delta = dir * Math.random() * 0.002;
                if (c.yield !== null) { c.yield = parseFloat(((c.yield ?? 0) + delta).toFixed(3)); c.change += delta; }
                if (c.price !== null) { c.price = parseFloat(((c.price ?? 0) - delta * 8).toFixed(4)); }
              }
              simFlashes[c.id] = dir > 0 ? "up" : "down";
            });
          });
        });
        return next;
      });
      setFlashes(prev => ({ ...prev, ...simFlashes }));
      setTimeout(() => setFlashes({}), 550);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Register so Sparkline can call applyPrice without prop drilling
  useEffect(() => {
    _applySparklinePrice = (id, last, prev) => {
      if (TREASURY_YIELD_IDS.has(id)) {
        // v8 chart closes are already the actual yield value
        const chgYld = last - prev;
        applyPrice(id, null, Math.round(last * 1000) / 1000, Math.round(chgYld * 1000) / 1000, null, last * 1.1, last * 0.9);
      } else {
        const chgAbs = last - prev;
        const chgPct = prev > 0 ? chgAbs / prev : 0;
        applyPrice(id, Math.round(last * 100) / 100, null, chgPct, Math.round(chgAbs * 100) / 100, last * 1.1, last * 0.9);
      }
      setDataSource("live");
    };
    return () => { _applySparklinePrice = null; };
  }, []);

  return { data, flashes, dataSource };
}
// ─── SPARKLINE ────────────────────────────────────────────────────────────────

// Global sparkline cache so we don't re-fetch on every render
const sparklineCache: Record<string, number[]> = {};
const pendingFetches = new Set<string>();

function Sparkline({ contractId, positive, onPrice }: { contractId: string; positive: boolean; onPrice?: (closes: number[]) => void }) {
  const [pts, setPts] = useState<number[]>(sparklineCache[contractId] ?? []);

  useEffect(() => {
    if (sparklineCache[contractId]) { setPts(sparklineCache[contractId]); onPrice?.(sparklineCache[contractId]); return; }
    if (pendingFetches.has(contractId)) return;
    pendingFetches.add(contractId);
    fetch(`/api/sparklines?ids=${contractId}`)
      .then(r => r.json())
      .then(d => {
        const closes: number[] = d[contractId] ?? [];
        sparklineCache[contractId] = closes;
        setPts(closes);
        onPrice?.(closes);
      })
      .catch(() => {})
      .finally(() => pendingFetches.delete(contractId));
  }, [contractId]);

  if (pts.length < 2) {
    // Placeholder while loading
    return <svg width={78} height={28} viewBox="0 0 78 28" style={{ display: "block" }}><line x1={0} y1={14} x2={78} y2={14} stroke="#1a2e42" strokeWidth={1} /></svg>;
  }

  const mn = Math.min(...pts), mx = Math.max(...pts);
  const norm = pts.map(p => ((p - mn) / (mx - mn || 1)) * 24);
  const path = norm
    .map((y, i) => `${i === 0 ? "M" : "L"}${(i / (norm.length - 1)) * 78},${26 - y}`)
    .join(" ");
  const color = positive ? "#22d3a5" : "#f45b5b";
  return (
    <svg width={78} height={28} viewBox="0 0 78 28" style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── RANGE BAR ────────────────────────────────────────────────────────────────

function RangeBar({ value, low, high }: { value: number; low: number; high: number }) {
  const pct = Math.max(0, Math.min(100, ((value - low) / (high - low || 1)) * 100));
  const isShort = high < 10;
  const loLbl = isShort ? low.toFixed(3) : low.toFixed(0);
  const hiLbl = isShort ? high.toFixed(3) : high.toFixed(0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10, color: "#5a80a0", fontFamily: "monospace", width: 42, textAlign: "right" }}>{loLbl}</span>
      <div style={{ flex: 1, height: 3, background: "#0e1e30", borderRadius: 2, position: "relative", minWidth: 56 }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "linear-gradient(90deg,#1a3d6e,#22d3a5)", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: -2, left: `${pct}%`, width: 1.5, height: 7, background: "#e8f0f8", borderRadius: 1, transform: "translateX(-50%)" }} />
      </div>
      <span style={{ fontSize: 10, color: "#5a80a0", fontFamily: "monospace", width: 42 }}>{hiLbl}</span>
      <span style={{ fontSize: 10, color: "#5a80a0", fontFamily: "monospace", width: 28, textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── CHART MODAL ─────────────────────────────────────────────────────────────

type ChartMode = "1d" | "3d" | "30d" | "6m";
interface ChartPoint { t: number; o: number; h: number; l: number; c: number; v: number; }

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / mag;
  const nice  = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

function fmtAxisVal(v: number, step: number): string {
  const decimals = step < 0.01 ? 4 : step < 0.1 ? 3 : step < 1 ? 2 : step < 10 ? 1 : 0;
  return v.toFixed(decimals);
}

function drawChart(canvas: HTMLCanvasElement, points: ChartPoint[], simulated: boolean, mode: ChartMode) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (points.length === 0) {
    ctx.fillStyle = "#8aadcc";
    ctx.font = "12px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(simulated ? "SIMULATED — NO REAL DATA FOR THIS INSTRUMENT" : "NO DATA AVAILABLE", W / 2, H / 2);
    return;
  }

  const closes = points.map(p => p.c);
  const dataMin = Math.min(...closes), dataMax = Math.max(...closes);
  const pad = { t: 18, b: (mode === "1d" || mode === "3d") ? 48 : 36, l: 70, r: 14 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  // ── Nice Y axis ticks ─────────────────────────────────────────────────────
  const range = dataMax - dataMin || dataMax * 0.01;
  const step  = niceStep(range, 6);
  const axMin = Math.floor(dataMin / step) * step;
  const axMax = Math.ceil(dataMax  / step) * step;
  const ticks: number[] = [];
  for (let v = axMin; v <= axMax + step * 0.001; v += step) ticks.push(parseFloat(v.toFixed(10)));

  const toY = (v: number) => pad.t + (1 - (v - axMin) / (axMax - axMin)) * cH;
  const toX = (i: number) => pad.l + (i / (Math.max(points.length - 1, 1))) * cW;

  // Grid lines + Y labels
  ticks.forEach(tick => {
    const y = toY(tick);
    if (y < pad.t - 2 || y > H - pad.b + 2) return;
    // horizontal grid line
    ctx.strokeStyle = "#162840";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    // vertical tick line from x-axis up — draw as subtle vertical at each tick x? No — user wants vertical lines at Y-axis marks going UP
    // i.e. a full-height vertical line at the x positions corresponding to each y tick — actually user wants grid lines
    // Re-reading: "whatever is marked on the y-axis, there should be a vertical line up" — they mean gridlines ARE the vertical lines
    // Actually they mean: at each Y tick mark, draw a vertical line across the full chart width (which is what we're doing)
    // Y label
    ctx.fillStyle = "#7aadcc";
    ctx.font = "11px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillText(fmtAxisVal(tick, step), pad.l - 6, y + 3.5);
  });

  // X axis date/time labels
  const showTime = (mode === "1d" || mode === "3d");
  const xCount = Math.min(6, points.length);
  for (let i = 0; i < xCount; i++) {
    const idx = Math.floor((i / (xCount - 1)) * (points.length - 1));
    const x   = toX(idx);
    const d   = new Date(points[idx].t);
    const dateLbl = `${d.getDate()}/${d.getMonth() + 1}`;
    const timeLbl = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    // vertical gridline
    ctx.strokeStyle = "#0e1e2e";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
    ctx.font = "11px 'Courier New', monospace";
    ctx.textAlign = "center";
    if (showTime) {
      ctx.fillStyle = "#7aadcc";
      ctx.fillText(dateLbl, x, H - 18);
      ctx.fillStyle = "#5a80a0";
      ctx.fillText(timeLbl, x, H - 5);
    } else {
      ctx.fillStyle = "#7aadcc";
      ctx.fillText(dateLbl, x, H - 6);
    }
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, "rgba(34,211,165,0.18)");
  grad.addColorStop(1, "rgba(34,211,165,0.01)");
  ctx.beginPath();
  closes.forEach((c, i) => i === 0 ? ctx.moveTo(toX(i), toY(c)) : ctx.lineTo(toX(i), toY(c)));
  ctx.lineTo(toX(closes.length - 1), H - pad.b);
  ctx.lineTo(pad.l, H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Price line
  ctx.beginPath();
  ctx.strokeStyle = simulated ? "#f0a500" : "#22d3a5";
  ctx.lineWidth = 1.5;
  closes.forEach((c, i) => i === 0 ? ctx.moveTo(toX(i), toY(c)) : ctx.lineTo(toX(i), toY(c)));
  ctx.stroke();

  // SIM watermark
  if (simulated) {
    ctx.fillStyle = "rgba(240,165,0,0.08)";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("SIMULATED", W / 2, H / 2);
  }
}

function ChartModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [mode, setMode] = useState<ChartMode>("1d");
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [simulated, setSimulated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch real chart data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/chart?id=${contract.id}&mode=${mode}`)
      .then(r => r.json())
      .then(d => {
        setPoints(d.points ?? []);
        setSimulated(d.simulated ?? false);
      })
      .catch(() => setSimulated(true))
      .finally(() => setLoading(false));
  }, [contract.id, mode]);

  // Draw whenever data or canvas changes
  useEffect(() => {
    if (!canvasRef.current || loading) return;
    drawChart(canvasRef.current, points, simulated, mode);
  }, [points, simulated, loading]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,5,12,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#090f1a", border: "1px solid #172438", borderRadius: 8, padding: "20px 24px", width: 700, maxWidth: "94vw" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ color: "#22d3a5", fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>{contract.label}</span>
            <span style={{ color: "#3a6888", fontSize: 11 }}>{contract.id}</span>
            {simulated && <span style={{ color: "#f0a500", fontSize: 10, border: "1px solid #f0a500", borderRadius: 2, padding: "1px 5px" }}>SIM</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["1d", "3d", "30d", "6m"] as ChartMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: "3px 10px", borderRadius: 3, border: `1px solid ${mode === m ? "#22d3a5" : "#172438"}`, background: mode === m ? "rgba(34,211,165,0.1)" : "transparent", color: mode === m ? "#22d3a5" : "#5a80a0", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
                {m.toUpperCase()}
              </button>
            ))}
            <button onClick={onClose} style={{ padding: "3px 10px", borderRadius: 3, border: "1px solid #172438", background: "transparent", color: "#5a80a0", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* canvas */}
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} width={652} height={260} style={{ width: "100%", display: "block" }} />
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9,15,26,0.7)" }}>
              <span style={{ color: "#22d3a5", fontFamily: "monospace", fontSize: 12, letterSpacing: 2 }}>LOADING...</span>
            </div>
          )}
        </div>

        {/* stats */}
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, paddingTop: 14, borderTop: "1px solid #0e1e30" }}>
          {[
            ["PRICE",  fmtPrice(contract)],
            ["YIELD",  fmtYield(contract)],
            ["CHG",    fmtChange(contract)],
            ["52W HI", contract.high52 < 10 ? contract.high52.toFixed(3) : contract.high52.toFixed(2)],
            ["52W LO", contract.low52  < 10 ? contract.low52.toFixed(3)  : contract.low52.toFixed(2)],
            ["SOURCE", simulated ? "SIM" : "LIVE"],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ color: "#3a6888", fontSize: 9, letterSpacing: 1, marginBottom: 3 }}>{k}</div>
              <div style={{ color: k === "SOURCE" ? (simulated ? "#f0a500" : "#22d3a5") : "#c8dff5", fontSize: 12, fontFamily: "'Courier New', monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RANGE BAR HEADER ROW ─────────────────────────────────────────────────────

function TableHeader({ lookback, showTrend }: { lookback: string; showTrend: boolean }) {
  const th = (label: string, align: "left" | "right" | "center" = "right", width?: number) => (
    <th
      style={{
        padding: "3px 8px",
        color: "#3a6080",
        fontFamily: "'Courier New', monospace",
        fontSize: 10,
        textAlign: align,
        letterSpacing: 1,
        fontWeight: 400,
        whiteSpace: "nowrap",
        ...(width ? { width } : {}),
      }}
    >
      {label}
    </th>
  );
  return (
    <thead>
      <tr style={{ background: "#060d16", borderBottom: "1px solid #0d1c2c" }}>
        {th("TENOR", "left", 72)}
        {th("PRICE", "right", 96)}
        {th("YIELD", "right", 80)}
        {th(`CHG vs LDN CLOSE`, "right", 130)}
        {th(`${lookback} RANGE`, "left")}
        {showTrend && th("TREND", "center", 90)}
      </tr>
    </thead>
  );
}

// ─── CONTRACT ROW ─────────────────────────────────────────────────────────────

function ContractRow({
  contract,
  flash,
  showTrend,
  onChart,
}: {
  contract: Contract;
  flash?: "up" | "down";
  showTrend: boolean;
  onChart: (c: Contract) => void;
}) {
  const positive = contract.change >= 0;
  const changeColor = positive ? "#22d3a5" : "#f45b5b";
  const flashClass = flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "";

  const cell = (content: React.ReactNode, align: "left" | "right" = "right", extra?: React.CSSProperties) => (
    <td
      style={{
        padding: "5px 8px",
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        textAlign: align,
        whiteSpace: "nowrap",
        ...extra,
      }}
    >
      {content}
    </td>
  );

  return (
    <tr
      className={`row-hover ${flashClass}`}
      onClick={() => onChart(contract)}
      style={{ borderBottom: "1px solid #0a1520", cursor: "pointer" }}
    >
      {cell(
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: "#c0d8f0", fontWeight: 600 }}>{contract.label}</span>
          {SIMULATED_IDS.has(contract.id) && (
            <span style={{ fontSize: 8, color: "#4a6a50", background: "rgba(34,100,60,0.18)", border: "1px solid #2a5a38", borderRadius: 2, padding: "0 3px", letterSpacing: 1 }}>SIM</span>
          )}
        </span>,
        "left"
      )}
      {cell(<span style={{ color: "#e8f4ff" }}>{fmtPrice(contract)}</span>)}
      {cell(<span style={{ color: "#8aadcc" }}>{fmtYield(contract)}</span>)}
      {cell(<span style={{ color: changeColor, fontWeight: 600 }}>{fmtChange(contract)}</span>)}
      <td style={{ padding: "5px 8px", minWidth: 200 }}>
        <RangeBar
          value={rangeValue(contract)}
          low={contract.low52}
          high={contract.high52}
        />
      </td>
      {showTrend && (
        <td style={{ padding: "3px 8px" }}>
          <Sparkline contractId={contract.id} positive={positive} onPrice={(closes) => {
            if (closes.length === 0) return;
            const last = closes[closes.length - 1];
            const prev = closes.length > 1 ? closes[closes.length - 2] : last;
            onPriceUpdate(contract.id, last, prev);
          }} />
        </td>
      )}
    </tr>
  );
}

// ─── ASSET GROUP ─────────────────────────────────────────────────────────────

import type { Group, Section } from "./data/instruments";

function AssetGroup({
  group,
  flashes,
  showTrend,
  lookback,
  onChart,
}: {
  group: Group;
  flashes: Record<string, "up" | "down">;
  showTrend: boolean;
  lookback: string;
  onChart: (c: Contract) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 1 }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 14px", background: "#0a1624", borderBottom: "1px solid #0d1c2c", cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ color: "#5a80a0", fontSize: 9, display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.18s" }}>▾</span>
        <span style={{ color: "#7aabcc", fontSize: 11, letterSpacing: 2 }}>{group.label}</span>
        <span style={{ color: "#2e5070", fontSize: 10, marginLeft: 3 }}>{group.currency}</span>
        <span style={{ marginLeft: "auto", color: "#2e5070", fontSize: 10 }}>{group.contracts.length} INSTR</span>
      </div>
      {open && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHeader lookback={lookback} showTrend={showTrend} />
          <tbody>
            {group.contracts.map(c => (
              <ContractRow key={c.id} contract={c} flash={flashes[c.id]} showTrend={showTrend} onChart={onChart} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── ASSET SECTION ────────────────────────────────────────────────────────────

function AssetSection({
  section,
  flashes,
  showTrend,
  lookback,
  onChart,
}: {
  section: Section;
  flashes: Record<string, "up" | "down">;
  showTrend: boolean;
  lookback: string;
  onChart: (c: Contract) => void;
}) {
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#070e18", borderBottom: "1px solid #0d1c2c" }}>
        <div style={{ width: 2, height: 13, background: "#22d3a5", borderRadius: 1, flexShrink: 0 }} />
        <span style={{ color: "#22d3a5", fontSize: 11, fontWeight: 700, letterSpacing: 3 }}>{section.label}</span>
      </div>
      {section.groups.map(g => (
        <AssetGroup key={g.id} group={g} flashes={flashes} showTrend={showTrend} lookback={lookback} onChart={onChart} />
      ))}
    </div>
  );
}

// ─── TICKER TAPE ─────────────────────────────────────────────────────────────

function TickerTape({ data }: { data: DataStore }) {
  const items: Contract[] = [];
  Object.values(data).forEach(s => s.groups.forEach(g => items.push(...g.contracts.slice(0, 2))));

  return (
    <div style={{ background: "#060d14", borderBottom: "1px solid #0d1c2c", height: 26, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", animation: "ticker 80s linear infinite", whiteSpace: "nowrap" }}>
        {[...items, ...items].map((c, i) => (
          <span key={i} style={{ marginRight: 36, fontFamily: "'Courier New', monospace", fontSize: 11 }}>
            <span style={{ color: "#5a80a0" }}>{c.label} </span>
            <span style={{ color: "#c8dff5" }}>{fmtPrice(c) !== "—" ? fmtPrice(c) : fmtYield(c)} </span>
            <span style={{ color: c.change >= 0 ? "#22d3a5" : "#f45b5b" }}>{fmtChange(c)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── CLOCKS ──────────────────────────────────────────────────────────────────

function Clocks() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tz = (zone: string) =>
    new Date(now.toLocaleString("en-US", { timeZone: zone })).toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      {[["LDN", "Europe/London"], ["NYC", "America/New_York"], ["TYO", "Asia/Tokyo"], ["UTC", "UTC"]].map(([label, zone]) => (
        <div key={zone} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: "#3a6080", fontSize: 9, letterSpacing: 1 }}>{label}</span>
          <span style={{ color: "#7aabcc", fontSize: 11, fontFamily: "'Courier New', monospace" }}>{tz(zone)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ROOT DASHBOARD ───────────────────────────────────────────────────────────

const TABS = [
  { id: "all",         label: "ALL" },
  { id: "rates",       label: "RATES" },
  { id: "govbonds",    label: "BONDS" },
  { id: "swaps",       label: "SWAPS" },
  { id: "equities",    label: "EQ" },
  { id: "fx",          label: "FX" },
  { id: "commodities", label: "CMDTY" },
  { id: "crypto",      label: "CRYPTO" },
  { id: "mag7",        label: "MAG 7" },
] as const;

type TabId = typeof TABS[number]["id"];
type Lookback = "1M" | "3M" | "6M";

export default function Dashboard() {
  const { data, flashes, dataSource } = useLivePrices(INITIAL_DATA);
  const [tab, setTab]           = useState<TabId>("all");
  const [lookback, setLookback] = useState<Lookback>("3M");
  const [showTrend, setTrend]   = useState(true);
  const [search, setSearch]     = useState("");
  const [chartTarget, setChart] = useState<Contract | null>(null);

  const totalInstruments = Object.values(INITIAL_DATA).flatMap(s => s.groups.flatMap(g => g.contracts)).length;

  const sections: Section[] = tab === "all"
    ? Object.values(data)
    : data[tab] ? [data[tab]] : [];

  const filtered = sections
    .map(s => ({
      ...s,
      groups: s.groups.map(g => ({
        ...g,
        contracts: search
          ? g.contracts.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()))
          : g.contracts,
      })).filter(g => g.contracts.length > 0),
    }))
    .filter(s => s.groups.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#060d16", overflow: "hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 16px", height: 44, background: "#070e18", borderBottom: "2px solid #0d1c2c", flexShrink: 0 }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 20, height: 20, background: "linear-gradient(135deg,#22d3a5 0%,#1a4a88 100%)", borderRadius: 4, flexShrink: 0 }} />
          <span style={{ color: "#22d3a5", fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>MACRO</span>
          <span style={{ color: "#4a7898", fontSize: 13, letterSpacing: 2 }}>TERMINAL</span>
        </div>

        <div style={{ width: 1, height: 22, background: "#0d1c2c" }} />
        <Clocks />
        <div style={{ flex: 1 }} />

        {/* search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="⌕  SEARCH..."
          style={{ background: "#0a1624", border: "1px solid #172438", borderRadius: 4, padding: "4px 10px", color: "#c8dff5", fontFamily: "'Courier New', monospace", fontSize: 11, width: 180, outline: "none" }}
        />

        {/* lookback */}
        <div style={{ display: "flex", gap: 3 }}>
          {(["1M", "3M", "6M"] as Lookback[]).map(l => (
            <button
              key={l}
              onClick={() => setLookback(l)}
              style={{ padding: "3px 8px", borderRadius: 3, border: `1px solid ${lookback === l ? "#22d3a5" : "#172438"}`, background: lookback === l ? "rgba(34,211,165,0.1)" : "transparent", color: lookback === l ? "#22d3a5" : "#5a80a0", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* trend toggle */}
        <button
          onClick={() => setTrend(p => !p)}
          style={{ padding: "3px 9px", borderRadius: 3, border: `1px solid ${showTrend ? "#22d3a5" : "#172438"}`, background: showTrend ? "rgba(34,211,165,0.08)" : "transparent", color: showTrend ? "#22d3a5" : "#5a80a0", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
        >
          TREND
        </button>

        {/* live pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: dataSource === "live" ? "#22d3a5" : "#f0a500",
            boxShadow: `0 0 7px ${dataSource === "live" ? "#22d3a5" : "#f0a500"}`,
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: dataSource === "live" ? "#22d3a5" : "#f0a500", fontSize: 10, letterSpacing: 1 }}>
            {dataSource === "live" ? "LIVE · 15m DELAY" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* ── TICKER TAPE ── */}
      <TickerTape data={data} />

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#070e18", borderBottom: "1px solid #0d1c2c", padding: "0 10px", flexShrink: 0, gap: 1 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: "7px 14px", border: "none", borderBottom: `2px solid ${tab === t.id ? "#22d3a5" : "transparent"}`, background: "transparent", color: tab === t.id ? "#22d3a5" : "#5a80a0", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", letterSpacing: 2, transition: "color 0.15s" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MAIN SCROLL AREA ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#2e5070", fontFamily: "'Courier New', monospace", fontSize: 13, letterSpacing: 2 }}>
            NO INSTRUMENTS MATCH
          </div>
        ) : (
          filtered.map((s, i) => (
            <AssetSection key={i} section={s} flashes={flashes} showTrend={showTrend} lookback={lookback} onChart={setChart} />
          ))
        )}
      </div>

      {/* ── STATUS BAR ── */}
      <div style={{ height: 22, background: "#060d14", borderTop: "1px solid #0d1c2c", display: "flex", alignItems: "center", padding: "0 14px", gap: 14, flexShrink: 0 }}>
        <span style={{ color: dataSource === "live" ? "#22d3a5" : "#f0a500", fontSize: 9, letterSpacing: 1 }}>
          {dataSource === "live" ? "● YAHOO FINANCE · 15 MIN DELAY" : "● CONNECTING TO YAHOO FINANCE..."}
        </span>
        <span style={{ color: "#0d1c2c" }}>|</span>
        <span style={{ color: "#2e5070", fontSize: 9 }}>SIM = SIMULATED (SWAPS · RATE FUTURES · TTF)</span>
        <span style={{ color: "#0d1c2c" }}>|</span>
        <span style={{ color: "#2e5070", fontSize: 9 }}>INSTRUMENTS: {totalInstruments}</span>
        <span style={{ color: "#0d1c2c" }}>|</span>
        <span style={{ color: "#2e5070", fontSize: 9 }}>CLICK ANY ROW TO CHART</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#2e5070", fontSize: 9 }}>MACRO TERMINAL · FOR INFORMATIONAL USE ONLY</span>
      </div>

      {/* ── CHART MODAL ── */}
      {chartTarget && <ChartModal contract={chartTarget} onClose={() => setChart(null)} />}
    </div>
  );
}
