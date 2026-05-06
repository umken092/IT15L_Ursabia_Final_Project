import { useCallback, useState } from 'react'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { formatMoney, useDisplayCurrency } from '../../store/currencyStore'
import { reportsService } from '../../services/accountantService'

type ReportType = 'income-statement' | 'balance-sheet' | 'cash-flow' | 'aging-ap' | 'aging-ar' | 'department-budget'
type ScheduleCadence = 'Daily' | 'Weekly' | 'Monthly'
type ScheduleTarget = 'Excel' | 'PDF'

interface ReportTemplate {
  id: string
  name: string
  type: ReportType
  visibility: 'Private' | 'Team'
  updatedAt: string
}

interface SchedulerItem {
  id: string
  label: string
  type: ReportType
  cadence: ScheduleCadence
  target: ScheduleTarget
  active: boolean
  updatedAt?: string
}

interface AuditActivity {
  id: string
  action: string
  user: string
  entity: string
  status: string
  timestamp: string
}

const REPORT_LABELS: Record<ReportType, string> = {
  'income-statement': 'Income Statement',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'aging-ap': 'AP Aging',
  'aging-ar': 'AR Aging',
  'department-budget': 'Department Budget',
}

const toReportType = (value: string): ReportType => {
  if (value in REPORT_LABELS) {
    return value as ReportType
  }

  return 'income-statement'
}

const EXPORTABLE_TYPES: ReportType[] = ['income-statement', 'balance-sheet', 'aging-ap', 'aging-ar']

const formatCurrency = (value: number) => formatMoney(value, 'PHP')

// Insert spaces between camelCase / PascalCase words and acronyms
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

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const IconRunReport = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l4 3-4 3V9z" />
  </svg>
)

const IconExport = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 10l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const IconDrilldown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <circle cx={11} cy={11} r={7} strokeLinecap="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
  </svg>
)

const IconTemplates = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const IconAuditLog = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)

const IconScheduler = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={36} height={36}>
    <rect x={3} y={4} width={18} height={18} rx={2} strokeLinecap="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </svg>
)

// ── Action Card ───────────────────────────────────────────────────────────────

interface ActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

const ActionCard = ({ icon, title, description, onClick }: ActionCardProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '24px 20px',
      textAlign: 'left',
      cursor: 'pointer',
      width: '100%',
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(30,64,175,0.12)' }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
  >
    <div
      style={{
        width: 60,
        height: 60,
        borderRadius: 12,
        background: '#1d4ed8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        marginBottom: 14,
      }}
    >
      {icon}
    </div>
    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 13, color: '#6b7280' }}>{description}</div>
  </button>
)

// ── Shared result table ───────────────────────────────────────────────────────

const ResultTable = ({ columns, rows }: { columns: string[]; rows: Array<Record<string, string | number>> }) => (
  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 420, overflowY: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
        <tr>
          {columns.map((col) => (
            <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const rowKey = columns.map((c) => String(row[c] ?? '')).join('|')
          return (
            <tr key={rowKey} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {columns.map((col) => (
                <td key={col} style={{ padding: '7px 12px', color: '#1f2937' }}>{String(row[col] ?? '')}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

// ── Main Component ────────────────────────────────────────────────────────────

export const FinancialReportsModule = () => {
  useDisplayCurrency()
  const user = useAuthStore((state) => state.user)
  const push = useNotificationStore((state) => state.push)

  // Modal visibility
  const [showRunReport, setShowRunReport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showDrilldown, setShowDrilldown] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)

  // Run Report state
  const [rrType, setRrType] = useState<ReportType>('income-statement')
  const [rrStartDate, setRrStartDate] = useState(firstOfMonth)
  const [rrEndDate, setRrEndDate] = useState(today)
  const [rrAsOfDate, setRrAsOfDate] = useState(today)
  const [rrLoading, setRrLoading] = useState(false)
  const [rrResult, setRrResult] = useState<null | {
    rows: Array<Record<string, string | number>>
    columns: string[]
    summary?: Record<string, number>
  }>(null)

  // Export state
  const [expType, setExpType] = useState<ReportType>('income-statement')
  const [expFormat, setExpFormat] = useState<'excel' | 'pdf'>('excel')
  const [expStartDate, setExpStartDate] = useState(firstOfMonth)
  const [expEndDate, setExpEndDate] = useState(today)
  const [expAsOfDate, setExpAsOfDate] = useState(today)
  const [expLoading, setExpLoading] = useState(false)

  // Drill-down state
  const [ddType, setDdType] = useState<'aging-ap' | 'aging-ar' | 'department-budget'>('aging-ap')
  const [ddLoading, setDdLoading] = useState(false)
  const [ddAsOfDate, setDdAsOfDate] = useState(today)
  const [ddRows, setDdRows] = useState<Array<Record<string, string | number>>>([])
  const [ddColumns, setDdColumns] = useState<string[]>([])
  const [ddSummary, setDdSummary] = useState<Array<{ bucket: string; total: number }>>([])

  // Template management state
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesBusy, setTemplatesBusy] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateType, setTemplateType] = useState<ReportType>('income-statement')
  const [templateVisibility, setTemplateVisibility] = useState<'Private' | 'Team'>('Private')

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditActivity[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Scheduler state
  const [schedulerItems, setSchedulerItems] = useState<SchedulerItem[]>([])
  const [schedulerLoading, setSchedulerLoading] = useState(false)
  const [schedulerBusyId, setSchedulerBusyId] = useState<string | null>(null)
  const [schedulerCreateBusy, setSchedulerCreateBusy] = useState(false)
  const [newScheduleLabel, setNewScheduleLabel] = useState('')
  const [newScheduleType, setNewScheduleType] = useState<ReportType>('income-statement')
  const [newScheduleCadence, setNewScheduleCadence] = useState<ScheduleCadence>('Weekly')
  const [newScheduleTarget, setNewScheduleTarget] = useState<ScheduleTarget>('Excel')
  const [newScheduleActive, setNewScheduleActive] = useState(true)

  const rrIsDateRange = rrType === 'income-statement' || rrType === 'cash-flow'
  const rrIsBudget = rrType === 'department-budget'
  const expIsDateRange = expType === 'income-statement'

  // ── Run Report ──────────────────────────────────────────────────────────────

  const handleRunReport = useCallback(async () => {
    setRrLoading(true)
    setRrResult(null)
    try {
      let rows: Array<Record<string, string | number>> = []
      let columns: string[] = []
      let summary: Record<string, number> | undefined

      switch (rrType) {
        case 'income-statement': {
          const res = await reportsService.getIncomeStatement({ startDate: rrStartDate, endDate: rrEndDate })
          const data = res.data as {
            revenue: Array<{ accountCode: string; accountName: string; amount: number }>
            expenses: Array<{ accountCode: string; accountName: string; amount: number }>
            totalRevenue: number; totalExpenses: number; netIncome: number
          }
          columns = ['Section', 'Account Code', 'Account Name', 'Amount']
          rows = [
            ...data.revenue.map(r => ({ Section: 'Revenue', 'Account Code': r.accountCode, 'Account Name': r.accountName, Amount: formatCurrency(r.amount) })),
            ...data.expenses.map(r => ({ Section: 'Expense', 'Account Code': r.accountCode, 'Account Name': r.accountName, Amount: formatCurrency(r.amount) })),
          ]
          summary = { 'Total Revenue': data.totalRevenue, 'Total Expenses': data.totalExpenses, 'Net Income': data.netIncome }
          break
        }
        case 'balance-sheet': {
          const res = await reportsService.getBalanceSheet({ asOfDate: rrAsOfDate })
          const data = res.data as {
            assets: Array<{ accountCode: string; accountName: string; amount: number }>
            liabilities: Array<{ accountCode: string; accountName: string; amount: number }>
            equity: Array<{ accountCode: string; accountName: string; amount: number }>
            totalAssets: number; totalLiabilities: number; totalEquity: number
          }
          columns = ['Section', 'Account Code', 'Account Name', 'Balance']
          rows = [
            ...data.assets.map(r => ({ Section: 'Asset', 'Account Code': r.accountCode, 'Account Name': r.accountName, Balance: formatCurrency(r.amount) })),
            ...data.liabilities.map(r => ({ Section: 'Liability', 'Account Code': r.accountCode, 'Account Name': r.accountName, Balance: formatCurrency(r.amount) })),
            ...data.equity.map(r => ({ Section: 'Equity', 'Account Code': r.accountCode, 'Account Name': r.accountName, Balance: formatCurrency(r.amount) })),
          ]
          summary = { 'Total Assets': data.totalAssets, 'Total Liabilities': data.totalLiabilities, 'Total Equity': data.totalEquity }
          break
        }
        case 'cash-flow': {
          const res = await reportsService.getCashFlow({ startDate: rrStartDate, endDate: rrEndDate })
          const data = res.data as { operatingActivities: number; investingActivities: number; financingActivities: number; netCashFlow: number }
          columns = ['Activity', 'Amount']
          rows = [
            { Activity: 'Operating Activities', Amount: formatCurrency(data.operatingActivities) },
            { Activity: 'Investing Activities', Amount: formatCurrency(data.investingActivities) },
            { Activity: 'Financing Activities', Amount: formatCurrency(data.financingActivities) },
            { Activity: 'Net Cash Flow', Amount: formatCurrency(data.netCashFlow) },
          ]
          break
        }
        case 'aging-ap': {
          const res = await reportsService.getAgingAp({ asOfDate: rrAsOfDate })
          const data = res.data as { items: Array<{ invoiceNumber: string; vendorName: string; dueDate: string; totalAmount: number; bucket: string; ageDays: number; status: string }> }
          columns = ['Invoice #', 'Vendor', 'Due Date', 'Amount', 'Bucket', 'Age (days)', 'Status']
          rows = data.items.map(r => ({ 'Invoice #': r.invoiceNumber, Vendor: r.vendorName, 'Due Date': r.dueDate, Amount: formatCurrency(r.totalAmount), Bucket: r.bucket, 'Age (days)': r.ageDays, Status: r.status }))
          break
        }
        case 'aging-ar': {
          const res = await reportsService.getAgingAr({ asOfDate: rrAsOfDate })
          const data = res.data as { items: Array<{ invoiceNumber: string; customerName: string; dueDate: string; totalAmount: number; bucket: string; ageDays: number; status: string }> }
          columns = ['Invoice #', 'Customer', 'Due Date', 'Amount', 'Bucket', 'Age (days)', 'Status']
          rows = data.items.map(r => ({ 'Invoice #': r.invoiceNumber, Customer: r.customerName, 'Due Date': r.dueDate, Amount: formatCurrency(r.totalAmount), Bucket: r.bucket, 'Age (days)': r.ageDays, Status: r.status }))
          break
        }
        case 'department-budget': {
          const res = await reportsService.getDepartmentBudget()
          const data = res.data as { items: Array<{ code: string; name: string; budget: number; actual: number; remaining: number; utilizationPct: number }>; totalBudget: number; totalActual: number }
          columns = ['Code', 'Department', 'Budget', 'Actual', 'Remaining', 'Utilization %']
          rows = data.items.map(r => ({ Code: r.code, Department: r.name, Budget: formatCurrency(r.budget), Actual: formatCurrency(r.actual), Remaining: formatCurrency(r.remaining), 'Utilization %': `${r.utilizationPct}%` }))
          summary = { 'Total Budget': data.totalBudget, 'Total Actual': data.totalActual }
          break
        }
      }

      setRrResult({ rows, columns, summary })
      push('success', `${REPORT_LABELS[rrType]} loaded successfully.`)
    } catch {
      push('error', `Failed to load ${REPORT_LABELS[rrType]}.`)
    } finally {
      setRrLoading(false)
    }
  }, [rrType, rrStartDate, rrEndDate, rrAsOfDate, push])

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExpLoading(true)
    try {
      const params: Record<string, string> = expIsDateRange
        ? { startDate: expStartDate, endDate: expEndDate }
        : { asOfDate: expAsOfDate }
      const res = await reportsService.exportReport(expType, expFormat, params)
      const blob = res.data as Blob
      const ext = expFormat === 'excel' ? 'xlsx' : 'pdf'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${expType}-${today}.${ext}`
      link.click()
      URL.revokeObjectURL(url)
      push('success', `Downloaded: ${expType}.${ext}`)
      setShowExport(false)
    } catch {
      push('error', 'Export failed. Please try again.')
    } finally {
      setExpLoading(false)
    }
  }

  // ── Drill-down ──────────────────────────────────────────────────────────────

  const handleLoadDrilldown = async () => {
    setDdLoading(true)
    setDdRows([])
    setDdColumns([])
    setDdSummary([])
    try {
      if (ddType === 'aging-ap') {
        const res = await reportsService.getAgingAp({ asOfDate: ddAsOfDate })
        const data = res.data as {
          items: Array<{ invoiceNumber: string; vendorName: string; dueDate: string; totalAmount: number; bucket: string; ageDays: number; status: string }>
          summary: Array<{ bucket: string; total: number }>
        }
        setDdColumns(['Invoice #', 'Vendor', 'Due Date', 'Amount', 'Bucket', 'Age (days)', 'Status'])
        setDdRows(data.items.map(r => ({ 'Invoice #': r.invoiceNumber, Vendor: r.vendorName, 'Due Date': r.dueDate, Amount: formatCurrency(r.totalAmount), Bucket: r.bucket, 'Age (days)': r.ageDays, Status: r.status })))
        setDdSummary(data.summary)
      } else if (ddType === 'aging-ar') {
        const res = await reportsService.getAgingAr({ asOfDate: ddAsOfDate })
        const data = res.data as {
          items: Array<{ invoiceNumber: string; customerName: string; dueDate: string; totalAmount: number; bucket: string; ageDays: number; status: string }>
          summary: Array<{ bucket: string; total: number }>
        }
        setDdColumns(['Invoice #', 'Customer', 'Due Date', 'Amount', 'Bucket', 'Age (days)', 'Status'])
        setDdRows(data.items.map(r => ({ 'Invoice #': r.invoiceNumber, Customer: r.customerName, 'Due Date': r.dueDate, Amount: formatCurrency(r.totalAmount), Bucket: r.bucket, 'Age (days)': r.ageDays, Status: r.status })))
        setDdSummary(data.summary)
      } else {
        const res = await reportsService.getDepartmentBudget()
        const data = res.data as { items: Array<{ code: string; name: string; budget: number; actual: number; remaining: number; utilizationPct: number }> }
        setDdColumns(['Code', 'Department', 'Budget', 'Actual', 'Remaining', 'Utilization %'])
        setDdRows(data.items.map(r => ({ Code: r.code, Department: r.name, Budget: formatCurrency(r.budget), Actual: formatCurrency(r.actual), Remaining: formatCurrency(r.remaining), 'Utilization %': `${r.utilizationPct}%` })))
      }
      push('success', 'Drill-down data loaded.')
    } catch {
      push('error', 'Failed to load drill-down data.')
    } finally {
      setDdLoading(false)
    }
  }

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await reportsService.listTemplates()
      const items = (res.data.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        type: toReportType(item.type),
        visibility: item.visibility,
        updatedAt: item.updatedAt,
      }))
      setTemplates(items)
    } catch {
      push('error', 'Unable to load templates.')
    } finally {
      setTemplatesLoading(false)
    }
  }, [push])

  const handleAddTemplate = async () => {
    if (!templateName.trim()) {
      push('warning', 'Template name is required.')
      return
    }

    setTemplatesBusy(true)
    try {
      const res = await reportsService.createTemplate({
        name: templateName.trim(),
        type: templateType,
        visibility: templateVisibility,
      })

      setTemplates((prev) => [
        {
          id: res.data.id,
          name: res.data.name,
          type: toReportType(res.data.type),
          visibility: res.data.visibility,
          updatedAt: res.data.updatedAt,
        },
        ...prev,
      ])
      setTemplateName('')
      setTemplateType('income-statement')
      setTemplateVisibility('Private')
      push('success', 'Template saved.')
    } catch {
      push('error', 'Failed to save template.')
    } finally {
      setTemplatesBusy(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    setTemplatesBusy(true)
    try {
      await reportsService.deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      push('info', 'Template removed.')
    } catch {
      push('error', 'Failed to remove template.')
    } finally {
      setTemplatesBusy(false)
    }
  }

  const handleLoadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const res = await reportsService.getAuditActivities()
      const data = (res.data as { activities?: Array<{ id: string; action: string; user: string; entity: string; status: string; timestamp: string }> }).activities ?? []
      setAuditLogs(
        data.map((item) => ({
          id: item.id,
          action: item.action,
          user: item.user,
          entity: item.entity,
          status: item.status,
          timestamp: item.timestamp,
        })),
      )
    } catch {
      setAuditLogs([
        { id: 'fallback-1', action: 'Report Opened', user: user?.email ?? 'accountant@cmnetwork.com', entity: 'Reports Module', status: 'success', timestamp: new Date().toISOString() },
      ])
      push('warning', 'Loaded fallback audit data.')
    } finally {
      setAuditLoading(false)
    }
  }

  const loadSchedules = useCallback(async () => {
    setSchedulerLoading(true)
    try {
      const res = await reportsService.listSchedules()
      const items = (res.data.items ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        type: toReportType(item.type),
        cadence: item.cadence,
        target: item.target,
        active: item.active,
        updatedAt: item.updatedAt,
      }))
      setSchedulerItems(items)
    } catch {
      push('error', 'Unable to load report schedules.')
    } finally {
      setSchedulerLoading(false)
    }
  }, [push])

  const toggleScheduler = async (id: string) => {
    const item = schedulerItems.find((s) => s.id === id)
    if (!item) {
      return
    }

    setSchedulerBusyId(id)
    try {
      const res = await reportsService.updateSchedule(id, {
        label: item.label,
        type: item.type,
        cadence: item.cadence,
        target: item.target,
        active: !item.active,
      })

      setSchedulerItems((prev) => prev.map((entry) => (entry.id === id
        ? {
            ...entry,
            active: res.data.active,
            updatedAt: res.data.updatedAt,
          }
        : entry)))
      push('success', `${item.label} is now ${res.data.active ? 'active' : 'inactive'}.`)
    } catch {
      push('error', 'Failed to update schedule status.')
    } finally {
      setSchedulerBusyId(null)
    }
  }

  const createSchedule = async () => {
    if (!newScheduleLabel.trim()) {
      push('warning', 'Schedule label is required.')
      return
    }

    setSchedulerCreateBusy(true)
    try {
      const res = await reportsService.createSchedule({
        label: newScheduleLabel.trim(),
        type: newScheduleType,
        cadence: newScheduleCadence,
        target: newScheduleTarget,
        active: newScheduleActive,
      })

      setSchedulerItems((prev) => [
        {
          id: res.data.id,
          label: res.data.label,
          type: toReportType(res.data.type),
          cadence: res.data.cadence,
          target: res.data.target,
          active: res.data.active,
          updatedAt: res.data.updatedAt,
        },
        ...prev,
      ])

      setNewScheduleLabel('')
      setNewScheduleType('income-statement')
      setNewScheduleCadence('Weekly')
      setNewScheduleTarget('Excel')
      setNewScheduleActive(true)
      push('success', 'Schedule created.')
    } catch {
      push('error', 'Failed to create schedule.')
    } finally {
      setSchedulerCreateBusy(false)
    }
  }

  const runScheduledNow = async (item: SchedulerItem) => {
    setSchedulerBusyId(item.id)
    try {
      await reportsService.runScheduleNow(item.id)
      push('success', `${item.label} scheduled run triggered.`)
    } catch {
      push('error', 'Failed to trigger scheduled run.')
    } finally {
      setSchedulerBusyId(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section style={{ padding: '20px 24px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #d5dbe4', borderRadius: 12, padding: '22px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 50, fontWeight: 700, color: '#1e3a8a', margin: 0, lineHeight: 1 }}>Reports</h1>
            <p style={{ color: '#6b7280', marginTop: 8, marginBottom: 14, maxWidth: 640 }}>
              Consolidated reporting workspace with read-only and drill-down outputs based on role permissions.
            </p>
          </div>

        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 14 }}>
        {[
          { label: 'Saved Reports', value: '14', sub: 'Available in your role scope', valueColor: '#111827' },
          { label: 'Scheduled Exports', value: '6', sub: 'Auto-generated weekly/monthly', valueColor: '#111827' },
        ].map(({ label, value, sub, valueColor }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #d1d5db', padding: '14px 16px', minHeight: 132 }}>
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 10, fontSize: 16 }}>{label}</div>
            <div style={{ fontSize: 50, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Module Actions */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 20 }}>Module Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <ActionCard
            icon={<IconRunReport />}
            title="Run Report"
            description="Execute selected report template."
            onClick={() => { setRrResult(null); setShowRunReport(true) }}
          />
          <ActionCard
            icon={<IconExport />}
            title="Export Data"
            description="Download report output as file."
            onClick={() => setShowExport(true)}
          />
          <ActionCard
            icon={<IconDrilldown />}
            title="Open Drill-down"
            description="Inspect detailed report slices."
            onClick={() => { setDdRows([]); setDdSummary([]); setShowDrilldown(true) }}
          />
          <ActionCard
            icon={<IconTemplates />}
            title="Manage Templates"
            description="Create and edit report structures."
            onClick={() => {
              setShowTemplateManager(true)
              void loadTemplates()
            }}
          />
          <ActionCard
            icon={<IconAuditLog />}
            title="Audit Log"
            description="Review report access history."
            onClick={() => {
              setShowAuditLog(true)
              void handleLoadAuditLog()
            }}
          />
          <ActionCard
            icon={<IconScheduler />}
            title="Report Scheduler"
            description="Automate report generation."
            onClick={() => {
              setShowScheduler(true)
              void loadSchedules()
            }}
          />
        </div>
      </div>
      </div>

      {/* ── Run Report Modal ─────────────────────────────────────────────────── */}
      {showRunReport && (
        <Dialog title="Run Report — Execute Report Template" onClose={() => setShowRunReport(false)}>
          <div style={{ padding: '16px 8px', minWidth: 760 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
              <div>
                <label htmlFor="rr-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Report Template</label>
                <select
                  id="rr-type"
                  value={rrType}
                  onChange={(e) => { setRrType(e.target.value as ReportType); setRrResult(null) }}
                  className="k-input k-input-md"
                  style={{ height: 36, minWidth: 200 }}
                >
                  {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                    <option key={t} value={t}>{REPORT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              {rrIsDateRange && (
                <>
                  <div>
                    <label htmlFor="rr-start" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Start Date</label>
                    <input id="rr-start" type="date" value={rrStartDate} onChange={(e) => setRrStartDate(e.target.value)} className="k-input k-input-md" style={{ height: 36 }} />
                  </div>
                  <div>
                    <label htmlFor="rr-end" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>End Date</label>
                    <input id="rr-end" type="date" value={rrEndDate} onChange={(e) => setRrEndDate(e.target.value)} className="k-input k-input-md" style={{ height: 36 }} />
                  </div>
                </>
              )}
              {!rrIsDateRange && !rrIsBudget && (
                <div>
                  <label htmlFor="rr-asof" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>As of Date</label>
                  <input id="rr-asof" type="date" value={rrAsOfDate} onChange={(e) => setRrAsOfDate(e.target.value)} className="k-input k-input-md" style={{ height: 36 }} />
                </div>
              )}

              <button
                type="button"
                onClick={handleRunReport}
                disabled={rrLoading}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', height: 36, fontWeight: 600, cursor: rrLoading ? 'not-allowed' : 'pointer', opacity: rrLoading ? 0.7 : 1 }}
              >
                {rrLoading ? 'Running...' : 'Run Report'}
              </button>
            </div>

            {rrResult?.summary && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {Object.entries(rrResult.summary).map(([k, v]) => (
                  <div key={k} style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 16px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0369a1' }}>{k}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0c4a6e' }}>{formatCurrency(v)}</div>
                  </div>
                ))}
              </div>
            )}

            {rrResult && rrResult.rows.length > 0 && <ResultTable columns={rrResult.columns} rows={rrResult.rows} />}
            {rrResult?.rows.length === 0 && !rrLoading && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No data for the selected period.</p>
            )}
            {!rrResult && !rrLoading && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>Select a template and click Run Report.</p>
            )}
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => setShowRunReport(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* ── Export Modal ─────────────────────────────────────────────────────── */}
      {showExport && (
        <Dialog title="Export Data — Download Report as File" onClose={() => setShowExport(false)}>
          <div style={{ padding: '16px 8px', minWidth: 460 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="exp-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Report Type</label>
                <select
                  id="exp-type"
                  value={expType}
                  onChange={(e) => setExpType(e.target.value as ReportType)}
                  className="k-input k-input-md"
                  style={{ height: 36, width: '100%' }}
                >
                  {EXPORTABLE_TYPES.map((t) => (
                    <option key={t} value={t}>{REPORT_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Export Format</span>
                <div style={{ display: 'flex', gap: 20 }}>
                  {(['excel', 'pdf'] as const).map((fmt) => (
                    <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: expFormat === fmt ? 700 : 400 }}>
                      <input type="radio" name="expFormat" value={fmt} checked={expFormat === fmt} onChange={() => setExpFormat(fmt)} />
                      {fmt === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'}
                    </label>
                  ))}
                </div>
              </div>

              {expIsDateRange ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="exp-start" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Start Date</label>
                    <input id="exp-start" type="date" value={expStartDate} onChange={(e) => setExpStartDate(e.target.value)} className="k-input k-input-md" style={{ height: 36, width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="exp-end" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>End Date</label>
                    <input id="exp-end" type="date" value={expEndDate} onChange={(e) => setExpEndDate(e.target.value)} className="k-input k-input-md" style={{ height: 36, width: '100%' }} />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="exp-asof" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>As of Date</label>
                  <input id="exp-asof" type="date" value={expAsOfDate} onChange={(e) => setExpAsOfDate(e.target.value)} className="k-input k-input-md" style={{ height: 36, width: '100%' }} />
                </div>
              )}
            </div>
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => setShowExport(false)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={expLoading}
              style={{ padding: '6px 20px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 600, cursor: expLoading ? 'not-allowed' : 'pointer', opacity: expLoading ? 0.7 : 1 }}
            >
              {expLoading ? 'Downloading...' : 'Download'}
            </button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* ── Drill-down Modal ──────────────────────────────────────────────────── */}
      {showDrilldown && (
        <Dialog title="Open Drill-down — Inspect Detailed Report Slices" onClose={() => setShowDrilldown(false)}>
          <div style={{ padding: '16px 8px', minWidth: 860 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <label htmlFor="dd-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Report Slice</label>
                <select
                  id="dd-type"
                  value={ddType}
                  onChange={(e) => { setDdType(e.target.value as typeof ddType); setDdRows([]); setDdSummary([]) }}
                  className="k-input k-input-md"
                  style={{ height: 36, minWidth: 220 }}
                >
                  <option value="aging-ap">AP Aging — Invoice Detail</option>
                  <option value="aging-ar">AR Aging — Invoice Detail</option>
                  <option value="department-budget">Department Budget — Breakdown</option>
                </select>
              </div>
              {ddType !== 'department-budget' && (
                <div>
                  <label htmlFor="dd-asof" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>As of Date</label>
                  <input id="dd-asof" type="date" value={ddAsOfDate} onChange={(e) => setDdAsOfDate(e.target.value)} className="k-input k-input-md" style={{ height: 36 }} />
                </div>
              )}
              <button
                type="button"
                onClick={handleLoadDrilldown}
                disabled={ddLoading}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', height: 36, fontWeight: 600, cursor: ddLoading ? 'not-allowed' : 'pointer', opacity: ddLoading ? 0.7 : 1 }}
              >
                {ddLoading ? 'Loading...' : 'Load Drill-down'}
              </button>
            </div>

            {ddSummary.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {ddSummary.map((s) => (
                  <div key={s.bucket} style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', minWidth: 110 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>{s.bucket}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>{formatCurrency(s.total)}</div>
                  </div>
                ))}
              </div>
            )}

            {ddRows.length > 0 && <ResultTable columns={ddColumns} rows={ddRows} />}
            {ddRows.length === 0 && !ddLoading && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>Select a report slice and click Load Drill-down.</p>
            )}
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => setShowDrilldown(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* ── Template Management Modal ───────────────────────────────────────── */}
      {showTemplateManager && (
        <Dialog title="Template Management" onClose={() => setShowTemplateManager(false)}>
          <div style={{ padding: '12px 8px', minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
              <div>
                <label htmlFor="tpl-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Template Name</label>
                <input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="k-input k-input-md" style={{ height: 36, width: '100%' }} />
              </div>
              <div>
                <label htmlFor="tpl-type" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Type</label>
                <select id="tpl-type" value={templateType} onChange={(e) => setTemplateType(e.target.value as ReportType)} className="k-input k-input-md" style={{ height: 36, width: '100%' }}>
                  {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                    <option key={t} value={t}>{REPORT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tpl-vis" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Visibility</label>
                <select id="tpl-vis" value={templateVisibility} onChange={(e) => setTemplateVisibility(e.target.value as 'Private' | 'Team')} className="k-input k-input-md" style={{ height: 36, width: '100%' }}>
                  <option value="Private">Private</option>
                  <option value="Team">Team</option>
                </select>
              </div>
              <button type="button" onClick={handleAddTemplate} style={{ height: 36, border: 'none', borderRadius: 8, background: '#1d4ed8', color: '#fff', padding: '0 16px', fontWeight: 600, cursor: 'pointer' }}>
                {templatesBusy ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Visibility</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Updated</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templatesLoading && (
                    <tr>
                      <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#9ca3af' }}>Loading templates...</td>
                    </tr>
                  )}
                  {templates.map((tpl) => (
                    <tr key={tpl.id}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{tpl.name}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{REPORT_LABELS[tpl.type]}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{tpl.visibility}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{new Date(tpl.updatedAt).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                        <button type="button" disabled={templatesBusy} onClick={() => void handleDeleteTemplate(tpl.id)} style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: '4px 10px', cursor: templatesBusy ? 'not-allowed' : 'pointer', opacity: templatesBusy ? 0.6 : 1 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!templatesLoading && templates.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#9ca3af' }}>No templates yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => setShowTemplateManager(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* ── Audit Log Modal ─────────────────────────────────────────────────── */}
      {showAuditLog && (
        <Dialog title="Audit Log" onClose={() => setShowAuditLog(false)}>
          <div style={{ padding: '12px 8px', minWidth: 860 }}>
            {auditLoading && <p style={{ color: '#6b7280' }}>Loading audit activities...</p>}
            {!auditLoading && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Entity</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{humanize(log.action)}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{log.user}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{humanize(log.entity)}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{humanize(log.status)}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#9ca3af' }}>No audit activities found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => void handleLoadAuditLog()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Refresh
            </button>
            <button type="button" onClick={() => setShowAuditLog(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* ── Report Scheduler Modal ──────────────────────────────────────────── */}
      {showScheduler && (
        <Dialog title="Report Scheduler" onClose={() => setShowScheduler(false)}>
          <div style={{ padding: '12px 8px', minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
              <div>
                <label htmlFor="sch-label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Schedule Label</label>
                <input id="sch-label" value={newScheduleLabel} onChange={(e) => setNewScheduleLabel(e.target.value)} className="k-input k-input-md" style={{ height: 36, width: '100%' }} />
              </div>
              <div>
                <label htmlFor="sch-type" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Type</label>
                <select id="sch-type" value={newScheduleType} onChange={(e) => setNewScheduleType(e.target.value as ReportType)} className="k-input k-input-md" style={{ height: 36, width: '100%' }}>
                  {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                    <option key={t} value={t}>{REPORT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sch-cadence" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cadence</label>
                <select id="sch-cadence" value={newScheduleCadence} onChange={(e) => setNewScheduleCadence(e.target.value as ScheduleCadence)} className="k-input k-input-md" style={{ height: 36, width: '100%' }}>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="sch-target" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target</label>
                <select id="sch-target" value={newScheduleTarget} onChange={(e) => setNewScheduleTarget(e.target.value as ScheduleTarget)} className="k-input k-input-md" style={{ height: 36, width: '100%' }}>
                  <option value="Excel">Excel</option>
                  <option value="PDF">PDF</option>
                </select>
              </div>
              <button type="button" disabled={schedulerCreateBusy} onClick={() => void createSchedule()} style={{ height: 36, border: 'none', borderRadius: 8, background: '#1d4ed8', color: '#fff', padding: '0 16px', fontWeight: 600, cursor: schedulerCreateBusy ? 'not-allowed' : 'pointer', opacity: schedulerCreateBusy ? 0.7 : 1 }}>
                {schedulerCreateBusy ? 'Saving...' : 'Add'}
              </button>
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: '#4b5563' }}>
              <input type="checkbox" checked={newScheduleActive} onChange={(e) => setNewScheduleActive(e.target.checked)} />
              <span>Active on create</span>
            </label>

            <div style={{ display: 'grid', gap: 10 }}>
              {schedulerLoading && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px', color: '#9ca3af', textAlign: 'center' }}>Loading schedules...</div>
              )}
              {schedulerItems.map((item) => (
                <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {REPORT_LABELS[item.type]} • {item.cadence} • {item.target}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={schedulerBusyId === item.id} onClick={() => void toggleScheduler(item.id)} style={{ border: '1px solid #d1d5db', borderRadius: 6, background: item.active ? '#ecfdf5' : '#fff', color: item.active ? '#047857' : '#111827', padding: '5px 10px', cursor: schedulerBusyId === item.id ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: schedulerBusyId === item.id ? 0.7 : 1 }}>
                      {item.active ? 'Active' : 'Inactive'}
                    </button>
                    <button type="button" disabled={schedulerBusyId === item.id} onClick={() => void runScheduledNow(item)} style={{ border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', padding: '5px 10px', cursor: schedulerBusyId === item.id ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: schedulerBusyId === item.id ? 0.7 : 1 }}>
                      Run Now
                    </button>
                  </div>
                </div>
              ))}
              {!schedulerLoading && schedulerItems.length === 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px', color: '#9ca3af', textAlign: 'center' }}>No schedules yet.</div>
              )}
            </div>
          </div>
          <DialogActionsBar>
            <button type="button" onClick={() => setShowScheduler(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Close
            </button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}
