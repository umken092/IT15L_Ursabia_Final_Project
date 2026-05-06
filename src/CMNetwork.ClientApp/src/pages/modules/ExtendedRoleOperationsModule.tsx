import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import type { ColumnDef } from '@tanstack/react-table'
import { DashboardCard } from '../../components/DashboardCard'
import { DataTable } from '../../components/ui/data-table'
import { SkeletonCard } from '../../components/SkeletonCard'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { roleLabels } from '../../types/auth'
import { auditLogsService, budgetService, expenseClaimsService, approvalsService, payslipsService } from '../../services/extendedOperationsService'
import { dashboardService, type BudgetControlResponse } from '../../services/dashboardService'
import { convertAmount, formatMoney, useCurrencyStore, useDisplayCurrency } from '../../store/currencyStore'
import { createBudgetReallocationSchema, createExpenseClaimSchema, type CreateBudgetReallocationInput, type CreateExpenseClaimInput } from '../../schemas/extendedSchemas'

export type ExtendedModuleKey =
  | 'department-report'
  | 'approvals'
  | 'expense-claims'
  | 'payslips'
  | 'executive-summary'
  | 'audit-logs'
  | 'approvals-inbox'
  | 'budget-control'

interface ExtendedRoleOperationsModuleProps {
  moduleKey: ExtendedModuleKey
}

interface QueueItem {
  id: string
  title: string
  entityType: string
  entityId: string
  requestedByName: string
  amount: number
  priority: 'Low' | 'Medium' | 'High'
  status: 'Pending' | 'Approved' | 'Rejected' | 'Forwarded'
}

interface ApiApprovalQueueItem {
  id: string
  entityType: string
  entityId: string
  entityDescription: string
  amount: number
  requestedByName: string
  requiredApproverRole: string
  status: number
  createdAtUtc: string
}

interface BudgetDepartment {
  id: string
  code: string
  name: string
  budgetAmount: number
}

const humanize = (value: string | null | undefined): string => {
  if (!value) return ''
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .trim()
}

// Action overrides keyed by raw backend action name.
const FRIENDLY_ACTIONS: Record<string, string> = {
  GET: 'Viewed',
  POST: 'Submitted',
  PUT: 'Updated',
  PATCH: 'Updated',
  DELETE: 'Deleted',
  LoginSucceeded: 'Sign-In Succeeded',
  LoginFailed: 'Sign-In Failed',
  Logout: 'Signed Out',
  PasswordReset: 'Password Reset',
  Reviewed: 'Marked Reviewed',
  Exported: 'Exported',
}

// Map common API path segments to a friendly area label.
const AREA_BY_PATH: Array<{ test: RegExp; label: string }> = [
  { test: /\/auth\/login/i, label: 'Sign-In' },
  { test: /\/auth\/logout/i, label: 'Sign-Out' },
  { test: /\/auth\/refresh/i, label: 'Session Refresh' },
  { test: /\/auth\//i, label: 'Authentication' },
  { test: /\/admin\/audit-logs/i, label: 'Audit Log Viewer' },
  { test: /\/admin\/users/i, label: 'User Management' },
  { test: /\/admin\//i, label: 'Administration' },
  { test: /\/dashboard/i, label: 'Dashboard' },
  { test: /\/ar-invoices/i, label: 'AR Invoice' },
  { test: /\/ap-invoices/i, label: 'AP Invoice' },
  { test: /\/general-ledger/i, label: 'General Ledger' },
  { test: /\/payslips/i, label: 'Payslip' },
  { test: /\/budgets?/i, label: 'Budget' },
  { test: /\/expense-claims?/i, label: 'Expense Claim' },
  { test: /\/approvals?/i, label: 'Approval' },
]

const FRIENDLY_ENTITY: Record<string, string> = {
  Auth: 'Sign-In',
  AuditLogEntry: 'Audit Log',
  ApplicationUser: 'User Account',
  ARInvoice: 'AR Invoice',
  APInvoice: 'AP Invoice',
  JournalEntry: 'Journal Entry',
  PayslipBatch: 'Payslip Batch',
  Payslip: 'Payslip',
  ExpenseClaim: 'Expense Claim',
  Budget: 'Budget',
  Department: 'Department',
  SecurityPolicy: 'Security Policy',
}

const friendlyArea = (entity: string | null | undefined): string => {
  if (!entity) return ''
  // Backend writes API request entries as "<METHOD> <path>".
  const apiMatch = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i.exec(entity)
  if (apiMatch) {
    const path = apiMatch[2]
    const hit = AREA_BY_PATH.find((entry) => entry.test.test(path))
    return hit ? hit.label : 'API Activity'
  }
  return FRIENDLY_ENTITY[entity] ?? humanize(entity)
}

const friendlyAction = (action: string | null | undefined, entity?: string | null): string => {
  if (!action) return ''
  // For API request rows the raw "action" is the HTTP verb. Make it more contextual
  // by combining with the area when possible (e.g. "Sign-In Submitted").
  if (entity && /^(GET|POST|PUT|PATCH|DELETE)\s+/i.test(entity)) {
    const verb = FRIENDLY_ACTIONS[action.toUpperCase()] ?? humanize(action)
    return verb
  }
  return FRIENDLY_ACTIONS[action] ?? humanize(action)
}

interface AuditChange {
  field: string
  before: string
  after: string
}

const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const HASH64_PATTERN = /\b[0-9a-f]{64}\b/i

const hiddenFieldKeys = new Set([
  'id', 'recordid', 'path', 'querystring', 'useragent', 'ipaddress', 'checksum', 'hash', 'filepath',
])

const asDisplay = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const isTechnicalValue = (value: string): boolean => {
  if (!value) return false
  return GUID_PATTERN.test(value) || HASH64_PATTERN.test(value) || /\/api\//i.test(value)
}

const pickValue = (source: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key]
    }
  }
  return undefined
}

const extractAuditChanges = (detailsJson: string | null | undefined): AuditChange[] => {
  if (!detailsJson) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(detailsJson)
  } catch {
    return []
  }

  const rows: AuditChange[] = []
  const seen = new Set<string>()

  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node === null || node === undefined) return

    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1))
      return
    }

    if (typeof node !== 'object') return

    const obj = node as Record<string, unknown>
    const fieldRaw = pickValue(obj, ['field', 'Field', 'property', 'Property', 'propertyName', 'PropertyName', 'columnName', 'ColumnName', 'name', 'Name'])
    const beforeRaw = pickValue(obj, ['before', 'Before', 'old', 'Old', 'oldValue', 'OldValue', 'originalValue', 'OriginalValue', 'from', 'From'])
    const afterRaw = pickValue(obj, ['after', 'After', 'new', 'New', 'newValue', 'NewValue', 'currentValue', 'CurrentValue', 'to', 'To', 'value', 'Value'])

    if (beforeRaw !== undefined && afterRaw !== undefined) {
      const field = humanize(String(fieldRaw ?? 'Value'))
      const normalizedFieldKey = field.toLowerCase().replaceAll(' ', '')
      const before = asDisplay(beforeRaw)
      const after = asDisplay(afterRaw)

      if (
        before !== after
        && !hiddenFieldKeys.has(normalizedFieldKey)
        && !(isTechnicalValue(before) && isTechnicalValue(after))
      ) {
        const key = `${field}|${before}|${after}`
        if (!seen.has(key)) {
          seen.add(key)
          rows.push({ field, before, after })
        }
      }
    }

    Object.values(obj).forEach((value) => visit(value, depth + 1))
  }

  visit(parsed, 0)
  return rows.slice(0, 20)
}

interface ExpenseClaim {
  id: string
  claimNumber: string
  date: string
  category: string
  amount: number
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
  notes?: string
}

interface ApiExpenseClaim {
  id: string
  claimNumber: string
  claimDate: string
  category: string
  amount: number
  status: number
  notes?: string
}

interface Payslip {
  id: string
  payslipNumber: string
  periodStart: string
  periodEnd: string
  grossPay: number
  netPay: number
  deductions: number
  taxDeduction: number
  sssDeduction: number
  philHealthDeduction: number
  pagIbigDeduction: number
  otherDeductions: number
}

interface ApiPayslip {
  id: string
  payslipNumber: string
  periodStart: string
  periodEnd: string
  grossPay: number
  netPay: number
  taxDeduction: number
  sssDeduction: number
  philHealthDeduction: number
  pagIbigDeduction: number
  otherDeductions: number
}

interface AuditLog {
  id: string
  user: string
  table: string
  action: string
  date: string
  reviewed: boolean
  details?: string | null
}

const formatCurrency = (value: number) => formatMoney(value, 'PHP')

const formatShortDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatMonthYear = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const getYearValue = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return String(date.getFullYear())
}

const moduleMeta: Record<ExtendedModuleKey, { title: string; subtitle: string }> = {
  'department-report': {
    title: 'Department Report',
    subtitle: 'Open statement drill-down, approve request, and export PDF summary.',
  },
  approvals: {
    title: 'Approvals Queue',
    subtitle: 'Process next item, delegate, and escalate urgent requests.',
  },
  'expense-claims': {
    title: 'Expense Claims',
    subtitle: 'Create claims, upload receipts, and track claim timeline status.',
  },
  payslips: {
    title: 'Payslips',
    subtitle: 'Download latest slip, browse history, and review deduction details.',
  },
  'executive-summary': {
    title: 'Executive Summary',
    subtitle: 'Export brief, view trends, and share snapshot via email trigger.',
  },
  'audit-logs': {
    title: 'Audit Logs',
    subtitle: 'Search logs, export evidence, and mark selected entries reviewed.',
  },
  'approvals-inbox': {
    title: 'Approval Inbox',
    subtitle: 'Approve batch, review high-risk exceptions, and forward clarifications.',
  },
  'budget-control': {
    title: 'Budget Control',
    subtitle: 'Review forecast, approve reallocations, and export budget plans.',
  },
}

export const ExtendedRoleOperationsModule = ({ moduleKey }: ExtendedRoleOperationsModuleProps) => {
  useDisplayCurrency()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const activeRole = selectedRole || user?.role || 'employee'

  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)

  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)

  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [payslipsLoading, setPayslipsLoading] = useState(false)

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [showClaimDialog, setShowClaimDialog] = useState(false)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [budgetDepartments, setBudgetDepartments] = useState<BudgetDepartment[]>([])
  const [budgetDepartmentsLoading, setBudgetDepartmentsLoading] = useState(false)

  const claimFormHook = useForm<CreateExpenseClaimInput>({
    resolver: zodResolver(createExpenseClaimSchema),
    defaultValues: { date: '', category: 'Travel', amount: 0, description: '' },
  })
  const budgetFormHook = useForm<CreateBudgetReallocationInput>({
    resolver: zodResolver(createBudgetReallocationSchema),
    defaultValues: {
      sourceDepartmentId: '',
      targetDepartmentId: '',
      amount: 0,
      currency: 'USD',
      justification: '',
      effectiveDate: new Date().toISOString().slice(0, 10),
    },
  })
  const [showDeductionDialog, setShowDeductionDialog] = useState(false)
  const [showAuditSearch, setShowAuditSearch] = useState(false)
  const [selectedSlipId, setSelectedSlipId] = useState('')
  const [selectedPayslipYear, setSelectedPayslipYear] = useState('all')
  const [selectedQueueId, setSelectedQueueId] = useState('')
  const [selectedBudgetRequestId, setSelectedBudgetRequestId] = useState<string | null>(null)
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([])
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null)

  const [auditFilter, setAuditFilter] = useState({ user: '', table: '', action: '' })

  const queueDisplay = useMemo(
    () => queueItems.map((item) => ({
      ...item,
      sortablePriority: item.priority === 'High' ? 3 : item.priority === 'Medium' ? 2 : 1,
      amountText: formatCurrency(item.amount),
    })),
    [queueItems],
  )
  const claimsDisplay = useMemo(
    () => claims.map((item) => ({
      ...item,
      amountText: formatCurrency(item.amount),
      statusText: item.status,
    })),
    [claims],
  )
  const slipsDisplay = useMemo(
    () => payslips.map((item) => ({ ...item, grossPayText: formatCurrency(item.grossPay), netPayText: formatCurrency(item.netPay), deductionsText: formatCurrency(item.deductions) })),
    [payslips],
  )

  const payslipYears = useMemo(
    () => Array.from(new Set(payslips.map((item) => getYearValue(item.periodEnd)).filter(Boolean))).sort((a, b) => Number(b) - Number(a)),
    [payslips],
  )

  const filteredSlipsDisplay = useMemo(
    () => (selectedPayslipYear === 'all'
      ? slipsDisplay
      : slipsDisplay.filter((item) => getYearValue(item.periodEnd) === selectedPayslipYear)),
    [selectedPayslipYear, slipsDisplay],
  )

  const budgetQueueItems = useMemo(
    () => queueItems.filter((item) => item.entityType.toLowerCase().includes('budget')),
    [queueItems],
  )

  const selectedBudgetRequest = useMemo(
    () => budgetQueueItems.find((item) => item.id === selectedBudgetRequestId) ?? null,
    [budgetQueueItems, selectedBudgetRequestId],
  )

  const selectedPayslip = useMemo(
    () => payslips.find((item) => item.id === selectedSlipId) ?? payslips[0],
    [payslips, selectedSlipId],
  )

  const ytdDeductionBreakdown = useMemo(
    () => filteredSlipsDisplay.reduce(
      (acc, item) => ({
        tax: acc.tax + item.taxDeduction,
        sss: acc.sss + item.sssDeduction,
        philHealth: acc.philHealth + item.philHealthDeduction,
      }),
      { tax: 0, sss: 0, philHealth: 0 },
    ),
    [filteredSlipsDisplay],
  )

  const ytdDeductionsTotal = ytdDeductionBreakdown.tax + ytdDeductionBreakdown.sss + ytdDeductionBreakdown.philHealth

  const ytdDeductionRows = useMemo(
    () => [
      { label: 'Federal Tax', value: ytdDeductionBreakdown.tax },
      { label: 'Social Security', value: ytdDeductionBreakdown.sss },
      { label: 'Health Insurance', value: ytdDeductionBreakdown.philHealth },
    ],
    [ytdDeductionBreakdown],
  )

  const filteredAuditLogs = useMemo(
    () =>
      auditLogs.filter((log) =>
        (!auditFilter.user || log.user.toLowerCase().includes(auditFilter.user.toLowerCase()))
        && (!auditFilter.table || log.table.toLowerCase().includes(auditFilter.table.toLowerCase()))
        && (!auditFilter.action || log.action.toLowerCase().includes(auditFilter.action.toLowerCase())),
      ),
    [auditLogs, auditFilter],
  )

  const selectedAuditChanges = useMemo(
    () => extractAuditChanges(selectedAuditLog?.details),
    [selectedAuditLog],
  )

  const queueColumns = useMemo<ColumnDef<(typeof queueDisplay)[number]>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'title', header: 'Description' },
      { accessorKey: 'requestedByName', header: 'Requested By' },
      { accessorKey: 'entityType', header: 'Type' },
      { accessorKey: 'amountText', header: 'Amount' },
      { accessorKey: 'priority', header: 'Priority' },
      { accessorKey: 'status', header: 'Status' },
    ],
    [],
  )

  const claimColumns = useMemo<ColumnDef<(typeof claimsDisplay)[number]>[]>(
    () => [
      { accessorKey: 'claimNumber', header: 'Claim #' },
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'category', header: 'Category' },
      { accessorKey: 'amountText', header: 'Amount' },
      { accessorKey: 'status', header: 'Status' },
    ],
    [],
  )

  const auditColumns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            title="Select all unreviewed"
            checked={auditLogs.filter((l) => !l.reviewed).length > 0 && auditLogs.filter((l) => !l.reviewed).every((l) => selectedAuditIds.includes(l.id))}
            onChange={(e) => {
              const ids = auditLogs.filter((l) => !l.reviewed).map((l) => l.id)
              setSelectedAuditIds(e.target.checked ? ids : [])
            }}
          />
        ),
        cell: ({ row }) => row.original.reviewed ? null : (
          <input
            type="checkbox"
            checked={selectedAuditIds.includes(row.original.id)}
            onChange={() => setSelectedAuditIds((cur) =>
              cur.includes(row.original.id) ? cur.filter((id) => id !== row.original.id) : [...cur, row.original.id]
            )}
          />
        ),
      },
      { accessorKey: 'date', header: 'Date & Time' },
      {
        id: 'actionSummary',
        header: 'Action',
        cell: ({ row }) => `${row.original.action} ${row.original.table}`,
      },
      { accessorKey: 'user', header: 'User' },
      {
        id: 'reviewed',
        header: 'Status',
        cell: ({ row }) => (
          <span style={{ color: row.original.reviewed ? 'var(--success, green)' : 'var(--muted, #888)', fontSize: '0.82rem' }}>
            {row.original.reviewed ? '✓ Reviewed' : 'Pending'}
          </span>
        ),
      },
      {
        id: 'details',
        header: '',
        cell: ({ row }) => <Button size="small" onClick={() => setSelectedAuditLog(row.original)}>View Details</Button>,
      },
    ],
    [auditLogs, selectedAuditIds],
  )

  const loadApprovalQueue = useCallback(async () => {
    if (moduleKey !== 'approvals' && moduleKey !== 'approvals-inbox' && moduleKey !== 'department-report' && moduleKey !== 'budget-control') return
    setQueueLoading(true)
    try {
      const res = await approvalsService.getApprovalQueue()
      const items = (res.data as ApiApprovalQueueItem[]) ?? []
      setQueueItems(items.map((item) => ({
        id: item.id,
        title: item.entityDescription,
        entityType: item.entityType,
        entityId: item.entityId,
        requestedByName: item.requestedByName,
        amount: item.amount,
        priority: item.amount > 10000 ? 'High' : item.amount > 3000 ? 'Medium' : 'Low',
        status: 'Pending',
      })))
    } catch {
      pushToast('warning', 'Unable to load approval queue.')
    } finally {
      setQueueLoading(false)
    }
  }, [moduleKey, pushToast])

  const loadBudgetDepartments = useCallback(async () => {
    if (moduleKey !== 'budget-control') return
    setBudgetDepartmentsLoading(true)
    try {
      const res = await budgetService.getDepartments()
      const items = (res.data as BudgetDepartment[]) ?? []
      setBudgetDepartments(items)
    } catch {
      pushToast('warning', 'Unable to load departments for reallocation.')
    } finally {
      setBudgetDepartmentsLoading(false)
    }
  }, [moduleKey, pushToast])

  const loadExpenseClaims = useCallback(async () => {
    if (moduleKey !== 'expense-claims') return
    setClaimsLoading(true)
    try {
      const res = await expenseClaimsService.getClaims()
      const items = (res.data as ApiExpenseClaim[]) ?? []
      const statusMap: Record<number, ExpenseClaim['status']> = { 1: 'Draft', 2: 'Submitted', 3: 'Approved', 4: 'Rejected' }
      setClaims(items.map((item) => ({
        id: item.id,
        claimNumber: item.claimNumber,
        date: item.claimDate,
        category: item.category,
        amount: item.amount,
        status: statusMap[item.status] ?? 'Draft',
        notes: item.notes,
      })))
    } catch {
      pushToast('warning', 'Unable to load expense claims.')
    } finally {
      setClaimsLoading(false)
    }
  }, [moduleKey, pushToast])

  const loadPayslips = useCallback(async () => {
    if (moduleKey !== 'payslips') return
    setPayslipsLoading(true)
    try {
      const res = await payslipsService.getPayslips()
      const items = (res.data as ApiPayslip[]) ?? []
      setPayslips(items.map((item) => ({
        id: item.id,
        payslipNumber: item.payslipNumber,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        grossPay: item.grossPay,
        netPay: item.netPay,
        deductions: item.taxDeduction + item.sssDeduction + item.philHealthDeduction + item.pagIbigDeduction + item.otherDeductions,
        taxDeduction: item.taxDeduction,
        sssDeduction: item.sssDeduction,
        philHealthDeduction: item.philHealthDeduction,
        pagIbigDeduction: item.pagIbigDeduction,
        otherDeductions: item.otherDeductions,
      })))
    } catch {
      pushToast('error', 'Failed to load payslips from the server.')
      setPayslips([])
    } finally {
      setPayslipsLoading(false)
    }
  }, [moduleKey, pushToast])

  const loadAuditLogs = useCallback(async () => {
    if (moduleKey !== 'audit-logs') return
    try {
      const res = await auditLogsService.getLogs({ page: 1, pageSize: 100 })
      const payload = res.data as { items?: Array<{
        id: string
        createdUtc: string
        category: string
        entity: string
        action: string
        userEmail?: string | null
        performedBy: string
        isReviewed: boolean
        details?: string | null
      }> } | undefined
      const items = payload?.items ?? []
      setAuditLogs(items.map((item) => ({
        id: item.id,
        user: item.userEmail || item.performedBy,
        table: friendlyArea(item.entity),
        action: friendlyAction(item.action, item.entity),
        date: new Date(item.createdUtc).toLocaleString(),
        reviewed: item.isReviewed,
        details: item.details,
      })))
    } catch (err) {
      console.error('Failed to load audit logs', err)
      setAuditLogs([])
    }
  }, [moduleKey])

  useEffect(() => {
    void loadApprovalQueue()
  }, [loadApprovalQueue])

  useEffect(() => {
    void loadExpenseClaims()
  }, [loadExpenseClaims])

  useEffect(() => {
    void loadPayslips()
  }, [loadPayslips])

  useEffect(() => {
    void loadBudgetDepartments()
  }, [loadBudgetDepartments])

  useEffect(() => {
    void loadAuditLogs()
  }, [loadAuditLogs])

  const processNextItem = async () => {
    const next = queueItems.find((item) => item.status === 'Pending')
    if (!next) {
      pushToast('info', 'No pending approval items left.')
      return
    }
    try {
      await approvalsService.processApproval({ approvalId: next.id, action: 'Approve' })
      pushToast('success', `${next.id} approved.`)
      await loadApprovalQueue()
    } catch {
      pushToast('error', `Failed to approve ${next.id}.`)
    }
  }

  const delegateItem = () => {
    if (!selectedQueueId) {
      pushToast('warning', 'Select an item to delegate.')
      return
    }

    pushToast('info', `${selectedQueueId} delegated to another reviewer.`)
  }

  const escalateItem = () => {
    if (!selectedQueueId) {
      pushToast('warning', 'Select an item to escalate.')
      return
    }

    setQueueItems((current) =>
      current.map((item) =>
        item.id === selectedQueueId ? { ...item, priority: 'High' } : item,
      ),
    )
    pushToast('warning', `${selectedQueueId} escalated to CFO.`)
  }

  const saveClaim = async (data: CreateExpenseClaimInput) => {
    try {
      const res = await expenseClaimsService.createClaim(data)
      await expenseClaimsService.submitClaim((res.data as { id: string }).id)
      claimFormHook.reset()
      setShowClaimDialog(false)
      pushToast('success', 'New claim submitted.')
      await loadExpenseClaims()
    } catch {
      pushToast('error', 'Failed to submit claim.')
    }
  }

  const saveBudgetReallocation = async (data: CreateBudgetReallocationInput) => {
    if (data.sourceDepartmentId === data.targetDepartmentId) {
      pushToast('warning', 'Source and target departments must be different.')
      return
    }
    try {
      await budgetService.createReallocation(data)
      budgetFormHook.reset({
        sourceDepartmentId: '',
        targetDepartmentId: '',
        amount: 0,
        currency: 'USD',
        justification: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
      })
      setShowBudgetDialog(false)
      pushToast('success', 'New budget reallocation request submitted for approval.')
      await loadApprovalQueue()
    } catch {
      pushToast('error', 'Failed to create budget reallocation request.')
    }
  }

  const uploadReceipt = () => {
    pushToast('info', 'Receipt uploaded. OCR extraction placeholder queued.')
  }

  const downloadPayslip = async () => {
    const slipId = selectedSlipId || payslips[0]?.id
    if (!slipId) {
      pushToast('warning', 'No payslip selected.')
      return
    }
    try {
      const res = await payslipsService.downloadPayslip(slipId)
      const blob = res.data as Blob
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${slipId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      pushToast('success', `${slipId} download started.`)
    } catch {
      pushToast('error', 'Failed to download payslip.')
    }
  }

  const markReviewed = async () => {
    if (!selectedAuditIds.length) {
      pushToast('warning', 'Select logs to mark reviewed.')
      return
    }

    try {
      await auditLogsService.markReviewed({
        auditLogIds: selectedAuditIds,
        reviewedBy: user?.email ?? user?.fullName ?? 'auditor',
      })
      setSelectedAuditIds([])
      pushToast('success', 'Selected audit logs marked reviewed.')
      await loadAuditLogs()
    } catch (err) {
      console.error('Failed to mark audit logs reviewed', err)
      pushToast('error', 'Failed to mark audit logs reviewed.')
    }
  }

  const approveBatch = async () => {
    const pending = queueItems.filter((item) => item.status === 'Pending')
    if (!pending.length) {
      pushToast('info', 'No pending items to approve.')
      return
    }

    try {
      await Promise.all(pending.map((item) => approvalsService.processApproval({ approvalId: item.id, action: 'Approve' })))
      pushToast('success', `${pending.length} approvals released in batch.`)
      await loadApprovalQueue()
    } catch {
      pushToast('error', 'Failed to process batch approvals.')
    }
  }

  const forwardForClarification = () => {
    if (!selectedQueueId) {
      pushToast('warning', 'Select an item to forward.')
      return
    }

    pushToast('info', `${selectedQueueId} forwarded for clarification.`)
  }

  const processSingleApproval = async (id: string, action: 'Approve' | 'Reject') => {
    try {
      await approvalsService.processApproval({ approvalId: id, action })
      pushToast('success', `${id} ${action === 'Approve' ? 'approved' : 'rejected'}.`)
      await loadApprovalQueue()
    } catch {
      pushToast('error', `Failed to ${action.toLowerCase()} ${id}.`)
    }
  }

  const exportApprovalQueue = () => {
    const headers = ['ID', 'Description', 'Requested By', 'Type', 'Amount', 'Priority', 'Status']
    const rows = queueItems.map((item) => [
      item.id,
      item.title,
      item.requestedByName,
      item.entityType,
      item.amount.toString(),
      item.priority,
      item.status,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `approval-queue-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    pushToast('success', 'Approval queue exported.')
  }

  const payslipHeroContent = useMemo(() => {
    if (payslipsLoading) {
      return <SkeletonCard rows={5} />
    }

    if (!selectedPayslip) {
      return <p style={{ color: '#6C757D', fontSize: 14 }}>No payslips available.</p>
    }

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <span style={{ display: 'inline-block', padding: '2px 8px', background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 4 }}>Latest Payment</span>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '8px 0 0' }}>{formatMonthYear(selectedPayslip.periodEnd)}</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>Paid on {formatShortDate(selectedPayslip.periodEnd)} via Direct Deposit</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Pay</p>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#1D63C1', lineHeight: 1.1, marginTop: 2 }}>{formatCurrency(selectedPayslip.netPay)}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
          <div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Gross Earnings</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#0f172a' }}>{formatCurrency(selectedPayslip.grossPay)}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Total Deductions</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#DC2626' }}>-{formatCurrency(selectedPayslip.deductions)}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="button"
              style={{ color: '#1D63C1', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => downloadPayslip()}
            >
              View Full Statement <span style={{ fontSize: 16 }}>›</span>
            </button>
          </div>
        </div>
      </>
    )
  }, [downloadPayslip, payslipsLoading, selectedPayslip])

  const payslipHistoryRows = useMemo(() => {
    if (filteredSlipsDisplay.length === 0) {
      return (
        <tr>
          <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6C757D', fontSize: 14 }}>No payslips available for the selected year.</td>
        </tr>
      )
    }

    return filteredSlipsDisplay.map((item) => (
      <tr
        key={item.id}
        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8F9FA' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
      >
        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatMonthYear(item.periodEnd)}</td>
        <td style={{ padding: '16px 24px', fontSize: 14, color: '#6C757D' }}>{formatShortDate(item.periodEnd)}</td>
        <td style={{ padding: '16px 24px', fontSize: 14, color: '#334155', fontWeight: 500 }}>{item.grossPayText}</td>
        <td style={{ padding: '16px 24px', fontSize: 14, color: '#DC2626', fontWeight: 500 }}>-{item.deductionsText}</td>
        <td style={{ padding: '16px 24px', fontSize: 14, color: '#1D63C1', fontWeight: 700 }}>{item.netPayText}</td>
        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
          <button
            type="button"
            title="Download payslip"
            style={{ padding: 8, color: '#6C757D', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, borderRadius: 4, transition: 'color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#1D63C1' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6C757D' }}
            onClick={async () => {
              setSelectedSlipId(item.id)
              try {
                const res = await payslipsService.downloadPayslip(item.id)
                const blob = res.data as Blob
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${item.id}.pdf`
                link.click()
                URL.revokeObjectURL(url)
              } catch {
                pushToast('error', 'Failed to download payslip.')
              }
            }}
          >
            ⬇
          </button>
        </td>
      </tr>
    ))
  }, [filteredSlipsDisplay, pushToast])

  return (
    <section>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">
          {moduleMeta[moduleKey].title}
        </h1>
        <p className="card-subtitle">{moduleMeta[moduleKey].subtitle}</p>
      </div>

      {(moduleKey === 'department-report' || moduleKey === 'approvals') && (
        <>
          <div className="quick-actions">
            {(moduleKey === 'approvals' || moduleKey === 'department-report') && (
              <Button themeColor="primary" onClick={processNextItem}>Process Next Item</Button>
            )}
            {moduleKey === 'department-report' && (
              <Button onClick={() => pushToast('success', 'Department summary PDF export started.')}>Export Summary PDF</Button>
            )}
            {(moduleKey === 'approvals' || moduleKey === 'department-report') && (
              <Button onClick={delegateItem}>Delegate</Button>
            )}
            {(moduleKey === 'approvals' || moduleKey === 'department-report') && (
              <Button onClick={escalateItem}>Escalate</Button>
            )}
          </div>

          <DashboardCard title="Approval Queue">
            {queueLoading ? <SkeletonCard rows={5} /> : <DataTable data={queueDisplay} columns={queueColumns} pageSizeOptions={[20, 50, 100]} />}

            <div style={{ marginTop: '16px' }}>
              <label>Select Item</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={selectedQueueId}
                onChange={(event) => setSelectedQueueId(event.target.value)}
              >
                <option value="">Choose queue item</option>
                {queueItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.id} - {item.title}</option>
                ))}
              </select>
            </div>
          </DashboardCard>
        </>
      )}

      {moduleKey === 'approvals-inbox' && (
        <ApprovalInboxView
          loading={queueLoading}
          items={queueItems}
          onApprove={(id) => processSingleApproval(id, 'Approve')}
          onReject={(id) => processSingleApproval(id, 'Reject')}
          onApproveBatch={approveBatch}
          onExport={exportApprovalQueue}
          onForward={forwardForClarification}
          onSelectItem={setSelectedQueueId}
          selectedItemId={selectedQueueId}
        />
      )}

      {moduleKey === 'budget-control' && (
        <BudgetControlView
          loading={queueLoading}
          items={budgetQueueItems}
          onApprove={(id) => processSingleApproval(id, 'Approve')}
          onReject={(id) => processSingleApproval(id, 'Reject')}
          onView={(id) => {
            setSelectedQueueId(id)
            setSelectedBudgetRequestId(id)
          }}
          onCreateRequest={() => setShowBudgetDialog(true)}
          onExportPlan={() => pushToast('success', 'Budget plan export started (PDF/Excel).')}
        />
      )}

      {selectedBudgetRequest && (
        <Dialog title="Reallocation Request Details" onClose={() => setSelectedBudgetRequestId(null)} width={760}>
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <section>
              <h3 style={{ margin: '0 0 0.35rem', color: 'var(--primary, #1f4f8a)' }}>Overview</h3>
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedBudgetRequest.title}</div>
                <div style={{ color: 'var(--muted, #666)' }}>Request ID: {selectedBudgetRequest.id}</div>
              </div>
            </section>

            <section style={{ borderTop: '1px solid var(--border, #d8dee4)', paddingTop: '0.8rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Request Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1.2rem' }}>
                <div><strong>Requested by:</strong> {selectedBudgetRequest.requestedByName}</div>
                <div><strong>Amount:</strong> {formatCurrency(selectedBudgetRequest.amount)}</div>
                <div><strong>Type:</strong> {selectedBudgetRequest.entityType}</div>
                <div><strong>Priority:</strong> {selectedBudgetRequest.priority}</div>
                <div><strong>Status:</strong> {selectedBudgetRequest.status}</div>
                <div><strong>Entity ref:</strong> {selectedBudgetRequest.entityId}</div>
              </div>
            </section>
          </div>
          <DialogActionsBar>
            <Button
              themeColor="primary"
              onClick={async () => {
                await processSingleApproval(selectedBudgetRequest.id, 'Approve')
                setSelectedBudgetRequestId(null)
              }}
            >
              Approve
            </Button>
            <Button
              onClick={async () => {
                await processSingleApproval(selectedBudgetRequest.id, 'Reject')
                setSelectedBudgetRequestId(null)
              }}
            >
              Reject
            </Button>
            <Button onClick={() => setSelectedBudgetRequestId(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {moduleKey === 'expense-claims' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => setShowClaimDialog(true)}>New Claim</Button>
            <Button onClick={uploadReceipt}>Upload Receipt</Button>
            <Button onClick={() => pushToast('info', 'Timeline: submitted -> approved -> paid')}>Track Status</Button>
          </div>

          <DashboardCard title="Expense Claims">
            {claimsLoading ? <SkeletonCard rows={5} /> : <DataTable data={claimsDisplay} columns={claimColumns} pageSizeOptions={[20, 50, 100]} />}
          </DashboardCard>
        </>
      )}

      {moduleKey === 'payslips' && (
        <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
          {/* Page Header */}
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h2 style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Payslips</h2>
              <p style={{ fontSize: 14, color: '#6C757D', marginTop: 4 }}>Review your earnings, deductions, and tax contributions for the current fiscal year.</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <select
                value={selectedPayslipYear}
                onChange={(e) => setSelectedPayslipYear(e.target.value)}
                aria-label="Filter by year"
                style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', border: '1px solid #E0E4E8', background: 'white', color: '#334155', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
              >
                <option value="all">Filter by Year</option>
                {payslipYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                type="button"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                onClick={downloadPayslip}
              >
                ⬇ Download All (PDF)
              </button>
            </div>
          </div>

          {/* Bento Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>

            {/* Latest Payment Card — 8 cols */}
            <div style={{ gridColumn: 'span 8', background: 'white', border: '1px solid #E0E4E8', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {payslipHeroContent}
            </div>

            {/* Tax & Deductions YTD — 4 cols */}
            <div style={{ gridColumn: 'span 4', background: 'white', border: '1px solid #E0E4E8', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: '0 0 24px' }}>Tax &amp; Deductions YTD</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ytdDeductionRows.map((item, idx) => {
                  const maxVal = Math.max(...ytdDeductionRows.map((r) => r.value), 1)
                  const ratio = (item.value / maxVal) * 100
                  const barColors = ['#2563eb', '#60a5fa', '#93c5fd']
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: '#6C757D' }}>{item.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(item.value)}</span>
                      </div>
                      <div style={{ width: '100%', background: '#f1f5f9', height: 6, borderRadius: 999 }}>
                        <div style={{ background: barColors[idx % barColors.length], height: 6, borderRadius: 999, width: `${Math.max(8, ratio)}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total YTD Deductions</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{formatCurrency(ytdDeductionsTotal)}</span>
              </div>
            </div>

            {/* Payslip History Table — 12 cols */}
            <div style={{ gridColumn: 'span 12', background: 'white', border: '1px solid #E0E4E8', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #E0E4E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>Payslip History</h3>
                <span style={{ fontSize: 12, color: '#6C757D' }}>Showing last {Math.min(filteredSlipsDisplay.length, 12)} months</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {payslipsLoading ? (
                  <div style={{ padding: 24 }}><SkeletonCard rows={5} /></div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E4E8' }}>
                        {['Period', 'Payment Date', 'Gross Pay', 'Deductions', 'Net Pay', ''].map((h) => (
                          <th key={h} style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === '' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{payslipHistoryRows}</tbody>
                  </table>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  style={{ fontSize: 14, fontWeight: 600, color: '#1D63C1', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => pushToast('info', 'Load more history is not yet implemented.')}
                >
                  Load More History
                </button>
              </div>
            </div>

            {/* Annual Tax Documents — 6 cols */}
            <div style={{ gridColumn: 'span 6', background: 'white', border: '1px solid #E0E4E8', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontSize: 20, marginRight: 16 }}>📄</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>Annual Tax Documents</h3>
              </div>
              <p style={{ fontSize: 14, color: '#6C757D', marginBottom: 24 }}>Access your annual tax documents and W-2 forms for previous fiscal years.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['2025 Tax Summary', '2024 W-2 Form', '2023 W-2 Form'].map((doc) => (
                  <button
                    key={doc}
                    type="button"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #f1f5f9', borderRadius: 8, background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f1f5f9' }}
                    onClick={() => pushToast('info', `${doc} download queued.`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#94a3b8', fontSize: 18 }}>📑</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>{doc}</span>
                    </div>
                    <span style={{ color: '#cbd5e1', fontSize: 14 }}>⬇</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Deposit Settings — 6 cols */}
            <div style={{ gridColumn: 'span 6', background: 'white', border: '1px solid #E0E4E8', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontSize: 20, marginRight: 16 }}>🏦</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>Direct Deposit Settings</h3>
              </div>
              <p style={{ fontSize: 14, color: '#6C757D', marginBottom: 24 }}>Your primary account for payroll distribution. Changes may take 1–2 billing cycles.</p>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Primary Account</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>UNION BANK •••• 4829</p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>Status: Verified &amp; Active</p>
                </div>
                <button
                  type="button"
                  style={{ fontSize: 14, fontWeight: 700, color: '#1D63C1', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => pushToast('info', 'Direct deposit update flow is not yet implemented.')}
                >
                  Update
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {moduleKey === 'executive-summary' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => pushToast('success', 'Board brief export queued.')}>Export Brief</Button>
            <Button onClick={() => pushToast('info', 'Trend comparison opened for monthly revenue and expenses.')}>View Trends</Button>
            <Button onClick={() => pushToast('success', 'Snapshot email send request queued.')}>Share Snapshot</Button>
          </div>

          <DashboardCard title="Executive Actions">
            <p>Use quick actions above to export, trend, or share the current executive view.</p>
          </DashboardCard>
        </>
      )}

      {moduleKey === 'audit-logs' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => setShowAuditSearch(true)}>Search Logs</Button>
            <Button onClick={() => pushToast('success', 'Signed evidence archive export queued.')}>Export Evidence</Button>
            <Button onClick={markReviewed}>Mark Reviewed</Button>
          </div>

          <DashboardCard title="Audit Trail">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted, #666)' }}>
                {selectedAuditIds.length > 0 ? `${selectedAuditIds.length} selected` : 'Check rows to mark reviewed'}
              </span>
              {selectedAuditIds.length > 0 && (
                <>
                  <Button themeColor="primary" size="small" onClick={markReviewed}>Mark {selectedAuditIds.length} Reviewed</Button>
                  <Button size="small" onClick={() => setSelectedAuditIds([])}>Clear</Button>
                </>
              )}
            </div>
            <DataTable data={filteredAuditLogs} columns={auditColumns} pageSizeOptions={[20, 50, 100]} />
          </DashboardCard>
        </>
      )}

      {showClaimDialog && (
        <Dialog title="New Expense Claim" onClose={() => { setShowClaimDialog(false); claimFormHook.reset() }}>
          <form onSubmit={claimFormHook.handleSubmit(saveClaim)} style={{ minWidth: '520px' }}>
            <div style={{ display: 'grid', gap: '12px', padding: '4px 0 12px' }}>
              <div>
                <label>Date *</label>
                <input
                  className="role-select"
                  style={{ width: '100%' }}
                  type="date"
                  {...claimFormHook.register('date')}
                />
                {claimFormHook.formState.errors.date && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{claimFormHook.formState.errors.date.message}</span>
                )}
              </div>
              <div>
                <label>Category *</label>
                <select
                  className="role-select"
                  style={{ width: '100%' }}
                  {...claimFormHook.register('category')}
                >
                  <option value="Travel">Travel</option>
                  <option value="Meals">Meals</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Other">Other</option>
                </select>
                {claimFormHook.formState.errors.category && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{claimFormHook.formState.errors.category.message}</span>
                )}
              </div>
              <div>
                <label>Amount *</label>
                <input
                  className="role-select"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...claimFormHook.register('amount', { valueAsNumber: true })}
                />
                {claimFormHook.formState.errors.amount && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{claimFormHook.formState.errors.amount.message}</span>
                )}
              </div>
              <div>
                <label>Description</label>
                <input
                  className="role-select"
                  style={{ width: '100%' }}
                  {...claimFormHook.register('description')}
                />
                {claimFormHook.formState.errors.description && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{claimFormHook.formState.errors.description.message}</span>
                )}
              </div>
            </div>
            <DialogActionsBar>
              <Button themeColor="primary" type="submit" disabled={claimFormHook.formState.isSubmitting}>Submit Claim</Button>
              <Button type="button" onClick={() => { setShowClaimDialog(false); claimFormHook.reset() }}>Cancel</Button>
            </DialogActionsBar>
          </form>
        </Dialog>
      )}

      {showBudgetDialog && (
        <Dialog title="New Budget Reallocation Request" onClose={() => { setShowBudgetDialog(false); budgetFormHook.reset() }}>
          <form onSubmit={budgetFormHook.handleSubmit(saveBudgetReallocation)} style={{ minWidth: '560px' }}>
            <div style={{ display: 'grid', gap: '12px', padding: '4px 0 12px' }}>
              <div>
                <label>Source Department *</label>
                <select className="role-select" style={{ width: '100%' }} {...budgetFormHook.register('sourceDepartmentId')}>
                  <option value="">Select source department</option>
                  {budgetDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code} - {d.name} ({formatCurrency(d.budgetAmount)})</option>
                  ))}
                </select>
                {budgetFormHook.formState.errors.sourceDepartmentId && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{budgetFormHook.formState.errors.sourceDepartmentId.message}</span>
                )}
              </div>
              <div>
                <label>Target Department *</label>
                <select className="role-select" style={{ width: '100%' }} {...budgetFormHook.register('targetDepartmentId')}>
                  <option value="">Select target department</option>
                  {budgetDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                  ))}
                </select>
                {budgetFormHook.formState.errors.targetDepartmentId && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{budgetFormHook.formState.errors.targetDepartmentId.message}</span>
                )}
              </div>
              <div>
                <label>Amount *</label>
                <input
                  className="role-select"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...budgetFormHook.register('amount', { valueAsNumber: true })}
                />
                {budgetFormHook.formState.errors.amount && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{budgetFormHook.formState.errors.amount.message}</span>
                )}
              </div>
              <div>
                <label>Effective Date *</label>
                <input className="role-select" style={{ width: '100%' }} type="date" {...budgetFormHook.register('effectiveDate')} />
                {budgetFormHook.formState.errors.effectiveDate && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{budgetFormHook.formState.errors.effectiveDate.message}</span>
                )}
              </div>
              <div>
                <label>Justification *</label>
                <textarea className="role-select" style={{ width: '100%', minHeight: '90px' }} {...budgetFormHook.register('justification')} />
                {budgetFormHook.formState.errors.justification && (
                  <span style={{ color: 'var(--error, #c62828)', fontSize: '0.8rem' }}>{budgetFormHook.formState.errors.justification.message}</span>
                )}
              </div>
            </div>
            <DialogActionsBar>
              <Button
                themeColor="primary"
                type="submit"
                disabled={budgetFormHook.formState.isSubmitting || budgetDepartmentsLoading}
              >
                Submit Reallocation
              </Button>
              <Button type="button" onClick={() => { setShowBudgetDialog(false); budgetFormHook.reset() }}>Cancel</Button>
            </DialogActionsBar>
          </form>
        </Dialog>
      )}

      {showDeductionDialog && (
        <Dialog title="Deduction Breakdown" onClose={() => setShowDeductionDialog(false)}>
          <div style={{ minWidth: '420px', display: 'grid', gap: '8px' }}>
            <div>SSS: {formatCurrency(1200)}</div>
            <div>PhilHealth: {formatCurrency(850)}</div>
            <div>Pag-IBIG: {formatCurrency(400)}</div>
            <div>Withholding Tax: {formatCurrency(1300)}</div>
          </div>
          <DialogActionsBar>
            <Button onClick={() => setShowDeductionDialog(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showAuditSearch && (
        <Dialog title="Search Audit Logs" onClose={() => setShowAuditSearch(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>User</label>
              <Input
                value={auditFilter.user}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, user: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Table</label>
              <Input
                value={auditFilter.table}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, table: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Action</label>
              <Input
                value={auditFilter.action}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, action: String(event.target.value) }))}
              />
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={() => setShowAuditSearch(false)}>Apply Filter</Button>
            <Button onClick={() => setShowAuditSearch(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {selectedAuditLog && (
        <Dialog title="Activity Details" onClose={() => setSelectedAuditLog(null)} width={860}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section>
              <h3 style={{ margin: '0 0 0.35rem', color: 'var(--primary, #1f4f8a)' }}>Overview</h3>
              <div style={{ display: 'grid', gap: '0.15rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedAuditLog.user}</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{selectedAuditLog.action} {selectedAuditLog.table}</div>
                <div style={{ color: 'var(--muted, #666)' }}>{selectedAuditLog.date}</div>
              </div>
            </section>

            <section style={{ borderTop: '1px solid var(--border, #d8dee4)', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Changes Made</h3>
              {selectedAuditChanges.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted, #666)' }}>
                  No field-level before/after values were captured for this activity.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-muted, #f6f8fa)' }}>
                        <th style={{ textAlign: 'left', padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)' }}>Field</th>
                        <th style={{ textAlign: 'left', padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)' }}>Before</th>
                        <th style={{ textAlign: 'left', padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)' }}>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAuditChanges.map((row) => (
                        <tr key={`${row.field}-${row.before}-${row.after}`}>
                          <td style={{ padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)', fontWeight: 600 }}>{row.field}</td>
                          <td style={{ padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)' }}>{row.before}</td>
                          <td style={{ padding: '0.55rem', borderBottom: '1px solid var(--border, #d8dee4)', background: 'rgba(37, 99, 235, 0.08)' }}>{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ borderTop: '1px solid var(--border, #d8dee4)', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Context</h3>
              <p style={{ margin: 0 }}><strong>Related Module:</strong> {selectedAuditLog.table}</p>
            </section>
          </div>
          <DialogActionsBar>
            <Button onClick={() => setSelectedAuditLog(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}

// ── Approval Inbox view ────────────────────────────────────────────────────────

interface ApprovalInboxViewProps {
  loading: boolean
  items: QueueItem[]
  selectedItemId: string
  onSelectItem: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onApproveBatch: () => void
  onExport: () => void
  onForward: () => void
}

const PAGE_SIZE = 10

const initialsFor = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

const avatarColor = (name: string) => {
  const palette = ['#1d4ed8', '#0ea5e9', '#7c3aed', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#475569']
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

const typeStyle = (type: string): { bg: string; color: string; label: string } => {
  const t = type.toUpperCase()
  if (t.includes('BUDGET')) return { bg: '#ede9fe', color: '#6d28d9', label: 'BUDGET' }
  if (t.includes('INVOICE')) return { bg: '#e0f2fe', color: '#0369a1', label: 'INVOICE' }
  if (t.includes('JOURNAL')) return { bg: '#cffafe', color: '#0e7490', label: 'JOURNAL' }
  if (t.includes('EXPENSE')) return { bg: '#ffedd5', color: '#c2410c', label: 'EXPENSE' }
  return { bg: '#f1f5f9', color: '#475569', label: t || 'OTHER' }
}

const priorityStyle = (priority: QueueItem['priority']) => {
  if (priority === 'High') return { color: '#dc2626', icon: '!', label: 'High' }
  if (priority === 'Medium') return { color: '#64748b', icon: '–', label: 'Med' }
  return { color: '#16a34a', icon: '↓', label: 'Low' }
}

const statusStyle = (status: QueueItem['status']) => {
  if (status === 'Approved') return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'Rejected') return { bg: '#fee2e2', color: '#b91c1c' }
  if (status === 'Forwarded') return { bg: '#e0e7ff', color: '#4338ca' }
  // Pending — use amber. If amount > 100k flag visually via separate path.
  return { bg: '#fef3c7', color: '#b45309' }
}

const formatPHP = (value: number) => formatMoney(value, 'PHP')

const ApprovalInboxView = ({
  loading,
  items,
  selectedItemId,
  onSelectItem,
  onApprove,
  onReject,
  onApproveBatch,
  onExport,
  onForward,
}: ApprovalInboxViewProps) => {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = items.slice(start, start + PAGE_SIZE)

  const totalExposure = items.reduce((sum, item) => sum + item.amount, 0)
  const aging = items.filter((item) => item.priority === 'High').length
  const flaggedCount = items.filter((item) => item.amount > 100000).length

  const visiblePages: number[] = []
  for (let i = 1; i <= Math.min(totalPages, 5); i++) visiblePages.push(i)

  return (
    <div className="approvals-inbox">
      {/* Header */}
      <div className="ai-header">
        <div>
          <h1 className="ai-title">Approval Inbox</h1>
          <p className="ai-subtitle">Review and manage pending financial authorizations across the enterprise.</p>
        </div>
        <div className="ai-header-actions">
          <button type="button" className="ai-btn ai-btn-ghost" onClick={onExport}>
            <span aria-hidden>↓</span> Export Queue
          </button>
          <button type="button" className="ai-btn ai-btn-primary" onClick={onApproveBatch}>
            <span aria-hidden>✓</span> Approve Batch
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="ai-card">
        {loading ? (
          <div style={{ padding: 24 }}><SkeletonCard rows={6} /></div>
        ) : (
          <>
            <div className="ai-table-wrap">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Requested By</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                        No pending approvals.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((item) => {
                      const tStyle = typeStyle(item.entityType)
                      const pStyle = priorityStyle(item.priority)
                      const flagged = item.amount > 100000
                      const sStyle = flagged && item.status === 'Pending'
                        ? { bg: '#fee2e2', color: '#b91c1c' }
                        : statusStyle(item.status)
                      const isSelected = selectedItemId === item.id
                      return (
                        <tr
                          key={item.id}
                          className={isSelected ? 'ai-row ai-row-selected' : 'ai-row'}
                          onClick={() => onSelectItem(item.id)}
                        >
                          <td className="ai-cell-id">{item.id}</td>
                          <td>
                            <div className="ai-desc-title">{item.title}</div>
                            <div className="ai-desc-sub">{item.entityType} · {item.entityId}</div>
                          </td>
                          <td>
                            <div className="ai-requester">
                              <span className="ai-avatar" style={{ background: avatarColor(item.requestedByName) }}>
                                {initialsFor(item.requestedByName)}
                              </span>
                              <span className="ai-requester-name">{item.requestedByName}</span>
                            </div>
                          </td>
                          <td>
                            <span
                              className="ai-type-chip"
                              style={{ background: tStyle.bg, color: tStyle.color }}
                              data-tooltip={`Request type: ${tStyle.label}`}
                            >
                              {tStyle.label}
                            </span>
                          </td>
                          <td className="ai-amount">{formatPHP(item.amount)}</td>
                          <td>
                            <span
                              className="ai-priority"
                              style={{ color: pStyle.color }}
                              data-tooltip={`Priority: ${pStyle.label}. Higher priority items should be reviewed sooner.`}
                            >
                              <span className="ai-priority-icon">{pStyle.icon}</span> {pStyle.label}
                            </span>
                          </td>
                          <td>
                            <span
                              className="ai-status-pill"
                              style={{ background: sStyle.bg, color: sStyle.color }}
                              data-tooltip={
                                flagged && item.status === 'Pending'
                                  ? 'Flagged \u2014 this pending item was auto-flagged for additional review (e.g. unusual amount or policy match).'
                                  : item.status === 'Pending'
                                    ? 'Pending \u2014 awaiting approver decision.'
                                    : item.status === 'Approved'
                                      ? 'Approved \u2014 decision recorded; downstream processing will follow.'
                                      : item.status === 'Rejected'
                                        ? 'Rejected \u2014 decision recorded with notes for the requester.'
                                        : `Status: ${item.status}`
                              }
                            >
                              {flagged && item.status === 'Pending' ? 'Flagged' : item.status}
                            </span>
                          </td>
                          <td>
                            <div className="ai-actions">
                              <button
                                type="button"
                                title="View details"
                                className="ai-icon-btn"
                                onClick={(e) => { e.stopPropagation(); onSelectItem(item.id); onForward(); }}
                              >
                                ⊙
                              </button>
                              <button
                                type="button"
                                title="Approve"
                                className="ai-icon-btn ai-icon-approve"
                                onClick={(e) => { e.stopPropagation(); onApprove(item.id); }}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                className="ai-icon-btn ai-icon-reject"
                                onClick={(e) => { e.stopPropagation(); onReject(item.id); }}
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ai-pagination">
              <span className="ai-pagination-info">
                Showing {items.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, items.length)} of {items.length} items
              </span>
              <div className="ai-pagination-controls">
                <button
                  type="button"
                  className="ai-page-btn"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Prev
                </button>
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === safePage ? 'ai-page-btn ai-page-btn-active' : 'ai-page-btn'}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="ai-page-ellipsis">…</span>}
                <button
                  type="button"
                  className="ai-page-btn"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* KPI strip */}
      <div className="ai-kpi-grid">
        <div className="ai-kpi-card">
          <div className="ai-kpi-head">
            <span className="ai-kpi-label">Exposure in Queue</span>
            <span className="ai-kpi-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>🏛</span>
          </div>
          <div className="ai-kpi-value">{formatPHP(totalExposure)}</div>
          <div className="ai-kpi-foot">Total value across {items.length} pending items</div>
        </div>
        <div className="ai-kpi-card">
          <div className="ai-kpi-head">
            <span className="ai-kpi-label">Aging Alerts</span>
            <span className="ai-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>⏱</span>
          </div>
          <div className="ai-kpi-value">{aging.toString().padStart(2, '0')}</div>
          <div className="ai-kpi-foot ai-kpi-foot-warn">High-priority items requiring action</div>
        </div>
        <div className="ai-kpi-card">
          <div className="ai-kpi-head">
            <span className="ai-kpi-label">Flagged for Review</span>
            <span className="ai-kpi-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>⚑</span>
          </div>
          <div className="ai-kpi-value">{flaggedCount.toString().padStart(2, '0')}</div>
          <div className="ai-kpi-foot">Exceeds approval threshold</div>
        </div>
      </div>
    </div>
  )
}

// ── Budget Control / Reallocations view ──────────────────────────────────────

interface BudgetControlViewProps {
  loading: boolean
  items: QueueItem[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onView: (id: string) => void
  onCreateRequest: () => void
  onExportPlan: () => void
}

const BC_PAGE_SIZE = 4

const formatUsd = (value: number) => formatMoney(value, 'USD')

const departmentFor = (item: QueueItem): { project: string; dept: string } => {
  const t = item.entityType.toUpperCase()
  if (t.includes('BUDGET')) return { project: item.title, dept: 'Finance / Budgeting' }
  if (t.includes('INVOICE')) return { project: item.title, dept: 'Operations / Procurement' }
  if (t.includes('JOURNAL')) return { project: item.title, dept: 'Accounting / GL' }
  if (t.includes('EXPENSE')) return { project: item.title, dept: 'Human Resources' }
  return { project: item.title, dept: item.entityType }
}

const BudgetControlView = ({
  loading,
  items,
  onApprove,
  onReject,
  onView,
  onCreateRequest,
  onExportPlan,
}: BudgetControlViewProps) => {
  const [page, setPage] = useState(1)
  const [budget, setBudget] = useState<BudgetControlResponse | null>(null)
  const [budgetLoading, setBudgetLoading] = useState(true)
  const [budgetRefreshedAt, setBudgetRefreshedAt] = useState<Date>(new Date())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setBudgetLoading(true)
        const data = await dashboardService.getBudgetControl()
        if (!cancelled) {
          setBudget(data)
          setBudgetRefreshedAt(new Date())
        }
      } catch {
        if (!cancelled) setBudget(null)
      } finally {
        if (!cancelled) setBudgetLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(items.length / BC_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * BC_PAGE_SIZE
  const pageItems = items.slice(start, start + BC_PAGE_SIZE)

  const totalAllocated = budget?.totalAllocated ?? 0
  const totalActual = budget?.totalActual ?? 0
  const remainingForecast = budget?.remainingForecast ?? 0
  const allocatedDelta = budget?.allocatedDeltaPercent ?? 0
  const varianceRequests = budget?.varianceRequestCount ?? items.filter((item) => item.priority === 'High').length

  const monthsData = budget?.months ?? []
  const sourceCurrency = budget?.currency ?? 'USD'
  const displayCurrency = useCurrencyStore((s) => s.code)
  const months = monthsData.map((m) => m.label)
  // Convert raw currency to display currency, then to millions for axis display
  const actualsM = monthsData.map((m) => convertAmount(m.actual, sourceCurrency, displayCurrency) / 1_000_000)
  const projectedM = monthsData.map((m) => convertAmount(m.projected, sourceCurrency, displayCurrency) / 1_000_000)
  const peakValue = Math.max(0.5, ...actualsM, ...projectedM)
  const maxVal = Math.ceil(peakValue * 2) / 2 || 0.5
  const chartHeight = 260
  const chartGridLines = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]

  const allocatedFillPct = totalAllocated > 0 ? Math.min(100, (totalActual / totalAllocated) * 100) : 0
  const remainingPct = totalAllocated > 0 ? Math.min(100, (remainingForecast / totalAllocated) * 100) : 0
  const onTrack = totalActual <= (budget?.totalProjected ?? 0)

  const refreshLabel = (() => {
    const diffMs = Date.now() - budgetRefreshedAt.getTime()
    const mins = Math.max(1, Math.round(diffMs / 60000))
    return mins === 1 ? '1 min ago' : `${mins} mins ago`
  })()

  const visiblePages: number[] = []
  for (let i = 1; i <= Math.min(totalPages, 3); i++) visiblePages.push(i)

  return (
    <div className="budget-control">
      {/* Header */}
      <div className="bc-header">
        <div>
          <h1 className="bc-title">Reallocations</h1>
          <p className="bc-subtitle">Review and manage budget adjustments across departments for FY {budget?.year ?? new Date().getFullYear()}.</p>
        </div>
        <div className="bc-header-actions">
          <button type="button" className="bc-btn bc-btn-ghost" onClick={onExportPlan}>
            <span aria-hidden>↓</span> Export Budget Plan
          </button>
          <button type="button" className="bc-btn bc-btn-primary" onClick={onCreateRequest}>
            <span aria-hidden>⊕</span> New Reallocation Request
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="bc-kpi-grid">
        <div className="bc-kpi-card">
          <div className="bc-kpi-head">
            <span className="bc-kpi-label">Total Allocated</span>
            <span className="bc-kpi-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>$</span>
          </div>
          <div className="bc-kpi-value-row">
            <span className="bc-kpi-value">{formatUsd(totalAllocated)}</span>
            <span className={`bc-kpi-delta ${allocatedDelta >= 0 ? 'bc-kpi-delta-up' : 'bc-kpi-delta-bad'}`}>
              {allocatedDelta >= 0 ? '+' : ''}{allocatedDelta.toFixed(1)}%
            </span>
          </div>
          <div className="bc-kpi-foot">Total operational expenditure ceiling · {formatUsd(totalActual)} spent YTD</div>
          <div className="bc-kpi-bar"><div className="bc-kpi-bar-fill" style={{ width: `${allocatedFillPct}%`, background: '#1d4ed8' }} /></div>
        </div>
        <div className="bc-kpi-card">
          <div className="bc-kpi-head">
            <span className="bc-kpi-label">Remaining Forecast</span>
            <span className="bc-kpi-icon" style={{ background: '#ecfdf5', color: '#16a34a' }}>↗</span>
          </div>
          <div className="bc-kpi-value-row">
            <span className="bc-kpi-value">{formatUsd(remainingForecast)}</span>
            <span className={`bc-kpi-delta ${onTrack ? 'bc-kpi-delta-ok' : 'bc-kpi-delta-bad'}`}>
              {onTrack ? 'On Track' : 'Over Plan'}
            </span>
          </div>
          <div className="bc-kpi-foot">Projected surplus at quarter end</div>
          <div className="bc-kpi-bar"><div className="bc-kpi-bar-fill" style={{ width: `${remainingPct}%`, background: '#60a5fa' }} /></div>
        </div>
        <div className="bc-kpi-card bc-kpi-card-alert">
          <div className="bc-kpi-head">
            <span className="bc-kpi-label">Variance Alert</span>
            <span className="bc-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>⚠</span>
          </div>
          <div className="bc-kpi-value-row">
            <span className="bc-kpi-value">{varianceRequests} Requests</span>
            <span className={`bc-kpi-delta ${varianceRequests > 0 ? 'bc-kpi-delta-bad' : 'bc-kpi-delta-ok'}`}>
              {varianceRequests > 0 ? 'Critical' : 'Clear'}
            </span>
          </div>
          <div className="bc-kpi-foot">High-priority reallocations pending review · {budget?.pendingRequestCount ?? 0} total in queue</div>
          <div className="bc-kpi-bar">
            <div className="bc-kpi-bar-fill" style={{ width: '28%', background: '#1d4ed8' }} />
            <div className="bc-kpi-bar-fill" style={{ width: '20%', background: '#1d4ed8', marginLeft: 4 }} />
            <div className="bc-kpi-bar-fill" style={{ width: '12%', background: '#cbd5e1', marginLeft: 4 }} />
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bc-card bc-chart-card">
        <div className="bc-chart-head">
          <div>
            <h3 className="bc-chart-title">Projected vs. Actual Spending</h3>
            <p className="bc-chart-sub">FINANCIAL YEAR {budget?.year ?? new Date().getFullYear()} ANALYSIS · {displayCurrency} (MILLIONS)</p>
          </div>
          <div className="bc-chart-legend">
            <span><i style={{ background: '#1d4ed8' }} /> ACTUAL SPENDING</span>
            <span><i className="bc-legend-stripe" /> PROJECTED TARGET</span>
          </div>
        </div>
        <div className="bc-chart-body">
          {budgetLoading ? (
            <div style={{ padding: 24 }}><SkeletonCard rows={4} /></div>
          ) : (
          <svg viewBox="0 0 760 280" preserveAspectRatio="none" style={{ width: '100%', height: chartHeight }}>
            <defs>
              <pattern id="bc-stripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="3" height="6" fill="#cbd5e1" />
                <rect x="3" width="3" height="6" fill="transparent" />
              </pattern>
            </defs>
            {chartGridLines.map((g) => {
              const y = 240 - (g / maxVal) * 220
              return (
                <g key={g.toString()}>
                  <line x1="50" x2="750" y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x="40" y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{g.toFixed(2)}M</text>
                </g>
              )
            })}
            {months.map((m, i) => {
              const groupX = 60 + i * 58
              const aH = (actualsM[i] / maxVal) * 220
              const pH = (projectedM[i] / maxVal) * 220
              return (
                <g key={m}>
                  <rect x={groupX} y={240 - pH} width="18" height={pH} fill="url(#bc-stripe)" rx="2" />
                  <rect x={groupX + 22} y={240 - aH} width="18" height={aH} fill="#1d4ed8" rx="2" />
                  <text x={groupX + 20} y="262" textAnchor="middle" fontSize="11" fill="#94a3b8">{m}</text>
                </g>
              )
            })}
          </svg>
          )}
        </div>
        <div className="bc-chart-foot">
          <span>Posted journal totals · Data refreshed {refreshLabel}</span>
        </div>
      </div>

      {/* Queue card */}
      <div className="bc-card">
        <div className="bc-queue-head">
          <h3 className="bc-queue-title">Reallocation Request Queue</h3>
          <div className="bc-queue-tools">
            <button type="button" className="bc-icon-btn" title="Filter">▤</button>
            <button type="button" className="bc-icon-btn" title="Refresh">↻</button>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 24 }}><SkeletonCard rows={4} /></div>
        ) : (
          <>
            <div className="bc-table-wrap">
              <table className="bc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Project / Department</th>
                    <th>Requested By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Priority</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                        No reallocation requests pending.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((item) => {
                      const dept = departmentFor(item)
                      const pStyle = priorityStyle(item.priority)
                      return (
                        <tr key={item.id} className="bc-row">
                          <td className="bc-cell-id">#{item.id}</td>
                          <td>
                            <div className="bc-desc-title">{dept.project}</div>
                            <div className="bc-desc-sub">{dept.dept}</div>
                          </td>
                          <td>
                            <div className="bc-requester">
                              <span className="bc-avatar" style={{ background: avatarColor(item.requestedByName) }}>
                                {initialsFor(item.requestedByName)}
                              </span>
                              <span>{item.requestedByName}</span>
                            </div>
                          </td>
                          <td className="bc-amount">{formatUsd(item.amount)}</td>
                          <td>
                            <span
                              className="bc-priority-pill"
                              style={{
                                background: item.priority === 'High' ? '#fee2e2' : item.priority === 'Medium' ? '#fef3c7' : '#dcfce7',
                                color: pStyle.color,
                              }}
                              data-tooltip={`Priority: ${item.priority}. ${item.priority === 'High' ? 'Review urgently \u2014 high business impact.' : item.priority === 'Medium' ? 'Standard review timeline.' : 'Low priority \u2014 review when capacity allows.'}`}
                            >
                              {item.priority.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="bc-actions">
                              <button type="button" className="bc-icon-btn bc-icon-approve" title="Approve" onClick={() => onApprove(item.id)}>✓</button>
                              <button type="button" className="bc-icon-btn bc-icon-reject" title="Reject" onClick={() => onReject(item.id)}>✕</button>
                              <button type="button" className="bc-icon-btn" title="View" onClick={() => onView(item.id)}>⊙</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="bc-pagination">
              <span className="bc-pagination-info">
                Showing {pageItems.length} of {items.length} pending requests
              </span>
              <div className="bc-pagination-controls">
                <button type="button" className="bc-page-btn" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === safePage ? 'bc-page-btn bc-page-btn-active' : 'bc-page-btn'}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button type="button" className="bc-page-btn" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
