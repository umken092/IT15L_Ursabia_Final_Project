import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SvgIcon } from '@progress/kendo-react-common'
import {
  banknoteOutlineIcon,
  dashboardOutlineIcon,
  fileReportIcon,
  arrowUpIcon,
  arrowDownIcon,
  minusIcon,
  warningTriangleIcon,
  walletOutlineIcon,
  usersOutlineIcon,
  securityCheckOutlineIcon,
} from '@progress/kendo-svg-icons'
import { DashboardCard } from '../../components/DashboardCard'
import { SkeletonKpiGrid } from '../../components/SkeletonCard'
import { dashboardService, type ApprovalDto, type AuditActivityDto, type ChartDataResponse, type MetricDto } from '../../services/dashboardService'
import { useAuthStore } from '../../store/authStore'
import { roleLabels, type Role } from '../../types/auth'
import { convertCurrencyText, formatCurrencyCompact, formatMoney, useDisplayCurrency } from '../../store/currencyStore'

interface GenericRoleDashboardProps {
  fallbackRole: Role
}

const formatCurrency = (amount: number) => formatMoney(amount, 'PHP')

// Insert spaces between camelCase / PascalCase words and acronyms.
// e.g. "LoginSucceeded" -> "Login Succeeded", "APInvoice" -> "AP Invoice".
const humanize = (value: string | null | undefined): string => {
  if (!value) return ''
  return value
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/([a-z\d])([A-Z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const getChartWidth = () => {
  const viewportWidth = window.innerWidth || 1280
  if (viewportWidth < 768) return 640
  if (viewportWidth < 1024) return viewportWidth - 120
  return viewportWidth - 420
}

export const GenericRoleDashboard = ({ fallbackRole }: GenericRoleDashboardProps) => {
  useDisplayCurrency()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const role = selectedRole || user?.role || fallbackRole

  const [metrics, setMetrics] = useState<MetricDto[]>([])
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null)
  const [approvals, setApprovals] = useState<ApprovalDto[]>([])
  const [auditActivities, setAuditActivities] = useState<AuditActivityDto[]>([])
  const [loading, setLoading] = useState(false)
  const [chartWidth, setChartWidth] = useState<number>(() => getChartWidth())

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [metricResult, chartResult, approvalResult, auditResult] = await Promise.allSettled([
          dashboardService.getMetrics(role),
          dashboardService.getChartData(),
          dashboardService.getPendingApprovals(),
          dashboardService.getAuditActivities(),
        ])

        if (metricResult.status === 'fulfilled') {
          setMetrics(metricResult.value.metrics)
        } else {
          console.error('Failed to load metrics', metricResult.reason)
          setMetrics([])
        }

        if (chartResult.status === 'fulfilled') {
          setChartData(chartResult.value)
        } else {
          console.error('Failed to load chart data', chartResult.reason)
          setChartData(null)
        }

        if (approvalResult.status === 'fulfilled') {
          setApprovals(approvalResult.value.approvals)
        } else {
          console.error('Failed to load approvals', approvalResult.reason)
          setApprovals([])
        }

        if (auditResult.status === 'fulfilled') {
          setAuditActivities(auditResult.value.activities)
        } else {
          console.error('Failed to load audit activities', auditResult.reason)
          setAuditActivities([])
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [role])

  const categories = useMemo(() => chartData?.data.map((d) => d.label) || [], [chartData])
  const revenueSeries = useMemo(
    () => chartData?.data.map((d) => d.series.find((s) => s.name === 'Revenue')?.values[0] ?? 0) || [],
    [chartData],
  )
  const expenseSeries = useMemo(
    () => chartData?.data.map((d) => d.series.find((s) => s.name === 'Expenses')?.values[0] ?? 0) || [],
    [chartData],
  )
  const revenueExpenseData = useMemo(
    () =>
      categories.map((label, index) => ({
        label,
        revenue: revenueSeries[index] ?? 0,
        expenses: expenseSeries[index] ?? 0,
      })),
    [categories, expenseSeries, revenueSeries],
  )

  const showApprovals = approvals.length > 0 && (role === 'cfo' || role === 'faculty-admin' || role === 'accountant')
  const showAudit = auditActivities.length > 0 && role === 'auditor'
  const showRevenueChart = categories.length > 0 && (role === 'accountant' || role === 'authorized-viewer' || role === 'cfo')
  const isAccountant = role === 'accountant'
  const hasKpis = metrics.length > 0
  const hasBoardContent = showRevenueChart || showApprovals || showAudit

  useEffect(() => {
    const handleResize = () => setChartWidth(getChartWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const heroTitle = isAccountant
    ? `Welcome, ${user?.fullName ?? 'Accountant'}`
    : `Welcome, ${user?.fullName} - ${roleLabels[role]} Dashboard`

  const heroSubtitle = isAccountant
    ? (roleLabels[role] ?? 'Accountant')
    : 'Financial snapshot, approvals, and operational signals in one view.'

  const accountantKpiIcons = [dashboardOutlineIcon, fileReportIcon, banknoteOutlineIcon]

  const pickKpiIcon = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('revenue') || t.includes('income') || t.includes('budget')) return banknoteOutlineIcon
    if (t.includes('expense') || t.includes('claim') || t.includes('payroll')) return walletOutlineIcon
    if (t.includes('user') || t.includes('employee')) return usersOutlineIcon
    if (t.includes('audit') || t.includes('approval') || t.includes('void')) return securityCheckOutlineIcon
    if (t.includes('journal') || t.includes('invoice') || t.includes('report')) return fileReportIcon
    if (t.includes('alert') || t.includes('warning') || t.includes('draft')) return warningTriangleIcon
    return dashboardOutlineIcon
  }

  const trendStyle = (direction?: string): { tone: 'positive' | 'negative' | 'warning' | 'neutral'; icon: typeof arrowUpIcon; label: string } => {
    switch ((direction ?? '').toLowerCase()) {
      case 'up':
        return { tone: 'positive', icon: arrowUpIcon, label: 'Up' }
      case 'down':
        return { tone: 'negative', icon: arrowDownIcon, label: 'Down' }
      case 'warning':
        return { tone: 'warning', icon: warningTriangleIcon, label: 'Watch' }
      default:
        return { tone: 'neutral', icon: minusIcon, label: 'Stable' }
    }
  }

  const hasProgress = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0

  return (
    <section className={`dashboard-scene ${isAccountant ? 'accountant-dashboard-scene' : ''}`.trim()}>
      <div className={`dashboard-hero ${isAccountant ? 'accountant-hero' : ''}`.trim()}>
        <h1 className="page-title">
          {heroTitle}
        </h1>
        <p className="dashboard-hero-subtitle">{heroSubtitle}</p>
      </div>

      {loading && <SkeletonKpiGrid count={3} />}

      {!loading && (
        <>
        {hasKpis ? (
        <div className={`dashboard-grid cols-3 dashboard-kpis-grid kpi-grid-modern ${isAccountant ? 'accountant-kpis-grid' : ''}`.trim()}>
        {metrics.map((metric, index) => {
          const trend = trendStyle(metric.trendDirection)
          const icon = isAccountant
            ? accountantKpiIcons[index % accountantKpiIcons.length]
            : pickKpiIcon(metric.title)
          const showProgress = hasProgress(metric.progressPercentage)

          return (
            <article
              key={metric.title}
              className={`kpi-card-modern tone-${trend.tone} ${isAccountant ? 'accountant-kpi-card' : ''}`.trim()}
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
                  const trendDelta = metric.trendValue ? ` (${metric.trendValue})` : ''
                  const trendTip = `${metric.title} is trending ${trend.label}${trendDelta} versus the previous period`
                  return (
                    <span
                      className={`kpi-trend-pill kpi-trend-${trend.tone}`}
                      data-tooltip={trendTip}
                    >
                      <SvgIcon icon={trend.icon} />
                      <span>{metric.trendValue || trend.label}</span>
                    </span>
                  )
                })()}

                {showProgress && (
                  <div
                    className="kpi-meter"
                    data-tooltip={`${metric.title}: ${Math.round(metric.progressPercentage ?? 0)}% complete`}
                  >
                    <span
                      className="kpi-meter-fill"
                      style={{ width: `${Math.min(100, Math.max(0, metric.progressPercentage ?? 0))}%` }}
                    />
                  </div>
                )}
              </footer>
            </article>
          )
        })}
      </div>
        ) : (
          <DashboardCard
            title="No KPI data available"
            subtitle="Live KPI metrics are currently unavailable for this role"
            className={isAccountant ? 'accountant-approvals-card' : ''}
          >
            <p className="activity-description">Please verify dashboard metrics endpoint configuration for your role and refresh the page.</p>
          </DashboardCard>
        )}

      {hasBoardContent && (
        <div className={`dashboard-board ${isAccountant ? 'accountant-dashboard-board' : ''}`.trim()}>
          <div className="dashboard-main-column">
            {showRevenueChart && (
              <DashboardCard
                title="Revenue vs Expenses"
                subtitle="Monthly posted journal totals"
                className={`chart-card main-feature-card ${isAccountant ? 'accountant-chart-card' : ''}`.trim()}
              >
                <div style={{ overflowX: 'auto' }}>
                  <BarChart width={Math.max(560, chartWidth)} height={280} data={revenueExpenseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(v: number) => formatCurrencyCompact(v, 'PHP')} width={70} />
                    <Tooltip formatter={(v) => formatMoney(Number(v), 'PHP')} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </div>
              </DashboardCard>
            )}

            {!showRevenueChart && showApprovals && (
              <DashboardCard
                title="Approvals"
                subtitle={`${approvals.length} items pending or queued`}
                className={`main-feature-card ${isAccountant ? 'accountant-approvals-card' : ''}`.trim()}
              >
                <ul className={`activity-list ${isAccountant ? 'accountant-activity-list' : ''}`.trim()}>
                  {approvals.slice(0, 6).map((item) => (
                    <li key={item.id} className={`activity-item ${isAccountant ? 'accountant-activity-item' : ''}`.trim()}>
                      <div>
                        <div className="activity-title">{item.title}</div>
                        <div className="activity-description">{item.description}</div>
                        {item.amount !== undefined && (
                          <div className="activity-meta">{formatCurrency(item.amount)}</div>
                        )}
                      </div>
                      {isAccountant && <span className="accountant-approval-status-dot" aria-hidden="true">•</span>}
                    </li>
                  ))}
                </ul>
              </DashboardCard>
            )}

            {!showRevenueChart && !showApprovals && showAudit && (
              <DashboardCard title="Recent Audit Activities" subtitle="Last 10 records" className="main-feature-card">
                <ul className="activity-list">
                  {auditActivities.slice(0, 10).map((activity) => (
                    <li key={activity.id} className="activity-item">
                      <div className="activity-title">{humanize(activity.action)}</div>
                      <div className="activity-description">
                        {humanize(activity.entity)} by {activity.user}
                      </div>
                    </li>
                  ))}
                </ul>
              </DashboardCard>
            )}
          </div>

          <div className="dashboard-side-column">
            {showRevenueChart && showApprovals && (
              <DashboardCard
                title="Approvals"
                subtitle={`${approvals.length} items pending or queued`}
                className={`side-feature-card ${isAccountant ? 'accountant-approvals-card' : ''}`.trim()}
              >
                <ul className={`activity-list ${isAccountant ? 'accountant-activity-list' : ''}`.trim()}>
                  {approvals.slice(0, 6).map((item) => (
                    <li key={item.id} className={`activity-item ${isAccountant ? 'accountant-activity-item' : ''}`.trim()}>
                      <div>
                        <div className="activity-title">{item.title}</div>
                        <div className="activity-description">{item.description}</div>
                        {item.amount !== undefined && (
                          <div className="activity-meta">{formatCurrency(item.amount)}</div>
                        )}
                      </div>
                      {isAccountant && <span className="accountant-approval-status-dot" aria-hidden="true">•</span>}
                    </li>
                  ))}
                </ul>
              </DashboardCard>
            )}

            {showRevenueChart && showAudit && (
              <DashboardCard title="Recent Audit Activities" subtitle="Last 10 records" className="side-feature-card">
                <ul className="activity-list">
                  {auditActivities.slice(0, 10).map((activity) => (
                    <li key={activity.id} className="activity-item">
                      <div className="activity-title">{humanize(activity.action)}</div>
                      <div className="activity-description">
                        {humanize(activity.entity)} by {activity.user}
                      </div>
                    </li>
                  ))}
                </ul>
              </DashboardCard>
            )}
          </div>
        </div>
      )}

      {!hasBoardContent && (
        <DashboardCard
          title="No live dashboard widgets available"
          subtitle="Chart and activity widgets are hidden until live data is available"
          className={isAccountant ? 'accountant-approvals-card' : ''}
        >
          <p className="activity-description">No chart points, approvals, or audit activities were returned by the live APIs.</p>
        </DashboardCard>
      )}
        </>
      )}
    </section>
  )
}
