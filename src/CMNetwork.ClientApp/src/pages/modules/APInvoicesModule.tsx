/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import { DashboardCard } from '../../components/DashboardCard'
import { createClientId } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { vendorService, type Vendor } from '../../services/vendorCustomerService'
import {
  apInvoiceService,
  invoiceReferenceService,
  type APInvoiceListItem,
  type ChartOfAccountOption,
} from '../../services/invoiceService'
import { createAPInvoiceSchema, updateAPInvoiceSchema } from '../../schemas/invoiceSchemas'

interface APInvoiceLineForm {
  id: string
  chartOfAccountId: string
  description: string
  quantity: string
  unitPrice: string
  taxAmount: string
}

interface APInvoiceFormData {
  vendorId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lines: APInvoiceLineForm[]
}

const today = new Date().toISOString().slice(0, 10)

const createEmptyLine = (): APInvoiceLineForm => ({
  id: createClientId(),
  chartOfAccountId: '',
  description: '',
  quantity: '1',
  unitPrice: '0',
  taxAmount: '0',
})

const defaultFormData: APInvoiceFormData = {
  vendorId: '',
  invoiceNumber: '',
  invoiceDate: today,
  dueDate: today,
  lines: [createEmptyLine()],
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value)

const accountTypeCode = (value: number | string): number => {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  if (!Number.isNaN(parsed)) return parsed

  const normalized = String(value).toLowerCase()
  if (normalized === 'expense') return 5
  if (normalized === 'asset') return 1
  if (normalized === 'liability') return 2
  if (normalized === 'equity') return 3
  if (normalized === 'revenue') return 4

  return 0
}

const statusLabel = (status: number) => {
  switch (status) {
    case 1:
      return 'Draft'
    case 2:
      return 'Submitted'
    case 3:
      return 'Approved'
    case 4:
      return 'Paid'
    case 5:
      return 'Void'
    default:
      return `Unknown (${status})`
  }
}

const statusTooltip = (status: number) => {
  switch (status) {
    case 1:
      return 'Draft \u2014 invoice is editable and has not been submitted for approval.'
    case 2:
      return 'Submitted \u2014 invoice is awaiting approval from authorized approvers.'
    case 3:
      return 'Approved \u2014 invoice is cleared for payment but has not yet been paid.'
    case 4:
      return 'Paid \u2014 invoice has been settled and the payable is closed.'
    case 5:
      return 'Void \u2014 invoice has been cancelled and is no longer valid.'
    default:
      return `Unknown status code: ${status}`
  }
}

const formatDateCell = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

const statusPillStyle = (status: number) => {
  if (status === 4) return { backgroundColor: '#2e7d32', color: '#ffffff' }
  if (status === 3) return { backgroundColor: '#1565c0', color: '#ffffff' }
  if (status === 2) return { backgroundColor: '#b7791f', color: '#ffffff' }
  if (status === 1) return { backgroundColor: '#6b7280', color: '#ffffff' }
  if (status === 5) return { backgroundColor: '#b91c1c', color: '#ffffff' }
  return { backgroundColor: '#64748b', color: '#ffffff' }
}

export function APInvoicesModule() {
  const user = useAuthStore((state) => state.user)
  const push = useNotificationStore((state) => state.push)

  const [invoices, setInvoices] = useState<APInvoiceListItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccountOption[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<APInvoiceFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')

  const [selectedVendorFilter, setSelectedVendorFilter] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('')
  const [fromDateFilter, setFromDateFilter] = useState('')
  const [toDateFilter, setToDateFilter] = useState('')

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.isActive !== false && accountTypeCode(account.type) === 5,
      ),
    [accounts],
  )

  const lineTotals = useMemo(
    () =>
      formData.lines.map((line) => {
        const quantity = Number(line.quantity || 0)
        const unitPrice = Number(line.unitPrice || 0)
        const taxAmount = Number(line.taxAmount || 0)
        const amount = quantity * unitPrice
        return {
          amount,
          lineTotal: amount + taxAmount,
        }
      }),
    [formData.lines],
  )

  const invoiceTotal = useMemo(
    () => lineTotals.reduce((sum, line) => sum + line.lineTotal, 0),
    [lineTotals],
  )

  const canWrite = !!user && ['accountant', 'cfo', 'super-admin'].includes(user.role)

  const loadReferenceData = useCallback(async () => {
    try {
      const [vendorsResponse, accountsResponse] = await Promise.all([
        vendorService.getVendors(true),
        invoiceReferenceService.getChartOfAccounts(),
      ])
      setVendors(vendorsResponse.data)
      setAccounts(accountsResponse.data)
    } catch {
      push('error', 'Failed to load vendor/account reference data')
    }
  }, [push])

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apInvoiceService.getAPInvoices({
        vendorId: selectedVendorFilter || undefined,
        status: selectedStatusFilter ? Number(selectedStatusFilter) : undefined,
        fromDate: fromDateFilter || undefined,
        toDate: toDateFilter || undefined,
      })
      setInvoices(response.data)
    } catch {
      push('error', 'Failed to load AP invoices')
    } finally {
      setLoading(false)
    }
  }, [selectedVendorFilter, selectedStatusFilter, fromDateFilter, toDateFilter, push])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const filteredInvoices = searchText
    ? invoices.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(searchText.toLowerCase())
          || invoice.vendorName.toLowerCase().includes(searchText.toLowerCase())
          || invoice.vendorCode.toLowerCase().includes(searchText.toLowerCase()),
      )
    : invoices

  const handleAddClick = () => {
    setEditingId(null)
    setFormData({ ...defaultFormData, lines: [createEmptyLine()] })
    setFormErrors({})
    setShowDialog(true)
  }

  const handleEditClick = async (invoice: APInvoiceListItem) => {
    const fallbackVendor = vendors.find((vendor) =>
      vendor.id === invoice.vendorCode
      || vendor.vendorCode === invoice.vendorCode
      || vendor.name === invoice.vendorName,
    )

    try {
      const response = await apInvoiceService.getAPInvoice(invoice.id)
      const detail = response.data

      setEditingId(invoice.id)
      setFormData({
        vendorId: detail.vendorId,
        invoiceNumber: detail.invoiceNumber,
        invoiceDate: detail.invoiceDate.slice(0, 10),
        dueDate: detail.dueDate.slice(0, 10),
        lines:
          detail.lines.length > 0
            ? detail.lines.map((line) => ({
                id: line.id,
                chartOfAccountId: line.chartOfAccountId,
                description: line.description || '',
                quantity: String(line.quantity),
                unitPrice: String(line.unitPrice),
                taxAmount: String(line.taxAmount ?? 0),
              }))
            : [createEmptyLine()],
      })
      setFormErrors({})
      setShowDialog(true)
    } catch {
      // Fallback: open editor using row-level data when detail endpoint is unavailable.
      setEditingId(invoice.id)
      setFormData({
        vendorId: fallbackVendor?.id ?? '',
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.slice(0, 10),
        dueDate: invoice.dueDate.slice(0, 10),
        lines: [createEmptyLine()],
      })
      setFormErrors({})
      setShowDialog(true)
      push('warning', 'Detail API unavailable. Opened invoice with basic data.')
    }
  }

  const handleApproveClick = async (invoice: APInvoiceListItem) => {
    if (!confirm(`Approve AP invoice "${invoice.invoiceNumber}"?`)) {
      return
    }

    try {
      await apInvoiceService.approveAPInvoice(invoice.id)
      push('success', 'AP invoice approved and posted to GL')
      await loadInvoices()
    } catch {
      push('error', 'Failed to approve AP invoice')
    }
  }

  const handleVoidClick = async (invoice: APInvoiceListItem) => {
    if (!confirm(`Void AP invoice "${invoice.invoiceNumber}"?`)) {
      return
    }

    try {
      await apInvoiceService.voidAPInvoice(invoice.id)
      push('success', 'AP invoice voided successfully')
      await loadInvoices()
    } catch {
      push('error', 'Failed to void AP invoice')
    }
  }

  const handleHeaderChange = (e: InputChangeEvent) => {
    const target = e.target as unknown as { name?: string; value?: string | number | null }
    const name = target.name || ''
    const value = String(target.value ?? '')
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleLineChange = (lineId: string, field: keyof APInvoiceLineForm, value: string) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)),
    }))
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }))
  }

  const removeLine = (lineId: string) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((line) => line.id !== lineId) : prev.lines,
    }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    const normalizedLines = formData.lines.map((line) => ({
      chartOfAccountId: line.chartOfAccountId,
      description: line.description || undefined,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      taxAmount: Number(line.taxAmount || 0),
    }))

    const payload = {
      vendorId: formData.vendorId,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      lines: normalizedLines,
    }

    const schema = editingId ? updateAPInvoiceSchema : createAPInvoiceSchema
    const result = schema.safeParse(editingId ? { ...payload, lines: normalizedLines } : payload)

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0] || 'form')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      })
    }

    if (formData.lines.some((line) => !line.chartOfAccountId)) {
      errors.lines = 'Each line must have an expense account'
    }

    if (formData.lines.some((line) => Number(line.quantity || 0) <= 0)) {
      errors.lines = 'Line quantity must be greater than zero'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    const lines = formData.lines.map((line) => {
      const quantity = Number(line.quantity || 0)
      const unitPrice = Number(line.unitPrice || 0)
      const amount = quantity * unitPrice
      const taxAmount = Number(line.taxAmount || 0)

      return {
        chartOfAccountId: line.chartOfAccountId,
        description: line.description || undefined,
        quantity,
        unitPrice,
        amount,
        taxAmount,
      }
    })

    try {
      if (editingId) {
        await apInvoiceService.updateAPInvoice(editingId, {
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          lines,
        })
        push('success', 'AP invoice updated successfully')
      } else {
        await apInvoiceService.createAPInvoice({
          vendorId: formData.vendorId,
          invoiceNumber: formData.invoiceNumber,
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          lines,
        })
        push('success', 'AP invoice created successfully')
      }

      setShowDialog(false)
      await loadInvoices()
    } catch {
      push('error', editingId ? 'Failed to update AP invoice' : 'Failed to create AP invoice')
    }
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setFormErrors({})
  }

  return (
    <div className="space-y-4 p-4">
      <DashboardCard
        title="AP Invoice Processing"
        subtitle="Enter, review, approve, and post vendor invoices to the general ledger"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-3" >
            <Input
              placeholder="Search invoice no / vendor..."
              value={searchText}
              onChange={(e: InputChangeEvent) => setSearchText((e.target.value as string) || '')}
              style={{ width: '260px', height: 36 }}
            />

            <select
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="k-input k-input-md"
              style={{ width: '190px', height: 36 }}
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorCode} - {vendor.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="k-input k-input-md"
              style={{ width: '150px', height: 36 }}
            >
              <option value="">All Statuses</option>
              <option value="1">Draft</option>
              <option value="2">Submitted</option>
              <option value="3">Approved</option>
              <option value="4">Paid</option>
              <option value="5">Void</option>
            </select>

            <Input
              type="date"
              value={fromDateFilter}
              onChange={(e: InputChangeEvent) => setFromDateFilter((e.target.value as string) || '')}
              style={{ width: '155px', height: 36 }}
            />
            <Input
              type="date"
              value={toDateFilter}
              onChange={(e: InputChangeEvent) => setToDateFilter((e.target.value as string) || '')}
              style={{ width: '155px', height: 36 }}
            />

            <Button onClick={() => loadInvoices()}>Refresh</Button>
            <Button themeColor="primary" onClick={handleAddClick} disabled={!canWrite}>
              + New AP Invoice
            </Button>
          </div>

          {loading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Loading AP invoices...</div>}

          <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '8px' }}>
            <table className="employee-table" style={{ minWidth: '1100px', width: '100%' }}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Vendor Code</th>
                  <th>Vendor</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const editable = invoice.status === 1 || invoice.status === 2
                  const approvable = invoice.status === 1 || invoice.status === 2
                  const voidable = invoice.status !== 4 && invoice.status !== 5
                  const badgeStyle = statusPillStyle(invoice.status)

                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.vendorCode}</td>
                      <td>{invoice.vendorName}</td>
                      <td>{formatDateCell(invoice.invoiceDate)}</td>
                      <td>{formatDateCell(invoice.dueDate)}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(invoice.totalAmount)}</td>
                      <td>
                        <span
                          data-tooltip={statusTooltip(invoice.status)}
                          style={{
                            ...badgeStyle,
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: '999px',
                            padding: '2px 10px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          {statusLabel(invoice.status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            title="View"
                            onClick={() => handleEditClick(invoice)}
                            style={{
                              border: '1px solid #d1d5db',
                              background: '#f8fafc',
                              color: '#1f2937',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => handleEditClick(invoice)}
                            disabled={!canWrite || !editable}
                            style={{
                              border: '1px solid #d1d5db',
                              background: '#f8fafc',
                              color: '#1f2937',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: !canWrite || !editable ? 'not-allowed' : 'pointer',
                              opacity: !canWrite || !editable ? 0.5 : 1,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            title="Approve"
                            onClick={() => handleApproveClick(invoice)}
                            disabled={!canWrite || !approvable}
                            style={{
                              border: '1px solid #d1d5db',
                              background: '#f8fafc',
                              color: '#1f2937',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: !canWrite || !approvable ? 'not-allowed' : 'pointer',
                              opacity: !canWrite || !approvable ? 0.5 : 1,
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            title="Void"
                            onClick={() => handleVoidClick(invoice)}
                            disabled={!canWrite || !voidable}
                            style={{
                              border: '1px solid #d1d5db',
                              background: '#f8fafc',
                              color: '#991b1b',
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: !canWrite || !voidable ? 'not-allowed' : 'pointer',
                              opacity: !canWrite || !voidable ? 0.5 : 1,
                            }}
                          >
                            Void
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardCard>

      {showDialog && (
        <Dialog title={editingId ? 'Edit AP Invoice' : 'Create AP Invoice'} onClose={handleDialogClose}>
          <div className="space-y-4 p-4" style={{ minWidth: '960px' }}>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor*</label>
                <select
                  name="vendorId"
                  value={formData.vendorId}
                  onChange={handleSelectChange}
                  disabled={editingId !== null}
                  className="k-input k-input-md w-full"
                  style={{ height: 36 }}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorCode} - {vendor.name}
                    </option>
                  ))}
                </select>
                {formErrors.vendorId && <p className="text-red-500 text-xs mt-1">{formErrors.vendorId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Invoice Number*</label>
                <Input
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleHeaderChange}
                  disabled={editingId !== null}
                />
                {formErrors.invoiceNumber && <p className="text-red-500 text-xs mt-1">{formErrors.invoiceNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Invoice Date*</label>
                <Input name="invoiceDate" type="date" value={formData.invoiceDate} onChange={handleHeaderChange} />
                {formErrors.invoiceDate && <p className="text-red-500 text-xs mt-1">{formErrors.invoiceDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Due Date*</label>
                <Input name="dueDate" type="date" value={formData.dueDate} onChange={handleHeaderChange} />
                {formErrors.dueDate && <p className="text-red-500 text-xs mt-1">{formErrors.dueDate}</p>}
              </div>
            </div>

            <div className="rounded border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <strong>Invoice Lines</strong>
                <Button onClick={addLine}>+ Add Line</Button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-2 text-left">Expense Account*</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-right">Qty*</th>
                      <th className="px-2 py-2 text-right">Unit Price*</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-right">Tax</th>
                      <th className="px-2 py-2 text-right">Line Total</th>
                      <th className="px-2 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lines.map((line, index) => {
                      const totals = lineTotals[index]

                      return (
                        <tr key={line.id} className="border-b border-slate-100">
                          <td className="px-2 py-2">
                            <select
                              value={line.chartOfAccountId}
                              onChange={(e) => handleLineChange(line.id, 'chartOfAccountId', e.target.value)}
                              className="k-input k-input-md w-full"
                              style={{ height: 34, minWidth: 240 }}
                            >
                              <option value="">Select expense account</option>
                              {expenseAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.accountCode} - {account.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              value={line.description}
                              onChange={(e: InputChangeEvent) =>
                                handleLineChange(line.id, 'description', (e.target.value as string) || '')
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={(e: InputChangeEvent) =>
                                handleLineChange(line.id, 'quantity', (e.target.value as string) || '0')
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={line.unitPrice}
                              onChange={(e: InputChangeEvent) =>
                                handleLineChange(line.id, 'unitPrice', (e.target.value as string) || '0')
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">{formatCurrency(totals?.amount || 0)}</td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={line.taxAmount}
                              onChange={(e: InputChangeEvent) =>
                                handleLineChange(line.id, 'taxAmount', (e.target.value as string) || '0')
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">{formatCurrency(totals?.lineTotal || 0)}</td>
                          <td className="px-2 py-2 text-center">
                            <Button onClick={() => removeLine(line.id)} disabled={formData.lines.length === 1}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {formErrors.lines && <p className="text-red-500 text-sm">{formErrors.lines}</p>}

            <div className="flex justify-end">
              <div className="rounded bg-slate-100 px-4 py-3">
                <span className="mr-3 text-sm text-slate-600">Invoice Total</span>
                <strong className="text-base">{formatCurrency(invoiceTotal)}</strong>
              </div>
            </div>
          </div>

          <DialogActionsBar>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button themeColor="primary" onClick={handleSave} disabled={!canWrite}>
              Save
            </Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
