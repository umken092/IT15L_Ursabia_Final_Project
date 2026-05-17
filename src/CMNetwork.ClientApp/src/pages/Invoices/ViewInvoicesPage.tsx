import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerInvoicesResponse } from '../../services/customerPortalService'

type Tab = 'all' | 'pay'

const badge = (status: string) => {
  const map: Record<string, [string, string]> = {
    Paid: ['#dcfce7', '#166534'],
    Pending: ['#fef9c3', '#854d0e'],
    Overdue: ['#fee2e2', '#991b1b'],
    Draft: ['#f3f4f6', '#374151'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#374151']
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {status}
    </span>
  )
}

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
    if (!data || selectedInvoices.length === 0) {
      setError('Please select at least one invoice to pay.')
      return
    }

    try {
      setProcessing(true)
      setError(null)
      const totalAmount = data.invoices
        .filter((inv) => selectedInvoices.includes(inv.id))
        .reduce((sum, inv) => sum + inv.totalAmount, 0)

      const result = await customerPortalService.createPaymentIntent(selectedInvoices, totalAmount)
      globalThis.location.href = result.redirectUrl
    } catch (err) {
      setError('Unable to process payment. Please try again.')
      console.error('Error processing payment:', err)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error ?? 'No invoice data available.'}
        </div>
      </div>
    )
  }

  const pendingInvoices = data.invoices.filter((inv) => inv.status !== 'Paid')
  const totalSelected = data.invoices
    .filter((inv) => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + inv.totalAmount, 0)

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: tab === id ? 'var(--card-bg)' : 'transparent',
        color: tab === id ? 'var(--primary)' : 'var(--muted)',
        boxShadow: tab === id ? 'var(--shadow)' : 'none',
        fontWeight: tab === id ? 600 : 400,
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Invoices
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {data.customerName} · {data.customerCode}
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('all', 'All Invoices')}
        {tabBtn('pay', `Pay Invoices${pendingInvoices.length > 0 ? ` (${pendingInvoices.length})` : ''}`)}
      </div>

      {/* All invoices tab */}
      {tab === 'all' && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {data.invoices.length === 0 ? (
            <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
              No invoices found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-container)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Invoice #</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Due Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice, i) => (
                  <tr
                    key={invoice.id}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                  >
                    <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--primary)' }}>{invoice.invoiceNumber}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--muted)' }}>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--muted)' }}>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold" style={{ color: 'var(--text)' }}>${invoice.totalAmount.toFixed(2)}</td>
                    <td className="px-5 py-3.5">{badge(invoice.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pay invoices tab */}
      {tab === 'pay' && (
        <div className="space-y-4">
          {pendingInvoices.length === 0 ? (
            <div
              className="rounded-xl px-6 py-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              All invoices are paid. No pending payments.
            </div>
          ) : (
            <>
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-container)', borderBottom: '1px solid var(--border)' }}>
                      <th className="px-5 py-3 w-10" />
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Invoice #</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Due Date</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Amount</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvoices.map((invoice, i) => (
                      <tr
                        key={invoice.id}
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                          background: selectedInvoices.includes(invoice.id) ? 'rgba(29,99,193,0.04)' : undefined,
                        }}
                      >
                        <td className="px-5 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={() => handleSelectInvoice(invoice.id)}
                            className="w-4 h-4 rounded accent-blue-600"
                          />
                        </td>
                        <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--primary)' }}>{invoice.invoiceNumber}</td>
                        <td className="px-5 py-3.5" style={{ color: 'var(--muted)' }}>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-right font-semibold" style={{ color: 'var(--text)' }}>${invoice.totalAmount.toFixed(2)}</td>
                        <td className="px-5 py-3.5">{badge(invoice.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment summary */}
              <div
                className="rounded-xl px-6 py-5 flex items-center justify-between gap-6"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {selectedInvoices.length > 0 ? `${selectedInvoices.length} invoice(s) selected` : 'Select invoices above'}
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                    ${totalSelected.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={processing || selectedInvoices.length === 0}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--primary)' }}
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
