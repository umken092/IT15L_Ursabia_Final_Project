import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SvgIcon } from '@progress/kendo-react-common'
import {
  arrowDownIcon,
  arrowUpIcon,
  banknoteOutlineIcon,
  checkOutlineIcon,
  dashboardOutlineIcon,
  fileReportIcon,
  minusIcon,
  warningTriangleIcon,
} from '@progress/kendo-svg-icons'
import { DashboardCard } from '../../components/DashboardCard'
import { SkeletonKpiGrid } from '../../components/SkeletonCard'
import {
  dashboardService,
  type ApprovalDto,
  type BudgetControlResponse,
  type MetricDto,
} from '../../services/dashboardService'
import { useAuthStore } from '../../store/authStore'
import {
  convertCurrencyText,
  formatCurrencyCompact,
  formatMoney,
  useDisplayCurrency,
} from '../../store/currencyStore'

// ── helpers ──────────────────────────────────────────────────────────────────

type TrendTone = 'positive' | 'negative' | 'warning' | 'neutral'

function trendStyle(direction?: string): { tone: TrendTone; icon: typeof arrowUpIcon; label: string } {
  switch ((direction ?? '').toLowerCase()) {
    case 'up': return { tone: 'positive', icon: arrowUpIcon, label: 'Up' }
    case 'down': return { tone: 'negative', icon: arrowDownIcon, label: 'Down' }
    case 'warning': return { tone: 'warning', icon: warningTriangleIcon, label: 'Watch' }
    default: return { tone: 'neutral', icon: minusIcon, label: 'Stable' }
  }
}

function pickKpiIcon(title: string) {
  const t = title.toLowerCase()
  if (t.includes('budget') || t.includes('allocated')) return banknoteOutlineIcon
  if (t.includes('approval') || t.includes('pending') || t.includes('invoice')) return checkOutlineIcon
  if (t.includes('report') || t.includes('expense')) return fileReportIcon
  return dashboardOutlineIcon
}

function approvalStatusMeta(status: string): { label: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes('due') || s.includes('overdue')) return { label: status, color: '#ef4444' }
  if (s.includes('approved')) return { label: status, color: '#16a34a' }
  if (s.includes('rejected')) return { label: status, color: '#b91c1c' }
  if (s.includes('draft')) return { label: 'Draft awaiting send', color: '#6b7280' }
  if (s.includes('pending')) return { label: 'Pending', color: '#d97706' }
  return { label: status, color: '#6b7280' }
}

// ── component ─────────────────────────────────────────────────────────────────

export const FacultyAdminDashboard = () => {
  useDisplayCurrency()
  const user = useAuthStore((s) => s.user)

  const [metrics, setMetrics] = useState<MetricDto[]>([])
  const [budget, setBudget] = useState<BudgetControlResponse | null>(null)
  const [approvals, setApprovals] = useState<ApprovalDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [mRes, bRes, aRes] = await Promise.allSettled([
          dashboardService.getMetrics('faculty-admin'),
          dashboardService.getBudgetControl(),
          dashboardService.getPendingApprovals(),
        ])
        if (mRes.status === 'fulfilled') setMetrics(mRes.value.metrics)
        if (bRes.status === 'fulfilled') setBudget(bRes.value)
        if (aRes.status === 'fulfilled') setApprovals(aRes.value.approvals)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const utilizationPct = budget
    ? Math.round((budget.totalActual / Math.max(1, budget.totalAllocated)) * 100)
    : 0

  const chartData = budget?.months.map((m) => ({
    label: m.label,
    Actual: m.actual,
    Projected: m.projected,
  })) ?? []

  const kpiIcons = [banknoteOutlineIcon, checkOutlineIcon, fileReportIcon]

  return (
    <section className="dashboard-scene fa-dashboard-scene">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <h1 className="page-title">
          Welcome, {user?.fullName ?? 'Faculty Admin'} — Faculty Admin Dashboard
        </h1>
        <p className="dashboard-hero-subtitle">
          Financial snapshot, approvals, and operational signals in one view.
        </p>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      {loading && <SkeletonKpiGrid count={3} />}

      {!loading && (
        <div className="dashboard-grid cols-3 dashboard-kpis-grid kpi-grid-modern">
          {metrics.map((metric, i) => {
            const trend = trendStyle(metric.trendDirection)
            const icon = kpiIcons[i % kpiIcons.length] ?? pickKpiIcon(metric.title)
            const pct = metric.progressPercentage
            const hasProgress = typeof pct === 'number' && Number.isFinite(pct) && pct > 0

            return (
              <article
                key={metric.title}
                className={`kpi-card-modern tone-${trend.tone}`}
              >
                <span className="kpi-accent" aria-hidden="true" />
                <header className="kpi-card-modern-head">
                  <div>
                    <p className="kpi-card-modern-title">{metric.title}</p>
                    {metric.subtitle && (
                      <p className="kpi-card-modern-sub">
                        {convertCurrencyText(metric.subtitle, 'PHP')}
                      </p>
                    )}
                  </div>
                  <span className="kpi-card-modern-icon" aria-hidden="true">
                    <SvgIcon icon={icon} />
                  </span>
                </header>

                <div className="kpi-card-modern-value">
                  {convertCurrencyText(metric.value, 'PHP')}
                </div>

                <footer className="kpi-card-modern-foot">
                  {metric.trendDirection && (() => {
                    const delta = metric.trendValue ? ` (${metric.trendValue})` : ''
                    const tip = `${metric.title} is trending ${trend.label}${delta} versus the previous period`
                    return (
                      <span
                        className={`kpi-trend-pill kpi-trend-${trend.tone}`}
                        data-tooltip={tip}
                      >
                        <SvgIcon icon={trend.icon} />
                        <span>{metric.trendValue ?? trend.label}</span>
                      </span>
                    )
                  })()}

                  {hasProgress && (
                    <div
                      className="kpi-meter"
                      data-tooltip={`${metric.title}: ${Math.round(pct ?? 0)}% utilised`}
                    >
                      <span
                        className="kpi-meter-fill"
                        style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                      />
                    </div>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {/* ── Main board ────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="fa-dashboard-stack">
          {/* Budget Utilisation Chart */}
          <DashboardCard
              title="Budget Utilisation"
              subtitle={`${utilizationPct}% of allocated budget consumed · ${budget?.year ?? new Date().getFullYear()}`}
              className="chart-card main-feature-card fa-budget-chart-card"
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="faActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="faProjected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 12 }} />
                    <YAxis
                      stroke="var(--muted)"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => formatCurrencyCompact(v, 'PHP')}
                      width={72}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => {
                        const numericValue = Array.isArray(v) ? Number(v[0]) || 0 : Number(v) || 0
                        return [formatMoney(numericValue, 'PHP'), String(name ?? '')] as [string, string]
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Actual"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#faActual)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="Projected"
                      stroke="var(--secondary)"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      fill="url(#faProjected)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="fa-empty-state">No budget data available for this period.</p>
              )}

              {budget && (
                <div className="fa-budget-footer-strip">
                  <div className="fa-budget-stat">
                    <span className="fa-budget-stat-label">Allocated</span>
                    <span className="fa-budget-stat-value">
                      {formatMoney(budget.totalAllocated, 'PHP')}
                    </span>
                  </div>
                  <div className="fa-budget-stat">
                    <span className="fa-budget-stat-label">Actual Spend</span>
                    <span className="fa-budget-stat-value">
                      {formatMoney(budget.totalActual, 'PHP')}
                    </span>
                  </div>
                  <div className="fa-budget-stat">
                    <span className="fa-budget-stat-label">Remaining</span>
                    <span className={`fa-budget-stat-value ${budget.remainingForecast < 0 ? 'fa-stat-over' : 'fa-stat-ok'}`}>
                      {formatMoney(Math.abs(budget.remainingForecast), 'PHP')}
                      {budget.remainingForecast < 0 ? ' over' : ''}
                    </span>
                  </div>
                  <div className="fa-budget-stat">
                    <span className="fa-budget-stat-label">Pending Requests</span>
                    <span className="fa-budget-stat-value">{budget.pendingRequestCount}</span>
                  </div>
                </div>
              )}
            </DashboardCard>

          {/* Approvals compact table */}
          <DashboardCard
              title="Approvals"
              subtitle={`${approvals.length} item${approvals.length === 1 ? '' : 's'} pending or queued`}
              className="main-feature-card fa-approvals-table-card"
            >
              {approvals.length === 0 ? (
                <p className="fa-empty-state">No pending approvals — all caught up.</p>
              ) : (
                <div className="fa-approvals-table-wrap">
                  <table className="fa-approvals-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Entity</th>
                        <th>Status</th>
                        <th className="fa-col-amount">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvals.slice(0, 8).map((item) => {
                        const { label, color } = approvalStatusMeta(item.status)
                        return (
                          <tr key={item.id}>
                            <td className="fa-col-type">{item.title}</td>
                            <td className="fa-col-entity">{item.description}</td>
                            <td>
                              <span
                                className="fa-status-badge"
                                style={{ background: `${color}18`, color }}
                              >
                                {label}
                              </span>
                            </td>
                            <td className="fa-col-amount">
                              {item.amount === undefined
                                ? '—'
                                : formatMoney(item.amount, 'PHP')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardCard>
        </div>
      )}
    </section>
  )
}
