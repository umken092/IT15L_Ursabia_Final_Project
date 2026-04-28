import { useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Grid, GridColumn } from '@progress/kendo-react-grid'
import { process, type State } from '@progress/kendo-data-query'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import { DashboardCard } from '../../components/DashboardCard'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { roleLabels } from '../../types/auth'

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
  owner: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Pending' | 'Approved' | 'Rejected' | 'Forwarded'
}

interface ExpenseClaim {
  id: string
  date: string
  category: string
  amount: number
  status: 'Submitted' | 'Approved' | 'Paid' | 'Rejected'
}

interface Payslip {
  id: string
  month: string
  grossPay: number
  netPay: number
  deductions: number
}

interface AuditLog {
  id: string
  user: string
  table: string
  action: string
  date: string
  reviewed: boolean
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
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const activeRole = selectedRole || user?.role || 'employee'

  const [queueItems, setQueueItems] = useState<QueueItem[]>([
    { id: 'APR-1201', title: 'Expense Claim - Lab Supplies', owner: 'Dr. Cruz', priority: 'High', status: 'Pending' },
    { id: 'APR-1202', title: 'Purchase Request - Printers', owner: 'Ms. Tan', priority: 'Medium', status: 'Pending' },
    { id: 'APR-1203', title: 'Travel Liquidation', owner: 'Mr. Lopez', priority: 'Low', status: 'Pending' },
  ])

  const [claims, setClaims] = useState<ExpenseClaim[]>([
    { id: 'CLM-201', date: '2026-04-25', category: 'Travel', amount: 1250, status: 'Submitted' },
    { id: 'CLM-202', date: '2026-04-20', category: 'Meals', amount: 860, status: 'Approved' },
    { id: 'CLM-203', date: '2026-04-12', category: 'Training', amount: 4200, status: 'Paid' },
  ])

  const [payslips] = useState<Payslip[]>([
    { id: 'PS-2026-04', month: 'April 2026', grossPay: 52000, netPay: 48250, deductions: 3750 },
    { id: 'PS-2026-03', month: 'March 2026', grossPay: 52000, netPay: 47990, deductions: 4010 },
    { id: 'PS-2026-02', month: 'February 2026', grossPay: 52000, netPay: 48120, deductions: 3880 },
  ])

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: 'LOG-001', user: 'accountant@cmnetwork.com', table: 'JournalEntries', action: 'UPDATE', date: '2026-04-28 09:10', reviewed: false },
    { id: 'LOG-002', user: 'admin@cmnetwork.com', table: 'Users', action: 'CREATE', date: '2026-04-28 08:40', reviewed: false },
    { id: 'LOG-003', user: 'cfo@cmnetwork.com', table: 'Approvals', action: 'APPROVE', date: '2026-04-27 16:25', reviewed: true },
  ])

  const [queueState, setQueueState] = useState<State>(defaultGridState)
  const [claimsState, setClaimsState] = useState<State>(defaultGridState)
  const [slipsState, setSlipsState] = useState<State>(defaultGridState)
  const [auditState, setAuditState] = useState<State>(defaultGridState)

  const [showClaimDialog, setShowClaimDialog] = useState(false)
  const [showDeductionDialog, setShowDeductionDialog] = useState(false)
  const [showAuditSearch, setShowAuditSearch] = useState(false)
  const [selectedSlipId, setSelectedSlipId] = useState('')
  const [selectedQueueId, setSelectedQueueId] = useState('')
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([])

  const [claimForm, setClaimForm] = useState({ date: '', category: '', amount: '', description: '' })
  const [auditFilter, setAuditFilter] = useState({ user: '', table: '', action: '' })

  const queueDisplay = useMemo(
    () => queueItems.map((item) => ({ ...item, sortablePriority: item.priority === 'High' ? 3 : item.priority === 'Medium' ? 2 : 1 })),
    [queueItems],
  )
  const claimsDisplay = useMemo(
    () => claims.map((item) => ({ ...item, amountText: formatCurrency(item.amount) })),
    [claims],
  )
  const slipsDisplay = useMemo(
    () => payslips.map((item) => ({ ...item, grossPayText: formatCurrency(item.grossPay), netPayText: formatCurrency(item.netPay), deductionsText: formatCurrency(item.deductions) })),
    [payslips],
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

  const processedQueue = useMemo(() => process(queueDisplay, queueState), [queueDisplay, queueState])
  const processedClaims = useMemo(() => process(claimsDisplay, claimsState), [claimsDisplay, claimsState])
  const processedSlips = useMemo(() => process(slipsDisplay, slipsState), [slipsDisplay, slipsState])
  const processedAudit = useMemo(() => process(filteredAuditLogs, auditState), [filteredAuditLogs, auditState])

  const processNextItem = () => {
    const next = queueItems.find((item) => item.status === 'Pending')
    if (!next) {
      pushToast('info', 'No pending approval items left.')
      return
    }

    setQueueItems((current) =>
      current.map((item) =>
        item.id === next.id ? { ...item, status: 'Approved' } : item,
      ),
    )
    pushToast('success', `${next.id} approved.`)
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

  const saveClaim = () => {
    if (!claimForm.date || !claimForm.category || !claimForm.amount) {
      pushToast('error', 'Complete claim form fields before saving.')
      return
    }

    const newClaim: ExpenseClaim = {
      id: `CLM-${String(200 + claims.length + 1)}`,
      date: claimForm.date,
      category: claimForm.category,
      amount: Number(claimForm.amount),
      status: 'Submitted',
    }

    setClaims((current) => [newClaim, ...current])
    setClaimForm({ date: '', category: '', amount: '', description: '' })
    setShowClaimDialog(false)
    pushToast('success', 'New claim submitted.')
  }

  const uploadReceipt = () => {
    pushToast('info', 'Receipt uploaded. OCR extraction placeholder queued.')
  }

  const downloadPayslip = () => {
    const slipId = selectedSlipId || payslips[0]?.id
    pushToast('success', `${slipId} download started.`)
  }

  const markReviewed = () => {
    if (!selectedAuditIds.length) {
      pushToast('warning', 'Select logs to mark reviewed.')
      return
    }

    setAuditLogs((current) =>
      current.map((item) =>
        selectedAuditIds.includes(item.id) ? { ...item, reviewed: true } : item,
      ),
    )
    setSelectedAuditIds([])
    pushToast('success', 'Selected audit logs marked reviewed.')
  }

  const approveBatch = () => {
    const pending = queueItems.filter((item) => item.status === 'Pending')
    if (!pending.length) {
      pushToast('info', 'No pending items to approve.')
      return
    }

    setQueueItems((current) =>
      current.map((item) => ({ ...item, status: 'Approved' })),
    )
    pushToast('success', `${pending.length} approvals released in batch.`)
  }

  const forwardForClarification = () => {
    if (!selectedQueueId) {
      pushToast('warning', 'Select an item to forward.')
      return
    }

    setQueueItems((current) =>
      current.map((item) =>
        item.id === selectedQueueId ? { ...item, status: 'Forwarded' } : item,
      ),
    )
    pushToast('info', `${selectedQueueId} forwarded for clarification.`)
  }

  return (
    <section>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} - {roleLabels[activeRole]} | {moduleMeta[moduleKey].title}
        </h1>
        <p className="card-subtitle">{moduleMeta[moduleKey].subtitle}</p>
      </div>

      {(moduleKey === 'department-report' || moduleKey === 'approvals' || moduleKey === 'approvals-inbox' || moduleKey === 'budget-control') && (
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
            {moduleKey === 'approvals-inbox' && (
              <Button themeColor="primary" onClick={approveBatch}>Approve Batch</Button>
            )}
            {moduleKey === 'approvals-inbox' && (
              <Button onClick={() => pushToast('warning', 'High-risk exceptions prioritized.')}>Review Exception</Button>
            )}
            {moduleKey === 'approvals-inbox' && (
              <Button onClick={forwardForClarification}>Forward</Button>
            )}
            {moduleKey === 'budget-control' && (
              <Button themeColor="primary" onClick={() => pushToast('info', 'Forecast curve review opened.')}>Review Forecast</Button>
            )}
            {moduleKey === 'budget-control' && (
              <Button onClick={() => pushToast('success', 'Budget reallocation approved.')}>Approve Reallocation</Button>
            )}
            {moduleKey === 'budget-control' && (
              <Button onClick={() => pushToast('success', 'Budget plan export started (PDF/Excel).')}>Export Plan</Button>
            )}
          </div>

          <DashboardCard title="Approval Queue">
            <Grid
              data={processedQueue}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...queueState}
              onDataStateChange={(event) => setQueueState(event.dataState)}
            >
              <GridColumn field="id" title="ID" width="120px" />
              <GridColumn field="title" title="Title" />
              <GridColumn field="owner" title="Owner" width="180px" />
              <GridColumn field="priority" title="Priority" width="120px" />
              <GridColumn field="status" title="Status" width="140px" />
            </Grid>

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

      {moduleKey === 'expense-claims' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => setShowClaimDialog(true)}>New Claim</Button>
            <Button onClick={uploadReceipt}>Upload Receipt</Button>
            <Button onClick={() => pushToast('info', 'Timeline: submitted -> approved -> paid')}>Track Status</Button>
          </div>

          <DashboardCard title="Claim Timeline">
            <Grid
              data={processedClaims}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...claimsState}
              onDataStateChange={(event) => setClaimsState(event.dataState)}
            >
              <GridColumn field="id" title="Claim" width="120px" />
              <GridColumn field="date" title="Date" width="140px" />
              <GridColumn field="category" title="Category" width="140px" />
              <GridColumn field="amountText" title="Amount" width="150px" />
              <GridColumn field="status" title="Status" width="130px" />
            </Grid>
          </DashboardCard>
        </>
      )}

      {moduleKey === 'payslips' && (
        <>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={downloadPayslip}>Download Slip</Button>
            <Button onClick={() => pushToast('info', 'Showing payslip history by month.')}>View History</Button>
            <Button onClick={() => setShowDeductionDialog(true)}>Check Deductions</Button>
          </div>

          <DashboardCard title="Payslip History">
            <Grid
              data={processedSlips}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...slipsState}
              onDataStateChange={(event) => setSlipsState(event.dataState)}
            >
              <GridColumn field="id" title="Payslip" width="120px" />
              <GridColumn field="month" title="Month" width="150px" />
              <GridColumn field="grossPayText" title="Gross" width="150px" />
              <GridColumn field="deductionsText" title="Deductions" width="150px" />
              <GridColumn field="netPayText" title="Net" width="150px" />
            </Grid>

            <div style={{ marginTop: '16px' }}>
              <label>Select Payslip</label>
              <select
                className="role-select"
                style={{ width: '100%' }}
                value={selectedSlipId}
                onChange={(event) => setSelectedSlipId(event.target.value)}
              >
                <option value="">Latest payslip</option>
                {payslips.map((item) => (
                  <option key={item.id} value={item.id}>{item.id} - {item.month}</option>
                ))}
              </select>
            </div>
          </DashboardCard>
        </>
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
            <Grid
              data={processedAudit}
              pageable={{ pageSizes: [20, 50, 100], buttonCount: 5 }}
              sortable
              filterable
              {...auditState}
              onDataStateChange={(event) => setAuditState(event.dataState)}
            >
              <GridColumn field="id" title="Log ID" width="120px" />
              <GridColumn field="user" title="User" width="220px" />
              <GridColumn field="table" title="Table" width="140px" />
              <GridColumn field="action" title="Action" width="110px" />
              <GridColumn field="date" title="Date" width="170px" />
              <GridColumn field="reviewed" title="Reviewed" width="120px" />
            </Grid>

            <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
              {auditLogs.filter((item) => !item.reviewed).map((item) => (
                <label key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedAuditIds.includes(item.id)}
                    onChange={() =>
                      setSelectedAuditIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                  {item.id} - {item.user} ({item.action})
                </label>
              ))}
            </div>
          </DashboardCard>
        </>
      )}

      {showClaimDialog && (
        <Dialog title="New Claim" onClose={() => setShowClaimDialog(false)}>
          <div style={{ minWidth: '520px' }}>
            <div>
              <label>Date</label>
              <input
                className="role-select"
                style={{ width: '100%' }}
                type="date"
                value={claimForm.date}
                onChange={(event) => setClaimForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div>
              <label>Category</label>
              <Input
                value={claimForm.category}
                onChange={(event: InputChangeEvent) => setClaimForm((current) => ({ ...current, category: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Amount</label>
              <Input
                type="number"
                value={claimForm.amount}
                onChange={(event: InputChangeEvent) => setClaimForm((current) => ({ ...current, amount: String(event.target.value) }))}
              />
            </div>
            <div>
              <label>Description</label>
              <Input
                value={claimForm.description}
                onChange={(event: InputChangeEvent) => setClaimForm((current) => ({ ...current, description: String(event.target.value) }))}
              />
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={saveClaim}>Submit Claim</Button>
            <Button onClick={() => setShowClaimDialog(false)}>Cancel</Button>
          </DialogActionsBar>
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
    </section>
  )
}
