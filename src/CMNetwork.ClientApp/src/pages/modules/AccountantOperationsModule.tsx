/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import type { ColumnDef } from '@tanstack/react-table'
import { DashboardCard } from '../../components/DashboardCard'
import { DataTable } from '../../components/ui/data-table'
import { createClientId } from '../../lib/utils'
import { generalLedgerService, bankReconciliationService } from '../../services/accountantService'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { formatMoney, useDisplayCurrency } from '../../store/currencyStore'
import { roleLabels } from '../../types/auth'

type AccountantModuleKey =
  | 'general-ledger'
  | 'accounts-payable'
  | 'accounts-receivable'
  | 'bank-reconciliation'

interface AccountantOperationsModuleProps {
  moduleKey: AccountantModuleKey
}

interface JournalEntry {
  id: string
  journalId?: string
  date: string
  reference: string
  debit: number
  credit: number
  status: string
  recurring: boolean
}

interface ApiJournalLine {
  accountId: string
  description?: string | null
  debit: number
  credit: number
}

interface ApiJournalEntry {
  id: string
  entryNumber: string
  entryDate: string
  referenceNo?: string | null
  description?: string | null
  status: string | number
  lines: ApiJournalLine[]
}

interface ApiChartOfAccount {
  id: string
  accountCode: string
  name: string
  type: number | string
  isActive?: boolean
}

interface JournalLineForm {
  id: string
  side: 'debit' | 'credit'
  accountId: string
  description: string
  amount: string
}

interface ApiTrialBalanceItem {
  accountCode: string
  accountName: string
  totalDebit: number
  totalCredit: number
  balance: number
}

interface ApiFiscalPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  isClosed: boolean
}

interface PayableInvoice {
  id: string
  supplier: string
  poNumber: string
  receiptNumber: string
  invoiceAmount: number
  poAmount: number
  receiptAmount: number
  status: 'Ready for Payment' | 'Matched' | 'Mismatch' | 'Approved'
}

interface ReceivableInvoice {
  id: string
  customer: string
  dueDate: string
  amount: number
  ageDays: number
  status: 'Overdue' | 'Due Soon' | 'Paid'
}

interface BankStatement {
  id: string
  bankAccountName: string
  bankAccountNumber: string
  statementDate: string
  openingBalance: number
  closingBalance: number
  reconciliationStatus?: string
  reconciliationId?: string | null
  transactionCount?: number
  matchedCount?: number
}

interface BankTransaction {
  id: string
  transactionDate: string
  description: string
  reference: string
  debitAmount: number
  creditAmount: number
  isMatched: boolean
}

interface ApiBankTransaction {
  id: string
  transactionDate: string
  description: string
  reference?: string | null
  amount?: number
  isDebit?: boolean
  debitAmount?: number
  creditAmount?: number
  isMatched: boolean
}

interface GlLine {
  id: string
  entryNumber: string
  entryDate: string
  description: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

interface AgingRow {
  bucket: string
  amount: number
  risk: 'Low' | 'Medium' | 'High'
}

const normalizeBankTransaction = (transaction: ApiBankTransaction): BankTransaction => {
  const amount = Math.abs(Number(transaction.amount ?? 0))
  const isDebit = typeof transaction.isDebit === 'boolean'
    ? transaction.isDebit
    : Number(transaction.debitAmount ?? 0) > 0

  return {
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    description: transaction.description,
    reference: transaction.reference ?? '',
    debitAmount: Number(transaction.debitAmount ?? (isDebit ? amount : 0)),
    creditAmount: Number(transaction.creditAmount ?? (!isDebit ? amount : 0)),
    isMatched: transaction.isMatched,
  }
}

interface MonthEndChecklistItem {
  id: string
  label: string
  completed: boolean
}

const moduleMeta: Record<AccountantModuleKey, { title: string; subtitle: string }> = {
  'general-ledger': {
    title: 'General Ledger',
    subtitle: 'Create journals, review month-end close checklist, and export ledger activity.',
  },
  'accounts-payable': {
    title: 'Accounts Payable',
    subtitle: 'Approve invoices, run 3-way match checks, and open supplier view.',
  },
  'accounts-receivable': {
    title: 'Accounts Receivable',
    subtitle: 'Send overdue reminders, post receipts, and inspect aging risk.',
  },
  'bank-reconciliation': {
    title: 'Bank Reconciliation',
    subtitle: 'Automatch, resolve exceptions, and finalize statement close.',
  },
}

const formatCurrency = (value: number) => formatMoney(value, 'PHP')

const getFileNameFromDisposition = (disposition: string | undefined, fallback: string) => {
  if (!disposition) return fallback
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  // eslint-disable-next-line no-useless-escape
  const asciiMatch = disposition.match(/filename="?([^\";]+)"?/i)
  return asciiMatch?.[1] ?? fallback
}

const defaultJournals: JournalEntry[] = [
  { id: 'JE-24018', date: '2026-04-24', reference: 'REV-RECLASS', debit: 92500, credit: 92500, status: 'Draft', recurring: false },
  { id: 'JE-24019', date: '2026-04-25', reference: 'UTIL-ACCRUAL', debit: 18000, credit: 18000, status: 'Posted', recurring: true },
]

const createDefaultJournalLine = (side: 'debit' | 'credit'): JournalLineForm => ({
  id: createClientId(),
  side,
  accountId: '',
  description: '',
  amount: '',
})

const resolveAccountTypeCode = (type: number | string) => {
  if (typeof type === 'number') {
    return type
  }

  const parsed = Number(type)
  if (!Number.isNaN(parsed)) {
    return parsed
  }

  switch (String(type).toLowerCase()) {
    case 'asset':
      return 1
    case 'liability':
      return 2
    case 'equity':
      return 3
    case 'revenue':
      return 4
    case 'expense':
      return 5
    default:
      return 0
  }
}

const normalizeJournalStatus = (status: string | number) => {
  const raw = String(status ?? '').trim().toLowerCase()
  if (raw === '1' || raw === 'draft') return 'Draft'
  if (raw === '2' || raw === 'posted') return 'Posted'
  return 'Unknown'
}

export const AccountantOperationsModule = ({ moduleKey }: AccountantOperationsModuleProps) => {
  const displayCurrency = useDisplayCurrency()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const currentRole = selectedRole || user?.role || 'accountant'

  const [journals, setJournals] = useState<JournalEntry[]>(defaultJournals)

  const [payables, setPayables] = useState<PayableInvoice[]>([
    { id: 'AP-1001', supplier: 'Metro Office Supply', poNumber: 'PO-8821', receiptNumber: 'RCV-5511', invoiceAmount: 48200, poAmount: 48200, receiptAmount: 48200, status: 'Ready for Payment' },
    { id: 'AP-1002', supplier: 'North Facilities', poNumber: 'PO-8830', receiptNumber: 'RCV-5519', invoiceAmount: 128000, poAmount: 128000, receiptAmount: 125000, status: 'Mismatch' },
    { id: 'AP-1003', supplier: 'Techstream Subscriptions', poNumber: 'PO-8841', receiptNumber: 'RCV-5524', invoiceAmount: 22500, poAmount: 22500, receiptAmount: 22500, status: 'Matched' },
  ])

  const [receivables, setReceivables] = useState<ReceivableInvoice[]>([
    { id: 'AR-8812', customer: 'University Services', dueDate: '2026-03-10', amount: 120000, ageDays: 49, status: 'Overdue' },
    { id: 'AR-8813', customer: 'Conference Partners', dueDate: '2026-04-30', amount: 82500, ageDays: 2, status: 'Due Soon' },
    { id: 'AR-8814', customer: 'Training Plus', dueDate: '2026-04-15', amount: 56000, ageDays: 0, status: 'Paid' },
  ])

  const [showCreateJournal, setShowCreateJournal] = useState(false)
  const [showFiscalPeriods, setShowFiscalPeriods] = useState(false)
  const [showMonthEnd, setShowMonthEnd] = useState(false)
  const [showExportLedger, setShowExportLedger] = useState(false)
  const [showMatch, setShowMatch] = useState(false)
  const [showSupplierView, setShowSupplierView] = useState(false)
  const [showPostReceipt, setShowPostReceipt] = useState(false)
  const [showImportStatement, setShowImportStatement] = useState(false)

  // Bank Reconciliation state
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([])
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null)
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
  const [glLines, setGlLines] = useState<GlLine[]>([])
  const [bankDifference, setBankDifference] = useState<{ closingBalance: number; matchedTotal: number; difference: number } | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [selectedBankTxId, setSelectedBankTxId] = useState<string | null>(null)
  const [selectedGlLineId, setSelectedGlLineId] = useState<string | null>(null)
  const [bankReconTab, setBankReconTab] = useState<'overview' | 'reconcile' | 'history'>('overview')
  const [importForm, setImportForm] = useState({
    bankName: '',
    accountNumber: '',
    statementDate: new Date().toISOString().slice(0, 10),
    openingBalance: '',
    closingBalance: '',
  })

  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    description: '',
    recurring: false,
  })
  const [journalLines, setJournalLines] = useState<JournalLineForm[]>([
    createDefaultJournalLine('debit'),
    createDefaultJournalLine('credit'),
  ])
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null)
  const [viewingJournal, setViewingJournal] = useState<ApiJournalEntry | null>(null)
  const [viewJournalLoading, setViewJournalLoading] = useState(false)

  const [selectedPayableIds, setSelectedPayableIds] = useState<string[]>([])
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<string[]>([])
  const [matchInvoiceId, setMatchInvoiceId] = useState('')
  const [receiptForm, setReceiptForm] = useState({ customer: '', amount: '', reference: '' })
  const [ledgerExportForm, setLedgerExportForm] = useState({
    fromDate: '2026-04-01',
    toDate: '2026-04-30',
    format: 'csv' as 'csv' | 'excel',
  })

  const [monthEndChecklist, setMonthEndChecklist] = useState<MonthEndChecklistItem[]>([
    { id: 'reconcile', label: 'Reconcile banks', completed: false },
    { id: 'accruals', label: 'Post accruals', completed: false },
    { id: 'trial-balance', label: 'Review trial balance', completed: false },
  ])
  const [journalLoading, setJournalLoading] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [trialBalanceLoading, setTrialBalanceLoading] = useState(false)
  const [fiscalPeriodsLoading, setFiscalPeriodsLoading] = useState(false)
  const [monthEndLoading, setMonthEndLoading] = useState(false)
  const [glAccounts, setGlAccounts] = useState<ApiChartOfAccount[]>([])
  const [fiscalPeriods, setFiscalPeriods] = useState<ApiFiscalPeriod[]>([])
  const [trialBalanceRows, setTrialBalanceRows] = useState<ApiTrialBalanceItem[]>([])
  const [trialBalanceAsOfDate, setTrialBalanceAsOfDate] = useState(new Date().toISOString().slice(0, 10))

  const monthEndProgress = monthEndChecklist.length
    ? Math.round((monthEndChecklist.filter((item) => item.completed).length / monthEndChecklist.length) * 100)
    : 0

  const journalDebitTotal = journalLines
    .filter((line) => line.side === 'debit')
    .reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const journalCreditTotal = journalLines
    .filter((line) => line.side === 'credit')
    .reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const journalBalanced = journalDebitTotal === journalCreditTotal && journalDebitTotal > 0
  const canCallProtectedGlApi = moduleKey === 'general-ledger' && isAuthenticated && Boolean(token)
  const canCallProtectedBankApi = moduleKey === 'bank-reconciliation' && isAuthenticated && Boolean(token)
  const journalBalanceMessage = useMemo(() => {
    if (journalBalanced) {
      return 'Balanced: Debits and credits match. Ready to save.'
    }

    if (journalDebitTotal === 0 && journalCreditTotal === 0) {
      return 'Add at least one debit line and one credit line with amounts to continue.'
    }

    const difference = Math.abs(journalDebitTotal - journalCreditTotal)
    if (journalDebitTotal > journalCreditTotal) {
      return `Not balanced yet: add ${formatCurrency(difference)} to credits or reduce debits.`
    }

    return `Not balanced yet: add ${formatCurrency(difference)} to debits or reduce credits.`
  }, [journalBalanced, journalDebitTotal, journalCreditTotal])

  const debitEligibleAccounts = useMemo(
    () =>
      glAccounts.filter((account) => {
        if (account.isActive === false) {
          return false
        }
        const typeCode = resolveAccountTypeCode(account.type)
        return typeCode === 1 || typeCode === 5
      }),
    [glAccounts],
  )

  const creditEligibleAccounts = useMemo(
    () =>
      glAccounts.filter((account) => {
        if (account.isActive === false) {
          return false
        }
        const typeCode = resolveAccountTypeCode(account.type)
        return typeCode === 2 || typeCode === 3 || typeCode === 4
      }),
    [glAccounts],
  )

  const refreshGeneralLedgerData = useCallback(async () => {
    if (!canCallProtectedGlApi) {
      return
    }

    const today = new Date()
    const fiscalYear = today.getFullYear()
    const month = today.getMonth() + 1

    setJournalLoading(true)
    setMonthEndLoading(true)

    try {
      const [journalResponse, checklistResponse] = await Promise.all([
        generalLedgerService.getJournalEntries(),
        generalLedgerService.monthEndChecklist(fiscalYear, month),
      ])

      const entries = journalResponse.data as ApiJournalEntry[]
      const mapped = entries.map((entry) => {
        const debit = entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
        const credit = entry.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)

        return {
          id: entry.entryNumber,
          journalId: entry.id,
          date: entry.entryDate,
          reference: entry.referenceNo || entry.description || entry.entryNumber,
          debit,
          credit,
          status: normalizeJournalStatus(entry.status),
          recurring: false,
        }
      })
      setJournals(mapped)

      const checklistData = checklistResponse.data as {
        tasks?: Array<{
          taskId: string
          label: string
          completed: boolean
        }>
      }
      const tasks = checklistData.tasks ?? []
      if (tasks.length > 0) {
        setMonthEndChecklist(
          tasks.map((task) => ({
            id: task.taskId,
            label: task.label,
            completed: task.completed,
          })),
        )
      }
    } catch (error) {
      let detail = ''

      if (typeof error === 'object' && error !== null) {
        const apiError = error as {
          message?: string
          response?: {
            status?: number
            data?: unknown
          }
        }

        const responseData = apiError.response?.data
        if (typeof responseData === 'string' && responseData.trim().length > 0) {
          detail = responseData
        } else if (typeof responseData === 'object' && responseData !== null) {
          const responseObj = responseData as { message?: unknown; title?: unknown }
          if (typeof responseObj.message === 'string' && responseObj.message.trim().length > 0) {
            detail = responseObj.message
          } else if (typeof responseObj.title === 'string' && responseObj.title.trim().length > 0) {
            detail = responseObj.title
          }
        }

        if (!detail && typeof apiError.message === 'string' && apiError.message.trim().length > 0) {
          detail = apiError.message
        }
      }

      const toastMessage = detail
        ? `Unable to refresh GL data from API: ${detail}. Showing cached UI values.`
        : 'Unable to refresh GL data from API. Showing cached UI values.'

      pushToast('warning', toastMessage)
      console.error('General Ledger refresh failed', error)
    } finally {
      setJournalLoading(false)
      setMonthEndLoading(false)
    }
  }, [canCallProtectedGlApi, pushToast])

  const journalRows = useMemo(
    () => journals.map((item) => ({ ...item, debitText: formatCurrency(item.debit), creditText: formatCurrency(item.credit), recurringText: item.recurring ? 'Yes' : 'No' })),
    [journals, displayCurrency],
  )

  const payableRows = useMemo(
    () => payables.map((item) => ({ ...item, invoiceAmountText: formatCurrency(item.invoiceAmount), poAmountText: formatCurrency(item.poAmount), receiptAmountText: formatCurrency(item.receiptAmount) })),
    [payables, displayCurrency],
  )

  const receivableRows = useMemo(
    () => receivables.map((item) => ({ ...item, amountText: formatCurrency(item.amount) })),
    [receivables, displayCurrency],
  )

  const agingRows: AgingRow[] = useMemo(() => {
    const result = { '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0 }

    receivables.filter((item) => item.status !== 'Paid').forEach((item) => {
      if (item.ageDays <= 30) result['0-30'] += item.amount
      else if (item.ageDays <= 60) result['31-60'] += item.amount
      else if (item.ageDays <= 90) result['61-90'] += item.amount
      else result['>90'] += item.amount
    })

    return [
      { bucket: '0-30', amount: result['0-30'], risk: 'Low' },
      { bucket: '31-60', amount: result['31-60'], risk: 'Medium' },
      { bucket: '61-90', amount: result['61-90'], risk: 'High' },
      { bucket: '>90', amount: result['>90'], risk: 'High' },
    ]
  }, [receivables])

  const agingDisplayRows = useMemo(
    () => agingRows.map((item) => ({ ...item, amountText: formatCurrency(item.amount) })),
    [agingRows, displayCurrency],
  )

  const ledgerExportRows = useMemo(
    () =>
      journals.filter(
        (item) => item.date >= ledgerExportForm.fromDate && item.date <= ledgerExportForm.toDate,
      ),
    [journals, ledgerExportForm.fromDate, ledgerExportForm.toDate],
  )

  useEffect(() => {
    if (!canCallProtectedGlApi) {
      return
    }
    void refreshGeneralLedgerData()
  }, [canCallProtectedGlApi, refreshGeneralLedgerData])

  useEffect(() => {
    if (!canCallProtectedGlApi) {
      return
    }

    const loadAccounts = async () => {
      setAccountsLoading(true)
      try {
        const response = await generalLedgerService.getAccounts()
        const accounts = response.data as ApiChartOfAccount[]
        setGlAccounts(accounts)
      } catch {
        pushToast('warning', 'Unable to load chart of accounts for journal creation.')
      } finally {
        setAccountsLoading(false)
      }
    }

    void loadAccounts()
  }, [canCallProtectedGlApi, pushToast])

  const getLineEligibleAccounts = (side: 'debit' | 'credit') =>
    side === 'debit' ? debitEligibleAccounts : creditEligibleAccounts

  const resetJournalEditor = () => {
    setEditingJournalId(null)
    setJournalForm({
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      description: '',
      recurring: false,
    })
    setJournalLines([createDefaultJournalLine('debit'), createDefaultJournalLine('credit')])
  }

  const addJournalLine = (side: 'debit' | 'credit') => {
    setJournalLines((current) => [...current, createDefaultJournalLine(side)])
  }

  const updateJournalLine = (id: string, patch: Partial<JournalLineForm>) => {
    setJournalLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  const removeJournalLine = (id: string) => {
    setJournalLines((current) => {
      const target = current.find((line) => line.id === id)
      if (!target) return current
      const sameSideCount = current.filter((line) => line.side === target.side).length
      if (sameSideCount <= 1) return current
      return current.filter((line) => line.id !== id)
    })
  }

  const loadJournalForView = async (entry: JournalEntry) => {
    if (!entry.journalId) {
      setViewingJournal({
        id: entry.id,
        entryNumber: entry.id,
        entryDate: entry.date,
        referenceNo: entry.reference,
        description: null,
        status: entry.status,
        lines: [],
      })
      return
    }

    setViewJournalLoading(true)
    try {
      const response = await generalLedgerService.getJournalEntry(entry.journalId)
      setViewingJournal(response.data as ApiJournalEntry)
    } catch {
      pushToast('error', `Failed to load journal ${entry.id}.`)
    } finally {
      setViewJournalLoading(false)
    }
  }

  const loadJournalForEdit = async (entry: JournalEntry) => {
    if (!entry.journalId) {
      pushToast('warning', `Journal ${entry.id} is not linked to the server record.`)
      return
    }

    try {
      const response = await generalLedgerService.getJournalEntry(entry.journalId)
      const detail = response.data as ApiJournalEntry

      const mappedLines: JournalLineForm[] = detail.lines.map((line) => ({
        id: createClientId(),
        side: (line.debit > 0 ? 'debit' : 'credit') as 'debit' | 'credit',
        accountId: line.accountId,
        description: line.description ?? '',
        amount: String(line.debit > 0 ? line.debit : line.credit),
      }))

      setEditingJournalId(detail.id)
      setJournalForm({
        date: detail.entryDate,
        reference: detail.referenceNo ?? '',
        description: detail.description ?? '',
        recurring: false,
      })
      setJournalLines(mappedLines.length ? mappedLines : [createDefaultJournalLine('debit'), createDefaultJournalLine('credit')])
      setShowCreateJournal(true)
    } catch {
      pushToast('error', `Failed to load journal ${entry.id} for editing.`)
    }
  }

  const loadTrialBalance = useCallback(async () => {
    if (!canCallProtectedGlApi) return

    setTrialBalanceLoading(true)
    try {
      const response = await generalLedgerService.getTrialBalance(trialBalanceAsOfDate)
      const data = response.data as { items?: ApiTrialBalanceItem[] }
      setTrialBalanceRows(data.items ?? [])
    } catch {
      pushToast('warning', 'Unable to load trial balance for selected period.')
    } finally {
      setTrialBalanceLoading(false)
    }
  }, [canCallProtectedGlApi, pushToast, trialBalanceAsOfDate])

  const loadFiscalPeriods = useCallback(async () => {
    if (!canCallProtectedGlApi) return

    setFiscalPeriodsLoading(true)
    try {
      const response = await generalLedgerService.getFiscalPeriods()
      setFiscalPeriods(response.data as ApiFiscalPeriod[])
    } catch {
      pushToast('warning', 'Unable to load fiscal periods.')
    } finally {
      setFiscalPeriodsLoading(false)
    }
  }, [canCallProtectedGlApi, pushToast])

  const createOrUpdateJournalEntry = async () => {
    if (!journalForm.reference || !journalForm.description) {
      pushToast('error', 'Reference and description are required.')
      return
    }

    if (!journalBalanced) {
      const difference = Math.abs(journalDebitTotal - journalCreditTotal)
      if (journalDebitTotal === 0 && journalCreditTotal === 0) {
        pushToast('error', 'Journal is not ready to save. Add at least one debit and one credit amount.')
      } else {
        pushToast('error', `Journal is not ready to save. Debits and credits must match. Difference to fix: ${formatCurrency(difference)}.`)
      }
      return
    }

    const normalizedLines = journalLines
      .map((line) => {
        const amount = Number(line.amount || 0)
        return {
          accountId: line.accountId,
          description: line.description || undefined,
          debit: line.side === 'debit' ? amount : 0,
          credit: line.side === 'credit' ? amount : 0,
        }
      })
      .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0))

    if (normalizedLines.length < 2) {
      pushToast('error', 'Provide at least two valid journal lines.')
      return
    }

    try {
      const payload = {
        entryDate: journalForm.date,
        description: journalForm.description,
        referenceNo: journalForm.reference,
        lines: normalizedLines,
      }

      if (editingJournalId) {
        await generalLedgerService.updateJournal(editingJournalId, payload)
      } else {
        await generalLedgerService.createJournal(payload)
      }

      await Promise.all([refreshGeneralLedgerData(), loadTrialBalance(), loadFiscalPeriods()])
      setShowCreateJournal(false)
      resetJournalEditor()
      pushToast('success', editingJournalId ? 'Journal entry updated.' : 'Journal entry created.')
    } catch {
      pushToast('error', 'Failed to save journal entry. Verify fields and try again.')
    }
  }

  const updateFiscalPeriodStatus = async (periodId: string, action: 'close' | 'reopen') => {
    try {
      if (action === 'close') {
        await generalLedgerService.closeFiscalPeriod(periodId)
      } else {
        await generalLedgerService.reopenFiscalPeriod(periodId)
      }

      await Promise.all([loadFiscalPeriods(), refreshGeneralLedgerData()])
      pushToast('success', action === 'close' ? 'Fiscal period closed.' : 'Fiscal period reopened.')
    } catch {
      pushToast('error', action === 'close' ? 'Unable to close fiscal period.' : 'Unable to reopen fiscal period.')
    }
  }

  useEffect(() => {
    if (!canCallProtectedGlApi) {
      return
    }
    void loadTrialBalance()
  }, [canCallProtectedGlApi, loadTrialBalance])

  useEffect(() => {
    if (!canCallProtectedGlApi) {
      return
    }
    void loadFiscalPeriods()
  }, [canCallProtectedGlApi, loadFiscalPeriods])

  const postJournalEntry = async (entry: JournalEntry) => {
    if (!entry.journalId) {
      pushToast('warning', `Journal ${entry.id} is not linked to the server record.`)
      return
    }

    if (normalizeJournalStatus(entry.status) === 'Posted') {
      pushToast('info', `Journal ${entry.id} is already posted.`)
      return
    }

    try {
      await generalLedgerService.postJournal(entry.journalId)
      await Promise.all([refreshGeneralLedgerData(), loadTrialBalance()])
      pushToast('success', `Journal ${entry.id} posted and ledger refreshed.`)
    } catch {
      pushToast('error', `Unable to post journal ${entry.id}.`)
    }
  }

  const toggleMonthEndTask = (id: string) => {
    setMonthEndChecklist((current) =>
      current.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    )
  }

  const finalizeMonthEnd = async () => {
    if (monthEndProgress < 100) {
      pushToast('error', 'All month-end tasks must be completed before finalizing.')
      return
    }

    const today = new Date()

    try {
      await generalLedgerService.monthEndClose({
        fiscalYear: today.getFullYear(),
        month: today.getMonth() + 1,
        checklistItems: monthEndChecklist.map((item) => ({ taskId: item.id, completed: item.completed })),
      })

      await refreshGeneralLedgerData()
      setShowMonthEnd(false)
      pushToast('success', 'Month-end close finalized and GL data refreshed.')
    } catch {
      pushToast('error', 'Month-end close failed. Ensure checklist tasks are complete and retry.')
    }
  }

  const exportLedgerActivity = async () => {
    if (ledgerExportForm.fromDate > ledgerExportForm.toDate) {
      pushToast('error', 'Ledger export date range is invalid.')
      return
    }

    if (!ledgerExportRows.length) {
      pushToast('warning', 'No journal rows found for the selected date range.')
      return
    }

    try {
      const response = await generalLedgerService.exportLedgerActivity({
        fromDate: ledgerExportForm.fromDate,
        toDate: ledgerExportForm.toDate,
        format: ledgerExportForm.format,
      })

      const extension = ledgerExportForm.format === 'excel' ? 'xlsx' : 'csv'
      const fallbackName = `ledger-activity-${ledgerExportForm.fromDate}-to-${ledgerExportForm.toDate}.${extension}`
      const fileName = getFileNameFromDisposition(
        response.headers['content-disposition'] as string | undefined,
        fallbackName,
      )

      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      pushToast('success', `Ledger activity export ready (${ledgerExportRows.length} row(s)).`)
      setShowExportLedger(false)
    } catch {
      pushToast('error', 'Failed to export ledger activity. Please retry.')
    }
  }

  const approveInvoices = () => {
    if (!selectedPayableIds.length) {
      pushToast('warning', 'Select invoices to approve.')
      return
    }

    setPayables((current) =>
      current.map((item) =>
        selectedPayableIds.includes(item.id) ? { ...item, status: 'Approved' } : item,
      ),
    )
    setSelectedPayableIds([])
    pushToast('success', 'Selected invoices approved for payment.')
  }

  const runMatchCheck = () => {
    const invoice = payables.find((item) => item.id === matchInvoiceId)

    if (!invoice) {
      pushToast('warning', 'Select an invoice first.')
      return
    }

    const matched = invoice.invoiceAmount === invoice.poAmount && invoice.invoiceAmount === invoice.receiptAmount

    setPayables((current) =>
      current.map((item) =>
        item.id === invoice.id ? { ...item, status: matched ? 'Matched' : 'Mismatch' } : item,
      ),
    )

    pushToast(matched ? 'success' : 'error', matched ? '3-way match successful.' : '3-way mismatch detected.')
  }

  const sendReminders = () => {
    if (!selectedOverdueIds.length) {
      pushToast('warning', 'Select overdue invoices to remind.')
      return
    }

    pushToast('success', `${selectedOverdueIds.length} reminder email(s) queued.`)
    setSelectedOverdueIds([])
  }

  const postReceipt = () => {
    if (!receiptForm.customer || !receiptForm.amount || !selectedOverdueIds.length) {
      pushToast('error', 'Provide receipt details and choose invoices to apply.')
      return
    }

    setReceivables((current) =>
      current.map((item) =>
        selectedOverdueIds.includes(item.id)
          ? { ...item, status: 'Paid', ageDays: 0 }
          : item,
      ),
    )

    setReceiptForm({ customer: '', amount: '', reference: '' })
    setSelectedOverdueIds([])
    setShowPostReceipt(false)
    pushToast('success', 'Receipt posted and applied.')
  }

  const loadBankStatements = useCallback(async () => {
    if (!canCallProtectedBankApi) return
    setBankLoading(true)
    try {
      const res = await bankReconciliationService.getStatements()
      const raw = res.data
      const statements: BankStatement[] = Array.isArray(raw)
        ? (raw as BankStatement[])
        : ((raw as { items?: BankStatement[] }).items ?? [])
      setBankStatements(statements)
    } catch {
      pushToast('warning', 'Unable to load bank statements.')
    } finally {
      setBankLoading(false)
    }
  }, [canCallProtectedBankApi, pushToast])

  const loadStatementDetails = useCallback(async (statementId: string) => {
    setBankLoading(true)
    try {
      const [txRes, glRes, diffRes] = await Promise.all([
        bankReconciliationService.getUnmatchedTransactions(statementId),
        bankReconciliationService.getUnmatchedGlLines(),
        bankReconciliationService.getDifference(statementId),
      ])
      const transactions = ((txRes.data as ApiBankTransaction[]) ?? []).map(normalizeBankTransaction)
      setBankTransactions(transactions)
      setGlLines((glRes.data as GlLine[]) ?? [])
      setBankDifference(diffRes.data as { closingBalance: number; matchedTotal: number; difference: number })
    } catch {
      pushToast('warning', 'Unable to load reconciliation details.')
    } finally {
      setBankLoading(false)
    }
  }, [pushToast])

  const handleSelectStatement = async (id: string) => {
    setSelectedStatementId(id)
    setSelectedBankTxId(null)
    setSelectedGlLineId(null)
    await loadStatementDetails(id)
  }

  const handleMatch = async () => {
    if (!selectedBankTxId || !selectedGlLineId || !selectedStatementId) {
      pushToast('warning', 'Select one bank transaction and one GL line to match.')
      return
    }
    try {
      await bankReconciliationService.matchTransaction({ bankTransactionId: selectedBankTxId, journalEntryLineId: selectedGlLineId })
      pushToast('success', 'Match applied.')
      setSelectedBankTxId(null)
      setSelectedGlLineId(null)
      await loadStatementDetails(selectedStatementId)
    } catch {
      pushToast('error', 'Failed to apply match.')
    }
  }

  const handleFinalize = async () => {
    if (!selectedStatementId) return
    const statement = bankStatements.find((item) => item.id === selectedStatementId)
    if (!statement?.reconciliationId) {
      pushToast('error', 'Unable to finalize: reconciliation record was not found for this statement.')
      return
    }
    try {
      await bankReconciliationService.finalizeStatement({ reconciliationId: statement.reconciliationId })
      pushToast('success', 'Bank reconciliation statement finalized.')
      await loadBankStatements()
      setSelectedStatementId(null)
      setBankTransactions([])
      setGlLines([])
      setBankDifference(null)
    } catch {
      pushToast('error', 'Unable to finalize. Ensure all transactions are matched or use Force Finalize.')
    }
  }

  const handleImportStatement = async () => {
    if (!importForm.bankName || !importForm.accountNumber || !importForm.statementDate) {
      pushToast('error', 'Bank name, account number, and statement date are required.')
      return
    }
    try {
      await bankReconciliationService.importStatement({
        bankAccountName: importForm.bankName,
        bankAccountNumber: importForm.accountNumber,
        statementDate: importForm.statementDate,
        openingBalance: Number(importForm.openingBalance || 0),
        closingBalance: Number(importForm.closingBalance || 0),
        transactions: [],
      })
      pushToast('success', 'Bank statement imported.')
      setShowImportStatement(false)
      setImportForm({ bankName: '', accountNumber: '', statementDate: new Date().toISOString().slice(0, 10), openingBalance: '', closingBalance: '' })
      await loadBankStatements()
    } catch {
      pushToast('error', 'Failed to import statement.')
    }
  }

  useEffect(() => {
    void loadBankStatements()
  }, [loadBankStatements])

  const journalColumns = useMemo<ColumnDef<(typeof journalRows)[number]>[]>(
    () => [
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'reference', header: 'Reference' },
      { accessorKey: 'debitText', header: 'Debit' },
      { accessorKey: 'creditText', header: 'Credit' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const statusValue = normalizeJournalStatus(row.original.status)
          const normalized = statusValue.toLowerCase()
          const statusClass = normalized.includes('post') ? 'posted' : normalized.includes('draft') ? 'draft' : 'neutral'

          return <span className={`gl-status-pill gl-status-${statusClass}`}>{statusValue}</span>
        },
      },
      { accessorKey: 'recurringText', header: 'Recurring' },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const entry = row.original
          const isPosted = normalizeJournalStatus(entry.status) === 'Posted'

          return (
            <div className="gl-row-actions">
              <Button
                size="small"
                onClick={() => void loadJournalForView(entry)}
              >
                View
              </Button>
              <Button
                size="small"
                disabled={isPosted || !entry.journalId || journalLoading}
                onClick={() => void loadJournalForEdit(entry)}
              >
                Edit
              </Button>
              <Button
                size="small"
                disabled={isPosted || !entry.journalId || journalLoading}
                onClick={() => void postJournalEntry(entry)}
              >
                Post
              </Button>
            </div>
          )
        },
      },
    ],
    [journalLoading],
  )

  const trialBalanceRowsDisplay = useMemo(
    () =>
      trialBalanceRows.map((item) => ({
        ...item,
        totalDebitText: formatCurrency(item.totalDebit),
        totalCreditText: formatCurrency(item.totalCredit),
        balanceText: formatCurrency(item.balance),
      })),
    [trialBalanceRows, displayCurrency],
  )

  const trialBalanceColumns = useMemo<ColumnDef<(typeof trialBalanceRowsDisplay)[number]>[]>(
    () => [
      { accessorKey: 'accountCode', header: 'Account' },
      { accessorKey: 'accountName', header: 'Account Name' },
      { accessorKey: 'totalDebitText', header: 'Debit' },
      { accessorKey: 'totalCreditText', header: 'Credit' },
      { accessorKey: 'balanceText', header: 'Balance' },
    ],
    [],
  )

  const payablesColumns = useMemo<ColumnDef<(typeof payableRows)[number]>[]>(
    () => [
      { accessorKey: 'id', header: 'Invoice' },
      { accessorKey: 'supplier', header: 'Supplier' },
      { accessorKey: 'poNumber', header: 'PO' },
      { accessorKey: 'receiptNumber', header: 'Receipt' },
      { accessorKey: 'invoiceAmountText', header: 'Invoice Amount' },
      { accessorKey: 'status', header: 'Status' },
    ],
    [],
  )

  const receivablesColumns = useMemo<ColumnDef<(typeof receivableRows)[number]>[]>(
    () => [
      { accessorKey: 'id', header: 'Invoice' },
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'dueDate', header: 'Due Date' },
      { accessorKey: 'amountText', header: 'Amount' },
      { accessorKey: 'ageDays', header: 'Age (days)' },
      { accessorKey: 'status', header: 'Status' },
    ],
    [],
  )

  const agingColumns = useMemo<ColumnDef<(typeof agingDisplayRows)[number]>[]>(
    () => [
      { accessorKey: 'bucket', header: 'Bucket' },
      { accessorKey: 'amountText', header: 'Amount' },
      { accessorKey: 'risk', header: 'Risk' },
    ],
    [],
  )

  const fiscalPeriodRowsDisplay = useMemo(
    () =>
      fiscalPeriods.map((period) => ({
        ...period,
        statusText: period.isClosed ? 'Closed' : 'Open',
      })),
    [fiscalPeriods],
  )

  const fiscalPeriodColumns = useMemo<ColumnDef<(typeof fiscalPeriodRowsDisplay)[number]>[]>(
    () => [
      { accessorKey: 'name', header: 'Period' },
      { accessorKey: 'startDate', header: 'Start' },
      { accessorKey: 'endDate', header: 'End' },
      { accessorKey: 'statusText', header: 'Status' },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const period = row.original
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="small"
                disabled={period.isClosed}
                onClick={() => void updateFiscalPeriodStatus(period.id, 'close')}
              >
                Close
              </Button>
              <Button
                size="small"
                disabled={!period.isClosed}
                onClick={() => void updateFiscalPeriodStatus(period.id, 'reopen')}
              >
                Reopen
              </Button>
            </div>
          )
        },
      },
    ],
    [],
  )

  return (
    <section className={`accountant-module ${moduleKey === 'general-ledger' ? 'accountant-ledger-page' : ''}`.trim()}>
      <div className="accountant-module-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">
          {moduleKey === 'general-ledger'
            ? moduleMeta[moduleKey].title
            : `Welcome, ${user?.fullName} - ${roleLabels[currentRole]} | ${moduleMeta[moduleKey].title}`}
        </h1>
        <p className="card-subtitle">{moduleMeta[moduleKey].subtitle}</p>
      </div>

      {moduleKey === 'general-ledger' && (
        <>
          <div className="quick-actions gl-quick-actions">
            <Button
              themeColor="primary"
              onClick={() => {
                resetJournalEditor()
                setShowCreateJournal(true)
              }}
            >
              Create Journal
            </Button>
            <Button onClick={() => setShowMonthEnd(true)}>Review Month-End Close</Button>
            <Button onClick={() => setShowExportLedger(true)}>Export Ledger Activity</Button>
            {(currentRole === 'accountant' || currentRole === 'super-admin') && (
              <Button onClick={() => setShowFiscalPeriods(true)}>Manage Fiscal Periods</Button>
            )}
            <Button onClick={() => void refreshGeneralLedgerData()}>Refresh GL Data</Button>
          </div>

          <DashboardCard className="gl-card" title="Journal Entry List" subtitle="Server-style view with paging, sorting, and filtering">
            {journalLoading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Refreshing journals...</div>}
            <DataTable
              className="gl-table"
              data={journalRows}
              columns={journalColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No journal entries found."
            />
          </DashboardCard>

          <DashboardCard className="gl-card" title="Trial Balance" subtitle="As-of date filter with posted entries only">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label style={{ marginBottom: 0 }}>As of</label>
              <input
                className="role-select"
                type="date"
                value={trialBalanceAsOfDate}
                onChange={(event) => setTrialBalanceAsOfDate(event.target.value)}
              />
              <Button onClick={() => void loadTrialBalance()}>Refresh Trial Balance</Button>
              {trialBalanceLoading && <span style={{ color: 'var(--text-muted)' }}>Loading...</span>}
            </div>
            <DataTable
              className="gl-table"
              data={trialBalanceRowsDisplay}
              columns={trialBalanceColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No trial balance rows for selected date."
            />
          </DashboardCard>

        </>
      )}

      {moduleKey === 'accounts-payable' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={approveInvoices}>Approve Invoices</Button>
            <Button onClick={() => setShowMatch(true)}>Match PO/Receipt</Button>
            <Button onClick={() => setShowSupplierView(true)}>Supplier View</Button>
          </div>

          <DashboardCard title="Invoices" subtitle="Ready for payment and 3-way matching queue">
            <DataTable
              data={payableRows}
              columns={payablesColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No payable invoices available."
            />
          </DashboardCard>

          <DashboardCard title="Bulk Selection" subtitle="Select invoices then click Approve Invoices">
            <div style={{ display: 'grid', gap: '8px' }}>
              {payables.filter((item) => item.status === 'Ready for Payment' || item.status === 'Matched').map((item) => (
                <label key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedPayableIds.includes(item.id)}
                    onChange={() =>
                      setSelectedPayableIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                  {item.id} - {item.supplier}
                </label>
              ))}
            </div>
          </DashboardCard>
        </>
      )}

      {moduleKey === 'accounts-receivable' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={sendReminders}>Send Reminders</Button>
            <Button onClick={() => setShowPostReceipt(true)}>Post Receipt</Button>
            <Button onClick={() => pushToast('info', 'Aging grid refreshed with latest risk breakdown.')}>View Aging</Button>
          </div>

          <DashboardCard title="Receivable Queue" subtitle="Overdue items and posting queue">
            <DataTable
              data={receivableRows}
              columns={receivablesColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No receivable invoices available."
            />
          </DashboardCard>

          <DashboardCard title="Aging Buckets" subtitle="0-30, 31-60, 61-90, >90">
            <DataTable
              data={agingDisplayRows}
              columns={agingColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No aging bucket data available."
            />
          </DashboardCard>

          <DashboardCard title="Reminder Selection" subtitle="Select overdue invoices then send reminder">
            <div style={{ display: 'grid', gap: '8px' }}>
              {receivables.filter((item) => item.status === 'Overdue').map((item) => (
                <label key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedOverdueIds.includes(item.id)}
                    onChange={() =>
                      setSelectedOverdueIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                  {item.id} - {item.customer} ({formatCurrency(item.amount)})
                </label>
              ))}
            </div>
          </DashboardCard>
        </>
      )}

      {moduleKey === 'bank-reconciliation' && (() => {
        // ── Derived data ──────────────────────────────────────────────────
        const unmatched = bankTransactions.filter((t) => !t.isMatched)
        const aggregateUnmatchedCount = bankStatements.reduce(
          (sum, statement) => sum + Math.max(Number(statement.transactionCount ?? 0) - Number(statement.matchedCount ?? 0), 0),
          0,
        )
        const unmatchedCount = selectedStatementId ? unmatched.length : aggregateUnmatchedCount
        const kpiAccent = unmatchedCount === 0 ? 'accent-green' : unmatchedCount <= 10 ? 'accent-amber' : 'accent-red'

        const finalizedList = bankStatements.filter((s) => s.reconciliationStatus === 'Finalized')
        const lastFinalized = finalizedList[0] ?? null
        const openStatements = bankStatements.filter((s) => s.reconciliationStatus !== 'Finalized')

        const agedRows = [...unmatched]
          .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
          .slice(0, 5)
          .map((tx) => ({
            ...tx,
            daysOut: Math.floor((Date.now() - new Date(tx.transactionDate).getTime()) / 86_400_000),
          }))

        const selectedStmt = bankStatements.find((s) => s.id === selectedStatementId)
        const variance = bankDifference?.difference ?? null
        const isBalanced = variance !== null && Math.abs(variance) < 0.01
        const canMatch = Boolean(selectedBankTxId) && Boolean(selectedGlLineId) && !bankLoading
        const canFinalize = Boolean(selectedStmt?.reconciliationId) && !bankLoading && isBalanced

        const TAB_DEF = [
          { key: 'overview',  icon: '◈', label: 'Overview' },
          { key: 'reconcile', icon: '⇌', label: 'Reconcile' },
          { key: 'history',   icon: '≡', label: 'History'  },
        ] as const

        return (
          <div className="bkr-root">

            {/* ── Tab strip ─────────────────────────────────────────── */}
            <div className="bkr-tab-strip">
              {TAB_DEF.map(({ key, icon, label }) => (
                <button
                  key={key}
                  className={`bkr-tab${bankReconTab === key ? ' active' : ''}`}
                  onClick={() => setBankReconTab(key)}
                >
                  <span className="bkr-tab-icon">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* ══════════════ OVERVIEW ══════════════════════════════ */}
            {bankReconTab === 'overview' && (
              <>
                {/* KPI row */}
                <div className="bkr-kpi-row">
                  <div className={`bkr-kpi ${kpiAccent}`}>
                    <div className="bkr-kpi-label">Unreconciled Items</div>
                    <div className="bkr-kpi-value">{bankLoading ? '—' : unmatchedCount}</div>
                    <div className="bkr-kpi-sub">Unmatched bank transactions</div>
                  </div>

                  <div className="bkr-kpi accent-blue">
                    <div className="bkr-kpi-label">Last Finalized</div>
                    <div className={`bkr-kpi-value${lastFinalized ? ' text-lg' : ''}`}>
                      {lastFinalized ? lastFinalized.statementDate : '—'}
                    </div>
                    <div className="bkr-kpi-sub">
                      {lastFinalized ? lastFinalized.bankAccountName : 'No finalized statement yet'}
                    </div>
                  </div>

                  <div className={`bkr-kpi ${openStatements.length === 0 ? 'accent-green' : 'accent-amber'}`}>
                    <div className="bkr-kpi-label">Open Statements</div>
                    <div className="bkr-kpi-value">{bankLoading ? '—' : openStatements.length}</div>
                    <div className="bkr-kpi-sub">{bankStatements.length} total imported</div>
                  </div>

                  <div className={`bkr-kpi ${variance === null ? 'accent-blue' : isBalanced ? 'accent-green' : 'accent-red'}`}>
                    <div className="bkr-kpi-label">Current Variance</div>
                    <div className={`bkr-kpi-value text-lg`}>
                      {variance === null ? '—' : formatCurrency(Math.abs(variance))}
                    </div>
                    <div className="bkr-kpi-sub">
                      {isBalanced ? '✓ Balanced' : selectedStmt ? selectedStmt.bankAccountName : 'Select a statement'}
                    </div>
                  </div>
                </div>

                {/* Status + Aged */}
                <div className="bkr-body-grid">
                  {/* Statement status */}
                  <div className="bkr-card">
                    <div className="bkr-card-head">
                      <div>
                        <div className="bkr-card-title">Statement Status</div>
                        <div className="bkr-card-sub">All imported statements at a glance</div>
                      </div>
                    </div>
                    <div className="bkr-card-body">
                      {bankLoading && <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Loading…</p>}
                      {bankStatements.length === 0 && !bankLoading && (
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>No statements imported yet.</p>
                      )}
                      <div className="bkr-status-list">
                        {bankStatements.map((stmt) => {
                          const isOpen = stmt.reconciliationStatus !== 'Finalized'
                          const statusText = stmt.reconciliationStatus === 'Finalized' ? 'Closed' : stmt.reconciliationStatus === 'None' ? 'Not Started' : (stmt.reconciliationStatus ?? 'Open')
                          return (
                            <div key={stmt.id} className="bkr-status-item">
                              <div className="bkr-status-info">
                                <div className="bkr-status-name">{stmt.bankAccountName}</div>
                                <div className="bkr-status-meta">{stmt.bankAccountNumber} · {stmt.statementDate}</div>
                              </div>
                              <div className="bkr-status-right">
                                <div className={`bkr-status-label${!isOpen ? ' closed' : ''}`}>{statusText}</div>
                                <div className="bkr-pbar">
                                  <div className="bkr-pbar-fill" style={{ width: isOpen ? '40%' : '100%', background: isOpen ? '#f59e0b' : '#10b981' }} />
                                </div>
                              </div>
                              {isOpen && (
                                <button
                                  className="bkr-open-link"
                                  onClick={() => { setSelectedStatementId(stmt.id); setBankReconTab('reconcile'); void loadStatementDetails(stmt.id) }}
                                >
                                  Open →
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Aged unmatched */}
                  <div className="bkr-card">
                    <div className="bkr-card-head">
                      <div>
                        <div className="bkr-card-title">Aged Unmatched Transactions</div>
                        <div className="bkr-card-sub">Oldest 5 items needing attention</div>
                      </div>
                    </div>
                    <div className="bkr-card-body">
                      {agedRows.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
                          {selectedStatementId ? 'All transactions matched.' : 'Open a statement in Reconcile to see aged items.'}
                        </p>
                      ) : (
                        <table className="bkr-aged-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Description</th>
                              <th>Amount</th>
                              <th>Days</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agedRows.map((tx) => (
                              <tr key={tx.id}>
                                <td>{tx.transactionDate}</td>
                                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : formatCurrency(tx.creditAmount)}
                                </td>
                                <td>
                                  <span className={`bkr-days-pill${tx.daysOut > 30 ? ' bkr-days-danger' : tx.daysOut > 14 ? ' bkr-days-warn' : ''}`}>
                                    {tx.daysOut}d
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══════════════ RECONCILE ════════════════════════════ */}
            {bankReconTab === 'reconcile' && (
              <>
                {/* Statement picker */}
                <div className="bkr-card" style={{ marginBottom: 16 }}>
                  <div className="bkr-card-head">
                    <div>
                      <div className="bkr-card-title">Select Statement</div>
                      <div className="bkr-card-sub">Choose an open statement to work on</div>
                    </div>
                    {bankLoading && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading…</span>}
                  </div>
                  <div className="bkr-card-body">
                    {bankStatements.length === 0 && !bankLoading && (
                      <div className="bkr-empty">
                        <span className="bkr-empty-icon">📂</span>
                        <p>No statements imported yet. Upload one to begin.</p>
                      </div>
                    )}
                    <div className="bkr-stmt-list">
                      {bankStatements.map((stmt) => {
                        const isSelected = selectedStatementId === stmt.id
                        const isFinalized = stmt.reconciliationStatus === 'Finalized'
                        const badgeCls = isFinalized ? 'bkr-badge bkr-badge-finalized' : 'bkr-badge bkr-badge-open'
                        return (
                          <div
                            key={stmt.id}
                            className={`bkr-stmt-card${isSelected ? ' is-selected' : ''}${isFinalized ? ' is-finalized' : ''}`}
                            onClick={() => !isFinalized && void handleSelectStatement(stmt.id)}
                            role="button"
                            tabIndex={isFinalized ? -1 : 0}
                            onKeyDown={(e) => e.key === 'Enter' && !isFinalized && void handleSelectStatement(stmt.id)}
                          >
                            <div className="bkr-stmt-info">
                              <div className="bkr-stmt-name">{stmt.bankAccountName}</div>
                              <div className="bkr-stmt-meta">{stmt.bankAccountNumber} · {stmt.statementDate}</div>
                            </div>
                            <div className="bkr-stmt-right">
                              <div className="bkr-stmt-amount">{formatCurrency(stmt.closingBalance)}</div>
                              <span className={badgeCls}>
                                {isFinalized ? '✓ Finalized' : (stmt.reconciliationStatus === 'None' ? 'Not Started' : 'Open')}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Variance strip */}
                {selectedStatementId && bankDifference && (
                  <div className="bkr-variance" style={{ marginBottom: 16 }}>
                    <div className="bkr-variance-cell">
                      <span className="bkr-variance-lbl">Statement Closing</span>
                      <span className="bkr-variance-val">{formatCurrency(bankDifference.closingBalance)}</span>
                    </div>
                    <div className="bkr-variance-cell">
                      <span className="bkr-variance-lbl">Matched Total</span>
                      <span className="bkr-variance-val">{formatCurrency(bankDifference.matchedTotal)}</span>
                    </div>
                    <div className="bkr-variance-cell is-highlight">
                      <span className="bkr-variance-lbl">Variance</span>
                      <span className={`bkr-variance-val ${isBalanced ? 'is-good' : 'is-bad'}`}>
                        {formatCurrency(Math.abs(bankDifference.difference))}
                      </span>
                      <span className={`bkr-variance-pill ${isBalanced ? 'bkr-vpill-good' : 'bkr-vpill-bad'}`}>
                        {isBalanced ? '✓ Balanced' : '✗ Out of balance'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Split match screen */}
                {selectedStatementId && (
                  <div className="bkr-split">
                    {/* Bank lines */}
                    <div className="bkr-card">
                      <div className="bkr-card-head">
                        <div>
                          <div className="bkr-card-title">Bank Statement Lines</div>
                          <div className="bkr-card-sub">Select a row to stage for matching</div>
                        </div>
                        {unmatched.length > 0 && (
                          <span className="bkr-badge bkr-badge-open">{unmatched.length} unmatched</span>
                        )}
                      </div>
                      <div className="bkr-card-body">
                        {unmatched.length === 0 && !bankLoading && (
                          <div className="bkr-empty">
                            <span className="bkr-empty-icon">✅</span>
                            <p>All bank lines matched.</p>
                          </div>
                        )}
                        <div className="bkr-tx-list">
                          {unmatched.map((tx) => {
                            const isDebit = tx.debitAmount > 0
                            const amount = isDebit ? tx.debitAmount : tx.creditAmount
                            return (
                              <div
                                key={tx.id}
                                className={`bkr-tx-row${selectedBankTxId === tx.id ? ' selected' : ''}`}
                                onClick={() => setSelectedBankTxId(tx.id === selectedBankTxId ? null : tx.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setSelectedBankTxId(tx.id === selectedBankTxId ? null : tx.id)}
                              >
                                <div className="bkr-tx-info">
                                  <div className="bkr-tx-date">{tx.transactionDate}</div>
                                  <div className="bkr-tx-desc">{tx.description}</div>
                                  {tx.reference && <div className="bkr-tx-ref">Ref: {tx.reference}</div>}
                                </div>
                                <div className="bkr-tx-amount">
                                  <div className={`bkr-tx-val ${isDebit ? 'debit' : 'credit'}`}>
                                    {isDebit ? '−' : '+'}{formatCurrency(amount)}
                                  </div>
                                  <div className="bkr-tx-type">{isDebit ? 'Debit' : 'Credit'}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Center match column */}
                    <div className="bkr-match-col">
                      <div className={`bkr-match-icon${canMatch ? ' ready' : ''}`}>
                        {canMatch ? '⇌' : '↔'}
                      </div>
                      <button
                        className="bkr-match-btn"
                        disabled={!canMatch}
                        onClick={() => void handleMatch()}
                        title="Match selected pair"
                      >
                        🔗
                      </button>
                      <div className="bkr-match-hint">
                        {!selectedBankTxId && !selectedGlLineId ? 'Select one from each side' : !selectedBankTxId ? '← Select a bank line' : !selectedGlLineId ? 'Select a GL line →' : 'Ready to match'}
                      </div>
                    </div>

                    {/* GL lines */}
                    <div className="bkr-card">
                      <div className="bkr-card-head">
                        <div>
                          <div className="bkr-card-title">System GL Lines</div>
                          <div className="bkr-card-sub">Select a row to stage for matching</div>
                        </div>
                        {glLines.length > 0 && (
                          <span className="bkr-badge bkr-badge-open">{glLines.length} items</span>
                        )}
                      </div>
                      <div className="bkr-card-body">
                        {glLines.length === 0 && !bankLoading && (
                          <div className="bkr-empty">
                            <span className="bkr-empty-icon">📋</span>
                            <p>No unmatched GL lines in this period.</p>
                          </div>
                        )}
                        <div className="bkr-tx-list">
                          {glLines.map((line) => {
                            const isDebit = line.debit > 0
                            const amount = isDebit ? line.debit : line.credit
                            return (
                              <div
                                key={line.id}
                                className={`bkr-tx-row${selectedGlLineId === line.id ? ' selected' : ''}`}
                                onClick={() => setSelectedGlLineId(line.id === selectedGlLineId ? null : line.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setSelectedGlLineId(line.id === selectedGlLineId ? null : line.id)}
                              >
                                <div className="bkr-tx-info">
                                  <div className="bkr-tx-date">{line.entryDate} · {line.entryNumber}</div>
                                  <div className="bkr-tx-desc">{line.description}</div>
                                  <div className="bkr-tx-ref">{line.accountCode} {line.accountName}</div>
                                </div>
                                <div className="bkr-tx-amount">
                                  <div className={`bkr-tx-val ${isDebit ? 'debit' : 'credit'}`}>
                                    {isDebit ? '−' : '+'}{formatCurrency(amount)}
                                  </div>
                                  <div className="bkr-tx-type">{isDebit ? 'Debit' : 'Credit'}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══════════════ HISTORY ══════════════════════════════ */}
            {bankReconTab === 'history' && (
              <div className="bkr-card">
                <div className="bkr-card-head">
                  <div>
                    <div className="bkr-card-title">Reconciliation History</div>
                    <div className="bkr-card-sub">All imported statements and their status</div>
                  </div>
                  {bankLoading && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading…</span>}
                </div>
                <div className="bkr-card-body">
                  {bankStatements.length === 0 && !bankLoading && (
                    <div className="bkr-empty">
                      <span className="bkr-empty-icon">🗂</span>
                      <p>No reconciliation history yet.</p>
                    </div>
                  )}
                  {bankStatements.length > 0 && (
                    <table className="bkr-history-table">
                      <thead>
                        <tr>
                          <th>Bank Account</th>
                          <th>Account No.</th>
                          <th>Statement Date</th>
                          <th style={{ textAlign: 'right' }}>Opening</th>
                          <th style={{ textAlign: 'right' }}>Closing</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bankStatements.map((stmt) => {
                          const isFinalized = stmt.reconciliationStatus === 'Finalized'
                          return (
                            <tr key={stmt.id}>
                              <td style={{ fontWeight: 600 }}>{stmt.bankAccountName}</td>
                              <td style={{ color: '#94a3b8' }}>{stmt.bankAccountNumber ?? '—'}</td>
                              <td>{stmt.statementDate}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(stmt.openingBalance)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(stmt.closingBalance)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`bkr-badge ${isFinalized ? 'bkr-badge-finalized' : 'bkr-badge-open'}`}>
                                  {isFinalized ? '✓ Finalized' : (stmt.reconciliationStatus === 'None' ? 'Not Started' : (stmt.reconciliationStatus ?? 'Open'))}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {!isFinalized ? (
                                  <button
                                    className="bkr-open-link"
                                    onClick={() => { setSelectedStatementId(stmt.id); setBankReconTab('reconcile'); void loadStatementDetails(stmt.id) }}
                                  >
                                    Reconcile →
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Closed</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ BOTTOM ACTION BAR ════════════════════ */}
            <div className="bkr-action-bar">
              <div className="bkr-action-left">
                <button className="bkr-btn-primary" onClick={() => setShowImportStatement(true)}>
                  📤 Upload Statement
                </button>
              </div>

              <div className="bkr-action-center">
                {selectedStmt
                  ? `Working on: ${selectedStmt.bankAccountName} · ${selectedStmt.statementDate}`
                  : bankReconTab === 'reconcile' ? 'Select a statement above to begin' : ''}
              </div>

              <div className="bkr-action-right">
                {bankReconTab === 'reconcile' && canFinalize && (
                  <button className="bkr-btn-success" onClick={() => void handleFinalize()}>
                    ✅ Finalize Statement
                  </button>
                )}
                <button
                  className="bkr-btn-secondary"
                  onClick={() => setBankReconTab('history')}
                  style={{ opacity: bankReconTab === 'history' ? 0.5 : 1 }}
                >
                  🗂 View History
                </button>
              </div>
            </div>

          </div>
        )
      })()}

      {viewingJournal && (
        <Dialog title={`Journal Entry: ${viewingJournal.entryNumber}`} onClose={() => setViewingJournal(null)}>
          <div style={{ minWidth: '560px', maxWidth: '700px' }}>
            {viewJournalLoading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Loading...</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Entry Number</div>
                <div style={{ fontWeight: 500 }}>{viewingJournal.entryNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                <div style={{ fontWeight: 500 }}>{viewingJournal.entryDate}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Reference</div>
                <div style={{ fontWeight: 500 }}>{viewingJournal.referenceNo ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Status</div>
                <div>
                  <span className={`gl-status-pill gl-status-${normalizeJournalStatus(viewingJournal.status).toLowerCase().includes('post') ? 'posted' : 'draft'}`}>
                    {normalizeJournalStatus(viewingJournal.status)}
                  </span>
                </div>
              </div>
              {viewingJournal.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Description</div>
                  <div>{viewingJournal.description}</div>
                </div>
              )}
            </div>

            <div style={{ fontWeight: 600, marginBottom: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>Lines</div>
            {viewingJournal.lines.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No line details available.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Account</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Description</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>Debit</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingJournal.lines.map((line, idx) => {
                    const account = glAccounts.find((a) => a.id === line.accountId)
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 8px' }}>{account ? `${account.accountCode} – ${account.name}` : line.accountId}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{line.description ?? '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600, background: 'var(--bg-secondary)' }}>
                    <td colSpan={2} style={{ padding: '6px 8px' }}>Totals</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(viewingJournal.lines.reduce((s, l) => s + Number(l.debit || 0), 0))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(viewingJournal.lines.reduce((s, l) => s + Number(l.credit || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          <DialogActionsBar>
            <Button onClick={() => setViewingJournal(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showCreateJournal && (
        <Dialog title={editingJournalId ? 'Edit Journal Entry' : 'Create Journal Entry'} onClose={() => setShowCreateJournal(false)}>
          <div style={{ minWidth: '500px' }}>
            <div>
              <label>Date</label>
              <input
                className="role-select"
                style={{ width: '100%' }}
                type="date"
                value={journalForm.date}
                onChange={(event) => setJournalForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div>
              <label>Reference</label>
              <Input
                placeholder="e.g. JE-2026-05-001"
                value={journalForm.reference}
                onChange={(event: InputChangeEvent) => setJournalForm((current) => ({ ...current, reference: String(event.value ?? '') }))}
              />
            </div>
            <div>
              <label>Description</label>
              <Input
                placeholder="Enter a short journal description"
                value={journalForm.description}
                onChange={(event: InputChangeEvent) => setJournalForm((current) => ({ ...current, description: String(event.value ?? '') }))}
              />
            </div>
            <div>
              <label>Journal Lines</label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {journalLines.map((line) => (
                  <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 140px 80px', gap: '8px', alignItems: 'center' }}>
                    <select
                      className="role-select"
                      value={line.side}
                      onChange={(event) => {
                        const nextSide = event.target.value as 'debit' | 'credit'
                        const hasAccount = getLineEligibleAccounts(nextSide).some((x) => x.id === line.accountId)
                        updateJournalLine(line.id, { side: nextSide, accountId: hasAccount ? line.accountId : '' })
                      }}
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                    <select
                      className="role-select"
                      value={line.accountId}
                      onChange={(event) => updateJournalLine(line.id, { accountId: event.target.value })}
                    >
                      <option value="">{line.side === 'debit' ? 'Select debit account' : 'Select credit account'}</option>
                      {getLineEligibleAccounts(line.side).map((account) => (
                        <option key={account.id} value={account.id}>{account.accountCode} - {account.name}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Line description (optional)"
                      value={line.description}
                      onChange={(event: InputChangeEvent) => updateJournalLine(line.id, { description: String(event.value ?? '') })}
                    />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(event: InputChangeEvent) => updateJournalLine(line.id, { amount: String(event.value ?? '') })}
                    />
                    <Button
                      disabled={journalLines.filter((x) => x.side === line.side).length <= 1}
                      onClick={() => removeJournalLine(line.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Button onClick={() => addJournalLine('debit')}>Add Debit Line</Button>
                <Button onClick={() => addJournalLine('credit')}>Add Credit Line</Button>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={journalForm.recurring}
                  onChange={(event) => setJournalForm((current) => ({ ...current, recurring: event.target.checked }))}
                />
                Recurring Template
              </label>
            </div>
            <div style={{ marginBottom: '16px' }}>
              Debits: {formatCurrency(journalDebitTotal)} | Credits: {formatCurrency(journalCreditTotal)}
            </div>
            <div
              style={{
                marginBottom: '16px',
                color: journalBalanced ? '#166534' : '#b45309',
                background: journalBalanced ? '#dcfce7' : '#fef3c7',
                border: `1px solid ${journalBalanced ? '#86efac' : '#fcd34d'}`,
                borderRadius: '8px',
                padding: '8px 10px',
                fontWeight: 600,
              }}
            >
              {journalBalanceMessage}
            </div>
            {accountsLoading && <div style={{ color: 'var(--text-muted)' }}>Loading chart of accounts...</div>}
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={createOrUpdateJournalEntry}>{editingJournalId ? 'Update Journal' : 'Save Journal'}</Button>
            <Button onClick={() => setShowCreateJournal(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showFiscalPeriods && (
        <Dialog title="Fiscal Period Close/Reopen" onClose={() => setShowFiscalPeriods(false)}>
          <div style={{ minWidth: '700px' }}>
            {fiscalPeriodsLoading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Loading fiscal periods...</div>}
            <DataTable
              data={fiscalPeriodRowsDisplay}
              columns={fiscalPeriodColumns}
              pageSizeOptions={[20, 50, 100]}
              initialPageSize={20}
              emptyMessage="No fiscal periods available."
            />
          </div>
          <DialogActionsBar>
            <Button onClick={() => setShowFiscalPeriods(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showMonthEnd && (
        <Dialog title="Review Month-End Close" onClose={() => setShowMonthEnd(false)}>
          <div style={{ minWidth: '460px' }}>
            <div style={{ marginBottom: '16px' }}>Progress: {monthEndProgress}%</div>
            {monthEndLoading && <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>Refreshing checklist...</div>}
            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {monthEndChecklist.map((item) => (
                <label key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <input type="checkbox" checked={item.completed} onChange={() => toggleMonthEndTask(item.id)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" disabled={monthEndProgress < 100} onClick={finalizeMonthEnd}>Finalize</Button>
            <Button onClick={() => setShowMonthEnd(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showExportLedger && (
        <Dialog title="Export Ledger Activity" onClose={() => setShowExportLedger(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>From Date</label>
              <input
                className="role-select"
                style={{ width: '100%' }}
                type="date"
                value={ledgerExportForm.fromDate}
                onChange={(event) =>
                  setLedgerExportForm((current) => ({ ...current, fromDate: event.target.value }))
                }
              />
            </div>
            <div>
              <label>To Date</label>
              <input
                className="role-select"
                style={{ width: '100%' }}
                type="date"
                value={ledgerExportForm.toDate}
                onChange={(event) =>
                  setLedgerExportForm((current) => ({ ...current, toDate: event.target.value }))
                }
              />
            </div>
            <div>
              <label>Format</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={ledgerExportForm.format}
                onChange={(event) =>
                  setLedgerExportForm((current) => ({
                    ...current,
                    format: event.target.value as 'csv' | 'excel',
                  }))
                }
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
            </div>
            <div style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
              Matching journal rows: {ledgerExportRows.length}
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={exportLedgerActivity}>Export</Button>
            <Button onClick={() => setShowExportLedger(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showMatch && (
        <Dialog title="3-Way Match" onClose={() => setShowMatch(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>Invoice</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={matchInvoiceId}
                onChange={(event) => setMatchInvoiceId(event.target.value)}
              >
                <option value="">Select invoice</option>
                {payables.map((item) => (
                  <option key={item.id} value={item.id}>{item.id} - {item.supplier}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={runMatchCheck}>Run Match</Button>
            <Button onClick={() => setShowMatch(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showSupplierView && (
        <Dialog title="Supplier View" onClose={() => setShowSupplierView(false)}>
          <div style={{ minWidth: '520px', display: 'grid', gap: '8px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
              Metro Office Supply - transactions: 12 - aging: Current
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
              North Facilities - transactions: 5 - aging: 31-60
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
              Techstream Subscriptions - transactions: 3 - aging: Current
            </div>
          </div>
          <DialogActionsBar>
            <Button onClick={() => setShowSupplierView(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showPostReceipt && (
        <Dialog title="Post Receipt" onClose={() => setShowPostReceipt(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>Customer</label>
              <Input
                value={receiptForm.customer}
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, customer: String(event.value ?? '') }))}
              />
            </div>
            <div>
              <label>Amount</label>
              <Input
                type="number"
                value={receiptForm.amount}
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, amount: String(event.value ?? '') }))}
              />
            </div>
            <div>
              <label>Reference</label>
              <Input
                value={receiptForm.reference}
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, reference: String(event.value ?? '') }))}
              />
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={postReceipt}>Post Receipt</Button>
            <Button onClick={() => setShowPostReceipt(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showImportStatement && (
        <Dialog title="Import Bank Statement" onClose={() => setShowImportStatement(false)}>
          <div style={{ minWidth: '480px' }}>
            <div>
              <label>Bank Name</label>
              <Input placeholder="e.g. BDO, BPI, UnionBank" value={importForm.bankName} onChange={(e: InputChangeEvent) => setImportForm((c) => ({ ...c, bankName: String(e.value ?? '') }))} />
            </div>
            <div>
              <label>Account Number</label>
              <Input placeholder="e.g. 1234-5678-90" value={importForm.accountNumber} onChange={(e: InputChangeEvent) => setImportForm((c) => ({ ...c, accountNumber: String(e.value ?? '') }))} />
            </div>
            <div>
              <label>Statement Date</label>
              <input className="role-select" style={{ width: '100%' }} type="date" value={importForm.statementDate} onChange={(e) => setImportForm((c) => ({ ...c, statementDate: e.target.value }))} />
            </div>
            <div>
              <label>Opening Balance</label>
              <Input type="number" placeholder="0.00" value={importForm.openingBalance} onChange={(e: InputChangeEvent) => setImportForm((c) => ({ ...c, openingBalance: String(e.value ?? '') }))} />
            </div>
            <div>
              <label>Closing Balance</label>
              <Input type="number" placeholder="0.00" value={importForm.closingBalance} onChange={(e: InputChangeEvent) => setImportForm((c) => ({ ...c, closingBalance: String(e.value ?? '') }))} />
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '13px' }}>
              Transactions can be added via CSV import on the statement detail page.
            </p>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={() => void handleImportStatement()}>Import</Button>
            <Button onClick={() => setShowImportStatement(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}
