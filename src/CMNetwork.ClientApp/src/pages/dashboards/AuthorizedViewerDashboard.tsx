import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SvgIcon } from '@progress/kendo-react-common'
import {
  arrowDownIcon,
  arrowUpIcon,
  banknoteOutlineIcon,
  fileReportIcon,
  minusIcon,
  walletOutlineIcon,
} from '@progress/kendo-svg-icons'
import { SkeletonKpiGrid } from '../../components/SkeletonCard'
import {
  dashboardService,
  type ChartDataResponse,
  type DepartmentBudgetItem,
  type MetricDto,
} from '../../services/dashboardService'
import { convertCurrencyText, formatCurrencyCompact, formatMoney, useDisplayCurrency } from '../../store/currencyStore'

// ── Types ─────────────────────────────────────────────────────────────────────
type DeptStatus = 'on-track' | 'over' | 'under'

interface AreaChartData {
  month: string
  revenue: number
  expenses: number
}

const STATUS_CONFIG: Record<DeptStatus, { label: string; cls: string }> = {
  'on-track': { label: 'Within budget', cls: 'av2-pill--green' },
  'over':     { label: 'Over budget',   cls: 'av2-pill--red'   },
  'under':    { label: 'Under budget',  cls: 'av2-pill--amber' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const kpiWatermarkIcon = (title: string) => {
  const t = title.toLowerCase()
  if (t.includes('expense')) return walletOutlineIcon
  if (t.includes('net'))     return fileReportIcon
  return banknoteOutlineIcon
}

const trendPillCls = (direction?: string) => {
  const d = (direction ?? '').toLowerCase()
  if (d === 'up')   return 'av2-kpi-trend--positive'
  if (d === 'down') return 'av2-kpi-trend--negative'
  return 'av2-kpi-trend--neutral'
}

const trendIco = (direction?: string) => {
  const d = (direction ?? '').toLowerCase()
  if (d === 'up')   return arrowUpIcon
  if (d === 'down') return arrowDownIcon
  return minusIcon
}

const currFmt = (v: string) => convertCurrencyText(v, 'PHP')

const getDeptStatus = (utilizationPct: number): DeptStatus => {
  if (utilizationPct > 100) return 'over'
  if (utilizationPct < 75) return 'under'
  return 'on-track'
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const Av2KpiCard = ({ metric }: { metric: MetricDto }) => {
  const trendDir = (metric.trendDirection ?? '').toLowerCase()
  let fallbackTrend = 'Stable'
  if (trendDir === 'up')   fallbackTrend = 'Up vs Last Month'
  if (trendDir === 'down') fallbackTrend = 'Down vs Last Month'
  const trendText = metric.trendValue ? `${metric.trendValue} vs Last Month` : fallbackTrend

  return (
    <article className="av2-kpi-card" title="Read-only — no drill-down available">
      {/* Faded watermark icon */}
      <span className="av2-kpi-watermark" aria-hidden="true">
        <SvgIcon icon={kpiWatermarkIcon(metric.title)} />
      </span>

      <div className="av2-kpi-header">
        <p className="av2-kpi-title">{metric.title.toUpperCase()}</p>
        <span className="av2-kpi-readonly">READ-ONLY</span>
      </div>

      <div className="av2-kpi-value">{currFmt(metric.value)}</div>

      <span className={`av2-kpi-trend ${trendPillCls(metric.trendDirection)}`}>
        <SvgIcon icon={trendIco(metric.trendDirection)} />
        {trendText}
      </span>
    </article>
  )
}

// ── Department Performance Row ────────────────────────────────────────────────
const Av2DeptBar = ({ name, budget, actual, remaining, utilizationPct }: DepartmentBudgetItem) => {
  const status = getDeptStatus(utilizationPct)
  const config = STATUS_CONFIG[status]
  const barPct = Math.min(utilizationPct, 100)

  return (
    <div className="av2-dept-item">
      <div className="av2-dept-header">
        <span className="av2-dept-name">{name}</span>
        <div className="av2-dept-right">
          <span className={`av2-pill ${config.cls}`}>{config.label}</span>
          <span className="av2-dept-pct">{utilizationPct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="av2-dept-track">
        <div
          className="av2-dept-bar"
          style={{
            width: `${barPct}%`,
            backgroundColor:
              utilizationPct > 100 ? '#EF4444'
              : utilizationPct < 75 ? '#F59E0B'
              : '#22C55E',
          }}
        />
      </div>
      <div className="av2-dept-meta">
        <span>{formatMoney(actual, 'PHP', { maximumFractionDigits: 0 })} used</span>
        <span>{formatMoney(budget, 'PHP', { maximumFractionDigits: 0 })} budget</span>
        <span>{formatMoney(remaining, 'PHP', { maximumFractionDigits: 0 })} remaining</span>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export const AuthorizedViewerDashboard = () => {
  const displayCurrency = useDisplayCurrency()

  const [metrics, setMetrics] = useState<MetricDto[]>([])
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null)
  const [deptBudget, setDeptBudget] = useState<DepartmentBudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const failures: string[] = []

      const [mr, cr, dr] = await Promise.allSettled([
        dashboardService.getMetrics('authorized-viewer'),
        dashboardService.getChartData(),
        dashboardService.getDepartmentBudget(),
      ])

      if (cancelled) return

      if (mr.status === 'fulfilled') setMetrics(mr.value.metrics)
      else failures.push('metrics')

      if (cr.status === 'fulfilled') setChartData(cr.value)
      else failures.push('chart data')

      if (dr.status === 'fulfilled') setDeptBudget(dr.value.items)
      else failures.push('department budget')

      setErrors(failures)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  // Show only Revenue, Expenses, Net Income (first 3)
  const displayMetrics = metrics.slice(0, 3)

  const areaData = useMemo<AreaChartData[]>(() => {
    if (!chartData?.data?.length) return []
    return chartData.data.map((d) => ({
      month: d.label,
      revenue: d.series.find((s) => s.name === 'Revenue')?.values[0] ?? 0,
      expenses: d.series.find((s) => s.name === 'Expenses')?.values[0] ?? 0,
    }))
  }, [chartData])

  const yAxisTickFormatter = useMemo(
    () => (value: number) => formatCurrencyCompact(value, 'PHP'),
    [displayCurrency],
  )

  const tooltipValueFormatter = useMemo(
    () => (value: unknown, name: unknown) => {
      const numericValue = Array.isArray(value) ? Number(value[0]) || 0 : Number(value) || 0
      return [
        formatMoney(numericValue, 'PHP', { maximumFractionDigits: 0 }),
        String(name ?? ''),
      ] as [string, string]
    },
    [displayCurrency],
  )

  const now = new Date()
  const periodLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <section className="dashboard-scene av2-exec-scene">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="av2-hero">
        <div className="av2-hero-left">
          <h1 className="av2-hero-title">Executive Dashboard</h1>
          <span className="av2-badge-viewer">
            {/* Shield-check inline SVG */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
            Authorized Viewer
          </span>
        </div>
        <div className="av2-hero-right">
          <div className="av2-period-box">
            {/* Calendar SVG */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{periodLabel} — Month-to-Date</span>
            {/* Chevron SVG */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <span className="av2-badge-confidential">Confidential — Authorized Viewers Only</span>
        </div>
      </div>

      {errors.length > 0 && (
        <p className="av2-card-sub" style={{ color: '#d32f2f', marginBottom: '1rem' }}>
          Some sections unavailable: {errors.join(', ')}.
        </p>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      {loading ? (
        <SkeletonKpiGrid count={3} />
      ) : (
        <div className="av2-kpi-grid">
          {displayMetrics.map((m) => (
            <Av2KpiCard key={m.title} metric={m} />
          ))}
        </div>
      )}

      {/* ── Bottom row: Area chart + Dept Performance ───────────── */}
      {!loading && (
        <div className="av2-charts-row">

          {/* Area Chart */}
          <div className="av2-panel">
            <h2 className="av2-panel-title">Revenue vs Expenses — Last 6 Months</h2>
            {areaData.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                No live chart data available.
              </p>
            ) : (
              <ResponsiveContainer key={`revenue-expenses-${displayCurrency}`} width="100%" height={280}>
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="av2GradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1D63C1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1D63C1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="av2GradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F5A623" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={yAxisTickFormatter}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                  />
                  <Tooltip
                    formatter={tooltipValueFormatter}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.82rem' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: '0.82rem' }} />
                  <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#1D63C1" strokeWidth={2.5} fill="url(#av2GradRevenue)"  dot={{ r: 4, fill: '#1D63C1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#F5A623" strokeWidth={2.5} fill="url(#av2GradExpenses)" dot={{ r: 4, fill: '#F5A623', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Department Performance */}
          <div className="av2-panel">
            <h2 className="av2-panel-title">Department Performance</h2>
            {deptBudget.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                No live department data available.
              </p>
            ) : (
              <div className="av2-dept-list">
                {deptBudget.map((d) => (
                  <Av2DeptBar key={d.id} {...d} />
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </section>
  )
}
