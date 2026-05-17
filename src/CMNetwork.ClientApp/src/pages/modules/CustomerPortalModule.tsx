import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  customerPortalService,
  type CustomerInvoice,
  type CustomerInvoicesResponse,
} from '../../services/customerPortalService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  Paid: '#16a34a',
  Sent: '#2563eb',
  Approved: '#7c3aed',
  Draft: '#6b7280',
  Void: '#9ca3af',
}

const StatusBadge = ({ status }: { status: string }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: `${statusColors[status] ?? '#6b7280'}22`,
      color: statusColors[status] ?? '#6b7280',
      border: `1px solid ${statusColors[status] ?? '#6b7280'}55`,
    }}
  >
    {status}
  </span>
)

// ─── Component ────────────────────────────────────────────────────────────────

export const CustomerPortalModule = () => {
  const pushToast = useNotificationStore((state) => state.push)
  const [searchParams, setSearchParams] = useSearchParams()

  const [data, setData] = useState<CustomerInvoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingStatement, setDownloadingStatement] = useState(false)
  const [startingPayment, setStartingPayment] = useState(false)
  const [paymentAttemptKey, setPaymentAttemptKey] = useState<string>('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])

  const paymentRef = searchParams.get('refId') ?? searchParams.get('ref') ?? ''

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      setData(await customerPortalService.getMyInvoices())
    } catch {
      pushToast('error', 'Unable to load your invoices. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  useEffect(() => {
    const confirmFromReturnUrl = async () => {
      if (!paymentRef) return

      try {
        await customerPortalService.confirmPayment(paymentRef)
        pushToast('success', 'Payment confirmed and applied successfully.')
        setSearchParams({}, { replace: true })
        await loadInvoices()
      } catch {
        pushToast('warning', 'Payment return detected, but verification is still pending. Please refresh in a few seconds.')
      }
    }

    void confirmFromReturnUrl()
  }, [loadInvoices, paymentRef, pushToast, setSearchParams])

  const toggleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds((current) => {
      if (checked) {
        return current.includes(invoiceId) ? current : [...current, invoiceId]
      }
      return current.filter((id) => id !== invoiceId)
    })
  }

  const handlePayNow = async () => {
    if (selectedInvoiceIds.length === 0) {
      pushToast('warning', 'Select at least one invoice to continue.')
      return
    }

    setStartingPayment(true)
    try {
      const key = paymentAttemptKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${selectedInvoiceIds.join(',')}`
      setPaymentAttemptKey(key)
      const payment = await customerPortalService.createPaymentIntent(selectedInvoiceIds, undefined, key)
      globalThis.location.href = payment.redirectUrl
    } catch {
      pushToast('error', 'Unable to start payment. Please try again.')
      setStartingPayment(false)
    }
  }

  const handleDownloadStatement = async () => {
    setDownloadingStatement(true)
    try {
      const { blob, filename } = await customerPortalService.downloadStatement()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      pushToast('success', 'Statement downloaded.')
    } catch {
      pushToast('error', 'Failed to download statement.')
    } finally {
      setDownloadingStatement(false)
    }
  }

  const allStatuses = ['All', 'Draft', 'Sent', 'Approved', 'Paid', 'Void']

  const filteredInvoices: CustomerInvoice[] = (data?.invoices ?? []).filter((inv) => {
    const matchesSearch =
      search.trim().length === 0 ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const outstanding = (data?.invoices ?? [])
    .filter((inv) => inv.status !== 'Paid' && inv.status !== 'Void')
    .reduce((sum, inv) => sum + inv.totalAmount, 0)

  const payableStatus = new Set(['Sent', 'Approved'])
  const selectedTotal = filteredInvoices
    .filter((inv) => selectedInvoiceIds.includes(inv.id))
    .reduce((sum, inv) => sum + inv.totalAmount, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Customer Portal</h1>
          {data && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              {data.customerName} · {data.customerCode}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { void handleDownloadStatement() }}
          disabled={downloadingStatement || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity flex-shrink-0"
          style={{ background: 'var(--primary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {downloadingStatement ? 'Generating…' : 'Download Statement (PDF)'}
        </button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Invoices */}
        <div
          className="flex items-center gap-5 rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Total Invoices</p>
            <p className="text-3xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>
              {loading ? '—' : (data?.invoices.length ?? 0)}
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div
          className="flex items-center gap-5 rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Outstanding Balance</p>
            <p
              className="text-3xl font-bold mt-0.5"
              style={{ color: loading ? 'var(--text)' : outstanding > 0 ? '#dc2626' : '#059669' }}
            >
              {loading ? '—' : formatCurrency(outstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
      >
        <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              type="text"
              placeholder="Search invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface-container)' }}
            />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: statusFilter === s ? 'var(--primary)' : 'var(--card-bg)',
                  color: statusFilter === s ? '#fff' : 'var(--text)',
                  border: `1px solid ${statusFilter === s ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Pay button */}
          <button
            type="button"
            onClick={() => { void handlePayNow() }}
            disabled={startingPayment || selectedInvoiceIds.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity flex-shrink-0"
            style={{ background: selectedInvoiceIds.length === 0 ? 'var(--muted)' : 'var(--primary)' }}
          >
            {startingPayment ? 'Redirecting…' : 'Pay Selected Invoices'}
          </button>
        </div>

        {/* ── Invoice content ──────────────────────────────────── */}
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            {/* Folder illustration */}
            <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="30" width="100" height="62" rx="6" fill="#e0e7ef" stroke="#b0bec5" strokeWidth="1.5"/>
              <path d="M10 36a6 6 0 0 1 6-6h28l8 10H104a6 6 0 0 1 6 6v2H10V36z" fill="#b0c4d8" stroke="#b0bec5" strokeWidth="1.5"/>
              <rect x="30" y="48" width="60" height="8" rx="3" fill="#fff" opacity=".7"/>
              <rect x="30" y="62" width="44" height="8" rx="3" fill="#fff" opacity=".5"/>
              <rect x="30" y="76" width="52" height="8" rx="3" fill="#fff" opacity=".4"/>
            </svg>
            <p className="mt-4 text-sm font-medium" style={{ color: 'var(--muted)' }}>No invoices match your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--muted)' }}>Pay</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--muted)' }}>Invoice #</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--muted)' }}>Date</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--muted)' }}>Due Date</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--muted)' }}>Amount</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: idx % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-container)',
                    }}
                  >
                    <td className="px-4 py-3 text-center">
                      {payableStatus.has(inv.status) ? (
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.includes(inv.id)}
                          onChange={(e) => toggleInvoiceSelection(inv.id, e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-600"
                        />
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--primary)' }}>{inv.invoiceNumber}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{inv.invoiceDate}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{inv.dueDate}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text)' }}>{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected summary footer */}
        {selectedInvoiceIds.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3 text-sm"
            style={{ borderTop: '1px solid var(--border)', background: '#eff6ff', color: 'var(--text)' }}
          >
            <span>
              <strong>{selectedInvoiceIds.length}</strong> invoice{selectedInvoiceIds.length > 1 ? 's' : ''} selected
            </span>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>
              Total: {formatCurrency(selectedTotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
