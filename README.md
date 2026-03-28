# Chart Study App

Independent chart-analysis workspace built with React, Vite, and KLineChart.

## What is included

- dark trading-style chart workspace
- KLineChart candlestick engine
- built-in studies: MA, EMA, Bollinger, MACD, RSI, Volume
- overlay tools: trend line, ray, horizontal line, price line, annotation
- symbol search suggestions and watchlist panel
- live-ready market history and quote service layer

## Local development

1. Start your backend on port `8000`.
2. Run:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` by default.

If your local backend is on a different port, set:

```bash
VITE_DEV_PROXY_TARGET=http://localhost:9000
```

## Production / Vercel

This repo is ready for Vercel.

Recommended environment variable:

```bash
VITE_API_BASE_URL=https://tickertap-backend-88ts.onrender.com
```

If `VITE_API_BASE_URL` is not provided, production falls back to:

```text
https://tickertap-backend-88ts.onrender.com
```

## API endpoints expected

- `/api/market/quote?symbol=...`
- `/api/market/history?symbol=...&range=...&interval=...`

## Next steps

- connect to live Zerodha instrument universe
- persist watchlists and layouts
- add broker session badge and reconnect flow
- add option-chain workspace tab
