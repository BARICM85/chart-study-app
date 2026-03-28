import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CandlestickChart,
  ChartCandlestick,
  Crosshair,
  Gauge,
  LayoutPanelLeft,
  PencilLine,
  Plus,
  Radar,
  Search,
  Settings2,
  Shapes,
  TrendingUp,
} from 'lucide-react'
import { dispose, init } from 'klinecharts'

const WATCHLIST = [
  { symbol: 'MARUTI', name: 'Maruti Suzuki', price: 12389, change: -2.08 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2952, change: 0.84 },
  { symbol: 'TCS', name: 'Tata Consultancy', price: 4128, change: -0.52 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1684, change: 1.12 },
  { symbol: 'INFY', name: 'Infosys', price: 1738, change: -0.41 },
  { symbol: 'SBIN', name: 'State Bank of India', price: 804, change: 0.66 },
]

const INTERVALS = [
  { label: '1m', period: { type: 'minute', span: 1 } },
  { label: '5m', period: { type: 'minute', span: 5 } },
  { label: '15m', period: { type: 'minute', span: 15 } },
  { label: '1H', period: { type: 'hour', span: 1 } },
  { label: '4H', period: { type: 'hour', span: 4 } },
  { label: '1D', period: { type: 'day', span: 1 } },
  { label: '1W', period: { type: 'week', span: 1 } },
  { label: '1M', period: { type: 'month', span: 1 } },
]

const RANGE_BUTTONS = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL']

const TOOLS = [
  { label: 'Crosshair', icon: Crosshair, action: 'crosshair' },
  { label: 'Trend', icon: PencilLine, action: 'straightLine' },
  { label: 'Ray', icon: TrendingUp, action: 'rayLine' },
  { label: 'Horizontal', icon: Shapes, action: 'horizontalStraightLine' },
  { label: 'Price', icon: Gauge, action: 'priceLine' },
  { label: 'Note', icon: Bell, action: 'simpleAnnotation' },
]

function seedFromSymbol(symbol) {
  return [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function intervalToMs(period) {
  const base = {
    minute: 60_000,
    hour: 60 * 60_000,
    day: 24 * 60 * 60_000,
    week: 7 * 24 * 60 * 60_000,
    month: 30 * 24 * 60 * 60_000,
    year: 365 * 24 * 60 * 60_000,
  }
  return (base[period.type] || base.day) * period.span
}

function buildSeries(symbol, period, count = 320) {
  const seed = seedFromSymbol(symbol)
  const intervalMs = intervalToMs(period)
  const now = Date.now()
  const anchor = Math.floor(now / intervalMs) * intervalMs
  const base = 900 + ((seed % 700) * 5)
  let previousClose = base

  return Array.from({ length: count }, (_, index) => {
    const timestamp = anchor - ((count - index) * intervalMs)
    const drift = Math.sin((index + seed) / 18) * (base * 0.015)
    const wave = Math.cos((index + seed) / 7) * (base * 0.008)
    const open = previousClose
    const close = Math.max(10, open + drift + wave + (((seed % 13) - 6) * 0.12))
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
    }
  })
}

function buildNextBar(lastBar, symbol, period) {
  const seed = seedFromSymbol(symbol)
  const intervalMs = intervalToMs(period)
  const index = Math.floor(lastBar.timestamp / intervalMs)
  const drift = Math.sin((index + seed) / 11) * (lastBar.close * 0.006)
  const pulse = Math.cos((index + seed) / 5) * (lastBar.close * 0.0035)
  const open = lastBar.close
  const close = Math.max(10, open + drift + pulse)
  const high = Math.max(open, close) + Math.abs(Math.sin((seed + index) / 2.7) * (lastBar.close * 0.004))
  const low = Math.min(open, close) - Math.abs(Math.cos((seed + index) / 2.9) * (lastBar.close * 0.004))
  return {
    timestamp: lastBar.timestamp + intervalMs,
    open: Number(open.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    close: Number(close.toFixed(2)),
    volume: Math.round(lastBar.volume * (0.82 + ((seed % 19) / 25))),
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function StudyChart({ symbol, interval, selectedTool, onToolApplied }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const streamRef = useRef(null)
  const seriesCacheRef = useRef(new Map())

  const symbolInfo = useMemo(() => ({ ticker: symbol, pricePrecision: 2, volumePrecision: 0 }), [symbol])

  useEffect(() => {
    if (!containerRef.current) return undefined

    const chart = init(containerRef.current, {
      locale: 'en-US',
      timezone: 'Asia/Kolkata',
      zoomAnchor: 'last_bar',
      layout: [
        { type: 'candle', options: { id: 'main', dragEnabled: true } },
        { type: 'indicator', content: ['VOL'], options: { id: 'volume', height: 90, minHeight: 70 } },
        { type: 'indicator', content: ['MACD'], options: { id: 'macd', height: 120, minHeight: 90 } },
        { type: 'indicator', content: ['RSI'], options: { id: 'rsi', height: 110, minHeight: 90 } },
        { type: 'xAxis' },
      ],
      styles: {
        grid: {
          horizontal: { show: true, color: 'rgba(148,163,184,0.08)', style: 'solid', size: 1 },
          vertical: { show: true, color: 'rgba(148,163,184,0.05)', style: 'solid', size: 1 },
        },
        candle: {
          type: 'candle_stroke',
          bar: {
            upColor: '#18b26b',
            downColor: '#df4d5a',
            noChangeColor: '#94a3b8',
            upBorderColor: '#18b26b',
            downBorderColor: '#df4d5a',
            noChangeBorderColor: '#94a3b8',
            upWickColor: '#18b26b',
            downWickColor: '#df4d5a',
            noChangeWickColor: '#94a3b8',
          },
          priceMark: {
            last: {
              upColor: '#18b26b',
              downColor: '#df4d5a',
              noChangeColor: '#94a3b8',
            },
          },
        },
        indicator: {
          lines: [
            { color: '#22c55e', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
            { color: '#60a5fa', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
            { color: '#ef4444', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
            { color: '#f59e0b', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
          ],
        },
        xAxis: {
          axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 },
          tickText: { show: true, color: '#94a3b8', size: 11, weight: 500, family: 'Inter, sans-serif', marginStart: 8, marginEnd: 8 },
        },
        yAxis: {
          axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 },
          tickText: { show: true, color: '#e2e8f0', size: 11, weight: 600, family: 'IBM Plex Mono, ui-monospace, monospace', marginStart: 8, marginEnd: 8 },
        },
        separator: {
          size: 1,
          color: 'rgba(148,163,184,0.08)',
          fill: true,
          activeBackgroundColor: 'rgba(148,163,184,0.06)',
        },
        crosshair: {
          horizontal: {
            line: { show: true, color: 'rgba(226,232,240,0.28)', style: 'dashed', size: 1, dashedValue: [4, 4] },
            text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' },
            features: [],
          },
          vertical: {
            line: { show: true, color: 'rgba(226,232,240,0.18)', style: 'dashed', size: 1, dashedValue: [4, 4] },
            text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' },
          },
        },
        overlay: {
          line: { style: 'solid', size: 2, color: '#38bdf8', dashedValue: [0], smooth: false },
          rect: { style: 'stroke', color: 'rgba(56,189,248,0.08)', borderColor: '#38bdf8', borderSize: 1, borderStyle: 'solid', borderDashedValue: [0], borderRadius: 4 },
          polygon: { style: 'stroke', color: 'rgba(56,189,248,0.08)', borderColor: '#38bdf8', borderSize: 1, borderStyle: 'solid', borderDashedValue: [0] },
          text: { color: '#e2e8f0', size: 12, family: 'Inter, sans-serif', weight: 600, borderStyle: 'solid', borderDashedValue: [0], borderSize: 1, borderColor: 'rgba(148,163,184,0.16)', borderRadius: 6, backgroundColor: 'rgba(15,23,42,0.92)', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, style: 'fill' },
        },
      },
    })

    chartRef.current = chart

    chart.setDataLoader({
      getBars: ({ symbol: nextSymbol, period, callback }) => {
        const key = `${nextSymbol.ticker}-${period.type}-${period.span}`
        const existing = seriesCacheRef.current.get(key)
        const data = existing || buildSeries(nextSymbol.ticker, period)
        seriesCacheRef.current.set(key, data)
        callback(data, false)
      },
      subscribeBar: ({ symbol: nextSymbol, period, callback }) => {
        const key = `${nextSymbol.ticker}-${period.type}-${period.span}`
        const stream = window.setInterval(() => {
          const current = seriesCacheRef.current.get(key) || buildSeries(nextSymbol.ticker, period)
          const nextBar = buildNextBar(current[current.length - 1], nextSymbol.ticker, period)
          const updated = [...current.slice(-319), nextBar]
          seriesCacheRef.current.set(key, updated)
          callback(nextBar)
        }, 5000)
        streamRef.current = stream
      },
      unsubscribeBar: () => {
        if (streamRef.current) {
          window.clearInterval(streamRef.current)
          streamRef.current = null
        }
      },
    })

    chart.setSymbol(symbolInfo)
    chart.setPeriod(interval.period)
    chart.createIndicator({ name: 'MA', calcParams: [20, 50, 200] })
    chart.createIndicator({ name: 'EMA', calcParams: [9, 21] })
    chart.createIndicator('BOLL')

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (streamRef.current) {
        window.clearInterval(streamRef.current)
        streamRef.current = null
      }
      if (chartRef.current) {
        dispose(chartRef.current)
        chartRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setSymbol(symbolInfo)
  }, [symbolInfo])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setPeriod(interval.period)
    chartRef.current.scrollToRealTime()
  }, [interval])

  useEffect(() => {
    if (!chartRef.current || !selectedTool || selectedTool === 'crosshair') return
    chartRef.current.createOverlay(selectedTool)
    onToolApplied?.(selectedTool)
  }, [selectedTool, onToolApplied])

  return <div ref={containerRef} className="chart-canvas" />
}

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState(WATCHLIST[0])
  const [interval, setInterval] = useState(INTERVALS[5])
  const [selectedTool, setSelectedTool] = useState('crosshair')
  const [searchValue, setSearchValue] = useState(WATCHLIST[0].symbol)

  const headerStats = useMemo(() => {
    const base = selectedSymbol.price
    const change = selectedSymbol.change
    return {
      last: base,
      change,
      open: base * 1.006,
      high: base * 1.017,
      low: base * 0.992,
      close: base,
    }
  }, [selectedSymbol])

  const studies = ['MA 20/50/200', 'EMA 9/21', 'Bollinger', 'MACD', 'RSI', 'Volume']

  return (
    <div className="study-app-shell">
      <header className="top-shell">
        <div className="brand-strip">
          <div className="brand-mark"><ChartCandlestick size={18} /></div>
          <div>
            <p className="eyebrow">ChartStudy Prototyping Desk</p>
            <h1>Independent Chart Analysis Workspace</h1>
          </div>
        </div>
        <div className="header-actions">
          <button className="ghost-btn"><Settings2 size={16} /> Layout</button>
          <button className="primary-btn"><Plus size={16} /> Zerodha adapter next</button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="left-rail">
          {TOOLS.map((tool) => {
            const Icon = tool.icon
            const active = selectedTool === tool.action || (tool.action === 'crosshair' && selectedTool === 'crosshair')
            return (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                className={`rail-button ${active ? 'active' : ''}`}
                onClick={() => setSelectedTool(tool.action)}
              >
                <Icon size={18} />
              </button>
            )
          })}
        </aside>

        <main className="chart-workspace">
          <section className="workspace-toolbar">
            <div className="toolbar-row">
              <div className="symbol-box">
                <Search size={16} />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      const found = WATCHLIST.find((item) => item.symbol === searchValue.toUpperCase())
                      if (found) setSelectedSymbol(found)
                    }
                  }}
                  placeholder="Search symbol"
                />
              </div>
              <button className="chip">NSE</button>
              <div className="chip-group compact">
                {INTERVALS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`chip ${interval.label === item.label ? 'selected' : ''}`}
                    onClick={() => setInterval(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-row secondary">
              <div className="stats-line">
                <span className="symbol-title">{selectedSymbol.symbol}</span>
                <span>O {formatPrice(headerStats.open)}</span>
                <span>H {formatPrice(headerStats.high)}</span>
                <span>L {formatPrice(headerStats.low)}</span>
                <span>C {formatPrice(headerStats.close)}</span>
                <span className={headerStats.change >= 0 ? 'up' : 'down'}>
                  {headerStats.change >= 0 ? '+' : ''}{headerStats.change.toFixed(2)}%
                </span>
              </div>
              <div className="chip-group">
                {RANGE_BUTTONS.map((range) => (
                  <button key={range} type="button" className="chip subtle">{range}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="chart-card">
            <StudyChart symbol={selectedSymbol.symbol} interval={interval} selectedTool={selectedTool} onToolApplied={setSelectedTool} />
          </section>

          <section className="study-footer">
            <div className="footer-block">
              <p className="footer-label">Built-in studies</p>
              <div className="study-tags">
                {studies.map((study) => <span key={study}>{study}</span>)}
              </div>
            </div>
            <div className="footer-block">
              <p className="footer-label">Drawing overlays</p>
              <div className="study-tags muted">
                <span>Straight line</span>
                <span>Ray line</span>
                <span>Horizontal line</span>
                <span>Price line</span>
                <span>Annotation</span>
              </div>
            </div>
          </section>
        </main>

        <aside className="right-panel">
          <section className="panel-card focus-card">
            <div className="panel-title-row">
              <h2>{selectedSymbol.symbol}</h2>
              <span className="pill">Mock live feed</span>
            </div>
            <p className="company-name">{selectedSymbol.name}</p>
            <p className="price-print">{formatPrice(selectedSymbol.price)} <span>INR</span></p>
            <p className={`move-print ${selectedSymbol.change >= 0 ? 'up' : 'down'}`}>
              {selectedSymbol.change >= 0 ? '+' : ''}{selectedSymbol.change.toFixed(2)}%
            </p>
          </section>

          <section className="panel-card">
            <div className="panel-title-row">
              <h3>Watchlist</h3>
              <button className="icon-btn"><LayoutPanelLeft size={16} /></button>
            </div>
            <div className="watchlist">
              {WATCHLIST.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className={`watch-row ${selectedSymbol.symbol === item.symbol ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSymbol(item)
                    setSearchValue(item.symbol)
                  }}
                >
                  <div>
                    <p>{item.symbol}</p>
                    <span>{item.name}</span>
                  </div>
                  <div className="watch-metrics">
                    <strong>{formatPrice(item.price)}</strong>
                    <span className={item.change >= 0 ? 'up' : 'down'}>
                      {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-title-row">
              <h3>Study stack</h3>
              <button className="icon-btn"><Radar size={16} /></button>
            </div>
            <ul className="study-list">
              <li>KLineChart engine</li>
              <li>Candles with built-in MA, EMA, BOLL</li>
              <li>Separate VOL, MACD, RSI panes</li>
              <li>Overlay tools via built-in shapes</li>
              <li>Dark trading desk theme ready for broker data</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default App
