import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  ChartCandlestick,
  Crosshair,
  Gauge,
  Maximize2,
  Minimize2,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Shapes,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { dispose, init } from 'klinecharts'
import { fetchBrokerStatus, fetchMarketHistory, fetchMarketQuote, mergeWatchlistQuotes, searchSymbols } from './lib/marketApi'

const INITIAL_WATCHLIST = [
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', exchange: 'NSE' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
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
const CHART_TYPES = [
  { label: 'Candles', value: 'candle_stroke' },
  { label: 'Solid', value: 'candle_solid' },
  { label: 'OHLC', value: 'ohlc' },
]

const TOOLS = [
  { label: 'Crosshair', icon: Crosshair, action: 'crosshair' },
  { label: 'Trend', icon: PencilLine, action: 'straightLine' },
  { label: 'Ray', icon: TrendingUp, action: 'rayLine' },
  { label: 'Horizontal', icon: Shapes, action: 'horizontalStraightLine' },
  { label: 'Price', icon: Gauge, action: 'priceLine' },
  { label: 'Note', icon: Bell, action: 'simpleAnnotation' },
]

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)
}

function sourceLabel(source) {
  if (source === 'fallback') return 'Fallback feed'
  if (source === 'zerodha') return 'Zerodha live'
  if (source === 'yahoo') return 'Market fallback'
  return 'Live market'
}

function StudyChart({ symbol, interval, range, selectedTool, onToolApplied, onSeriesMeta, chartType, macdVisible, rsiVisible, clearDrawingsVersion }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const streamRef = useRef(null)
  const symbolRef = useRef(symbol)
  const intervalRef = useRef(interval)
  const rangeRef = useRef(range)
  const latestSeriesRef = useRef([])
  const symbolInfo = useMemo(() => ({ ticker: symbol, pricePrecision: 2, volumePrecision: 0 }), [symbol])

  useEffect(() => { symbolRef.current = symbol }, [symbol])
  useEffect(() => { intervalRef.current = interval }, [interval])
  useEffect(() => { rangeRef.current = range }, [range])

  useEffect(() => {
    if (!containerRef.current) return undefined

    const chart = init(containerRef.current, {
      locale: 'en-US',
      timezone: 'Asia/Kolkata',
      zoomAnchor: 'last_bar',
      layout: [
        { type: 'candle', options: { id: 'main', dragEnabled: true } },
        { type: 'indicator', options: { id: 'volume', height: 82, minHeight: 64 } },
        { type: 'indicator', options: { id: 'macd', height: 110, minHeight: 82 } },
        { type: 'indicator', options: { id: 'rsi', height: 92, minHeight: 74 } },
        { type: 'xAxis' },
      ],
      styles: {
        grid: {
          horizontal: { show: true, color: 'rgba(148,163,184,0.08)', style: 'solid', size: 1 },
          vertical: { show: true, color: 'rgba(148,163,184,0.05)', style: 'solid', size: 1 },
        },
        candle: {
          type: chartType,
          bar: {
            upColor: '#19c37d',
            downColor: '#ef4444',
            noChangeColor: '#94a3b8',
            upBorderColor: '#19c37d',
            downBorderColor: '#ef4444',
            noChangeBorderColor: '#94a3b8',
            upWickColor: '#19c37d',
            downWickColor: '#ef4444',
            noChangeWickColor: '#94a3b8',
          },
          priceMark: { last: { upColor: '#19c37d', downColor: '#ef4444', noChangeColor: '#94a3b8' } },
        },
        indicator: {
          lines: [
            { color: '#22c55e', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
            { color: '#60a5fa', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
            { color: '#ef4444', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
          ],
        },
        xAxis: { axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 }, tickText: { show: true, color: '#94a3b8', size: 11, weight: 500, family: 'Inter, sans-serif' } },
        yAxis: { axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 }, tickText: { show: true, color: '#f8fafc', size: 11, weight: 700, family: 'IBM Plex Mono, ui-monospace, monospace', marginStart: 8, marginEnd: 8 } },
        separator: { size: 1, color: 'rgba(148,163,184,0.08)', fill: true, activeBackgroundColor: 'rgba(148,163,184,0.06)' },
        crosshair: {
          horizontal: { line: { show: true, color: 'rgba(226,232,240,0.26)', style: 'dashed', size: 1, dashedValue: [4, 4] }, text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' }, features: [] },
          vertical: { line: { show: true, color: 'rgba(226,232,240,0.18)', style: 'dashed', size: 1, dashedValue: [4, 4] }, text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' } },
        },
      },
    })

    chartRef.current = chart
    chart.setDataLoader({
      getBars: async ({ callback }) => {
        const payload = await fetchMarketHistory(symbolRef.current, rangeRef.current, intervalRef.current.label)
        latestSeriesRef.current = payload.points
        callback(payload.points, false)
        onSeriesMeta?.({
          source: payload.source,
          bars: payload.points.length,
          lastBar: payload.points[payload.points.length - 1] || null,
        })
      },
      subscribeBar: ({ callback }) => {
        const stream = window.setInterval(async () => {
          const quote = await fetchMarketQuote(symbolRef.current)
          const current = latestSeriesRef.current
          if (!current.length) return
          const lastBar = current[current.length - 1]
          const updatedBar = {
            ...lastBar,
            high: Math.max(lastBar.high, quote.price),
            low: Math.min(lastBar.low, quote.price),
            close: Number(quote.price.toFixed(2)),
          }
          latestSeriesRef.current = [...current.slice(0, -1), updatedBar]
          callback(updatedBar)
          onSeriesMeta?.({ source: quote.source, bars: current.length, quote, lastBar: updatedBar })
        }, 12000)
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
    chart.createIndicator({ name: 'MA', calcParams: [20, 50, 200] }, false, { id: 'main' })
    chart.createIndicator('BOLL', false, { id: 'main' })
    chart.createIndicator({ name: 'VOL', calcParams: [20, 50, 200] }, false, { id: 'volume' })
    chart.createIndicator('MACD', false, { id: 'macd' })
    chart.createIndicator({ name: 'RSI', calcParams: [14] }, false, { id: 'rsi' })
    chart.setPaneOptions({ id: 'macd', state: macdVisible ? 'normal' : 'minimize' })
    chart.setPaneOptions({ id: 'rsi', state: rsiVisible ? 'normal' : 'minimize' })

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
  }, [onSeriesMeta])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.resetData()
    chartRef.current.setSymbol(symbolInfo)
    chartRef.current.setPeriod(interval.period)
    chartRef.current.scrollToRealTime()
  }, [symbolInfo, interval, range])

  useEffect(() => {
    if (chartRef.current) chartRef.current.setStyles({ candle: { type: chartType } })
  }, [chartType])

  useEffect(() => {
    if (chartRef.current) chartRef.current.setPaneOptions({ id: 'macd', state: macdVisible ? 'normal' : 'minimize' })
  }, [macdVisible])

  useEffect(() => {
    if (chartRef.current) chartRef.current.setPaneOptions({ id: 'rsi', state: rsiVisible ? 'normal' : 'minimize' })
  }, [rsiVisible])

  useEffect(() => {
    if (chartRef.current && clearDrawingsVersion > 0) {
      chartRef.current.removeOverlay()
    }
  }, [clearDrawingsVersion])

  useEffect(() => {
    if (!chartRef.current || !selectedTool || selectedTool === 'crosshair') return
    chartRef.current.createOverlay(selectedTool)
    onToolApplied?.('crosshair')
  }, [selectedTool, onToolApplied])

  return <div ref={containerRef} className="chart-canvas" />
}

function App() {
  const [watchlist, setWatchlist] = useState(INITIAL_WATCHLIST.map((item) => ({ ...item, price: 0, change: 0, source: 'fallback' })))
  const [selectedSymbol, setSelectedSymbol] = useState(INITIAL_WATCHLIST[0])
  const [interval, setInterval] = useState(INTERVALS[5])
  const [range, setRange] = useState('YTD')
  const [chartType, setChartType] = useState('candle_stroke')
  const [selectedTool, setSelectedTool] = useState('crosshair')
  const [searchValue, setSearchValue] = useState(INITIAL_WATCHLIST[0].symbol)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState(INITIAL_WATCHLIST)
  const [seriesMeta, setSeriesMeta] = useState({ source: 'fallback', bars: 0, quote: null, lastBar: null })
  const [brokerStatus, setBrokerStatus] = useState({ connected: false, configured: false })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [macdVisible, setMacdVisible] = useState(true)
  const [rsiVisible, setRsiVisible] = useState(true)
  const [clearDrawingsVersion, setClearDrawingsVersion] = useState(0)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      const results = await searchSymbols(searchValue, 16)
      if (active) setSearchSuggestions(results)
    }, 160)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchValue])

  useEffect(() => {
    let mounted = true

    const refreshQuotes = async () => {
      const quotes = await Promise.all(watchlist.map((item) => fetchMarketQuote(item.symbol)))
      if (!mounted) return
      const quoteMap = Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]))
      setWatchlist((current) => mergeWatchlistQuotes(current, quoteMap))
    }

    const refreshBroker = async () => {
      const status = await fetchBrokerStatus()
      if (mounted) setBrokerStatus(status)
    }

    refreshQuotes()
    refreshBroker()

    const quoteTimer = window.setInterval(refreshQuotes, 20000)
    const brokerTimer = window.setInterval(refreshBroker, 30000)

    return () => {
      mounted = false
      window.clearInterval(quoteTimer)
      window.clearInterval(brokerTimer)
    }
  }, [watchlist.length])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const selectedWatchItem = useMemo(() => {
    return watchlist.find((item) => item.symbol === selectedSymbol.symbol) || selectedSymbol
  }, [selectedSymbol, watchlist])

  const headerStats = useMemo(() => {
    const baseBar = seriesMeta.lastBar
    const basePrice = selectedWatchItem.price || 0
    return {
      open: baseBar?.open ?? basePrice,
      high: baseBar?.high ?? basePrice,
      low: baseBar?.low ?? basePrice,
      close: baseBar?.close ?? basePrice,
      change: selectedWatchItem.change || 0,
    }
  }, [seriesMeta.lastBar, selectedWatchItem])

  const addSelectedToWatchlist = () => {
    setWatchlist((current) => {
      if (current.some((item) => item.symbol === selectedSymbol.symbol)) return current
      const nextItem = { symbol: selectedSymbol.symbol, name: selectedSymbol.name, exchange: selectedSymbol.exchange || 'NSE', price: 0, change: 0, source: 'fallback' }
      if (current.length < 4) return [...current, nextItem]
      return [...current.slice(0, 3), nextItem]
    })
  }

  const content = (
    <div className={`workspace-grid ${isFullscreen ? 'fullscreen' : ''}`}>
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

      <main className="chart-workspace wide">
        <section className="workspace-toolbar compact">
          <div className="toolbar-row top-row">
            <div className="search-stack in-flow narrow">
              <div className="symbol-box">
                <Search size={16} />
                <input
                  value={searchValue}
                  onFocus={() => setShowSearchSuggestions(true)}
                  onChange={(event) => setSearchValue(event.target.value.toUpperCase())}
                  placeholder="Search NSE stock or index"
                />
              </div>
              {showSearchSuggestions ? (
                <div className="suggestions-box compact in-flow">
                  <div className="suggestions-header">
                    <span>Choose symbol</span>
                    <button type="button" className="icon-clear" onClick={() => setShowSearchSuggestions(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  {searchSuggestions.map((item) => (
                    <button
                      key={`${item.exchange || 'NSE'}:${item.symbol}`}
                      type="button"
                      className="suggestion-row"
                      onClick={() => {
                        setSelectedSymbol(item)
                        setSearchValue(item.symbol)
                        setShowSearchSuggestions(false)
                      }}
                    >
                      <strong>{item.symbol}</strong>
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="watch-compact">
              <div className="watch-compact-header">
                <span className="eyebrow">Watchlist 1-4</span>
                <button type="button" className="chip subtle" onClick={addSelectedToWatchlist}>
                  <Plus size={14} /> Add selected
                </button>
              </div>
              <div className="watch-compact-scroll">
                {watchlist.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={`watch-chip mini ${selectedWatchItem.symbol === item.symbol ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedSymbol(item)
                      setSearchValue(item.symbol)
                    }}
                  >
                    <strong>{item.symbol}</strong>
                    <span>{formatPrice(item.price)}</span>
                    <em className={item.change >= 0 ? 'up' : 'down'}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="summary-compact-card">
              <div className="summary-title-row">
                <strong>{selectedWatchItem.symbol}</strong>
                <span className={`feed-badge ${brokerStatus.connected ? 'good' : 'warn'}`}>{brokerStatus.connected ? 'ZERODHA' : 'STANDBY'}</span>
              </div>
              <span className="summary-name">{selectedSymbol.name}</span>
              <div className="summary-price-row">
                <span className="summary-price">{formatPrice(selectedWatchItem.price)}</span>
                <span className={selectedWatchItem.change >= 0 ? 'up' : 'down'}>{selectedWatchItem.change >= 0 ? '+' : ''}{selectedWatchItem.change.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="toolbar-row">
            <div className="stats-line compact">
              <span className="symbol-title">{selectedSymbol.symbol}</span>
              <span>O {formatPrice(headerStats.open)}</span>
              <span>H {formatPrice(headerStats.high)}</span>
              <span>L {formatPrice(headerStats.low)}</span>
              <span>C {formatPrice(headerStats.close)}</span>
              <span className={headerStats.change >= 0 ? 'up' : 'down'}>{headerStats.change >= 0 ? '+' : ''}{headerStats.change.toFixed(2)}%</span>
              <span className="feed-badge">{sourceLabel(seriesMeta.quote?.source || seriesMeta.source)}</span>
              <span className="feed-badge neutral">Bars {seriesMeta.bars || 0}</span>
            </div>
          </div>

          <div className="toolbar-row grouped-row">
            <div className="chip-group compact">{INTERVALS.map((item) => <button key={item.label} type="button" className={`chip ${interval.label === item.label ? 'selected' : ''}`} onClick={() => setInterval(item)}>{item.label}</button>)}</div>
            <div className="chip-group compact">{RANGE_BUTTONS.map((item) => <button key={item} type="button" className={`chip subtle ${range === item ? 'selected' : ''}`} onClick={() => setRange(item)}>{item}</button>)}</div>
          </div>

          <div className="toolbar-row grouped-row">
            <div className="chip-group compact">{CHART_TYPES.map((item) => <button key={item.value} type="button" className={`chip subtle ${chartType === item.value ? 'selected' : ''}`} onClick={() => setChartType(item.value)}>{item.label}</button>)}</div>
            <div className="chip-group compact">
              <button type="button" className={`chip subtle ${!macdVisible ? 'selected' : ''}`} onClick={() => setMacdVisible((value) => !value)}>{macdVisible ? 'Hide MACD' : 'Show MACD'}</button>
              <button type="button" className={`chip subtle ${!rsiVisible ? 'selected' : ''}`} onClick={() => setRsiVisible((value) => !value)}>{rsiVisible ? 'Hide RSI' : 'Show RSI'}</button>
              <button type="button" className="chip subtle" onClick={() => setClearDrawingsVersion((value) => value + 1)}><Trash2 size={14} /> Clear drawings</button>
              <button type="button" className="chip subtle" onClick={() => setIsFullscreen((value) => !value)}>{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{isFullscreen ? 'Exit full' : 'Fullscreen'}</button>
            </div>
          </div>
        </section>

        <section className="chart-card tight">
          <StudyChart
            symbol={selectedSymbol.symbol}
            interval={interval}
            range={range}
            selectedTool={selectedTool}
            onToolApplied={setSelectedTool}
            onSeriesMeta={setSeriesMeta}
            chartType={chartType}
            macdVisible={macdVisible}
            rsiVisible={rsiVisible}
            clearDrawingsVersion={clearDrawingsVersion}
          />
        </section>
      </main>
    </div>
  )

  return (
    <div className="study-app-shell compact-shell">
      <header className="top-shell compact-top-shell">
        <div className="brand-strip compact-brand">
          <div className="brand-mark"><ChartCandlestick size={18} /></div>
          <div>
            <p className="eyebrow">ChartStudy Prototyping Desk</p>
            <h1>Independent Chart Analysis Workspace</h1>
          </div>
        </div>
        <div className="header-actions">
          <button className="ghost-btn"><Settings2 size={16} /> Layout</button>
        </div>
      </header>
      {isFullscreen ? <div className="fullscreen-shell">{content}</div> : content}
    </div>
  )
}

export default App
