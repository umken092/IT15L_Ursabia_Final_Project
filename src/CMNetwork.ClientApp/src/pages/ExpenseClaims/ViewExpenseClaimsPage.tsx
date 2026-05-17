import React, { useEffect, useState } from 'react'
import { customerPortalService, type ExpenseClaim } from '../../services/customerPortalService'

const ViewExpenseClaimsPage: React.FC = () => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClaims = async () => {
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

    fetchClaims()
  }, [])

  if (loading) {
    return <div className="p-4">Loading expense claims...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">View Expense Claims</h1>

      {claims.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No expense claims found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Claim Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Submitted Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{claim.claimNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{claim.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{claim.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-semibold">${claim.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(claim.submittedDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    {(() => {
                      if (claim.status === 'Approved') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">{claim.status}</span>
                      if (claim.status === 'Pending') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">{claim.status}</span>
                      if (claim.status === 'Rejected') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">{claim.status}</span>
                      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{claim.status}</span>
                    })()}
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

export default ViewExpenseClaimsPage
