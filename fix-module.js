const fs = require('node:fs')
const file = 'c:/Users/kennu/CMNetwork/src/CMNetwork.ClientApp/src/pages/modules/AuthorizedViewerModule.tsx'
const lines = fs.readFileSync(file, 'utf8').split('\n')

// Keep everything up to (but not including) the old ExecutiveSummaryView comment
// Line 136 (0-indexed 135) is "// ── Executive Summary View ..."
const keep = lines.slice(0, 135).join('\n')

const newTail = `

// ─────────────────────────────────────────────────────────────────────────────
// Executive Summary View
// ─────────────────────────────────────────────────────────────────────────────
const ExecutiveSummaryView = () => {
  useDisplayCurrency()
  const [metrics, setMetrics] = useState<MetricDto[]>([])
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { hash } = useLocation()

  useEffect(() => {
    const load = async () => {
      try {
        const [mr, cr] = await Promise.allSettled([
          dashboardService.getMetrics('authorized-viewer'),
          dashboardService.getChartData(),
        ])
        if (mr.status === 'fulfilled') setMetrics(mr.value.metrics)
        if (cr.status === 'fulfilled') setChartData(cr.value)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!loading && hash) {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading, hash])

  const trendData = useMemo(() => {
    if (!chartData?.data?.length) return TREND_MOCK
    return chartData.data.map((d, i) => ({
      month: d.label,
      revenue: d.series.find((s) => s.name === 'Revenue')?.values[0] ?? 0,
      expenses: d.series.find((s) => s.name === 'Expenses')?.values[0] ?? 0,
      cash: TREND_MOCK[i]?.cash ?? 0,
    }))
  }, [chartData])

  const revMetric = metrics.find((m) => m.title.toLowerCase().includes('revenue'))
  const expMetric = metrics.find((m) => m.title.toLowerCase().includes('expense'))
  const netMetric = metrics.find((m) => m.title.toLowerCase().includes('net'))

  const revValue = revMetric ? convertCurrencyText(revMetric.value, 'PHP') : '\u2013'
  const expValue = expMetric ? convertCurrencyText(expMetric.value, 'PHP') : '\u2013'
  const netValue = netMetric ? convertCurrencyText(netMetric.value, 'PHP') : '\u2013'

  return (
    <div className="exs-body">

      {/* Read-only info bar */}
      <div className="exs-readonly-bar">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Read-only view enabled for this role
      </div>

      {/* KPI Cards */}
      <div id="monthly-performance" className="exs-kpi-row">
        {loading ? (
          <p className="exs-loading">Loading metrics\u2026</p>
        ) : (
          <>
            <ExsKpiCard
              icon={banknoteOutlineIcon}
              title="Total Revenue (MTD)"
              value={revValue}
              subtitle="Posted revenue journals this month"
              spark={REVENUE_SPARK}
              sparkColor="#1D63C1"
            />
            <ExsKpiCard
              icon={walletOutlineIcon}
              title="Total Expenses (MTD)"
              value={expValue}
              subtitle="Posted expense journals this month"
              spark={EXPENSES_SPARK}
              sparkColor="#6b7280"
            />
            <ExsKpiCard
              icon={fileReportIcon}
              title="Net Income (MTD)"
              value={netValue}
              subtitle="Revenue - expenses"
              spark={NETINCOME_SPARK}
              sparkColor="#1D63C1"
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      {!loading && (
        <div id="trend-charts" className="exs-charts-row">

          {/* Revenue vs Expenses */}
          <div className="exs-chart-card">
            <h3 className="exs-chart-title">Revenue vs Expenses (Fiscal Year)</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={trendData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' :
                    v >= 1000    ? (v / 1000).toFixed(0)    + 'K' : String(v)
                  }
                  tick={{ fontSize: 11 }}
                  axisLine={false} tickLine={false} width={58}
                />
                <Tooltip formatter={(v) => phpFmt(Number(v))} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="revenue"  name="Revenue"  fill="#1D63C1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#9ca3af" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cash Position Trend */}
          <div className="exs-chart-card">
            <h3 className="exs-chart-title">Cash Position Trend (Fiscal Year)</h3>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' :
                    v >= 1000    ? (v / 1000).toFixed(0)    + 'K' : String(v)
                  }
                  tick={{ fontSize: 11 }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip formatter={(v) => phpFmt(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="cash"
                  name="Cash Position"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#cashAreaGrad)"
                  dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* Export and Distribution */}
      <div id="export-brief" className="exs-export-section">
        <h2 className="exs-export-section-title">Export &amp; Distribution</h2>
        <div className="exs-export-row">

          <div className="exs-export-card">
            <div className="exs-export-icon-box"><SvgIcon icon={fileReportIcon} /></div>
            <div className="exs-export-body">
              <p className="exs-export-title">Export Executive Brief (PDF)</p>
              <p className="exs-export-desc">
                Pre-formatted board-ready PDF with KPIs, summary charts, and commentary placeholder.
                Watermarked Confidential \u2013 For Authorized Viewers Only.
              </p>
            </div>
            <button type="button" className="exs-btn exs-btn-primary" disabled title="PDF export coming soon">
              Export PDF
            </button>
          </div>

          <div className="exs-export-card">
            <div className="exs-export-icon-box"><SvgIcon icon={envelopeIcon} /></div>
            <div className="exs-export-body">
              <p className="exs-export-title">Share via Secure Link</p>
              <p className="exs-export-desc">
                Send a secure, time-limited link of the current Executive Summary to authorized recipients.
                The action is logged.
              </p>
            </div>
            <button type="button" className="exs-btn exs-btn-primary" disabled title="Secure link coming soon">
              Share Link
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AV Reports View
// ─────────────────────────────────────────────────────────────────────────────
const AvReportsView = () => {
  const { hash } = useLocation()
  const now = new Date()
  const period = now.toLocaleString('en-PH', { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])

  return (
    <div className="av-module-body">

      <div id="pl-summary" className="av-module-section-head">
        <h2 className="av-module-section-title">P&amp;L Summary \u2014 Profit &amp; Loss</h2>
        <p className="av-module-section-sub">Top-level categories only. No account-level detail, no drill-down.</p>
      </div>
      <StatementTable rows={PL_ROWS} period={period + ' \u00b7 Month-to-Date'} />

      <div id="balance-sheet" className="av-module-section-head">
        <h2 className="av-module-section-title">Balance Sheet Summary</h2>
        <p className="av-module-section-sub">Major groupings only \u2014 Current Assets, Fixed Assets, Liabilities, Equity. No drill-down.</p>
      </div>
      <StatementTable rows={BS_ROWS} period={'As of ' + now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} />

      <div className="av-export-actions" style={{ marginTop: '1.5rem' }}>
        <div className="av-export-card">
          <SvgIcon icon={fileReportIcon} />
          <div>
            <p className="av-export-card-title">Export Reports (PDF)</p>
            <p className="av-export-card-desc">
              Download the P&amp;L and Balance Sheet summaries as a single watermarked PDF.
            </p>
          </div>
          <button type="button" className="av-action-btn av-action-primary" disabled title="PDF export coming soon">
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Host
// ─────────────────────────────────────────────────────────────────────────────
export const AuthorizedViewerModule = ({ moduleKey }: Props) => {
  const now = new Date()
  const periodLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  if (moduleKey === 'executive-summary') {
    return (
      <div className="module-page-layout exs-layout">

        {/* Page Header */}
        <div className="exs-page-header">
          <div className="exs-page-title-area">
            <h1 className="exs-page-title">Executive Financial Summary</h1>
            <span className="exs-conf-badge">Confidential \u2013 Authorized Access</span>
          </div>
          <div className="exs-date-area">
            <span className="exs-date-label">Date period</span>
            <div className="exs-date-box">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
              <span>{periodLabel}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        <ExecutiveSummaryView />

      </div>
    )
  }

  return (
    <div className="module-page-layout av-module-layout">
      <div className="module-hero" style={{ borderLeft: '4px solid var(--color-primary, #1e3a5f)' }}>
        <div className="module-hero-text">
          <h1 className="module-hero-title">Financial Reports</h1>
          <p className="module-hero-subtitle">
            Aggregated P&amp;L and Balance Sheet summaries \u2014 no account detail \u00b7 {periodLabel}
          </p>
        </div>
        <span className="av-confidential-badge" style={{ alignSelf: 'center' }}>
          Confidential \u00b7 Authorized Viewers Only
        </span>
      </div>
      <div className="av-no-edit-notice">
        <SvgIcon icon={arrowDownIcon} />
        This view is read-only. No data entry, editing, or drill-down is available.
      </div>
      <AvReportsView />
    </div>
  )
}
`

fs.writeFileSync(file, keep + newTail, 'utf8')
const newLines = fs.readFileSync(file, 'utf8').split('\n').length
console.log('Done. Total lines:', newLines)

