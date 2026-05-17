import React, { useEffect, useState } from 'react'
import { customerPortalService, type Budget } from '../../services/customerPortalService'

type Tab = 'budgets' | 'adjust'

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid var(--border)', borderRadius: 7,
  fontSize: 13, color: 'var(--text)', background: 'var(--card-bg)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
    {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
  </label>
)

const SectionRule = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
    <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</p>
  </div>
)

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Active:   { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  Upcoming: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  Expired:  { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
  Closed:   { bg: '#f9fafb', text: '#9ca3af', border: '#e5e7eb' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.Closed
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

const ViewBudgetsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('budgets')
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [selectedBudgetId, setSelectedBudgetId] = useState('')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getMyBudgets()
        setBudgets(data)
        setError(null)
      } catch (err) {
        setError('Unable to load budgets.')
        console.error('Error loading budgets:', err)
      } finally { setLoading(false) }
    }
    fetchBudgets()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBudgetId || !requestedAmount || !reason.trim()) { setError('All adjustment fields are required.'); return }
    const parsedAmount = Number.parseFloat(requestedAmount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) { setError('Requested amount must be greater than zero.'); return }
    try {
      setSubmitting(true); setError(null)
      await customerPortalService.requestBudgetAdjustment({ budgetId: selectedBudgetId, requestedAmount: parsedAmount, reason: reason.trim() })
      setSuccess('Budget adjustment request submitted successfully.')
      setSelectedBudgetId(''); setRequestedAmount(''); setReason('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to submit budget adjustment request.')
      console.error('Error submitting request:', err)
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[60, 120, 120].map((h, i) => <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, marginBottom: 16, opacity: 1 - i * 0.2 }} />)}
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

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 24px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 4, height: 26, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Budgets</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          View your allocated budgets and submit adjustment requests.
        </p>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{success}</div>}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="budgets" label={`My Budgets${budgets.length > 0 ? ` (${budgets.length})` : ''}`} />
        <TabBtn id="adjust" label="Request Adjustment" />
      </div>

      {/* Budget cards */}
      {tab === 'budgets' && (
        <>
          {budgets.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 13 }}>
              No budgets found.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {budgets.map((budget) => {
                const pct = budget.allocatedAmount > 0 ? (budget.spentAmount / budget.allocatedAmount) * 100 : 0
                const barColor = pct > 100 ? '#dc2626' : pct > 80 ? '#ca8a04' : '#059669'
                return (
                  <div key={budget.id} style={{
                    background: 'var(--card-bg)',
                    border: `1px solid var(--border)`,
                    borderTop: `3px solid ${barColor}`,
                    borderRadius: 10,
                    padding: 20,
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{budget.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>
                          {new Date(budget.startDate).toLocaleDateString()} – {new Date(budget.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={budget.status} />
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Utilization</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: 6, borderRadius: 999, background: barColor, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>

                    {/* Amounts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      {[
                        { label: 'Allocated', value: `$${budget.allocatedAmount.toFixed(2)}`, color: 'var(--text)' },
                        { label: 'Spent', value: `$${budget.spentAmount.toFixed(2)}`, color: 'var(--text)' },
                        { label: 'Remaining', value: `$${budget.remainingAmount.toFixed(2)}`, color: budget.remainingAmount < 0 ? '#dc2626' : '#059669' },
                      ].map((item) => (
                        <div key={item.label}>
                          <p style={{ margin: '0 0 3px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{item.label}</p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Adjustment request */}
      {tab === 'adjust' && (
        <>
          <SectionRule label="Budget Adjustment Request" />
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', maxWidth: 540,
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)' }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Request Budget Adjustment</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Submit a request to increase or reallocate your budget.</p>
            </div>
            {budgets.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No budgets available for adjustment.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <FieldLabel required>Select Budget</FieldLabel>
                  <select
                    value={selectedBudgetId}
                    onChange={(e) => setSelectedBudgetId(e.target.value)}
                    style={{ ...inputStyle }} required
                  >
                    <option value="">Choose a budget…</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} — ${b.remainingAmount.toFixed(2)} remaining</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel required>Requested Amount (PHP)</FieldLabel>
                  <input type="number" step="0.01" min="0.01" value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    style={inputStyle} placeholder="0.00" required />
                </div>
                <div>
                  <FieldLabel required>Reason for Adjustment</FieldLabel>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }} rows={4}
                    placeholder="Provide a detailed reason for the adjustment request…" required />
                </div>
                <button type="submit" disabled={submitting} style={{
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: '#fff', background: 'var(--primary)', border: 'none',
                  cursor: 'pointer', opacity: submitting ? 0.6 : 1,
                  alignSelf: 'flex-start', boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
                }}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ViewBudgetsPage
