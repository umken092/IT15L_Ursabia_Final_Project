import React, { useEffect, useState } from 'react'
import { customerPortalService, type Budget } from '../../services/customerPortalService'

type Tab = 'budgets' | 'adjust'

const inputCls =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors'

const badge = (status: string) => {
  const map: Record<string, [string, string]> = {
    Active: ['#dcfce7', '#166534'],
    Upcoming: ['#dbeafe', '#1e40af'],
    Expired: ['#f3f4f6', '#374151'],
    Closed: ['#f3f4f6', '#374151'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#374151']
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
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
      } finally {
        setLoading(false)
      }
    }

    fetchBudgets()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBudgetId || !requestedAmount || !reason.trim()) {
      setError('All adjustment fields are required.')
      return
    }

    const parsedAmount = Number.parseFloat(requestedAmount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Requested amount must be greater than zero.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await customerPortalService.requestBudgetAdjustment({
        budgetId: selectedBudgetId,
        requestedAmount: parsedAmount,
        reason: reason.trim(),
      })
      setSuccess('Budget adjustment request submitted successfully.')
      setSelectedBudgetId('')
      setRequestedAmount('')
      setReason('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to submit budget adjustment request.')
      console.error('Error submitting request:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-200 rounded-xl" />
            <div className="h-48 bg-gray-200 rounded-xl" />
          </div>
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
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Budgets</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          View your allocated budgets and submit adjustment requests.
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
        {tabBtn('budgets', `My Budgets${budgets.length > 0 ? ` (${budgets.length})` : ''}`)}
        {tabBtn('adjust', 'Request Adjustment')}
      </div>

      {/* Budget cards tab */}
      {tab === 'budgets' && (
        <>
          {budgets.length === 0 ? (
            <div
              className="rounded-xl px-6 py-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              No budgets found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgets.map((budget) => {
                const pct = budget.allocatedAmount > 0 ? (budget.spentAmount / budget.allocatedAmount) * 100 : 0
                const barColor = pct > 100 ? '#dc2626' : pct > 80 ? '#ca8a04' : '#059669'
                return (
                  <div
                    key={budget.id}
                    className="rounded-xl p-5"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{budget.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {new Date(budget.startDate).toLocaleDateString()} – {new Date(budget.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      {badge(budget.status)}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
                        <span>Spent: ${budget.spentAmount.toFixed(2)}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                        />
                      </div>
                    </div>

                    {/* Amounts */}
                    <div className="grid grid-cols-3 gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Allocated</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>
                          ${budget.allocatedAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Spent</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>
                          ${budget.spentAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Remaining</p>
                        <p
                          className="text-sm font-semibold mt-0.5"
                          style={{ color: budget.remainingAmount < 0 ? '#dc2626' : '#059669' }}
                        >
                          ${budget.remainingAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Adjustment request tab */}
      {tab === 'adjust' && (
        <div
          className="rounded-xl max-w-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Request Budget Adjustment</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Submit a request to increase or reallocate your budget.
            </p>
          </div>
          {budgets.length === 0 ? (
            <div className="px-6 py-10 text-center" style={{ color: 'var(--muted)' }}>
              No budgets available for adjustment.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Select Budget *
                </label>
                <select
                  value={selectedBudgetId}
                  onChange={(e) => setSelectedBudgetId(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  required
                >
                  <option value="">Choose a budget…</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — ${b.remainingAmount.toFixed(2)} remaining
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Requested Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Reason *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
                  rows={4}
                  placeholder="Provide a detailed reason for the adjustment…"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default ViewBudgetsPage
