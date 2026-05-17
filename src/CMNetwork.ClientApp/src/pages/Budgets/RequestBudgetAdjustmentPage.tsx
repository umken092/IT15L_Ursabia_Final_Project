import React, { useEffect, useState } from 'react'
import { customerPortalService, type Budget } from '../../services/customerPortalService'

const RequestBudgetAdjustmentPage: React.FC = () => {
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

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    if (!selectedBudgetId || !requestedAmount || !reason) {
      setError('All fields are required.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await customerPortalService.requestBudgetAdjustment({
        budgetId: selectedBudgetId,
        requestedAmount: Number.parseFloat(requestedAmount),
        reason,
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
    return <div className="p-4">Loading budgets...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Request Budget Adjustment</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}

      {budgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No budgets available for adjustment.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <div className="mb-6">
            <label htmlFor="selectBudget" className="block text-sm font-semibold text-gray-700 mb-2">Select Budget</label>
            <select
              id="selectBudget"
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">-- Choose a budget --</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name} (Allocated: ${budget.allocatedAmount.toFixed(2)}, Remaining: ${budget.remainingAmount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="requestedAmount" className="block text-sm font-semibold text-gray-700 mb-2">Requested Adjustment Amount</label>
            <input
              id="requestedAmount"
              type="number"
              step="0.01"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter amount"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 mb-2">Reason for Adjustment</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows={4}
              placeholder="Please provide a detailed reason for the adjustment"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}
    </div>
  )
}

export default RequestBudgetAdjustmentPage
