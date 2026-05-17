import React, { useEffect, useState } from 'react'
import { customerPortalService, type Approval } from '../../services/customerPortalService'

type Tab = 'pending' | 'approved'

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Approved: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', icon: '✓' },
  Pending:  { bg: '#fefce8', text: '#854d0e', border: '#fde68a', icon: '⧖' },
  Rejected: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: '✗' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_BADGE[status] ?? { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb', icon: '·' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.02em', textTransform: 'uppercase' as const,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' as const,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.text, display: 'inline-block', flexShrink: 0 }} />
      {status}
    </span>
  )
}

const ApprovalCard: React.FC<{ approval: Approval }> = ({ approval }) => {
  const accent = approval.status === 'Approved' ? '#059669' : approval.status === 'Rejected' ? '#dc2626' : '#ca8a04'
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${accent}`,
      borderRadius: 10,
      padding: '18px 20px',
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {approval.title}
          </p>
          <span style={{
            display: 'inline-flex', padding: '2px 8px',
            background: 'var(--surface-container)', border: '1px solid var(--border)',
            borderRadius: 5, fontSize: 10, fontWeight: 600, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {approval.type}
          </span>
        </div>
        <StatusBadge status={approval.status} />
      </div>

      {approval.description && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          {approval.description}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Submitted: <strong style={{ color: 'var(--text)' }}>{new Date(approval.submittedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
        </span>
        {approval.approvedDate && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Resolved: <strong style={{ color: 'var(--text)' }}>{new Date(approval.approvedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </span>
        )}
      </div>
    </div>
  )
}

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
        setPending(p); setApproved(a); setError(null)
      } catch (err) {
        setError('Unable to load approvals.')
        console.error('Error loading approvals:', err)
      } finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[60, 120, 120, 120].map((h, i) => <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, marginBottom: 14, opacity: 1 - i * 0.18 }} />)}
      </div>
    )
  }

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button type="button" onClick={() => setTab(id)} style={{
      padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: tab === id ? 600 : 500,
      color: tab === id ? 'var(--primary)' : 'var(--muted)',
      background: tab === id ? 'var(--card-bg)' : 'transparent',
      boxShadow: tab === id ? 'var(--shadow)' : 'none',
      border: tab === id ? '1px solid var(--border)' : '1px solid transparent',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  )

  const items = tab === 'pending' ? pending : approved
  const emptyMsg = tab === 'pending' ? 'No pending approvals at this time.' : 'No approved requests found.'

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 24px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 4, height: 26, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Approvals</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          Track the status of your submitted requests and approvals.
        </p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Pending', count: pending.length, color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
          { label: 'Approved', count: approved.length, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
        ].map((item) => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: item.bg, border: `1px solid ${item.border}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'block' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.count}</span>
            <span style={{ fontSize: 12, color: item.color, fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="pending" label={`Pending${pending.length > 0 ? ` (${pending.length})` : ''}`} />
        <TabBtn id="approved" label={`Approved${approved.length > 0 ? ` (${approved.length})` : ''}`} />
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, color: 'var(--muted)', fontSize: 13,
        }}>
          {emptyMsg}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingApprovalsPage
