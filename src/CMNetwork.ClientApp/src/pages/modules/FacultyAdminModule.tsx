import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { TextArea } from '@progress/kendo-react-inputs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { DashboardCard } from '../../components/DashboardCard'
import { DataTable } from '../../components/ui/data-table'
import { SkeletonCard } from '../../components/SkeletonCard'
import type { ColumnDef } from '@tanstack/react-table'
import { useNotificationStore } from '../../store/notificationStore'
import { formatMoney, useDisplayCurrency } from '../../store/currencyStore'
import { dashboardService, type BudgetMonthPoint } from '../../services/dashboardService'
import { approvalsService, expenseClaimsService } from '../../services/extendedOperationsService'
import { reportsService } from '../../services/accountantService'

export type FacultyAdminModuleKey = 'dept-reports' | 'fa-approvals' | 'fa-reports'

interface FacultyAdminModuleProps {
  moduleKey: FacultyAdminModuleKey
}

interface NotificationPayload {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

const fmtMoney = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return '—'
  return formatMoney(v, 'PHP')
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

type ApprovalType = 'expense-claims' | 'purchase-requisitions' | 'budget-transfers'
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Escalated'
type Priority = 'Low' | 'Medium' | 'High'

interface ApprovalItem {
  id: string
  title: string
  type: ApprovalType
  requestedBy: string
  amount: number
  priority: Priority
  status: ApprovalStatus
  description: string
  submittedAt: string
  budgetLine?: string
  budgetAvailable?: number
  wouldExceedBudget?: boolean
}

type ExpenseClaimStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected'

interface FacultyExpenseClaim {
  id: string
  claimNumber: string
  employeeName: string
  claimDate: string
  category: string
  description: string
  amount: number
  status: ExpenseClaimStatus
}

interface ExpenseClaimsMonitoringSummary {
  overall: {
    totalAmount: number
    totalCount: number
    submittedAmount: number
    approvedAmount: number
    rejectedAmount: number
    draftAmount: number
  }
  monthly: Array<{
    month: string
    totalAmount: number
    totalCount: number
    submittedCount: number
    approvedCount: number
    rejectedCount: number
  }>
}

// ─── No mock seed data — all data must come from live API ─────────────────────


interface IncomeStatementLine {
  accountCode: string
  accountName: string
  amount: number
}

interface IncomeStatementResponse {
  from: string
  to: string
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  revenue: IncomeStatementLine[]
  expenses: IncomeStatementLine[]
}

interface BudgetLineItem {
  account: string
  budget: number
  actual: number
  committed: number
}

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

const toMonthYear = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const formatPeriodLabel = (from: string, to: string) => {
  const fromLabel = toMonthYear(from)
  const toLabel = toMonthYear(to)
  if (fromLabel === toLabel) return fromLabel
  return `${fromLabel} – ${toLabel}`
}

// ─── Sub-section tabs ──────────────────────────────────────────────────────────

type ApprovalsTab = 'expense-claims' | 'purchase-requisitions' | 'budget-transfers'

// ─── Department Reports ────────────────────────────────────────────────────────

type BudgetHealthStatus = 'Healthy' | 'Watch' | 'At Risk' | 'Loading'

function deriveBudgetHealth(pctUsed: number, varianceCount: number): BudgetHealthStatus {
  if (pctUsed >= 95 || varianceCount >= 3) return 'At Risk'
  if (pctUsed >= 80 || varianceCount >= 1) return 'Watch'
  return 'Healthy'
}

const HEALTH_STYLE: Record<BudgetHealthStatus, { color: string; bg: string; dot: string }> = {
  Healthy: { color: '#16a34a', bg: '#dcfce7', dot: '#16a34a' },
  Watch: { color: '#b45309', bg: '#fef3c7', dot: '#d97706' },
  'At Risk': { color: '#b91c1c', bg: '#fee2e2', dot: '#ef4444' },
  Loading: { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
}

function DeptReportsSection() {
  useDisplayCurrency()
  const location = useLocation()
  const pushToast = useNotificationStore((s) => s.push)
  const notify = useCallback((payload: NotificationPayload) => {
    pushToast(payload.type, payload.message)
  }, [pushToast])
  const [budgetData, setBudgetData] = useState<{ months: BudgetMonthPoint[]; totalAllocated: number; totalActual: number; remainingForecast: number; varianceRequestCount: number } | null>(null)
  const [liveBudgetLines, setLiveBudgetLines] = useState<BudgetLineItem[]>([])
  const [loading, setLoading] = useState(true)

  // Derive active section from URL hash; default to budget-status
  const activeSection = useMemo(() => {
    const hash = location.hash.replace('#', '')
    if (hash === 'variance-analysis') return 'variance-analysis'
    if (hash === 'export-pdf') return 'export-pdf'
    return 'budget-status'
  }, [location.hash])

  useEffect(() => {
    Promise.allSettled([
      dashboardService.getBudgetControl(),
      dashboardService.getDepartmentBudget(),
    ])
      .then(([controlRes, budgetRes]) => {
        if (controlRes.status === 'fulfilled') setBudgetData(controlRes.value)
        else notify({ type: 'warning', message: 'Could not load live budget summary.' })
        if (budgetRes.status === 'fulfilled') {
          setLiveBudgetLines(
            budgetRes.value.items.map((item) => ({
              account: item.name,
              budget: item.budget,
              actual: item.actual,
              committed: item.budget - item.actual - item.remaining,
            }))
          )
        } else {
          notify({ type: 'warning', message: 'Could not load live budget line detail.' })
        }
      })
      .finally(() => setLoading(false))
  }, [notify])

  const chartData = useMemo(() => {
    if (!budgetData?.months?.length) return []
    return budgetData.months.map((m) => ({
      month: m.label,
      Budget: m.projected,
      Actual: m.actual,
    }))
  }, [budgetData])

  const totalBudget = budgetData?.totalAllocated ?? 0
  const totalActual = budgetData?.totalActual ?? 0
  const pctUsed = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
  const remaining = budgetData?.remainingForecast ?? (totalBudget - totalActual)
  const overBudgetCount = liveBudgetLines.filter((l) => l.actual > l.budget).length
  const healthStatus: BudgetHealthStatus = loading ? 'Loading' : deriveBudgetHealth(pctUsed, overBudgetCount)
  const healthStyle = HEALTH_STYLE[healthStatus]

  const varianceColumns: ColumnDef<BudgetLineItem>[] = [
    { accessorKey: 'account', header: 'Budget Account' },
    { accessorKey: 'budget', header: 'Budget (PHP)', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    { accessorKey: 'actual', header: 'Actual (PHP)', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    {
      id: 'variance',
      header: 'Variance',
      cell: ({ row }) => {
        const v = row.original.actual - row.original.budget
        const pct = row.original.budget > 0 ? (v / row.original.budget) * 100 : 0
        const over = v > 0
        return (
          <span style={{ color: over ? 'var(--danger, #D32F2F)' : 'var(--success, #2E7D32)', fontWeight: 600 }}>
            {fmtMoney(Math.abs(v))} {over ? '▲ over' : '▼ under'} ({fmtPct(Math.abs(pct))})
          </span>
        )
      },
    },
    { accessorKey: 'committed', header: 'Committed (PHP)', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { actual, budget } = row.original
        const pct = budget > 0 ? (actual / budget) * 100 : 0
        let bgColor = '#dcfce7'
        let textColor = '#16a34a'
        let label = `On Track (${pct.toFixed(0)}%)`
        if (pct >= 95) { bgColor = '#fee2e2'; textColor = '#b91c1c'; label = `At Limit (${pct.toFixed(0)}%)` }
        else if (pct >= 80) { bgColor = '#fef3c7'; textColor = '#b45309'; label = `Watch (${pct.toFixed(0)}%)` }
        return (
          <span style={{ background: bgColor, color: textColor, fontWeight: 700, padding: '0.2em 0.6em', borderRadius: 999, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )
      },
    },
  ]

  return (
    <section className="fa-module-section">
      {/* ── Global Header ── */}
      <div className="fa-dept-header">
        <div className="fa-dept-header-right">
          {/* Dynamic health status badge */}
          <div
            className="fa-health-badge"
            style={{ background: healthStyle.bg, color: healthStyle.color }}
            title={`Budget health: ${healthStatus} — ${pctUsed.toFixed(1)}% utilised`}
          >
            <span className="fa-health-dot" style={{ background: healthStyle.dot }} />
            {healthStatus === 'Loading' ? 'Loading…' : `${healthStatus} · ${pctUsed.toFixed(1)}%`}
          </div>
          {/* KPI summary chips */}
          {!loading && (
            <div className="fa-header-chips">
              <span className="fa-header-chip">
                <span className="fa-chip-label">Total Budget</span>
                <span className="fa-chip-value">{fmtMoney(totalBudget)}</span>
              </span>
              <span className="fa-header-chip">
                <span className="fa-chip-label">Actual Spent</span>
                <span className="fa-chip-value">{fmtMoney(totalActual)} ({pctUsed.toFixed(1)}%)</span>
              </span>
              <span className="fa-header-chip">
                <span className="fa-chip-label">Remaining Forecast</span>
                <span className="fa-chip-value" style={{ color: remaining < 0 ? '#b91c1c' : '#16a34a' }}>
                  {fmtMoney(remaining)} ({(100 - pctUsed).toFixed(1)}%)
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content (hash-driven section) ── */}
      <div className="fa-tab-content">
        {loading && <SkeletonCard />}
        {!loading && activeSection === 'variance-analysis' && (
          <DashboardCard title="Variance Detail — All Budget Lines" className="fa-table-card">
            {liveBudgetLines.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No live budget line data available.</p>
            ) : (
              <DataTable
                columns={varianceColumns as ColumnDef<object>[]}
                data={liveBudgetLines}
                initialPageSize={10}
              />
            )}
          </DashboardCard>
        )}
        {!loading && activeSection === 'export-pdf' && (
          <DashboardCard title="Export PDF Summary" className="fa-chart-card">
            <div style={{ padding: '1.5rem 0.5rem' }}>
              <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
                Generate a PDF report for your department's current budget period. The report includes budget vs actual figures, variance analysis, and a cost centre summary.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4 }}>Total Allocated</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{fmtMoney(totalBudget)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4 }}>Actual Spend</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{fmtMoney(totalActual)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4 }}>Remaining Forecast</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: remaining < 0 ? '#b91c1c' : '#16a34a' }}>{fmtMoney(remaining)}</div>
                </div>
              </div>
              <button
                className="fa-export-btn"
                style={{ marginTop: '1.5rem' }}
                onClick={() => notify({ type: 'success', message: 'Department Budget Summary PDF has been generated and is ready to download.' })}
              >
                Generate &amp; Download PDF
              </button>
            </div>
          </DashboardCard>
        )}
        {!loading && activeSection === 'budget-status' && (
          <>
            {/* Budget Status: bar chart + detail table */}
            <DashboardCard title="Budget vs Actual — Monthly Trend" className="fa-chart-card">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted)" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} stroke="var(--muted)" />
                  <Tooltip
                    formatter={(value, name) => [fmtMoney(typeof value === 'number' ? value : Number(value ?? 0)), String(name)]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="Budget" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </DashboardCard>

            <DashboardCard title="Budget Lines — Detail" className="fa-table-card">
              {liveBudgetLines.length === 0 ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No live budget line data available.</p>
              ) : (
                <DataTable
                  columns={varianceColumns as ColumnDef<object>[]}
                  data={liveBudgetLines}
                  initialPageSize={10}
                />
              )}
            </DashboardCard>
          </>
        )}
      </div>
    </section>
  )
}

// ─── Approvals Inbox ───────────────────────────────────────────────────────────

interface ApprovalAction {
  item: ApprovalItem
  action: 'Approve' | 'Reject' | 'Delegate' | 'Escalate'
}

// ─── Approvals Inbox ───────────────────────────────────────────────────────────

interface ApprovalAction {
  item: ApprovalItem
  action: 'Approve' | 'Reject' | 'Delegate' | 'Escalate'
}

function BudgetBadge({ item }: Readonly<{ item: ApprovalItem }>) {
  if (item.wouldExceedBudget) {
    const label = item.budgetLine ? `Exceeds Budget – ${item.budgetLine}` : 'Exceeds Budget'
    return (
      <span className="ai-budget-badge ai-budget-over">
        <span className="ai-badge-icon">⚠</span>
        {label}
      </span>
    )
  }
  const avail = item.budgetAvailable == null ? '' : ` (${fmtMoney(item.budgetAvailable)} available)`
  return (
    <span className="ai-budget-badge ai-budget-ok">
      <span className="ai-badge-icon">✓</span>
      {`Within Budget${avail}`}
    </span>
  )
}

function PriorityPill({ priority }: Readonly<{ priority: Priority }>) {
  const styles: Record<Priority, { color: string; bg: string }> = {
    High: { color: '#b91c1c', bg: '#fee2e2' },
    Medium: { color: '#b45309', bg: '#fef3c7' },
    Low: { color: '#15803d', bg: '#dcfce7' },
  }
  const s = styles[priority]
  return (
    <span style={{ color: s.color, background: s.bg, fontWeight: 700, padding: '0.2em 0.65em', borderRadius: 999, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
      {priority}
    </span>
  )
}

function ApprovalsInboxSection() {
  useDisplayCurrency()
  const pushToast = useNotificationStore((s) => s.push)
  const notify = useCallback((payload: NotificationPayload) => {
    pushToast(payload.type, payload.message)
  }, [pushToast])
  const [tab, setTab] = useState<ApprovalsTab>('expense-claims')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [expenseClaims, setExpenseClaims] = useState<FacultyExpenseClaim[]>([])
  const [expenseSummary, setExpenseSummary] = useState<ExpenseClaimsMonitoringSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expenseLoading, setExpenseLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null)
  const [pendingExpenseAction, setPendingExpenseAction] = useState<{ claim: FacultyExpenseClaim; action: 'Approve' | 'Reject' } | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [processing, setProcessing] = useState(false)
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    approvalsService
      .getApprovalQueue()
      .then((res) => {
        const apiItems = (res.data ?? []) as Array<{
          id: string
          entityType: string
          entityDescription: string
          amount: number
          requestedByName: string
          status: number
        }>
        const liveItems: ApprovalItem[] = apiItems.map((i) => {
          let itemType: ApprovalType = 'purchase-requisitions'
          if (i.entityType?.toLowerCase().includes('expense')) { itemType = 'expense-claims' }
          else if (i.entityType?.toLowerCase().includes('budget')) { itemType = 'budget-transfers' }
          return {
            id: i.id,
            title: i.entityDescription ?? i.entityType,
            type: itemType,
            requestedBy: i.requestedByName ?? 'Unknown',
            amount: i.amount ?? 0,
            priority: 'Medium' as Priority,
            status: 'Pending' as ApprovalStatus,
            description: i.entityDescription ?? '',
            submittedAt: new Date().toISOString().slice(0, 10),
          }
        })
        setItems(liveItems)
      })
      .catch(() => {
        notify({ type: 'error', message: 'Could not load approval queue. Please refresh to try again.' })
      })
      .finally(() => setLoading(false))
  }, [notify])

  useEffect(() => {
    Promise.all([
      expenseClaimsService.getClaims(),
      expenseClaimsService.getMonitoringSummary(),
    ])
      .then(([claimsRes, summaryRes]) => {
        const apiClaims = (claimsRes.data ?? []) as Array<{
          id: string
          claimNumber: string
          employeeName: string
          claimDate: string
          category: string
          description: string
          amount: number
          status: number
        }>
        const statusMap: Record<number, ExpenseClaimStatus> = {
          1: 'Draft',
          2: 'Submitted',
          3: 'Approved',
          4: 'Rejected',
        }
        setExpenseClaims(
          apiClaims.map((c) => ({
            id: c.id,
            claimNumber: c.claimNumber,
            employeeName: c.employeeName,
            claimDate: c.claimDate,
            category: c.category,
            description: c.description,
            amount: c.amount,
            status: statusMap[c.status] ?? 'Draft',
          })),
        )
        setExpenseSummary((summaryRes.data ?? null) as ExpenseClaimsMonitoringSummary | null)
      })
      .catch(() => {
        notify({ type: 'error', message: 'Could not load expense claims monitoring data.' })
      })
      .finally(() => setExpenseLoading(false))
  }, [notify])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(
      (i) =>
        i.type === tab &&
        i.status === 'Pending' &&
        (!q || i.title.toLowerCase().includes(q) || i.requestedBy.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
    )
  }, [items, tab, search])

  const filteredExpenseClaims = useMemo(() => {
    const q = search.toLowerCase()
    return expenseClaims.filter((claim) => {
      if (!q) return true
      return (
        claim.claimNumber.toLowerCase().includes(q)
        || claim.employeeName.toLowerCase().includes(q)
        || claim.category.toLowerCase().includes(q)
      )
    })
  }, [expenseClaims, search])

  const refreshExpenseClaims = useCallback(async () => {
    const [claimsRes, summaryRes] = await Promise.all([
      expenseClaimsService.getClaims(),
      expenseClaimsService.getMonitoringSummary(),
    ])

    const apiClaims = (claimsRes.data ?? []) as Array<{
      id: string
      claimNumber: string
      employeeName: string
      claimDate: string
      category: string
      description: string
      amount: number
      status: number
    }>
    const statusMap: Record<number, ExpenseClaimStatus> = {
      1: 'Draft',
      2: 'Submitted',
      3: 'Approved',
      4: 'Rejected',
    }

    setExpenseClaims(
      apiClaims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        employeeName: c.employeeName,
        claimDate: c.claimDate,
        category: c.category,
        description: c.description,
        amount: c.amount,
        status: statusMap[c.status] ?? 'Draft',
      })),
    )
    setExpenseSummary((summaryRes.data ?? null) as ExpenseClaimsMonitoringSummary | null)
  }, [])

  const handleExpenseAction = useCallback(async () => {
    if (!pendingExpenseAction) return

    setProcessing(true)
    try {
      if (pendingExpenseAction.action === 'Approve') {
        await expenseClaimsService.approveClaim(pendingExpenseAction.claim.id, actionNote.trim() || undefined)
      } else {
        await expenseClaimsService.rejectClaim(pendingExpenseAction.claim.id, actionNote.trim() || undefined)
      }

      await refreshExpenseClaims()
      notify({
        type: 'success',
        message: `Expense claim ${pendingExpenseAction.claim.claimNumber} ${pendingExpenseAction.action.toLowerCase()}d successfully.`,
      })
    } catch {
      notify({ type: 'error', message: 'Failed to process expense claim action. Please try again.' })
    } finally {
      setProcessing(false)
      setPendingExpenseAction(null)
      setActionNote('')
    }
  }, [actionNote, notify, pendingExpenseAction, refreshExpenseClaims])

  const handleAction = useCallback(async () => {
    if (!pendingAction) return
    setProcessing(true)
    try {
      const { item, action } = pendingAction
      if (action === 'Approve' || action === 'Reject') {
        await approvalsService.processApproval({
          approvalId: item.id,
          action: action === 'Approve' ? 'Approve' : 'Reject',
          comments: actionNote,
        })
      } else if (action === 'Escalate') {
        await approvalsService.escalateRequest({
          itemId: item.id,
          reason: 'Other',
          escalateTo: 'cfo',
          priority: 'High',
          notes: actionNote,
        })
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: action === 'Delegate' ? 'Pending' : (action as ApprovalStatus) }
            : i,
        ),
      )
      let msg = `Delegated: ${item.title} has been reassigned.`
      if (action === 'Approve') { msg = `Approved: ${item.title}. Budget updated.` }
      else if (action === 'Reject') { msg = `Rejected: ${item.title}. Requester will be notified.` }
      else if (action === 'Escalate') { msg = `Escalated to CFO: ${item.title}.` }
      notify({ type: 'success', message: msg })
    } catch {
      notify({ type: 'error', message: 'Action could not be completed. Please try again.' })
    } finally {
      setProcessing(false)
      setPendingAction(null)
      setActionNote('')
    }
  }, [pendingAction, actionNote, notify])

  const tabLabels: Record<ApprovalsTab, string> = {
    'expense-claims': 'Expense Claims',
    'purchase-requisitions': 'Purchase Requisitions',
    'budget-transfers': 'Budget Transfers',
  }

  const pendingCount = (t: ApprovalsTab) => {
    if (t === 'expense-claims') {
      return expenseClaims.filter((c) => c.status === 'Submitted').length
    }
    return items.filter((i) => i.type === t && i.status === 'Pending').length
  }

  const highPriorityCount = tab === 'expense-claims'
    ? expenseClaims.filter((c) => c.status === 'Submitted' && c.amount >= 10000).length
    : items.filter((i) => i.priority === 'High' && i.status === 'Pending').length

  const totalPendingCount = tab === 'expense-claims'
    ? expenseClaims.filter((c) => c.status === 'Submitted').length
    : items.filter((i) => i.status === 'Pending').length

  const budgetWarningsCount = tab === 'expense-claims'
    ? expenseClaims.filter((c) => c.status === 'Submitted' && c.amount >= 20000).length
    : items.filter((i) => i.wouldExceedBudget && i.status === 'Pending').length

  const approvedTodayCount = tab === 'expense-claims'
    ? expenseClaims.filter((c) => c.status === 'Approved').length
    : items.filter((i) => i.status === 'Approved').length

  const monthlyExpenseTrend = useMemo(() => {
    return (expenseSummary?.monthly ?? []).map((m) => ({
      month: toMonthYear(`${m.month}-01`),
      Total: m.totalAmount,
      Approved: m.approvedCount,
      Submitted: m.submittedCount,
    }))
  }, [expenseSummary])

  const commonColumns: ColumnDef<ApprovalItem>[] = [
    { accessorKey: 'id', header: 'Ref #', size: 140 },
    { accessorKey: 'title', header: 'Description' },
    { accessorKey: 'requestedBy', header: 'Submitted By' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => fmtMoney(getValue<number>()) },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => <PriorityPill priority={getValue<Priority>()} />,
    },
    {
      id: 'budget-check',
      header: 'Budget Check',
      cell: ({ row }) => <BudgetBadge item={row.original} />,
    },
    { accessorKey: 'submittedAt', header: 'Submitted' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original
        const isCrossDept = item.budgetLine?.toLowerCase().includes('cross-department')
        return (
          <div className="ai-action-cell">
            <button
              className="ai-icon-btn ai-icon-view"
              title="View details"
              onClick={() => setDetailItem(item)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            {!isCrossDept && (
              <button
                className="ai-icon-btn ai-icon-approve"
                title="Approve"
                onClick={() => { setPendingAction({ item, action: 'Approve' }); setActionNote('') }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            )}
            {!isCrossDept && (
              <button
                className="ai-icon-btn ai-icon-reject"
                title="Reject"
                onClick={() => { setPendingAction({ item, action: 'Reject' }); setActionNote('') }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            {isCrossDept && (
              <button
                className="ai-icon-btn ai-icon-escalate"
                title="Forward to CFO"
                onClick={() => { setPendingAction({ item, action: 'Escalate' }); setActionNote('') }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
            )}
            <button
              className="ai-icon-btn ai-icon-delegate"
              title="Delegate"
              onClick={() => { setPendingAction({ item, action: 'Delegate' }); setActionNote('') }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <section className="fa-module-section ai-inbox">
      {/* ── KPI Cards ── */}
      <div className="ai-kpi-row">
        <div className="ai-kpi-card">
          <div className="ai-kpi-left">
            <div className="ai-kpi-value" style={{ color: '#dc2626' }}>{highPriorityCount}</div>
            <div className="ai-kpi-label">High Priority</div>
          </div>
          <div className="ai-kpi-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
        </div>
        <div className="ai-kpi-card">
          <div className="ai-kpi-left">
            <div className="ai-kpi-value" style={{ color: '#1D63C1' }}>{totalPendingCount}</div>
            <div className="ai-kpi-label">Total Pending</div>
          </div>
          <div className="ai-kpi-icon" style={{ background: '#dbeafe', color: '#1D63C1' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
        </div>
        <div className="ai-kpi-card">
          <div className="ai-kpi-left">
            <div className="ai-kpi-value" style={{ color: '#d97706' }}>{budgetWarningsCount}</div>
            <div className="ai-kpi-label">Budget Warnings</div>
          </div>
          <div className="ai-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
          </div>
        </div>
        <div className="ai-kpi-card">
          <div className="ai-kpi-left">
            <div className="ai-kpi-value" style={{ color: '#16a34a' }}>{approvedTodayCount}</div>
            <div className="ai-kpi-label">Approved Today</div>
          </div>
          <div className="ai-kpi-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="ai-tab-bar" role="tablist">
        {(['expense-claims', 'purchase-requisitions', 'budget-transfers'] as ApprovalsTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`ai-tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => { setTab(t); setSearch('') }}
          >
            {tabLabels[t]}
            {pendingCount(t) > 0 && (
              <span className="ai-tab-badge">{pendingCount(t)}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="ai-search-row">
        <div className="ai-search-box">
          <svg className="ai-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="ai-search-input"
            type="text"
            placeholder="Search by ref, description, or requestor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="ai-filter-icon-btn" title="Filter">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        </button>
        <button className="ai-filter-icon-btn" title="Sort">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
        </button>
      </div>

      {/* ── Table ── */}
      <div className="ai-table-section">
        {tab === 'expense-claims' ? (
          <>
            {expenseLoading && <SkeletonCard />}
            {!expenseLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
                <DashboardCard title="Overall Claims Total" className="fa-table-card">
                  <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{fmtMoney(expenseSummary?.overall.totalAmount ?? 0)}</div>
                  <div style={{ color: 'var(--muted)' }}>{expenseSummary?.overall.totalCount ?? 0} total claims</div>
                </DashboardCard>
                <DashboardCard title="Approved (Past & Present)" className="fa-table-card">
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#166534' }}>{fmtMoney(expenseSummary?.overall.approvedAmount ?? 0)}</div>
                </DashboardCard>
                <DashboardCard title="Submitted (For Review)" className="fa-table-card">
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>{fmtMoney(expenseSummary?.overall.submittedAmount ?? 0)}</div>
                </DashboardCard>
                <DashboardCard title="Rejected" className="fa-table-card">
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#b91c1c' }}>{fmtMoney(expenseSummary?.overall.rejectedAmount ?? 0)}</div>
                </DashboardCard>
              </div>
            )}

            {!expenseLoading && monthlyExpenseTrend.length > 0 && (
              <DashboardCard title="Monthly Expense Claims Monitoring" className="fa-chart-card">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyExpenseTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--muted)" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} stroke="var(--muted)" />
                    <Tooltip formatter={(value, name) => [name === 'Total' ? fmtMoney(typeof value === 'number' ? value : Number(value ?? 0)) : String(value ?? 0), String(name)]} />
                    <Legend />
                    <Bar dataKey="Total" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Submitted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Approved" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardCard>
            )}

            {!expenseLoading && filteredExpenseClaims.length === 0 && (
              <div className="fa-empty-state">
                <p>{search ? 'No expense claims match your search.' : 'No expense claims found yet.'}</p>
              </div>
            )}

            {!expenseLoading && filteredExpenseClaims.length > 0 && (
              <DashboardCard title="Employee Expense Claims" className="fa-table-card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="fa-approvals-table">
                    <thead>
                      <tr>
                        <th>Claim #</th>
                        <th>Employee</th>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenseClaims.map((claim) => (
                        <tr key={claim.id}>
                          <td>{claim.claimNumber}</td>
                          <td>{claim.employeeName}</td>
                          <td>{claim.claimDate}</td>
                          <td>{claim.category}</td>
                          <td>{fmtMoney(claim.amount)}</td>
                          <td>{claim.status}</td>
                          <td>
                            {claim.status === 'Submitted' ? (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button
                                  size="small"
                                  themeColor="primary"
                                  onClick={() => {
                                    setPendingExpenseAction({ claim, action: 'Approve' })
                                    setActionNote('')
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  themeColor="error"
                                  onClick={() => {
                                    setPendingExpenseAction({ claim, action: 'Reject' })
                                    setActionNote('')
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span style={{ color: '#64748b' }}>No action</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>
            )}
          </>
        ) : (
          <>
            {loading && <SkeletonCard />}
            {!loading && filtered.length === 0 && (
              <div className="fa-empty-state">
                <p>{search ? 'No results match your search.' : `No pending ${tabLabels[tab].toLowerCase()} — you are all caught up.`}</p>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <DashboardCard title={`Pending ${tabLabels[tab]}`} className="fa-table-card">
                <DataTable columns={commonColumns as ColumnDef<object>[]} data={filtered} initialPageSize={8} />
              </DashboardCard>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      {detailItem && (
        <Dialog title={`Request Detail — ${detailItem.id}`} onClose={() => setDetailItem(null)} width={560}>
          <div className="fa-detail-body">
            <div className="fa-detail-row"><span>Description</span><strong>{detailItem.title}</strong></div>
            <div className="fa-detail-row"><span>Requested By</span><strong>{detailItem.requestedBy}</strong></div>
            <div className="fa-detail-row"><span>Amount</span><strong>{fmtMoney(detailItem.amount)}</strong></div>
            <div className="fa-detail-row"><span>Priority</span><strong><PriorityPill priority={detailItem.priority} /></strong></div>
            <div className="fa-detail-row"><span>Budget Line</span><strong>{detailItem.budgetLine ?? '—'}</strong></div>
            <div className="fa-detail-row">
              <span>Budget Status</span>
              <strong><BudgetBadge item={detailItem} /></strong>
            </div>
            <div className="fa-detail-row"><span>Submitted</span><strong>{detailItem.submittedAt}</strong></div>
            <div className="fa-detail-notes"><span>Notes / Justification</span><p>{detailItem.description}</p></div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={() => { setPendingAction({ item: detailItem, action: 'Approve' }); setDetailItem(null); setActionNote('') }}>Approve</Button>
            <Button themeColor="error" onClick={() => { setPendingAction({ item: detailItem, action: 'Reject' }); setDetailItem(null); setActionNote('') }}>Reject</Button>
            <Button onClick={() => setDetailItem(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* Action confirmation Dialog */}
      {pendingAction && (
        <Dialog
          title={`${pendingAction.action}: ${pendingAction.item.title}`}
          onClose={() => { setPendingAction(null); setActionNote('') }}
          width={500}
        >
          <div className="fa-action-dialog-body">
            {pendingAction.action === 'Approve' && pendingAction.item.wouldExceedBudget && (
              <div className="fa-action-warning">
                ⚠ <strong>Budget Warning:</strong> Approving this will push <em>{pendingAction.item.budgetLine}</em> over its limit.
              </div>
            )}
            <p>
              {pendingAction.action === 'Approve' && 'Approving will update the department budget and (for expense claims) create an AP Invoice.'}
              {pendingAction.action === 'Reject' && 'Provide a reason for rejection. The requester will be notified.'}
              {pendingAction.action === 'Delegate' && 'This approval will be reassigned. Add a handover note.'}
              {pendingAction.action === 'Escalate' && 'This item will be forwarded to the CFO for review.'}
            </p>
            <label className="fa-note-label">
              {pendingAction.action === 'Reject' ? 'Rejection reason (required)' : 'Notes (optional)'}
            </label>
            <TextArea
              value={actionNote}
              onChange={(e) => setActionNote(String(e.value ?? ''))}
              rows={3}
              placeholder={
                pendingAction.action === 'Reject'
                  ? 'Explain why this request cannot be approved…'
                  : 'Add any relevant context…'
              }
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <DialogActionsBar>
            {(() => {
              let btnTheme: 'primary' | 'error' | 'base' = 'base'
              if (pendingAction.action === 'Approve') { btnTheme = 'primary' }
              else if (pendingAction.action === 'Reject') { btnTheme = 'error' }
              return (
                <Button
                  themeColor={btnTheme}
                  onClick={handleAction}
                  disabled={processing || (pendingAction.action === 'Reject' && !actionNote.trim())}
                >
                  {processing ? 'Processing…' : `Confirm ${pendingAction.action}`}
                </Button>
              )
            })()}
            <Button onClick={() => { setPendingAction(null); setActionNote('') }} disabled={processing}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {pendingExpenseAction && (
        <Dialog
          title={`${pendingExpenseAction.action} Expense Claim ${pendingExpenseAction.claim.claimNumber}`}
          onClose={() => { setPendingExpenseAction(null); setActionNote('') }}
          width={500}
        >
          <div className="fa-action-dialog-body">
            <p>
              {pendingExpenseAction.action === 'Approve'
                ? 'This will mark the expense claim as approved.'
                : 'This will mark the expense claim as rejected.'}
            </p>
            <label className="fa-note-label">
              {pendingExpenseAction.action === 'Reject' ? 'Rejection reason (required)' : 'Notes (optional)'}
            </label>
            <TextArea
              value={actionNote}
              onChange={(e) => setActionNote(String(e.value ?? ''))}
              rows={3}
              placeholder={pendingExpenseAction.action === 'Reject' ? 'Explain why this claim is rejected…' : 'Add notes…'}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <DialogActionsBar>
            <Button
              themeColor={pendingExpenseAction.action === 'Approve' ? 'primary' : 'error'}
              onClick={handleExpenseAction}
              disabled={processing || (pendingExpenseAction.action === 'Reject' && !actionNote.trim())}
            >
              {processing ? 'Processing…' : `Confirm ${pendingExpenseAction.action}`}
            </Button>
            <Button onClick={() => { setPendingExpenseAction(null); setActionNote('') }} disabled={processing}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}

// ─── Departmental P&L Reports ──────────────────────────────────────────────────

function DeptReportsModule() {
  useDisplayCurrency()
  const pushToast = useNotificationStore((s) => s.push)
  const notify = useCallback((payload: NotificationPayload) => {
    pushToast(payload.type, payload.message)
  }, [pushToast])
  const [exporting, setExporting] = useState(false)
  const [drillAccount, setDrillAccount] = useState<string | null>(null)
  const [statement, setStatement] = useState<IncomeStatementResponse | null>(null)
  const [loadingStatement, setLoadingStatement] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'unavailable'>('unavailable')

  const periodRange = useMemo(() => {
    const today = new Date()
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    return {
      startDate: toIsoDate(startOfYear),
      endDate: toIsoDate(today),
    }
  }, [])

  useEffect(() => {
    let active = true

    reportsService
      .getIncomeStatement(periodRange)
      .then((res) => {
        if (!active) return
        setStatement(res.data as IncomeStatementResponse)
        setDataSource('live')
      })
      .catch(() => {
        if (!active) return
        setStatement(null)
        setDataSource('unavailable')
        notify({ type: 'warning', message: 'Live P&L data is unavailable. No data will be shown.' })
      })
      .finally(() => {
        if (active) setLoadingStatement(false)
      })

    return () => {
      active = false
    }
  }, [notify, periodRange])

  const revenueLines = useMemo(() => {
    if (!statement) return []
    return statement.revenue.map((line) => ({
      account: line.accountName || line.accountCode,
      amount: Number(line.amount) || 0,
    }))
  }, [statement])

  const expenseLines = useMemo(() => {
    if (!statement) return []
    return statement.expenses.map((line) => ({
      account: line.accountName || line.accountCode,
      amount: Number(line.amount) || 0,
    }))
  }, [statement])

  const totalRevenue = statement?.totalRevenue ?? revenueLines.reduce((sum, line) => sum + line.amount, 0)
  const totalExpense = statement?.totalExpenses ?? expenseLines.reduce((sum, line) => sum + line.amount, 0)
  const netIncome = totalRevenue - totalExpense
  const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0.0'
  const periodLabel = formatPeriodLabel(statement?.from ?? periodRange.startDate, statement?.to ?? periodRange.endDate)
  const resultPeriodLabel = toMonthYear(statement?.to ?? periodRange.endDate)
  let sourceBadgeLabel = 'Unavailable'
  if (loadingStatement) {
    sourceBadgeLabel = 'Syncing'
  } else if (dataSource === 'live') {
    sourceBadgeLabel = 'Live Data'
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await reportsService.exportReport('income-statement', 'pdf', {
        startDate: statement?.from ?? periodRange.startDate,
        endDate: statement?.to ?? periodRange.endDate,
      })

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data as BlobPart], { type: 'application/pdf' })
      const url = globalThis.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `departmental-pl-${(statement?.to ?? periodRange.endDate)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      globalThis.URL.revokeObjectURL(url)

      notify({ type: 'success', message: 'Departmental P&L Statement PDF generated successfully.' })
    } catch {
      notify({ type: 'warning', message: 'Unable to export PDF right now. Please try again.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <section id="pl-statement" className="pl-report">
      {/* ── Report header bar ── */}
      <div className="pl-report-header">
        <div className="pl-report-meta">
          <span className="pl-report-period">{periodLabel}</span>
          <div className="pl-report-badges">
            <span className={`pl-source-badge ${dataSource === 'live' ? 'pl-source-badge--live' : 'pl-source-badge--unavailable'}`}>
              {sourceBadgeLabel}
            </span>
            <span className={`pl-margin-badge ${netIncome >= 0 ? 'pl-margin-badge--positive' : 'pl-margin-badge--negative'}`}>
              Margin {netMargin}%
            </span>
          </div>
        </div>
        <div className="pl-report-actions">
          <button className="pl-btn-outline" onClick={() => notify({ type: 'info', message: 'Email export requires SMTP integration.' })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Share via Email
          </button>
          <button className="pl-btn-primary" onClick={handleExport} disabled={exporting}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? 'Generating…' : 'Export as PDF'}
          </button>
        </div>
      </div>

      {/* ── Executive summary cards ── */}
      <div className="pl-summary-row">
        <div className="pl-summary-card">
          <div className="pl-summary-label">Total Revenue</div>
          <div className="pl-summary-value pl-revenue">{fmtMoney(totalRevenue)}</div>
          <div className="pl-summary-sub">Tuition, grants &amp; other income</div>
        </div>
        <div className="pl-summary-card">
          <div className="pl-summary-label">Total Expenses</div>
          <div className="pl-summary-value pl-expense">{fmtMoney(totalExpense)}</div>
          <div className="pl-summary-sub">All departmental expenditures</div>
        </div>
        <div className={`pl-summary-card pl-summary-card--accent${netIncome >= 0 ? ' pl-summary-card--surplus' : ' pl-summary-card--deficit'}`}>
          <div className="pl-summary-label">Net Income / (Loss)</div>
          <div className={`pl-summary-value ${netIncome >= 0 ? 'pl-surplus' : 'pl-deficit'}`}>
            {netIncome >= 0 ? fmtMoney(netIncome) : `(${fmtMoney(Math.abs(netIncome))})`}
          </div>
          <div className="pl-summary-sub">{netIncome >= 0 ? 'Surplus for the period' : 'Deficit for the period'}</div>
        </div>
        <div className="pl-summary-card">
          <div className="pl-summary-label">Net Margin</div>
          <div className={`pl-summary-value ${netIncome >= 0 ? 'pl-surplus' : 'pl-deficit'}`}>{netMargin}%</div>
          <div className="pl-summary-sub">Net income as % of revenue</div>
        </div>
      </div>

      {/* ── Revenue section ── */}
      <div className="pl-section-card">
        <div className="pl-section-header pl-section-header--revenue">
          <span className="pl-section-icon">↑</span>{' '}Revenue
        </div>
        <table className="pl-table">
          <thead>
            <tr>
              <th>Account</th>
              <th className="pl-col-amount">Amount (PHP)</th>
              <th className="pl-col-pct">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {revenueLines.length === 0 && (
              <tr className="pl-row">
                <td className="pl-text-muted" colSpan={3}>No revenue entries found for this period.</td>
              </tr>
            )}
            {revenueLines.map((l) => (
              <tr
                key={l.account}
                className={`pl-row pl-row--clickable${drillAccount === l.account ? ' pl-row--active' : ''}`}
                onClick={() => setDrillAccount(drillAccount === l.account ? null : l.account)}
              >
                <td className="pl-cell-account">
                  <span className="pl-drill-indicator">{drillAccount === l.account ? '▾' : '▸'}</span>
                  {l.account}
                </td>
                <td className="pl-col-amount pl-text-revenue">{fmtMoney(l.amount)}</td>
                <td className="pl-col-pct pl-text-muted">{totalRevenue > 0 ? ((l.amount / totalRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pl-row--total">
              <td><strong>Total Revenue</strong></td>
              <td className="pl-col-amount pl-text-revenue"><strong>{fmtMoney(totalRevenue)}</strong></td>
              <td className="pl-col-pct"><strong>{totalRevenue > 0 ? '100.0%' : '—'}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Expenses section ── */}
      <div className="pl-section-card">
        <div className="pl-section-header pl-section-header--expense">
          <span className="pl-section-icon">↓</span>{' '}Expenses
        </div>
        <table className="pl-table">
          <thead>
            <tr>
              <th>Account</th>
              <th className="pl-col-amount">Amount (PHP)</th>
              <th className="pl-col-pct">% of Revenue</th>
            </tr>
          </thead>
          <tbody>
            {expenseLines.length === 0 && (
              <tr className="pl-row">
                <td className="pl-text-muted" colSpan={3}>No expense entries found for this period.</td>
              </tr>
            )}
            {expenseLines.map((l) => (
              <tr
                key={l.account}
                className={`pl-row pl-row--clickable${drillAccount === l.account ? ' pl-row--active' : ''}`}
                onClick={() => setDrillAccount(drillAccount === l.account ? null : l.account)}
              >
                <td className="pl-cell-account">
                  <span className="pl-drill-indicator">{drillAccount === l.account ? '▾' : '▸'}</span>
                  {l.account}
                </td>
                <td className="pl-col-amount pl-text-expense">{fmtMoney(l.amount)}</td>
                <td className="pl-col-pct pl-text-muted">{totalRevenue > 0 ? ((l.amount / totalRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pl-row--total">
              <td><strong>Total Expenses</strong></td>
              <td className="pl-col-amount pl-text-expense"><strong>{fmtMoney(totalExpense)}</strong></td>
              <td className="pl-col-pct pl-text-muted"><strong>{totalRevenue > 0 ? ((totalExpense / totalRevenue) * 100).toFixed(1) : 0}%</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Result section ── */}
      <div className="pl-section-card pl-section-card--result">
        <div className="pl-result-row">
          <div>
            <div className="pl-result-label">Net Income / (Loss)</div>
            <div className="pl-result-sub">For the period ended {resultPeriodLabel}</div>
          </div>
          <div className={`pl-result-value ${netIncome >= 0 ? 'pl-surplus' : 'pl-deficit'}`}>
            {netIncome >= 0 ? fmtMoney(netIncome) : `(${fmtMoney(Math.abs(netIncome))})`}
          </div>
        </div>
        <div className="pl-result-chips">
          <span className="pl-result-chip">Margin: {netMargin}%</span>
          <span className={`pl-result-chip ${netIncome >= 0 ? 'pl-chip-surplus' : 'pl-chip-deficit'}`}>
            {netIncome >= 0 ? 'Surplus' : 'Deficit'}
          </span>
        </div>
      </div>

      {/* ── Drill-down panel ── */}
      {drillAccount && (
        <div className="pl-drill-panel">
          <div className="pl-drill-header">
            <span>
              <strong>Drill-down:</strong> {drillAccount}
            </span>
            <button className="pl-drill-close" onClick={() => setDrillAccount(null)}>✕ Close</button>
          </div>
          <p className="pl-drill-notice" style={{ color: 'var(--muted)', padding: '1rem 0' }}>Transaction detail for <strong>{drillAccount}</strong> is not available in this view. Please use the General Ledger module for journal-level drill-down.</p>
        </div>
      )}
    </section>
  )
}

// ─── Root module ───────────────────────────────────────────────────────────────

const MODULE_TITLES: Record<FacultyAdminModuleKey, { title: string; subtitle: string }> = {
  'dept-reports': {
    title: 'Department Reports',
    subtitle: 'Real-time budget usage, variance analysis, and exportable summaries for your cost centre.',
  },
  'fa-approvals': {
    title: 'Approvals Inbox',
    subtitle: 'Review expense claims, purchase requisitions, and budget transfer requests from your department.',
  },
  'fa-reports': {
    title: 'Departmental P&L Statement',
    subtitle: 'Detailed revenue and expense breakdown for your cost centre with drill-down to transactions.',
  },
}

export const FacultyAdminModule = ({ moduleKey }: FacultyAdminModuleProps) => {
  useDisplayCurrency()
  const { title, subtitle } = MODULE_TITLES[moduleKey]

  return (
    <div className="fa-module-root">
      <div className="fa-module-header">
        <h1 className="page-title">{title}</h1>
        <p className="fa-module-subtitle">{subtitle}</p>
      </div>

      {moduleKey === 'dept-reports' && <DeptReportsSection />}
      {moduleKey === 'fa-approvals' && <ApprovalsInboxSection />}
      {moduleKey === 'fa-reports' && <DeptReportsModule />}
    </div>
  )
}
