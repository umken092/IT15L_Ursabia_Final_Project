import React, { useEffect, useState } from 'react'
import { customerPortalService, type Approval } from '../../services/customerPortalService'

type Tab = 'pending' | 'approved'

const badge = (status: string) => {
  const map: Record<string, [string, string]> = {
    Approved: ['#dcfce7', '#166534'],
    Pending: ['#fef9c3', '#854d0e'],
    Rejected: ['#fee2e2', '#991b1b'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#374151']
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {status}
    </span>
  )
}

const ApprovalCard: React.FC<{ approval: Approval }> = ({ approval }) => (
  <div
    className="rounded-xl p-5"
    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
  >
    <div className="flex items-start justify-between gap-4 mb-3">
      <div>
        <p className="font-semibold" style={{ color: 'var(--text)' }}>{approval.title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Type: {approval.type}</p>
      </div>
      {badge(approval.status)}
    </div>
    <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>{approval.description}</p>
    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
      <span>Submitted: {new Date(approval.submittedDate).toLocaleDateString()}</span>
      {approval.approvedDate && (
        <span>Resolved: {new Date(approval.approvedDate).toLocaleDateString()}</span>
      )}
    </div>
  </div>
)

const PendingApprovalsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<Approval[]>([])
  const [approved, setApproved] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true)
        const [p, a] = await Promise.all([
          customerPortalService.getPendingApprovals(),
          customerPortalService.getApprovedRequests(),
        ])
        setPending(p)
        setApproved(a)
        setError(null)
      } catch (err) {
        setError('Unable to load approvals.')
        console.error('Error loading approvals:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-36 bg-gray-200 rounded-xl" />
          <div className="h-36 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

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

  const items = tab === 'pending' ? pending : approved
  const emptyMessage = tab === 'pending' ? 'No pending approvals at this time.' : 'No approved requests found.'

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Approvals</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Track the status of your submitted requests and approvals.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('pending', `Pending${pending.length > 0 ? ` (${pending.length})` : ''}`)}
        {tabBtn('approved', `Approved${approved.length > 0 ? ` (${approved.length})` : ''}`)}
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-xl px-6 py-12 text-center"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingApprovalsPage
