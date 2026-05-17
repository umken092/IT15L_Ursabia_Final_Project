import React, { useEffect, useState } from 'react'
import { customerPortalService, type Budget } from '../../services/customerPortalService'

const ViewBudgetsPage: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return <div className="p-4">Loading budgets...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">View Budgets</h1>

      {budgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No budgets found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((budget) => {
            const percentageUsed = (budget.spentAmount / budget.allocatedAmount) * 100
            const getStatusClass = (): string => {
              if (budget.status === 'Active') return 'bg-green-100 text-green-800'
              if (budget.status === 'Upcoming') return 'bg-blue-100 text-blue-800'
              return 'bg-gray-100 text-gray-800'
            }
            const getProgressBarClass = (): string => {
              if (percentageUsed > 100) return 'bg-red-500'
              if (percentageUsed > 80) return 'bg-yellow-500'
              return 'bg-green-500'
            }
            return (
              <div key={budget.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{budget.name}</h2>
                    <p className="text-sm text-gray-500">
                      {new Date(budget.startDate).toLocaleDateString()} to {new Date(budget.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass()}`}>
                    {budget.status}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Allocated: ${budget.allocatedAmount.toFixed(2)}</span>
                    <span className="text-gray-600">Spent: ${budget.spentAmount.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${getProgressBarClass()}`} style={{ width: `${Math.min(percentageUsed, 100)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Remaining</p>
                    <p className="text-lg font-semibold text-gray-900">${budget.remainingAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Usage</p>
                    <p className="text-lg font-semibold text-gray-900">{percentageUsed.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ViewBudgetsPage
