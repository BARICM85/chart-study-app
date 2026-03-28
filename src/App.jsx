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
  Radar,
  Search,
  Settings2,
  Shapes,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { dispose, init } from 'klinecharts'
import { fetchBrokerStatus, fetchMarketHistory, fetchMarketQuote, mergeWatchlistQuotes, searchSymbols } from './lib/marketApi'

const BASE_WATCHLIST = [
  { symbol: 'MARUTI', name: 'Maruti Suzuki India' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'LT', name: 'Larsen & Toubro' },
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
  { label: 'Area', value: 'area' },
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

function ComparePanel({ baseHistory, compareHistory, baseSymbol, compareSymbol }) {
  const width = 980
  const height = 120
  const normalizedBase = useMemo(() => {
    if (!baseHistory.length) return []
    const first = baseHistory[0].close || 1
    return baseHistory.map((point) => ((point.close / first) - 1) * 100)
  }, [baseHistory])
  const normalizedCompare = useMemo(() => {
    if (!compareHistory.length) return []
    const first = compareHistory[0].close || 1
    return compareHistory.map((point) => ((point.close / first) - 1) * 100)
  }, [compareHistory])
  const series = [...normalizedBase, ...normalizedCompare]
  const max = Math.max(...series, 1)
  const min = Math.min(...series, -1)
  const scaleY = (value) => height - (((value - min) / ((max - min) || 1)) * (height - 16)) - 8
  const buildPath = (values) => values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${scaleY(value)}`).join(' ')

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <span className="eyebrow">Compare chart</span>
        <div className="compare-legend">
          <span className="legend-a">{baseSymbol}</span>
          <span className="legend-b">{compareSymbol}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="compare-svg">
        <rect width={width} height={height} fill="transparent" />
        <line x1="0" y1={scaleY(0)} x2={width} y2={scaleY(0)} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={buildPath(normalizedBase)} />
        <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={buildPath(normalizedCompare)} />
      </svg>
    </div>
  )
}

function StudyChart({ symbol, interval, range, selectedTool, onToolApplied, onSeriesMeta, chartType, macdCollapsed, rsiCollapsed, clearDrawingsVersion }) {
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
        { type: 'indicator', content: ['VOL'], options: { id: 'volume', height: 90, minHeight: 70 } },
        { type: 'indicator', content: ['MACD'], options: { id: 'macd', height: 120, minHeight: 90 } },
        { type: 'indicator', content: ['RSI'], options: { id: 'rsi', height: 110, minHeight: 90 } },
        { type: 'xAxis' },
      ],
      styles: {
        grid: { horizontal: { show: true, color: 'rgba(148,163,184,0.08)', style: 'solid', size: 1 }, vertical: { show: true, color: 'rgba(148,163,184,0.05)', style: 'solid', size: 1 } },
        candle: {
          type: chartType,
          bar: { upColor: '#18b26b', downColor: '#df4d5a', noChangeColor: '#94a3b8', upBorderColor: '#18b26b', downBorderColor: '#df4d5a', noChangeBorderColor: '#94a3b8', upWickColor: '#18b26b', downWickColor: '#df4d5a', noChangeWickColor: '#94a3b8' },
          priceMark: { last: { upColor: '#18b26b', downColor: '#df4d5a', noChangeColor: '#94a3b8' } },
        },
        indicator: { lines: [
          { color: '#22c55e', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
          { color: '#60a5fa', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
          { color: '#ef4444', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
          { color: '#f59e0b', size: 1.8, style: 'solid', dashedValue: [0], smooth: false },
        ] },
        xAxis: { axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 }, tickText: { show: true, color: '#94a3b8', size: 11, weight: 500, family: 'Inter, sans-serif', marginStart: 8, marginEnd: 8 } },
        yAxis: { axisLine: { show: true, color: 'rgba(148,163,184,0.14)', size: 1 }, tickText: { show: true, color: '#e2e8f0', size: 11, weight: 600, family: 'IBM Plex Mono, ui-monospace, monospace', marginStart: 8, marginEnd: 8 } },
        separator: { size: 1, color: 'rgba(148,163,184,0.08)', fill: true, activeBackgroundColor: 'rgba(148,163,184,0.06)' },
        crosshair: {
          horizontal: { line: { show: true, color: 'rgba(226,232,240,0.28)', style: 'dashed', size: 1, dashedValue: [4, 4] }, text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' }, features: [] },
          vertical: { line: { show: true, color: 'rgba(226,232,240,0.18)', style: 'dashed', size: 1, dashedValue: [4, 4] }, text: { show: true, color: '#08111c', size: 11, weight: 700, family: 'Inter, sans-serif', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderSize: 0, borderColor: 'transparent', backgroundColor: '#e2e8f0' } },
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
      getBars: async ({ callback }) => {
        const payload = await fetchMarketHistory(symbolRef.current, rangeRef.current, intervalRef.current.label)
        latestSeriesRef.current = payload.points
        callback(payload.points, false)
        onSeriesMeta?.({ source: payload.source, bars: payload.points.length })
      },
      subscribeBar: ({ callback }) => {
        const stream = window.setInterval(async () => {
          const quote = await fetchMarketQuote(symbolRef.current)
          const current = latestSeriesRef.current
          if (!current.length) return
          const lastBar = current[current.length - 1]
          const updatedBar = { ...lastBar, high: Math.max(lastBar.high, quote.price), low: Math.min(lastBar.low, quote.price), close: Number(quote.price.toFixed(2)) }
          latestSeriesRef.current = [...current.slice(0, -1), updatedBar]
          callback(updatedBar)
          onSeriesMeta?.({ source: quote.source, bars: current.length, quote })
        }, 10000)
        streamRef.current = stream
      },
      unsubscribeBar: () => {
        if (streamRef.current) { window.clearInterval(streamRef.current); streamRef.current = null }
      },
    })

    chart.setSymbol(symbolInfo)
    chart.setPeriod(interval.period)
    chart.createIndicator({ name: 'MA', calcParams: [20, 50, 200] }, false, { id: 'main' })
    chart.createIndicator('BOLL', false, { id: 'main' })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (streamRef.current) { window.clearInterval(streamRef.current); streamRef.current = null }
      if (chartRef.current) { dispose(chartRef.current); chartRef.current = null }
    }
  }, [onSeriesMeta])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.resetData()
    chartRef.current.setSymbol(symbolInfo)
    chartRef.current.setPeriod(interval.period)
    chartRef.current.scrollToRealTime()
  }, [symbolInfo, interval, range])

  useEffect(() => { if (chartRef.current) chartRef.current.setStyles({ candle: { type: chartType } }) }, [chartType])
  useEffect(() => { if (chartRef.current) chartRef.current.setPaneOptions({ id: 'macd', state: macdCollapsed ? 'minimize' : 'normal' }) }, [macdCollapsed])
  useEffect(() => { if (chartRef.current) chartRef.current.setPaneOptions({ id: 'rsi', state: rsiCollapsed ? 'minimize' : 'normal' }) }, [rsiCollapsed])
  useEffect(() => { if (chartRef.current && clearDrawingsVersion > 0) chartRef.current.removeOverlay() }, [clearDrawingsVersion])
  useEffect(() => {
    if (!chartRef.current || !selectedTool || selectedTool === 'crosshair') return
    chartRef.current.createOverlay(selectedTool)
    onToolApplied?.('crosshair')
  }, [selectedTool, onToolApplied])

  return <div ref={containerRef} className="chart-canvas" />
}

function App() {
  const [watchlist, setWatchlist] = useState(BASE_WATCHLIST.map((item) => ({ ...item, price: 0, change: 0, source: 'fallback' })))
  const [selectedSymbol, setSelectedSymbol] = useState(BASE_WATCHLIST[0])
  const [compareSymbol, setCompareSymbol] = useState(BASE_WATCHLIST[1])
  const [interval, setInterval] = useState(INTERVALS[5])
  const [range, setRange] = useState('YTD')
  const [chartType, setChartType] = useState('candle_stroke')
  const [selectedTool, setSelectedTool] = useState('crosshair')
  const [searchValue, setSearchValue] = useState(BASE_WATCHLIST[0].symbol)
  const [compareValue, setCompareValue] = useState(BASE_WATCHLIST[1].symbol)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [showCompareSuggestions, setShowCompareSuggestions] = useState(false)
  const [seriesMeta, setSeriesMeta] = useState({ source: 'fallback', bars: 0, quote: null })
  const [brokerStatus, setBrokerStatus] = useState({ connected: false, configured: false })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [macdCollapsed, setMacdCollapsed] = useState(false)
  const [rsiCollapsed, setRsiCollapsed] = useState(false)
  const [clearDrawingsVersion, setClearDrawingsVersion] = useState(0)
  const [baseCompareHistory, setBaseCompareHistory] = useState([])
  const [otherCompareHistory, setOtherCompareHistory] = useState([])

  const searchSuggestions = useMemo(() => searchSymbols(searchValue), [searchValue])
  const compareSuggestions = useMemo(() => searchSymbols(compareValue), [compareValue])

  useEffect(() => {
    let mounted = true
    const refreshQuotes = async () => {
      const quotes = await Promise.all(BASE_WATCHLIST.map((item) => fetchMarketQuote(item.symbol)))
      if (!mounted) return
      const quoteMap = Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]))
      setWatchlist(mergeWatchlistQuotes(BASE_WATCHLIST, quoteMap))
    }
    const refreshBroker = async () => {
      const status = await fetchBrokerStatus()
      if (mounted) setBrokerStatus(status)
    }
    refreshQuotes()
    refreshBroker()
    const quoteTimer = window.setInterval(refreshQuotes, 20000)
    const brokerTimer = window.setInterval(refreshBroker, 30000)
    return () => { mounted = false; window.clearInterval(quoteTimer); window.clearInterval(brokerTimer) }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadCompare = async () => {
      const [base, other] = await Promise.all([
        fetchMarketHistory(selectedSymbol.symbol, range, interval.label),
        fetchMarketHistory(compareSymbol.symbol, range, interval.label),
      ])
      if (!mounted) return
      setBaseCompareHistory(base.points.slice(-120))
      setOtherCompareHistory(other.points.slice(-120))
    }
    loadCompare()
    return () => { mounted = false }
  }, [selectedSymbol.symbol, compareSymbol.symbol, range, interval.label])

  useEffect(() => {
    const handleKey = (event) => { if (event.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const selectedWatchItem = useMemo(() => watchlist.find((item) => item.symbol === selectedSymbol.symbol) || selectedSymbol, [selectedSymbol, watchlist])
  const headerStats = useMemo(() => {
    const base = selectedWatchItem.price || 0
    const change = selectedWatchItem.change || 0
    return { last: base, change, open: base ? base * 1.004 : 0, high: base ? base * 1.013 : 0, low: base ? base * 0.991 : 0, close: base }
  }, [selectedWatchItem])

  const content = (
    <div className={`workspace-grid ${isFullscreen ? 'fullscreen' : ''}`}>
      <aside className="left-rail">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          const active = selectedTool === tool.action || (tool.action === 'crosshair' && selectedTool === 'crosshair')
          return <button key={tool.label} type="button" title={tool.label} className={`rail-button ${active ? 'active' : ''}`} onClick={() => setSelectedTool(tool.action)}><Icon size={18} /></button>
        })}
      </aside>
      <main className="chart-workspace wide">
        <section className="workspace-toolbar">
          <div className="toolbar-row">
            <div className="toolbar-left-cluster">
              <div className="search-stack in-flow">
                <div className="symbol-box">
                  <Search size={16} />
                  <input value={searchValue} onFocus={() => setShowSearchSuggestions(true)} onChange={(event) => setSearchValue(event.target.value.toUpperCase())} placeholder="Search symbol" />
                </div>
                {showSearchSuggestions ? <div className="suggestions-box compact in-flow"><div className="suggestions-header"><span>Choose symbol</span><button type="button" className="icon-clear" onClick={() => setShowSearchSuggestions(false)}><X size={14} /></button></div>{searchSuggestions.map((item) => <button key={item.symbol} type="button" className="suggestion-row" onClick={() => { setSelectedSymbol(item); setSearchValue(item.symbol); setShowSearchSuggestions(false) }}><strong>{item.symbol}</strong><span>{item.name}</span></button>)}</div> : null}
              </div>
              <div className="search-stack in-flow">
                <div className="symbol-box compare">
                  <Radar size={16} />
                  <input value={compareValue} onFocus={() => setShowCompareSuggestions(true)} onChange={(event) => setCompareValue(event.target.value.toUpperCase())} placeholder="Compare symbol" />
                </div>
                {showCompareSuggestions ? <div className="suggestions-box compact in-flow"><div className="suggestions-header"><span>Compare with</span><button type="button" className="icon-clear" onClick={() => setShowCompareSuggestions(false)}><X size={14} /></button></div>{compareSuggestions.map((item) => <button key={item.symbol} type="button" className="suggestion-row" onClick={() => { setCompareSymbol(item); setCompareValue(item.symbol); setShowCompareSuggestions(false) }}><strong>{item.symbol}</strong><span>{item.name}</span></button>)}</div> : null}
              </div>
              <button className="chip">NSE</button>
            </div>
            <div className="chip-group compact">{INTERVALS.map((item) => <button key={item.label} type="button" className={`chip ${interval.label === item.label ? 'selected' : ''}`} onClick={() => setInterval(item)}>{item.label}</button>)}</div>
          </div>
          <div className="toolbar-row secondary">
            <div className="stats-line">
              <span className="symbol-title">{selectedSymbol.symbol}</span>
              <span>O {formatPrice(headerStats.open)}</span>
              <span>H {formatPrice(headerStats.high)}</span>
              <span>L {formatPrice(headerStats.low)}</span>
              <span>C {formatPrice(headerStats.close)}</span>
              <span className={headerStats.change >= 0 ? 'up' : 'down'}>{headerStats.change >= 0 ? '+' : ''}{headerStats.change.toFixed(2)}%</span>
              <span className="feed-badge">{sourceLabel(seriesMeta.quote?.source || seriesMeta.source)}</span>
              <span className={`feed-badge ${brokerStatus.connected ? 'good' : 'warn'}`}>{brokerStatus.connected ? 'ZERODHA CONNECTED' : 'ZERODHA STANDBY'}</span>
            </div>
            <div className="chip-group">{RANGE_BUTTONS.map((item) => <button key={item} type="button" className={`chip subtle ${range === item ? 'selected' : ''}`} onClick={() => setRange(item)}>{item}</button>)}</div>
          </div>
          <div className="toolbar-row tertiary">
            <div className="chip-group compact">{CHART_TYPES.map((item) => <button key={item.value} type="button" className={`chip subtle ${chartType === item.value ? 'selected' : ''}`} onClick={() => setChartType(item.value)}>{item.label}</button>)}</div>
            <div className="chip-group compact">
              <button type="button" className={`chip subtle ${macdCollapsed ? 'selected' : ''}`} onClick={() => setMacdCollapsed((value) => !value)}>{macdCollapsed ? 'Show MACD' : 'Hide MACD'}</button>
              <button type="button" className={`chip subtle ${rsiCollapsed ? 'selected' : ''}`} onClick={() => setRsiCollapsed((value) => !value)}>{rsiCollapsed ? 'Show RSI' : 'Hide RSI'}</button>
              <button type="button" className="chip subtle" onClick={() => setClearDrawingsVersion((value) => value + 1)}><Trash2 size={14} /> Clear drawings</button>
              <button type="button" className="chip subtle" onClick={() => setIsFullscreen((value) => !value)}>{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{isFullscreen ? 'Exit full' : 'Fullscreen'}</button>
            </div>
          </div>
        </section>
        <section className="chart-card"><StudyChart symbol={selectedSymbol.symbol} interval={interval} range={range} selectedTool={selectedTool} onToolApplied={setSelectedTool} onSeriesMeta={setSeriesMeta} chartType={chartType} macdCollapsed={macdCollapsed} rsiCollapsed={rsiCollapsed} clearDrawingsVersion={clearDrawingsVersion} /></section>
        <ComparePanel baseHistory={baseCompareHistory} compareHistory={otherCompareHistory} baseSymbol={selectedSymbol.symbol} compareSymbol={compareSymbol.symbol} />
      </main>
      <aside className="right-panel">
        <section className="panel-card slim">
          <div className="panel-title-row"><h2>{selectedWatchItem.symbol}</h2><span className="pill">{sourceLabel(selectedWatchItem.source)}</span></div>
          <p className="company-name">{selectedSymbol.name}</p>
          <p className="price-print">{formatPrice(selectedWatchItem.price)} <span>INR</span></p>
          <p className={`move-print ${selectedWatchItem.change >= 0 ? 'up' : 'down'}`}>{selectedWatchItem.change >= 0 ? '+' : ''}{selectedWatchItem.change.toFixed(2)}%</p>
          <ul className="study-list"><li>Broker: {brokerStatus.connected ? 'Connected to Zerodha' : 'Not connected yet'}</li><li>Chart type: {CHART_TYPES.find((item) => item.value === chartType)?.label}</li><li>Bars loaded: {seriesMeta.bars || 0}</li><li>Compare: {compareSymbol.symbol}</li></ul>
        </section>
      </aside>
    </div>
  )

  return <div className="study-app-shell"><header className="top-shell"><div className="brand-strip"><div className="brand-mark"><ChartCandlestick size={18} /></div><div><p className="eyebrow">ChartStudy Prototyping Desk</p><h1>Independent Chart Analysis Workspace</h1></div></div><div className="header-actions"><button className="ghost-btn"><Settings2 size={16} /> Layout</button><button className="primary-btn"><Plus size={16} /> Zerodha adapter active</button></div></header><div className="watch-strip-card"><div className="watch-strip-header"><span className="eyebrow">Watchlist</span><span className="feed-mini">{sourceLabel(selectedWatchItem.source)}</span></div><div className="watch-strip-scroll">{watchlist.map((item) => <button key={item.symbol} type="button" className={`watch-chip ${selectedWatchItem.symbol === item.symbol ? 'active' : ''}`} onClick={() => { setSelectedSymbol(item); setSearchValue(item.symbol) }}><strong>{item.symbol}</strong><span>{formatPrice(item.price)}</span><em className={item.change >= 0 ? 'up' : 'down'}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</em></button>)}</div></div>{isFullscreen ? <div className="fullscreen-shell">{content}</div> : content}</div>
}

export default App
