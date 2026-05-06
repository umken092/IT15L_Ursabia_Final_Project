import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SvgIcon } from '@progress/kendo-react-common'
import {
  banknoteOutlineIcon,
  envelopeIcon,
  fileReportIcon,
  walletOutlineIcon,
} from '@progress/kendo-svg-icons'
import {
  dashboardService,
  type ChartDataResponse,
  type MetricDto,
} from '../../services/dashboardService'
import { reportsService } from '../../services/accountantService'
import { convertCurrencyText, useDisplayCurrency } from '../../store/currencyStore'

export type AvModuleKey = 'executive-summary' | 'av-reports'

interface Props {
  moduleKey: AvModuleKey
}

// ── AV Reports types & helpers ───────────────────────────────────────────────
interface AvStatementLine {
  accountCode: string
  accountName: string
  amount: number
}
interface AvReportLine {
  account: string
  amount: number
}
interface AvStatementResponse {
  from: string
  to: string
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  revenue: AvStatementLine[]
  expenses: AvStatementLine[]
}
const avToIso = (d: Date) => d.toISOString().slice(0, 10)
const avMonthYear = (v: string) => {
  const d = new Date(`${v}T00:00:00`)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
const avPeriodLabel = (from: string, to: string) => {
  const f = avMonthYear(from)
  const t = avMonthYear(to)
  return f === t ? f : `${f} – ${t}`
}

// ── Empty state constants ─────────────────────────────────────────────────────
const EMPTY_CHART_DATA: Array<{ month: string; revenue: number; expenses: number; cash: number }> = []
const EMPTY_SPARKLINE: Array<{ v: number }> = []

const toSparkline = (values: number[]) => {
  const points = values.map((v) => ({ v }))
  return points.length > 0 ? points : EMPTY_SPARKLINE
}

const toPdfBlob = (data: unknown) => {
  if (data instanceof Blob) return data
  if (typeof data === 'string') return new Blob([data], { type: 'application/pdf' })
  if (data instanceof ArrayBuffer) return new Blob([data], { type: 'application/pdf' })
  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.byteLength)
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    return new Blob([bytes.buffer], { type: 'application/pdf' })
  }
  return new Blob([JSON.stringify(data)], { type: 'application/pdf' })
}

const percentOf = (amount: number, total: number) => (total > 0 ? ((amount / total) * 100).toFixed(1) : '0')

const formatNetIncome = (loading: boolean, netIncome: number) => {
  if (loading) return '—'
  return netIncome >= 0 ? phpFmt(netIncome) : `(${phpFmt(Math.abs(netIncome))})`
}

const getSourceBadgeLabel = (loading: boolean, dataSource: 'live' | 'unavailable') => {
  if (loading) return 'Syncing'
  if (dataSource === 'live') return 'Live Data'
  return 'Unavailable'
}

const getSourceBadgeClassName = (dataSource: 'live' | 'unavailable') => {
  if (dataSource === 'live') return 'pl-source-badge pl-source-badge--live'
  return 'pl-source-badge pl-source-badge--fallback'
}

const getResultTone = (netIncome: number) => {
  if (netIncome >= 0) {
    return {
      label: 'Surplus',
      description: 'Surplus for the period',
      cardClassName: 'pl-summary-card pl-summary-card--surplus',
      valueClassName: 'pl-summary-value pl-surplus',
      resultClassName: 'pl-result-value pl-surplus',
      marginClassName: 'pl-margin-badge pl-margin-badge--positive',
      chipClassName: 'pl-result-chip pl-chip-surplus',
    }
  }

  return {
    label: 'Deficit',
    description: 'Deficit for the period',
    cardClassName: 'pl-summary-card pl-summary-card--deficit',
    valueClassName: 'pl-summary-value pl-deficit',
    resultClassName: 'pl-result-value pl-deficit',
    marginClassName: 'pl-margin-badge pl-margin-badge--negative',
    chipClassName: 'pl-result-chip pl-chip-deficit',
  }
}

const phpFmt = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(v)

interface ProfitLossSectionProps {
  title: string
  icon: string
  tone: 'revenue' | 'expense'
  pctHeader: string
  pctTotalLabel: string
  emptyText: string
  loading: boolean
  lines: AvReportLine[]
  totalAmount: number
  totalRevenue: number
}

const ProfitLossSection = ({
  title,
  icon,
  tone,
  pctHeader,
  pctTotalLabel,
  emptyText,
  loading,
  lines,
  totalAmount,
  totalRevenue,
}: ProfitLossSectionProps) => {
  const headerClassName = `pl-section-header pl-section-header--${tone}`
  const amountClassName = tone === 'revenue' ? 'pl-col-amount pl-text-revenue' : 'pl-col-amount pl-text-expense'
  const totalPercent = pctTotalLabel === '100.0%' ? '100.0%' : `${percentOf(totalAmount, totalRevenue)}%`

  return (
    <div className="pl-section-card">
      <div className={headerClassName}>
        <span className="pl-section-icon">{icon}</span>{' '}{title}
      </div>
      <table className="pl-table">
        <thead>
          <tr>
            <th>Account</th>
            <th className="pl-col-amount">Amount (PHP)</th>
            <th className="pl-col-pct">{pctHeader}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr className="pl-row"><td colSpan={3} className="pl-text-muted" style={{ padding: '1.25rem' }}>Loading…</td></tr>
          )}
          {!loading && lines.length === 0 && (
            <tr className="pl-row"><td colSpan={3} className="pl-text-muted" style={{ padding: '1.25rem' }}>{emptyText}</td></tr>
          )}
          {!loading && lines.map((line) => (
            <tr key={line.account} className="pl-row">
              <td>{line.account}</td>
              <td className={amountClassName}>{phpFmt(line.amount)}</td>
              <td className="pl-col-pct pl-text-muted">{percentOf(line.amount, totalRevenue)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="pl-row--total">
            <td><strong>Total {title}</strong></td>
            <td className={amountClassName}><strong>{phpFmt(totalAmount)}</strong></td>
            <td className="pl-col-pct pl-text-muted"><strong>{totalPercent}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── KPI Sparkline ─────────────────────────────────────────────────────────────
const KpiSparkline = ({ data, color }: { data: { v: number }[]; color: string }) => (
  <ResponsiveContainer width={110} height={48}>
    <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
)

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface ExsKpiCardProps {
  icon: typeof banknoteOutlineIcon
  title: string
  value: string
  subtitle: string
  spark: { v: number }[]
  sparkColor?: string
}
const ExsKpiCard = ({
  icon, title, value, subtitle, spark, sparkColor = '#1D63C1',
}: ExsKpiCardProps) => (
  <div className="exs-kpi-card">
    <div className="exs-kpi-icon-box"><SvgIcon icon={icon} /></div>
    <div className="exs-kpi-body">
      <p className="exs-kpi-title">{title}</p>
      <p className="exs-kpi-value">{value}</p>
      <p className="exs-kpi-sub">{subtitle}</p>
    </div>
    <div className="exs-kpi-spark"><KpiSparkline data={spark} color={sparkColor} /></div>
  </div>
)

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
    if (!chartData?.data?.length) return EMPTY_CHART_DATA
    return chartData.data.map((d) => ({
      month: d.label,
      revenue: d.series.find((s) => s.name === 'Revenue')?.values[0] ?? 0,
      expenses: d.series.find((s) => s.name === 'Expenses')?.values[0] ?? 0,
      cash: 0,
    }))
  }, [chartData])

  const revMetric = metrics.find((m) => m.title.toLowerCase().includes('revenue'))
  const expMetric = metrics.find((m) => m.title.toLowerCase().includes('expense'))
  const netMetric = metrics.find((m) => m.title.toLowerCase().includes('net'))

  const revValue = revMetric ? convertCurrencyText(revMetric.value, 'PHP') : '–'
  const expValue = expMetric ? convertCurrencyText(expMetric.value, 'PHP') : '–'
  const netValue = netMetric ? convertCurrencyText(netMetric.value, 'PHP') : '–'

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
          <p className="exs-loading">Loading metrics…</p>
        ) : (
          <>
            <ExsKpiCard
              icon={banknoteOutlineIcon}
              title="Total Revenue (MTD)"
              value={revValue}
              subtitle="Posted revenue journals this month"
              spark={toSparkline(trendData.map((d) => d.revenue))}
              sparkColor="#1D63C1"
            />
            <ExsKpiCard
              icon={walletOutlineIcon}
              title="Total Expenses (MTD)"
              value={expValue}
              subtitle="Posted expense journals this month"
              spark={toSparkline(trendData.map((d) => d.expenses))}
              sparkColor="#6b7280"
            />
            <ExsKpiCard
              icon={fileReportIcon}
              title="Net Income (MTD)"
              value={netValue}
              subtitle="Revenue - expenses"
              spark={toSparkline(trendData.map((d) => d.revenue - d.expenses))}
              sparkColor="#1D63C1"
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      {!loading && (() => {
        if (trendData.length === 0) {
          return (
            <div id="trend-charts" className="exs-charts-row">
              <div className="exs-chart-card">
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No live chart data available.
                </p>
              </div>
              <div className="exs-chart-card">
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No live chart data available.
                </p>
              </div>
            </div>
          )
        }
        const fmtAxis = (v: number) => {
          if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
          if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
          return String(v)
        }
        return (
        <div id="trend-charts" className="exs-charts-row">

          {/* Revenue vs Expenses */}
          <div className="exs-chart-card">
            <h3 className="exs-chart-title">Revenue vs Expenses (Fiscal Year)</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={trendData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={fmtAxis}
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
                  tickFormatter={fmtAxis}
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
        )
      })()}

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
                Watermarked Confidential – For Authorized Viewers Only.
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
// AV Reports View — redesigned card-based P&L
// ─────────────────────────────────────────────────────────────────────────────
const AvReportsView = () => {
  useDisplayCurrency()
  const [statement, setStatement] = useState<AvStatementResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'unavailable'>('unavailable')
  const [exporting, setExporting] = useState(false)

  const periodRange = useMemo(() => {
    const today = new Date()
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    return { startDate: avToIso(startOfYear), endDate: avToIso(today) }
  }, [])

  useEffect(() => {
    let active = true
    reportsService
      .getIncomeStatement(periodRange)
      .then((res) => {
        if (!active) return
        setStatement(res.data as AvStatementResponse)
        setDataSource('live')
      })
      .catch(() => {
        if (!active) return
        setStatement(null)
        setDataSource('unavailable')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [periodRange])

  const revenueLines = useMemo(() =>
    (statement?.revenue ?? []).map((l) => ({ account: l.accountName || l.accountCode, amount: Number(l.amount) || 0 }))
  , [statement])

  const expenseLines = useMemo(() =>
    (statement?.expenses ?? []).map((l) => ({ account: l.accountName || l.accountCode, amount: Number(l.amount) || 0 }))
  , [statement])

  const totalRevenue = statement?.totalRevenue ?? revenueLines.reduce((s, l) => s + l.amount, 0)
  const totalExpense = statement?.totalExpenses ?? expenseLines.reduce((s, l) => s + l.amount, 0)
  const netIncome = totalRevenue - totalExpense
  const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0.0'
  const periodLabel = avPeriodLabel(statement?.from ?? periodRange.startDate, statement?.to ?? periodRange.endDate)
  const resultPeriodLabel = avMonthYear(statement?.to ?? periodRange.endDate)
  const sourceBadgeLabel = getSourceBadgeLabel(loading, dataSource)
  const sourceBadgeClassName = getSourceBadgeClassName(dataSource)
  const netIncomeDisplay = formatNetIncome(loading, netIncome)
  const resultTone = getResultTone(netIncome)
  const revenueDisplay = loading ? '—' : phpFmt(totalRevenue)
  const expenseDisplay = loading ? '—' : phpFmt(totalExpense)
  const marginDisplay = loading ? '—' : `${netMargin}%`

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await reportsService.exportReport('income-statement', 'pdf', {
        startDate: statement?.from ?? periodRange.startDate,
        endDate: statement?.to ?? periodRange.endDate,
      })
      const blob = toPdfBlob(response.data)
      const url = globalThis.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `av-pl-statement-${statement?.to ?? periodRange.endDate}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      globalThis.URL.revokeObjectURL(url)
    } catch { /* silently degrade */ } finally { setExporting(false) }
  }

  return (
    <section className="pl-report">

      {/* ── Header bar ── */}
      <div className="pl-report-header">
        <div className="pl-report-meta">
          <span className="pl-report-period">{periodLabel}</span>
          <div className="pl-report-badges">
            <span className={sourceBadgeClassName}>
              {sourceBadgeLabel}
            </span>
            <span className={resultTone.marginClassName}>
              Margin {netMargin}%
            </span>
          </div>
        </div>
        <div className="pl-report-actions">
          <button
            type="button"
            className="pl-btn-outline"
            disabled
            title="Email export requires SMTP integration"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Share via Email
          </button>
          <button
            type="button"
            className="pl-btn-primary"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Generating…' : 'Export as PDF'}
          </button>
        </div>
      </div>

      {/* ── Executive KPI cards ── */}
      <div className="pl-summary-row">
        <div className="pl-summary-card">
          <div className="pl-summary-label">Total Revenue</div>
          <div className="pl-summary-value pl-revenue">{revenueDisplay}</div>
          <div className="pl-summary-sub">Tuition, grants &amp; other income</div>
        </div>
        <div className="pl-summary-card">
          <div className="pl-summary-label">Total Expenses</div>
          <div className="pl-summary-value pl-expense">{expenseDisplay}</div>
          <div className="pl-summary-sub">All institutional expenditures</div>
        </div>
        <div className={resultTone.cardClassName}>
          <div className="pl-summary-label">Net Income / (Loss)</div>
          <div className={resultTone.valueClassName}>
            {netIncomeDisplay}
          </div>
          <div className="pl-summary-sub">{resultTone.description}</div>
        </div>
        <div className="pl-summary-card">
          <div className="pl-summary-label">Net Margin %</div>
          <div className={resultTone.valueClassName}>
            {marginDisplay}
          </div>
          <div className="pl-summary-sub">Net income as % of revenue</div>
        </div>
      </div>

      {/* ── Revenue section ── */}
      <ProfitLossSection
        title="Revenue"
        icon="↑"
        tone="revenue"
        pctHeader="% of Total"
        pctTotalLabel="100.0%"
        emptyText="No revenue entries found for this period."
        loading={loading}
        lines={revenueLines}
        totalAmount={totalRevenue}
        totalRevenue={totalRevenue}
      />

      {/* ── Expenses section ── */}
      <ProfitLossSection
        title="Expenses"
        icon="↓"
        tone="expense"
        pctHeader="% of Revenue"
        pctTotalLabel="ofRevenue"
        emptyText="No expense entries found for this period."
        loading={loading}
        lines={expenseLines}
        totalAmount={totalExpense}
        totalRevenue={totalRevenue}
      />

      {/* ── Result section ── */}
      <div className="pl-section-card pl-section-card--result">
        <div className="pl-result-row">
          <div>
            <div className="pl-result-label">Net Income / (Loss)</div>
            <div className="pl-result-sub">For the period ended {resultPeriodLabel}</div>
          </div>
          <div className={resultTone.resultClassName}>
            {netIncomeDisplay}
          </div>
        </div>
        <div className="pl-result-chips">
          <span className="pl-result-chip">Margin: {netMargin}%</span>
          <span className={resultTone.chipClassName}>
            {resultTone.label}
          </span>
          <span className="pl-result-chip" style={{ color: '#6b7280' }}>Aggregated · Read-only</span>
        </div>
      </div>

    </section>
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
            <span className="exs-conf-badge">Confidential – Authorized Access</span>
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
    <div className="module-page-layout avr-layout" style={{ background: '#EDF0F2', padding: '1.5rem 2rem 2.5rem' }}>
      <AvReportsView />
    </div>
  )
}
