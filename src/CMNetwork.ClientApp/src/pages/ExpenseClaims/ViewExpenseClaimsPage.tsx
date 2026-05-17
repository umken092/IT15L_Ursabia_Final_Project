import React, { useEffect, useState } from 'react'
import { customerPortalService, type ExpenseClaim } from '../../services/customerPortalService'

type Tab = 'claims' | 'submit'

const inputCls =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors'

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

const CATEGORIES = ['Travel', 'Meals', 'Equipment', 'Office Supplies', 'Other']

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
      setClaims(data)
      setError(null)
    } catch (err) {
      setError('Unable to load expense claims.')
      console.error('Error loading expense claims:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClaims()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim() || !amount || !category) {
      setError('Please fill in all required fields.')
      return
    }

    const parsedAmount = Number.parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await customerPortalService.submitExpenseClaim({
        description: description.trim(),
        amount: parsedAmount,
        category,
        attachments,
      })
      setSuccess('Expense claim submitted successfully.')
      setDescription('')
      setAmount('')
      setCategory('')
      setAttachments([])
      await loadClaims()
      setTab('claims')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError('Unable to submit expense claim.')
      console.error('Error submitting claim:', err)
    } finally {
      setSubmitting(false)
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
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Expense Claims</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          View your submitted claims and file new expense reimbursement requests.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{success}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('claims', `My Claims${claims.length > 0 ? ` (${claims.length})` : ''}`)}
        {tabBtn('submit', 'Submit Claim')}
      </div>

      {/* Claims table tab */}
      {tab === 'claims' && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {claims.length === 0 ? (
            <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
              No expense claims yet.{' '}
              <button
                type="button"
                onClick={() => setTab('submit')}
                className="underline"
                style={{ color: 'var(--primary)' }}
              >
                Submit your first claim.
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-container)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Claim #</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Description</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Category</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim, i) => (
                  <tr key={claim.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--primary)' }}>{claim.claimNumber}</td>
                    <td className="px-5 py-3.5 max-w-xs truncate" style={{ color: 'var(--text)' }}>{claim.description}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--muted)' }}>{claim.category}</td>
                    <td className="px-5 py-3.5 text-right font-semibold" style={{ color: 'var(--text)' }}>${claim.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--muted)' }}>{new Date(claim.submittedDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">{badge(claim.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Submit claim tab */}
      {tab === 'submit' && (
        <div
          className="rounded-xl overflow-hidden max-w-xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>New Expense Claim</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Fill in the details below and attach supporting receipts.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
                style={{ borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
                rows={3}
                placeholder="Describe the expense…"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  required
                >
                  <option value="">Select…</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                Attachments
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:text-white cursor-pointer"
                style={{ color: 'var(--muted)' }}
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((file) => (
                    <li key={file.name} className="text-xs" style={{ color: 'var(--muted)' }}>
                      · {file.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {submitting ? 'Submitting…' : 'Submit Claim'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default ViewExpenseClaimsPage
