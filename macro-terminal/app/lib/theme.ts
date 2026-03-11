// ── MACRO TERMINAL COLOUR THEME ──────────────────────────────────────────────
// Edit these values to restyle the entire dashboard.

export const T = {
  // ── Backgrounds ────────────────────────────────────────────────────────────
  bgPage:     "#04090f",   // outermost page background
  bgPanel:    "#070d17",   // section / panel background
  bgRow:      "#090f1a",   // table row default
  bgRowHover: "#0d1829",   // table row hover

  // ── Borders ────────────────────────────────────────────────────────────────
  borderDim:  "#0e1e30",
  borderMid:  "#172438",

  // ── Accent (green / teal) ─────────────────────────────────────────────────
  green:      "#22d3a5",   // live data, positive, highlights
  red:        "#f45b5b",   // negative changes
  amber:      "#f0a500",   // simulated / connecting

  // ── Text – primary (data values) ──────────────────────────────────────────
  textBright:  "#e8f4ff",  // primary price / data values  ← was too dark
  textPrimary: "#c8dff5",  // instrument names
  textSecond:  "#8aadcc",  // yield column, secondary values
  textMuted:   "#5a80a0",  // labels, headers, units
  textDim:     "#2e5070",  // very secondary labels (52w labels etc.)
  textInvis:   "#162840",  // separators, near-invisible

  // ── Table headers ─────────────────────────────────────────────────────────
  thText:     "#3a6080",
  thBg:       "#060c16",

  // ── Group / section labels ────────────────────────────────────────────────
  sectionLabel: "#22d3a5",
  groupLabel:   "#7aabcc",
  groupMeta:    "#2a5070",

  // ── Range bar ─────────────────────────────────────────────────────────────
  rangeLo:  "#3a6888",
  rangeHi:  "#3a6888",
  rangePct: "#4a7898",

  // ── Footer / status ───────────────────────────────────────────────────────
  footerText: "#2e5070",
  footerSep:  "#0d1c2c",
} as const;
