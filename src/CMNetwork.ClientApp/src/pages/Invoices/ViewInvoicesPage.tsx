import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerInvoicesResponse } from '../../services/customerPortalService'

type Tab = 'all' | 'pay'

// ─── Shared helpers ───────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  Paid:    { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  Pending: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  Overdue: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  Draft:   { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] ?? STATUS_MAP.Draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.02em', textTransform: 'uppercase' as const,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap' as const,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.text, display: 'inline-block', flexShrink: 0 }} />
      {status}
    </span>
  )
}

const SectionRule = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
    <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</p>
  </div>
)

const THCell = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th style={{
    padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' as const,
  }}>
    {children}
  </th>
)

const ViewInvoicesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('all')
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true)
        const invoices = await customerPortalService.getMyInvoices()
        setData(invoices)
        setError(null)
      } catch (err) {
        setError('Unable to load invoices.')
        console.error('Error loading invoices:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoices()
  }, [])

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId],
    )
  }

  const handlePayment = async () => {
    if (!data || selectedInvoices.length === 0) { setError('Please select at least one invoice to pay.'); return }
    try {
      setProcessing(true); setError(null)
      const totalAmount = data.invoices.filter((inv) => selectedInvoices.includes(inv.id)).reduce((sum, inv) => sum + inv.totalAmount, 0)
      const result = await customerPortalService.createPaymentIntent(selectedInvoices, totalAmount)
      globalThis.location.href = result.redirectUrl
    } catch (err) {
      setError('Unable to process payment. Please try again.')
      console.error('Error processing payment:', err)
    } finally { setProcessing(false) }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[60, 200].map((h, i) => <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, marginBottom: 16, opacity: 1 - i * 0.3 }} />)}
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {error ?? 'No invoice data available.'}
        </div>
      </div>
    )
  }

  const pendingInvoices = data.invoices.filter((inv) => inv.status !== 'Paid')
  const totalSelected = data.invoices.filter((inv) => selectedInvoices.includes(inv.id)).reduce((sum, inv) => sum + inv.totalAmount, 0)

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: tab === id ? 600 : 500,
        color: tab === id ? 'var(--primary)' : 'var(--muted)',
        background: tab === id ? 'var(--card-bg)' : 'transparent',
        boxShadow: tab === id ? 'var(--shadow)' : 'none',
        border: tab === id ? '1px solid var(--border)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '18px 24px', boxShadow: 'var(--shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 4, height: 26, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Invoices</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          {data.customerName} · {data.customerCode} — View and manage all your invoices.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="all" label="All Invoices" />
        <TabBtn id="pay" label={`Pay Invoices${pendingInvoices.length > 0 ? ` (${pendingInvoices.length})` : ''}`} />
      </div>

      {/* All invoices */}
      {tab === 'all' && (
        <>
          <SectionRule label="Invoice Register" />
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            {data.invoices.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No invoices found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-container)', borderBottom: '2px solid var(--border)' }}>
                      <THCell>Invoice #</THCell>
                      <THCell>Issue Date</THCell>
                      <THCell>Due Date</THCell>
                      <THCell right>Amount</THCell>
                      <THCell>Status</THCell>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((invoice, i) => (
                      <tr key={invoice.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-container)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12 }}>{invoice.invoiceNumber}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${invoice.totalAmount.toFixed(2)}</td>
                        <td style={{ padding: '10px 16px' }}><StatusBadge status={invoice.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pay invoices */}
      {tab === 'pay' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendingInvoices.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 13 }}>
              All invoices are paid. No pending payments.
            </div>
          ) : (
            <>
              <SectionRule label="Pending Invoices" />
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-container)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ width: 40, padding: '10px 16px' }} />
                        <THCell>Invoice #</THCell>
                        <THCell>Due Date</THCell>
                        <THCell right>Amount</THCell>
                        <THCell>Status</THCell>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvoices.map((invoice, i) => {
                        const isSelected = selectedInvoices.includes(invoice.id)
                        return (
                          <tr key={invoice.id} style={{
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                            background: isSelected ? 'color-mix(in srgb, var(--primary) 4%, white)' : i % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-container)',
                          }}>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <input type="checkbox" checked={isSelected} onChange={() => handleSelectInvoice(invoice.id)}
                                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12 }}>{invoice.invoiceNumber}</td>
                            <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${invoice.totalAmount.toFixed(2)}</td>
                            <td style={{ padding: '10px 16px' }}><StatusBadge status={invoice.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment summary */}
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '18px 24px', boxShadow: 'var(--shadow)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {selectedInvoices.length > 0 ? `${selectedInvoices.length} invoice(s) selected` : 'Select invoices above'}
                  </p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                    ${totalSelected.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={processing || selectedInvoices.length === 0}
                  style={{
                    padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    color: '#fff', background: 'var(--primary)', border: 'none',
                    cursor: selectedInvoices.length === 0 ? 'default' : 'pointer',
                    opacity: (processing || selectedInvoices.length === 0) ? 0.6 : 1,
                    boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
                  }}
                >
                  {processing ? 'Processing…' : 'Proceed to Payment'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ViewInvoicesPage
