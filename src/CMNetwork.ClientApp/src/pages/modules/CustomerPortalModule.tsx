import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  customerPortalService,
  type CustomerInvoice,
  type CustomerInvoicesResponse,
} from '../../services/customerPortalService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Design tokens (system palette) ──────────────────────────────────────────
const C = {
  primary: 'var(--primary)',          // #1d63c1
  primaryDark: 'var(--primary-container)', // #154a91
  cardBg: 'var(--card-bg)',
  surface: 'var(--surface-container)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  shadow: 'var(--shadow)',
  shadowLg: 'var(--shadow-lg)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#ca8a04',
} as const

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  Paid:     { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  Sent:     { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  Approved: { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  Draft:    { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
  Void:     { bg: '#f9fafb', text: '#9ca3af', border: '#e5e7eb' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] ?? STATUS_MAP.Void
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: s.text, display: 'inline-block', flexShrink: 0,
      }} />
      {status}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon, label, value, sub, accentColor = C.primary,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accentColor?: string
}) => (
  <div style={{
    background: C.cardBg,
    border: `1px solid ${C.border}`,
    borderTop: `3px solid ${accentColor}`,
    borderRadius: 10,
    padding: '20px 24px',
    boxShadow: C.shadow,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    transition: 'box-shadow 0.2s',
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 8,
      background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: accentColor,
    }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</p>}
    </div>
  </div>
)

// ─── Section header ───────────────────────────────────────────────────────────
const SectionRule = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
    <span style={{ display: 'block', width: 3, height: 16, borderRadius: 2, background: C.primary, flexShrink: 0 }} />
    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </p>
  </div>
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

  useEffect(() => { void loadInvoices() }, [loadInvoices])

  useEffect(() => {
    const confirmFromReturnUrl = async () => {
      if (!paymentRef) return
      try {
        const confirmation = await customerPortalService.confirmPayment(paymentRef)
        if (confirmation.completed) {
          pushToast('success', 'Payment confirmed and applied successfully.')
        } else {
          const status = await customerPortalService.getPaymentStatus(paymentRef)
          if (status.status === 'Completed') {
            pushToast('success', 'Payment confirmed and applied successfully.')
          } else {
            pushToast('warning', 'Payment return detected, but verification is still pending. Please refresh in a few seconds.')
          }
        }
        setSearchParams({}, { replace: true })
        await loadInvoices()
      } catch {
        pushToast('warning', 'Payment return detected, but verification is still pending. Please refresh in a few seconds.')
      }
    }
    void confirmFromReturnUrl()
  }, [loadInvoices, paymentRef, pushToast, setSearchParams])

  const toggleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds((cur) =>
      checked ? (cur.includes(invoiceId) ? cur : [...cur, invoiceId]) : cur.filter((id) => id !== invoiceId),
    )
  }

  const handlePayNow = async () => {
    if (selectedInvoiceIds.length === 0) { pushToast('warning', 'Select at least one invoice to continue.'); return }
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
      a.href = url; a.download = filename; a.click()
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
    const matchesSearch = search.trim().length === 0 || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
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
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '20px 24px',
        boxShadow: C.shadow,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{
              width: 4, height: 28, borderRadius: 2,
              background: C.primary, display: 'block', flexShrink: 0,
            }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Customer Portal
            </h1>
          </div>
          {data && (
            <p style={{ margin: '0 0 2px 14px', fontSize: 13, color: C.primary, fontWeight: 600 }}>
              {data.customerName} <span style={{ color: C.muted, fontWeight: 400 }}>· {data.customerCode}</span>
            </p>
          )}
          <p style={{ margin: '2px 0 0 14px', fontSize: 12, color: C.muted }}>
            Track invoices, settle outstanding balances, and download statements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void handleDownloadStatement() }}
          disabled={downloadingStatement || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: '#fff',
            background: C.primary, border: 'none', cursor: 'pointer',
            opacity: (downloadingStatement || loading) ? 0.6 : 1,
            transition: 'opacity 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloadingStatement ? 'Generating…' : 'Download Statement'}
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <KpiCard
          accentColor={C.primary}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
          label="Total Invoices"
          value={loading ? '—' : String(data?.invoices.length ?? 0)}
          sub="All invoice records"
        />
        <KpiCard
          accentColor={loading ? C.primary : outstanding > 0 ? C.danger : C.success}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
          label="Outstanding Balance"
          value={loading ? '—' : formatCurrency(outstanding)}
          sub={outstanding > 0 ? 'Payment required' : 'Account is current'}
        />
      </div>

      {/* ── Invoice Table ─────────────────────────────────────────────── */}
      <div>
        <SectionRule label="Invoice Register" />
        <div style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          boxShadow: C.shadow,
          overflow: 'hidden',
          marginTop: 10,
        }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
            padding: '14px 18px',
            borderBottom: `1px solid ${C.border}`,
            background: C.surface,
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
              <input
                type="text"
                placeholder="Search invoice number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13,
                  color: C.text, background: C.cardBg, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Status filter pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background: statusFilter === s ? C.primary : C.cardBg,
                    color: statusFilter === s ? '#fff' : C.muted,
                    border: `1px solid ${statusFilter === s ? C.primary : C.border}`,
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
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: '#fff',
                background: selectedInvoiceIds.length === 0 ? C.muted : C.primary,
                border: 'none', cursor: selectedInvoiceIds.length === 0 ? 'default' : 'pointer',
                opacity: (startingPayment || selectedInvoiceIds.length === 0) ? 0.6 : 1,
                transition: 'opacity 0.2s',
                flexShrink: 0,
                boxShadow: selectedInvoiceIds.length > 0 ? '0 2px 6px rgba(29,99,193,0.25)' : 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              {startingPayment ? 'Redirecting…' : 'Pay Selected'}
            </button>
          </div>

          {/* Table content */}
          {loading ? (
            <div style={{ padding: 24 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 40, background: '#f1f5f9', borderRadius: 4, marginBottom: 10, opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <svg width="64" height="56" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="30" width="100" height="62" rx="6" fill="#e0e7ef" stroke="#b0bec5" strokeWidth="1.5" />
                <path d="M10 36a6 6 0 0 1 6-6h28l8 10H104a6 6 0 0 1 6 6v2H10V36z" fill="#b0c4d8" stroke="#b0bec5" strokeWidth="1.5" />
                <rect x="30" y="48" width="60" height="8" rx="3" fill="#fff" opacity=".7" />
                <rect x="30" y="62" width="44" height="8" rx="3" fill="#fff" opacity=".5" />
              </svg>
              <p style={{ marginTop: 12, fontSize: 13, color: C.muted, fontWeight: 500 }}>No invoices match your filter.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `2px solid ${C.border}` }}>
                    {['Pay', 'Invoice #', 'Issue Date', 'Due Date', 'Amount', 'Status'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: i === 4 ? 'right' : i === 0 || i === 5 ? 'center' : 'left',
                          fontSize: 11, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: selectedInvoiceIds.includes(inv.id)
                          ? 'color-mix(in srgb, var(--primary) 4%, white)'
                          : idx % 2 === 0 ? C.cardBg : C.surface,
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {payableStatus.has(inv.status) ? (
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(inv.id)}
                            onChange={(e) => toggleInvoiceSelection(inv.id, e.target.checked)}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.primary }}
                          />
                        ) : (
                          <span style={{ color: C.muted, fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: C.primary, fontFamily: 'monospace', fontSize: 12 }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ padding: '10px 16px', color: C.text }}>{inv.invoiceDate}</td>
                      <td style={{ padding: '10px 16px', color: C.text }}>{inv.dueDate}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', fontSize: 13,
              borderTop: `1px solid ${C.border}`,
              background: 'color-mix(in srgb, var(--primary) 5%, white)',
            }}>
              <span style={{ color: C.text }}>
                <strong style={{ fontWeight: 700 }}>{selectedInvoiceIds.length}</strong>{' '}
                invoice{selectedInvoiceIds.length > 1 ? 's' : ''} selected for payment
              </span>
              <span style={{ fontWeight: 700, color: C.primary, fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>
                {formatCurrency(selectedTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
