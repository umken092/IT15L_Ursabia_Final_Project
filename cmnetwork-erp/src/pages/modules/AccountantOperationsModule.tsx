import { useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Grid, GridColumn } from '@progress/kendo-react-grid'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import { process, type State } from '@progress/kendo-data-query'
import { DashboardCard } from '../../components/DashboardCard'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { roleLabels } from '../../types/auth'
// Services are available for future use with React Hook Form integration
// import { generalLedgerService, accountsPayableService, accountsReceivableService, bankReconciliationService } from '../../services/accountantService'

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
  date: string
  reference: string
  debit: number
  credit: number
  status: 'Draft' | 'Posted'
  recurring: boolean
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

interface ExceptionLine {
  id: string
  bankReference: string
  systemReference: string
  bankAmount: number
  systemAmount: number
  status: 'Unmatched' | 'Partial'
}

interface AgingRow {
  bucket: string
  amount: number
  risk: 'Low' | 'Medium' | 'High'
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

const defaultGridState: State = {
  skip: 0,
  take: 20,
  sort: [],
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value)

export const AccountantOperationsModule = ({ moduleKey }: AccountantOperationsModuleProps) => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const currentRole = selectedRole || user?.role || 'accountant'

  const [journals, setJournals] = useState<JournalEntry[]>([
    { id: 'JE-24018', date: '2026-04-24', reference: 'REV-RECLASS', debit: 92500, credit: 92500, status: 'Draft', recurring: false },
    { id: 'JE-24019', date: '2026-04-25', reference: 'UTIL-ACCRUAL', debit: 18000, credit: 18000, status: 'Posted', recurring: true },
  ])

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

  const [exceptions, setExceptions] = useState<ExceptionLine[]>([
    { id: 'EX-1', bankReference: 'WD-11820', systemReference: 'WD-11820', bankAmount: 11200, systemAmount: 11200, status: 'Unmatched' },
    { id: 'EX-2', bankReference: 'SET-88012', systemReference: 'SET-88099', bankAmount: 8760, systemAmount: 8520, status: 'Partial' },
  ])

  const [showCreateJournal, setShowCreateJournal] = useState(false)
  const [showMonthEnd, setShowMonthEnd] = useState(false)
  const [showMatch, setShowMatch] = useState(false)
  const [showSupplierView, setShowSupplierView] = useState(false)
  const [showPostReceipt, setShowPostReceipt] = useState(false)
  const [showManualMatch, setShowManualMatch] = useState(false)

  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    debit: '',
    credit: '',
    recurring: false,
  })

  const [selectedPayableIds, setSelectedPayableIds] = useState<string[]>([])
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<string[]>([])
  const [matchInvoiceId, setMatchInvoiceId] = useState('')
  const [receiptForm, setReceiptForm] = useState({ customer: '', amount: '', reference: '' })
  const [manualMatch, setManualMatch] = useState({ bankReference: '', systemReference: '' })

  const [monthEndChecklist, setMonthEndChecklist] = useState([
    { id: 'reconcile', label: 'Reconcile banks', completed: false },
    { id: 'accruals', label: 'Post accruals', completed: false },
    { id: 'trial-balance', label: 'Review trial balance', completed: false },
  ])

  const [journalState, setJournalState] = useState<State>(defaultGridState)
  const [payablesState, setPayablesState] = useState<State>(defaultGridState)
  const [receivablesState, setReceivablesState] = useState<State>(defaultGridState)
  const [agingState, setAgingState] = useState<State>(defaultGridState)
  const [exceptionsState, setExceptionsState] = useState<State>(defaultGridState)

  const monthEndProgress = Math.round((monthEndChecklist.filter((item) => item.completed).length / monthEndChecklist.length) * 100)
  const journalBalanced = Number(journalForm.debit || 0) === Number(journalForm.credit || 0)

  const journalRows = useMemo(
    () => journals.map((item) => ({ ...item, debitText: formatCurrency(item.debit), creditText: formatCurrency(item.credit), recurringText: item.recurring ? 'Yes' : 'No' })),
    [journals],
  )

  const payableRows = useMemo(
    () => payables.map((item) => ({ ...item, invoiceAmountText: formatCurrency(item.invoiceAmount), poAmountText: formatCurrency(item.poAmount), receiptAmountText: formatCurrency(item.receiptAmount) })),
    [payables],
  )

  const receivableRows = useMemo(
    () => receivables.map((item) => ({ ...item, amountText: formatCurrency(item.amount) })),
    [receivables],
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
    [agingRows],
  )

  const exceptionRows = useMemo(
    () => exceptions.map((item) => ({ ...item, bankAmountText: formatCurrency(item.bankAmount), systemAmountText: formatCurrency(item.systemAmount) })),
    [exceptions],
  )

  const processedJournals = useMemo(() => process(journalRows, journalState), [journalRows, journalState])
  const processedPayables = useMemo(() => process(payableRows, payablesState), [payableRows, payablesState])
  const processedReceivables = useMemo(() => process(receivableRows, receivablesState), [receivableRows, receivablesState])
  const processedAging = useMemo(() => process(agingDisplayRows, agingState), [agingDisplayRows, agingState])
  const processedExceptions = useMemo(() => process(exceptionRows, exceptionsState), [exceptionRows, exceptionsState])

  const createJournalEntry = () => {
    if (!journalForm.reference || !journalBalanced) {
      pushToast('error', 'Create Journal requires a reference and balanced debit/credit.')
      return
    }

    const newEntry: JournalEntry = {
      id: `JE-${String(24020 + journals.length).padStart(5, '0')}`,
      date: journalForm.date,
      reference: journalForm.reference,
      debit: Number(journalForm.debit),
      credit: Number(journalForm.credit),
      status: 'Draft',
      recurring: journalForm.recurring,
    }

    setJournals((current) => [newEntry, ...current])
    setShowCreateJournal(false)
    setJournalForm({ date: new Date().toISOString().slice(0, 10), reference: '', debit: '', credit: '', recurring: false })
    pushToast('success', 'Journal entry created.')
  }

  const toggleMonthEndTask = (id: string) => {
    setMonthEndChecklist((current) =>
      current.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    )
  }

  const finalizeMonthEnd = () => {
    if (monthEndProgress < 100) {
      pushToast('error', 'All month-end tasks must be completed before finalizing.')
      return
    }

    setShowMonthEnd(false)
    pushToast('success', 'Month-end close finalized.')
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

  const autoMatch = () => {
    setExceptions((current) => current.filter((item) => item.status === 'Partial'))
    pushToast('info', 'Automatch complete by reference and amount.')
  }

  const applyManualMatch = () => {
    if (!manualMatch.bankReference || !manualMatch.systemReference) {
      pushToast('warning', 'Select both bank and system references.')
      return
    }

    setExceptions((current) =>
      current.filter(
        (item) => !(item.bankReference === manualMatch.bankReference && item.systemReference === manualMatch.systemReference),
      ),
    )
    setManualMatch({ bankReference: '', systemReference: '' })
    setShowManualMatch(false)
    pushToast('success', 'Manual matching applied.')
  }

  const finalizeStatement = () => {
    if (exceptions.length > 0) {
      pushToast('error', 'Resolve all variance items before finalizing statement.')
      return
    }

    pushToast('success', 'Bank reconciliation statement finalized.')
  }

  return (
    <section>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} - {roleLabels[currentRole]} | {moduleMeta[moduleKey].title}
        </h1>
        <p className="card-subtitle">{moduleMeta[moduleKey].subtitle}</p>
      </div>

      {moduleKey === 'general-ledger' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => setShowCreateJournal(true)}>Create Journal</Button>
            <Button onClick={() => setShowMonthEnd(true)}>Review Month-End Close</Button>
            <Button onClick={() => pushToast('info', 'Ledger export queued for audit support.')}>Export Ledger Activity</Button>
          </div>

          <DashboardCard title="Journal Entry List" subtitle="Server-style view with paging, sorting, and filtering">
            <Grid
              data={processedJournals}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...journalState}
              onDataStateChange={(event) => setJournalState(event.dataState)}
            >
              <GridColumn field="date" title="Date" width="140px" />
              <GridColumn field="reference" title="Reference" />
              <GridColumn field="debitText" title="Debit" width="160px" />
              <GridColumn field="creditText" title="Credit" width="160px" />
              <GridColumn field="status" title="Status" width="140px" />
              <GridColumn field="recurringText" title="Recurring" width="130px" />
            </Grid>
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
            <Grid
              data={processedPayables}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...payablesState}
              onDataStateChange={(event) => setPayablesState(event.dataState)}
            >
              <GridColumn field="id" title="Invoice" width="120px" />
              <GridColumn field="supplier" title="Supplier" />
              <GridColumn field="poNumber" title="PO" width="120px" />
              <GridColumn field="receiptNumber" title="Receipt" width="120px" />
              <GridColumn field="invoiceAmountText" title="Invoice Amount" width="170px" />
              <GridColumn field="status" title="Status" width="160px" />
            </Grid>
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
            <Grid
              data={processedReceivables}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...receivablesState}
              onDataStateChange={(event) => setReceivablesState(event.dataState)}
            >
              <GridColumn field="id" title="Invoice" width="120px" />
              <GridColumn field="customer" title="Customer" />
              <GridColumn field="dueDate" title="Due Date" width="140px" />
              <GridColumn field="amountText" title="Amount" width="150px" />
              <GridColumn field="ageDays" title="Age (days)" width="120px" />
              <GridColumn field="status" title="Status" width="130px" />
            </Grid>
          </DashboardCard>

          <DashboardCard title="Aging Buckets" subtitle="0-30, 31-60, 61-90, >90">
            <Grid
              data={processedAging}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...agingState}
              onDataStateChange={(event) => setAgingState(event.dataState)}
            >
              <GridColumn field="bucket" title="Bucket" width="120px" />
              <GridColumn field="amountText" title="Amount" width="160px" />
              <GridColumn field="risk" title="Risk" width="120px" />
            </Grid>
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

      {moduleKey === 'bank-reconciliation' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={autoMatch}>Automatch</Button>
            <Button onClick={() => setShowManualMatch(true)}>Review Variance</Button>
            <Button themeColor="secondary" disabled={exceptions.length > 0} onClick={finalizeStatement}>Finalize Statement</Button>
          </div>

          <DashboardCard title="Exception List" subtitle="Unmatched or partially matched entries">
            <Grid
              data={processedExceptions}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...exceptionsState}
              onDataStateChange={(event) => setExceptionsState(event.dataState)}
            >
              <GridColumn field="id" title="Exception" width="120px" />
              <GridColumn field="bankReference" title="Bank Reference" />
              <GridColumn field="systemReference" title="System Reference" />
              <GridColumn field="bankAmountText" title="Bank Amount" width="150px" />
              <GridColumn field="systemAmountText" title="System Amount" width="150px" />
              <GridColumn field="status" title="Status" width="120px" />
            </Grid>
          </DashboardCard>
        </>
      )}

      {showCreateJournal && (
        <Dialog title="Create Journal Entry" onClose={() => setShowCreateJournal(false)}>
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
                value={journalForm.reference}
                onChange={(event: InputChangeEvent) => setJournalForm((current) => ({ ...current, reference: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Debit</label>
              <Input
                type="number"
                value={journalForm.debit}
                onChange={(event: InputChangeEvent) => setJournalForm((current) => ({ ...current, debit: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Credit</label>
              <Input
                type="number"
                value={journalForm.credit}
                onChange={(event: InputChangeEvent) => setJournalForm((current) => ({ ...current, credit: String(event.target.value) }))}
              />
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
              {journalBalanced ? 'Balanced (Debits = Credits)' : 'Unbalanced (Debits != Credits)'}
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={createJournalEntry}>Save Journal</Button>
            <Button onClick={() => setShowCreateJournal(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showMonthEnd && (
        <Dialog title="Review Month-End Close" onClose={() => setShowMonthEnd(false)}>
          <div style={{ minWidth: '460px' }}>
            <div style={{ marginBottom: '16px' }}>Progress: {monthEndProgress}%</div>
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
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, customer: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Amount</label>
              <Input
                type="number"
                value={receiptForm.amount}
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, amount: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Reference</label>
              <Input
                value={receiptForm.reference}
                onChange={(event: InputChangeEvent) => setReceiptForm((current) => ({ ...current, reference: String(event.target.value) }))}
              />
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={postReceipt}>Post Receipt</Button>
            <Button onClick={() => setShowPostReceipt(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showManualMatch && (
        <Dialog title="Manual Match" onClose={() => setShowManualMatch(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>Bank Reference</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={manualMatch.bankReference}
                onChange={(event) => setManualMatch((current) => ({ ...current, bankReference: event.target.value }))}
              >
                <option value="">Select bank reference</option>
                {exceptions.map((item) => (
                  <option key={item.id} value={item.bankReference}>{item.bankReference}</option>
                ))}
              </select>
            </div>
            <div>
              <label>System Reference</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={manualMatch.systemReference}
                onChange={(event) => setManualMatch((current) => ({ ...current, systemReference: event.target.value }))}
              >
                <option value="">Select system reference</option>
                {exceptions.map((item) => (
                  <option key={item.id} value={item.systemReference}>{item.systemReference}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={applyManualMatch}>Apply Match</Button>
            <Button onClick={() => setShowManualMatch(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}
