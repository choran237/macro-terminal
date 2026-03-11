"use client";

import { useState, useEffect, useRef } from "react";
import INITIAL_DATA, { Contract, DataStore } from "./data/instruments";
import { SIMULATED_IDS } from "./data/symbols";
import { fmtPrice, fmtYield, fmtChange, rangeValue } from "./lib/format";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ─── YAHOO POLLING HOOK ───────────────────────────────────────────────────────
// Polls /api/prices every 60 s. Merges real data into the data store.
// Instruments not covered by Yahoo keep their previous value and get a
// lightweight random simulation so the UI never looks frozen.

function useLivePrices(initial: DataStore) {
  const [data, setData]     = useState<DataStore>(deepClone(initial));
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const [dataSource, setDataSource] = useState<"sim" | "live">("sim");
  const prevPrices = useRef<Record<string, number>>({});

  // ── 1. Poll Yahoo every 60 s ──────────────────────────────────────────────
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/prices");
        if (!res.ok) return;
        const yahoo: Record<string, {
          price: number | null;
          yield: number | null;
          change: number;
          changeAbs: number | null;
          high52: number;
          low52: number;
          simulated: boolean;
        }> = await res.json();

        const newFlashes: Record<string, "up" | "down"> = {};

        setData(prev => {
          const next = deepClone(prev);
          Object.values(next).forEach(section => {
            section.groups.forEach(group => {
              group.contracts.forEach((c: Contract) => {
                const live = yahoo[c.id];
                if (!live || live.simulated) return;

                // Detect direction vs previous fetch
                const key = c.id;
                const prevVal = prevPrices.current[key];
                const newVal = live.price ?? live.yield ?? 0;
                if (prevVal !== undefined && newVal !== prevVal) {
                  newFlashes[key] = newVal > prevVal ? "up" : "down";
                }
                prevPrices.current[key] = newVal;

                // Merge live data in
                if (live.price  !== null) c.price  = live.price;
                if (live.yield  !== null) c.yield  = live.yield;
                c.change    = live.change;
                c.high52    = live.high52;
                c.low52     = live.low52;
                if (live.changeAbs !== null) c.changeAbs = live.changeAbs;
              });
            });
          });
          return next;
        });

        setFlashes(newFlashes);
        setTimeout(() => setFlashes({}), 600);
        setDataSource("live");
      } catch (e) {
        console.warn("Price poll failed, staying on last data", e);
      }
    }

    poll(); // immediate on mount
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── 2. Simulate tick movement for SIM-only instruments ────────────────────
  // Runs every 1.5 s but only touches instruments NOT covered by Yahoo
  useEffect(() => {
    const id = setInterval(() => {
      const simFlashes: Record<string, "up" | "down"> = {};
      setData(prev => {
        const next = deepClone(prev);
        Object.values(next).forEach(section => {
          section.groups.forEach(group => {
            group.contracts.forEach((c: Contract) => {
              if (!SIMULATED_IDS.has(c.id)) return; // skip live instruments
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
                c.price = parseFloat(((c.price ?? 0) + dir * Math.random() * 0.06).toFixed(3));
                c.change += dir * 0.04;
              } else {
                // rates / bonds / swaps
                const delta = dir * Math.random() * 0.002;
                if (c.yield !== null) { c.yield = parseFloat((c.yield + delta).toFixed(3)); c.change += delta; }
                if (c.price !== null) { c.price = parseFloat((c.price - delta * 8).toFixed(4)); }
              }
              simFlashes[c.id] = dir > 0 ? "up" : "down";
            });
          });
        });
        return next;
      });
      // merge sim flashes without wiping live flashes
      setFlashes(prev => ({ ...prev, ...simFlashes }));
      setTimeout(() => setFlashes({}), 550);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return { data, flashes, dataSource };
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────

// Global sparkline cache so we don't re-fetch on every render
const sparklineCache: Record<string, number[]> = {};
const pendingFetches = new Set<string>();

function Sparkline({ contractId, positive }: { contractId: string; positive: boolean }) {
  const [pts, setPts] = useState<number[]>(sparklineCache[contractId] ?? []);

  useEffect(() => {
    if (sparklineCache[contractId]) { setPts(sparklineCache[contractId]); return; }
    if (pendingFetches.has(contractId)) return;
    pendingFetches.add(contractId);
    fetch(`/api/sparklines?ids=${contractId}`)
      .then(r => r.json())
      .then(d => {
        const closes: number[] = d[contractId] ?? [];
        sparklineCache[contractId] = closes;
        setPts(closes);
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
      <span style={{ fontSize: 10, color: "#3d5a78", fontFamily: "monospace", width: 42, textAlign: "right" }}>{loLbl}</span>
      <div style={{ flex: 1, height: 3, background: "#0e1e30", borderRadius: 2, position: "relative", minWidth: 56 }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "linear-gradient(90deg,#1a3d6e,#22d3a5)", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: -2, left: `${pct}%`, width: 1.5, height: 7, background: "#e8f0f8", borderRadius: 1, transform: "translateX(-50%)" }} />
      </div>
      <span style={{ fontSize: 10, color: "#3d5a78", fontFamily: "monospace", width: 42 }}>{hiLbl}</span>
      <span style={{ fontSize: 10, color: "#5a7a9e", fontFamily: "monospace", width: 28, textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── CHART MODAL ─────────────────────────────────────────────────────────────

type ChartMode = "3d" | "30d" | "6m";
interface ChartPoint { t: number; o: number; h: number; l: number; c: number; v: number; }

function drawChart(canvas: HTMLCanvasElement, points: ChartPoint[], simulated: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (points.length === 0) {
    ctx.fillStyle = "#3d5a78";
    ctx.font = "12px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(simulated ? "SIMULATED — NO REAL DATA FOR THIS INSTRUMENT" : "NO DATA AVAILABLE", W / 2, H / 2);
    return;
  }

  const closes = points.map(p => p.c);
  const minV = Math.min(...closes), maxV = Math.max(...closes);
  const pad = { t: 18, b: 36, l: 62, r: 14 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  // Grid lines + Y labels
  ctx.strokeStyle = "#0e1e2e";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + (i / 5) * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    const val = maxV - (i / 5) * (maxV - minV);
    ctx.fillStyle = "#3d5a78";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillText(val < 10 ? val.toFixed(3) : val.toFixed(2), pad.l - 5, y + 3.5);
  }

  // X axis labels
  const xCount = Math.min(4, points.length);
  for (let i = 0; i < xCount; i++) {
    const idx = Math.floor((i / (xCount - 1)) * (points.length - 1));
    const x = pad.l + (idx / (points.length - 1)) * cW;
    const d = new Date(points[idx].t);
    const lbl = `${d.getDate()}/${d.getMonth() + 1}`;
    ctx.fillStyle = "#3d5a78";
    ctx.font = "10px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(lbl, x, H - 6);
  }

  const toY = (v: number) => pad.t + (1 - (v - minV) / (maxV - minV || 1)) * cH;
  const toX = (i: number) => pad.l + (i / (points.length - 1)) * cW;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, "rgba(34,211,165,0.15)");
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
  const [mode, setMode] = useState<ChartMode>("30d");
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
    drawChart(canvasRef.current, points, simulated);
  }, [points, simulated, loading]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,5,12,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#090f1a", border: "1px solid #172438", borderRadius: 8, padding: "20px 24px", width: 700, maxWidth: "94vw" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ color: "#22d3a5", fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>{contract.label}</span>
            <span style={{ color: "#2e4a6a", fontSize: 11 }}>{contract.id}</span>
            {simulated && <span style={{ color: "#f0a500", fontSize: 10, border: "1px solid #f0a500", borderRadius: 2, padding: "1px 5px" }}>SIM</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["3d", "30d", "6m"] as ChartMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: "3px 10px", borderRadius: 3, border: `1px solid ${mode === m ? "#22d3a5" : "#172438"}`, background: mode === m ? "rgba(34,211,165,0.1)" : "transparent", color: mode === m ? "#22d3a5" : "#3d5a78", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
                {m.toUpperCase()}
              </button>
            ))}
            <button onClick={onClose} style={{ padding: "3px 10px", borderRadius: 3, border: "1px solid #172438", background: "transparent", color: "#3d5a78", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>✕</button>
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
              <div style={{ color: "#2e4a6a", fontSize: 9, letterSpacing: 1, marginBottom: 3 }}>{k}</div>
              <div style={{ color: k === "SOURCE" ? (simulated ? "#f0a500" : "#22d3a5") : "#c8d8e8", fontSize: 12, fontFamily: "'Courier New', monospace" }}>{v}</div>
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
        color: "#253a52",
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
          <span style={{ color: "#a8c4de", fontWeight: 600 }}>{contract.label}</span>
          {SIMULATED_IDS.has(contract.id) && (
            <span style={{ fontSize: 8, color: "#4a6a50", background: "rgba(34,100,60,0.18)", border: "1px solid #2a5a38", borderRadius: 2, padding: "0 3px", letterSpacing: 1 }}>SIM</span>
          )}
        </span>,
        "left"
      )}
      {cell(<span style={{ color: "#d8e8f4" }}>{fmtPrice(contract)}</span>)}
      {cell(<span style={{ color: "#8aaac8" }}>{fmtYield(contract)}</span>)}
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
          <Sparkline contractId={contract.id} positive={positive} />
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
        <span style={{ color: "#3d5a78", fontSize: 9, display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.18s" }}>▾</span>
        <span style={{ color: "#6a8aaa", fontSize: 11, letterSpacing: 2 }}>{group.label}</span>
        <span style={{ color: "#1e3448", fontSize: 10, marginLeft: 3 }}>{group.currency}</span>
        <span style={{ marginLeft: "auto", color: "#1e3448", fontSize: 10 }}>{group.contracts.length} INSTR</span>
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
            <span style={{ color: "#3d5a78" }}>{c.label} </span>
            <span style={{ color: "#b8cce0" }}>{fmtPrice(c) !== "—" ? fmtPrice(c) : fmtYield(c)} </span>
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
          <span style={{ color: "#253a52", fontSize: 9, letterSpacing: 1 }}>{label}</span>
          <span style={{ color: "#6a8aaa", fontSize: 11, fontFamily: "'Courier New', monospace" }}>{tz(zone)}</span>
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
          <span style={{ color: "#1e3a5a", fontSize: 13, letterSpacing: 2 }}>TERMINAL</span>
        </div>

        <div style={{ width: 1, height: 22, background: "#0d1c2c" }} />
        <Clocks />
        <div style={{ flex: 1 }} />

        {/* search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="⌕  SEARCH..."
          style={{ background: "#0a1624", border: "1px solid #172438", borderRadius: 4, padding: "4px 10px", color: "#c8d8e8", fontFamily: "'Courier New', monospace", fontSize: 11, width: 180, outline: "none" }}
        />

        {/* lookback */}
        <div style={{ display: "flex", gap: 3 }}>
          {(["1M", "3M", "6M"] as Lookback[]).map(l => (
            <button
              key={l}
              onClick={() => setLookback(l)}
              style={{ padding: "3px 8px", borderRadius: 3, border: `1px solid ${lookback === l ? "#22d3a5" : "#172438"}`, background: lookback === l ? "rgba(34,211,165,0.1)" : "transparent", color: lookback === l ? "#22d3a5" : "#3d5a78", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* trend toggle */}
        <button
          onClick={() => setTrend(p => !p)}
          style={{ padding: "3px 9px", borderRadius: 3, border: `1px solid ${showTrend ? "#22d3a5" : "#172438"}`, background: showTrend ? "rgba(34,211,165,0.08)" : "transparent", color: showTrend ? "#22d3a5" : "#3d5a78", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
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
            style={{ padding: "7px 14px", border: "none", borderBottom: `2px solid ${tab === t.id ? "#22d3a5" : "transparent"}`, background: "transparent", color: tab === t.id ? "#22d3a5" : "#3d5a78", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", letterSpacing: 2, transition: "color 0.15s" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MAIN SCROLL AREA ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#1e3448", fontFamily: "'Courier New', monospace", fontSize: 13, letterSpacing: 2 }}>
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
        <span style={{ color: "#1e3448", fontSize: 9 }}>SIM = SIMULATED (SWAPS · RATE FUTURES · TTF)</span>
        <span style={{ color: "#0d1c2c" }}>|</span>
        <span style={{ color: "#1e3448", fontSize: 9 }}>INSTRUMENTS: {totalInstruments}</span>
        <span style={{ color: "#0d1c2c" }}>|</span>
        <span style={{ color: "#1e3448", fontSize: 9 }}>CLICK ANY ROW TO CHART</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#1a2e44", fontSize: 9 }}>MACRO TERMINAL · FOR INFORMATIONAL USE ONLY</span>
      </div>

      {/* ── CHART MODAL ── */}
      {chartTarget && <ChartModal contract={chartTarget} onClose={() => setChart(null)} />}
    </div>
  );
}
