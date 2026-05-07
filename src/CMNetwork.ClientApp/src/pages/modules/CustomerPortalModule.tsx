import { useEffect, useState } from 'react'
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

  const [data, setData] = useState<CustomerInvoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingStatement, setDownloadingStatement] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        setData(await customerPortalService.getMyInvoices())
      } catch {
        pushToast('error', 'Unable to load your invoices. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [pushToast])

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Customer Portal</h1>
          {data && (
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              {data.customerName} · {data.customerCode}
            </p>
          )}
        </div>
        <button
          onClick={() => { void handleDownloadStatement() }}
          disabled={downloadingStatement || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#1d4ed8',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: downloadingStatement ? 'not-allowed' : 'pointer',
            opacity: downloadingStatement ? 0.7 : 1,
          }}
        >
          {downloadingStatement ? '⏳ Generating…' : '⬇ Download Statement (PDF)'}
        </button>
      </div>

      {/* Summary card */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          gap: 40,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Invoices
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a' }}>
            {loading ? '—' : (data?.invoices.length ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
            Outstanding Balance
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>
            {loading ? '—' : formatCurrency(outstanding)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search invoice number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
            flex: '1 1 200px',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${statusFilter === s ? '#1d4ed8' : '#d1d5db'}`,
                background: statusFilter === s ? '#1d4ed8' : '#fff',
                color: statusFilter === s ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice table */}
      {loading ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>Loading invoices…</p>
      ) : filteredInvoices.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>No invoices match your filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Invoice #</th>
                <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Due Date</th>
                <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 600, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, idx) => (
                <tr
                  key={inv.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: idx % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1d4ed8' }}>
                    {inv.invoiceNumber}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{inv.invoiceDate}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{inv.dueDate}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                    {formatCurrency(inv.totalAmount)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
