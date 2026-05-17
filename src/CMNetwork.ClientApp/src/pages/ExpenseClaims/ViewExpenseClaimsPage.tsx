import React, { useEffect, useState } from 'react'
import { customerPortalService, type ExpenseClaim } from '../../services/customerPortalService'

type Tab = 'claims' | 'submit'

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
  Approved: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  Pending:  { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  Rejected: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_BADGE[status] ?? { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' }
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

const CATEGORIES = ['Travel', 'Meals', 'Equipment', 'Office Supplies', 'Other']

const THCell = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th style={{
    padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' as const,
  }}>{children}</th>
)

const ViewExpenseClaimsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('claims')
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadClaims = async () => {
    try {
      setLoading(true)
      const data = await customerPortalService.getMyExpenseClaims()
      setClaims(data); setError(null)
    } catch (err) {
      setError('Unable to load expense claims.')
      console.error('Error loading expense claims:', err)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadClaims() }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments(Array.from(e.target.files))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount || !category) { setError('Please fill in all required fields.'); return }
    const parsedAmount = Number.parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) { setError('Amount must be greater than zero.'); return }
    try {
      setSubmitting(true); setError(null)
      await customerPortalService.submitExpenseClaim({ description: description.trim(), amount: parsedAmount, category, attachments })
      setSuccess('Expense claim submitted successfully.')
      setDescription(''); setAmount(''); setCategory(''); setAttachments([])
      await loadClaims()
      setTab('claims')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError('Unable to submit expense claim.')
      console.error('Error submitting claim:', err)
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[60, 200].map((h, i) => <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, marginBottom: 16, opacity: 1 - i * 0.3 }} />)}
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
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Expense Claims</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          View your submitted claims and file new expense reimbursement requests.
        </p>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="claims" label={`My Claims${claims.length > 0 ? ` (${claims.length})` : ''}`} />
        <TabBtn id="submit" label="Submit Claim" />
      </div>

      {/* Claims table */}
      {tab === 'claims' && (
        <>
          <SectionRule label="Expense Claim History" />
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            {claims.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No expense claims yet.{' '}
                <button type="button" onClick={() => setTab('submit')} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Submit your first claim.
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-container)', borderBottom: '2px solid var(--border)' }}>
                      <THCell>Claim #</THCell>
                      <THCell>Description</THCell>
                      <THCell>Category</THCell>
                      <THCell right>Amount</THCell>
                      <THCell>Date Submitted</THCell>
                      <THCell>Status</THCell>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim, i) => (
                      <tr key={claim.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-container)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12 }}>{claim.claimNumber}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text)', maxWidth: 240 }}>
                          <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.description}</p>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-flex', padding: '2px 8px', background: 'var(--surface-container)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                            {claim.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${claim.amount.toFixed(2)}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{new Date(claim.submittedDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 16px' }}><StatusBadge status={claim.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Submit form */}
      {tab === 'submit' && (
        <>
          <SectionRule label="New Expense Claim" />
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', maxWidth: 540,
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)' }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>New Expense Claim</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Fill in the details below and attach supporting receipts.</p>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel required>Description</FieldLabel>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                  placeholder="Describe the expense in detail…" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <FieldLabel required>Amount (PHP)</FieldLabel>
                  <input type="number" step="0.01" min="0.01" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle} placeholder="0.00" required />
                </div>
                <div>
                  <FieldLabel required>Category</FieldLabel>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} required>
                    <option value="">Select category…</option>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel>Attachments</FieldLabel>
                <div style={{ border: '1px dashed var(--border)', borderRadius: 7, padding: '14px', textAlign: 'center' }}>
                  <input type="file" multiple onChange={handleFileChange}
                    style={{ fontSize: 12, color: 'var(--muted)' }} />
                  {attachments.length > 0 && (
                    <ul style={{ marginTop: 10, textAlign: 'left', paddingLeft: 16 }}>
                      {attachments.map((file) => (
                        <li key={file.name} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                          📎 {file.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button type="submit" disabled={submitting} style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: '#fff', background: 'var(--primary)', border: 'none',
                cursor: 'pointer', opacity: submitting ? 0.6 : 1, alignSelf: 'flex-start',
                boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
              }}>
                {submitting ? 'Submitting…' : 'Submit Claim'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

export default ViewExpenseClaimsPage
