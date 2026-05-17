import React, { useEffect, useState } from 'react'
import { customerPortalService, type Approval } from '../../services/customerPortalService'

const PendingApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getPendingApprovals()
        setApprovals(data)
        setError(null)
      } catch (err) {
        setError('Unable to load pending approvals.')
        console.error('Error loading approvals:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchApprovals()
  }, [])

  if (loading) {
    return <div className="p-4">Loading pending approvals...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Pending Approvals</h1>

      {approvals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No pending approvals at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{approval.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">Type: {approval.type}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                  {approval.status}
                </span>
              </div>

              <p className="text-gray-700 mb-4">{approval.description}</p>

              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Submitted: {new Date(approval.submittedDate).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingApprovalsPage
