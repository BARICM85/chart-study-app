const ONLINE_API_BASE = 'https://tickertap-backend-88ts.onrender.com'
const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : ONLINE_API_BASE)

const SYMBOL_CATALOG = [
  { symbol: 'MARUTI', name: 'Maruti Suzuki India' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'LT', name: 'Larsen & Toubro' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'ITC', name: 'ITC' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma' },
]

export const RANGE_TO_LOOKBACK = {
  '1D': '1d',
  '5D': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  YTD: 'ytd',
  '1Y': '1y',
  ALL: 'all',
}

export const INTERVAL_TO_API = {
  '1m': '1minute',
  '5m': '5minute',
  '15m': '15minute',
  '1H': '60minute',
  '4H': '3hour',
  '1D': 'day',
  '1W': 'week',
  '1M': 'month',
}

function trimSlash(value = '') {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function apiUrl(path) {
  const base = trimSlash(DEFAULT_API_BASE)
  return base ? `${base}${path}` : path
}

function seedFromSymbol(symbol) {
  return [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function intervalToMs(interval) {
  const intervals = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '1H': 60 * 60_000,
    '4H': 4 * 60 * 60_000,
    '1D': 24 * 60 * 60_000,
    '1W': 7 * 24 * 60 * 60_000,
    '1M': 30 * 24 * 60 * 60_000,
  }
  return intervals[interval] || intervals['1D']
}

function fallbackSeries(symbol, interval = '1D', count = 320) {
  const seed = seedFromSymbol(symbol)
  const spacing = intervalToMs(interval)
  const now = Date.now()
  const anchor = Math.floor(now / spacing) * spacing
  const base = 900 + ((seed % 700) * 5)
  let previousClose = base

  return Array.from({ length: count }, (_, index) => {
    const timestamp = anchor - ((count - index) * spacing)
    const trend = Math.sin((index + seed) / 18) * (base * 0.014)
    const wave = Math.cos((index + seed) / 7) * (base * 0.008)
    const open = previousClose
    const close = Math.max(10, open + trend + wave + (((seed % 13) - 6) * 0.12))
    const high = Math.max(open, close) + Math.abs(Math.sin((seed + index) / 3.8) * (base * 0.01))
    const low = Math.min(open, close) - Math.abs(Math.cos((seed + index) / 4.1) * (base * 0.01))
    const volume = Math.round(120000 + ((seed * (index + 11)) % 650000))
    previousClose = close
    return {
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      source: 'fallback',
    }
  })
}

async function requestJson(path) {
  const response = await fetch(apiUrl(path))
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || 'Market request failed')
  }
  return data
}

function normalizeHistory(payload = {}) {
  const points = Array.isArray(payload?.points)
    ? payload.points
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return points
    .map((point) => ({
      timestamp: Number(point.timestamp || point.date || point.time || 0),
      open: Number(point.open),
      high: Number(point.high),
      low: Number(point.low),
      close: Number(point.close),
      volume: Number(point.volume || 0),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.open) && Number.isFinite(point.close))
}

export async function fetchBrokerStatus() {
  try {
    const payload = await requestJson('/api/zerodha/status')
    return {
      connected: Boolean(payload?.connected),
      configured: Boolean(payload?.configured),
      source: 'backend',
    }
  } catch {
    return {
      connected: false,
      configured: false,
      source: 'unavailable',
    }
  }
}

export async function fetchMarketHistory(symbol, range = 'YTD', interval = '1D') {
  try {
    const payload = await requestJson(`/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(RANGE_TO_LOOKBACK[range] || 'ytd')}&interval=${encodeURIComponent(INTERVAL_TO_API[interval] || 'day')}`)
    const points = normalizeHistory(payload)
    if (!points.length) throw new Error('No history points returned')
    return { source: payload?.source || 'live', points }
  } catch {
    return { source: 'fallback', points: fallbackSeries(symbol, interval) }
  }
}

export async function fetchMarketQuote(symbol) {
  try {
    const payload = await requestJson(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)
    return {
      symbol,
      price: Number(payload?.price || payload?.last_price || 0),
      changePercent: Number(payload?.changePercent || payload?.day_change_percent || 0),
      source: payload?.source || 'live',
    }
  } catch {
    const series = fallbackSeries(symbol, '1D', 4)
    const last = series[series.length - 1]
    const prev = series[series.length - 2] || last
    return {
      symbol,
      price: last.close,
      changePercent: ((last.close - prev.close) / prev.close) * 100,
      source: 'fallback',
    }
  }
}

export function searchSymbols(query) {
  const term = query.trim().toUpperCase()
  if (!term) return SYMBOL_CATALOG.slice(0, 8)
  return SYMBOL_CATALOG.filter((item) => item.symbol.includes(term) || item.name.toUpperCase().includes(term)).slice(0, 8)
}

export function mergeWatchlistQuotes(watchlist, quotesBySymbol) {
  return watchlist.map((item) => {
    const quote = quotesBySymbol[item.symbol]
    return {
      ...item,
      price: quote?.price ?? item.price,
      change: quote?.changePercent ?? item.change,
      source: quote?.source ?? item.source ?? 'fallback',
    }
  })
}
