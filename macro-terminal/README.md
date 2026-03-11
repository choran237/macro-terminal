# Macro Terminal

Institutional macro markets dashboard — mock data UI, ready for real feed integration.

## Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

### Option A — Vercel CLI (fastest)
```bash
npm install -g vercel
vercel
# Follow prompts → deployed in ~60s
```

### Option B — GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import repo
3. Framework: **Next.js** (auto-detected)
4. Build command: `next build` (default)
5. Output directory: `.next` (default)
6. Click Deploy

No environment variables needed for mock UI.

## Project Structure

```
macro-terminal/
├── app/
│   ├── data/
│   │   └── instruments.ts   ← all mock data, add instruments here
│   ├── lib/
│   │   └── format.ts        ← price/yield/change formatters
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx             ← full dashboard UI
├── package.json
└── next.config.js
```

## Adding Instruments

Edit `app/data/instruments.ts`. Each contract needs:
```ts
{
  id: "UNIQUE_ID",
  label: "DISPLAY LABEL",
  price: 99.88,          // null for swap/OTC instruments
  yield: 4.321,          // null for equities/FX/crypto/commodities
  change: -0.018,        // yield bp change OR pct for equity/crypto
  high52: 5.10,
  low52: 3.60,
  isYield: true,         // true → range bar uses yield, not price
}
```

## Next Steps (Real Data)

1. **Equities / Mag7 / Crypto** → Polygon.io WebSocket (`wss://socket.polygon.io`)
2. **FX** → dxFeed or OANDA v20 streaming
3. **Futures (SOFR/Euribor/SONIA)** → CME DataMine WebSocket
4. **Gov Bonds / Swaps** → Refinitiv Real-Time or Bloomberg SAPI
5. **Backend** → Node.js normalisation service → Redis pub/sub → Socket.io to client

See architecture doc for full system design.
