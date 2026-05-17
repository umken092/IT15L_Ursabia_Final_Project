import React, { useEffect, useState } from 'react'
import { customerPortalService, type FinancialReport } from '../../services/customerPortalService'

const FinancialReportsPage: React.FC = () => {
  const [reports, setReports] = useState<FinancialReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getFinancialReports()
        setReports(data)
        setError(null)
      } catch (err) {
        setError('Unable to load financial reports.')
        console.error('Error loading reports:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  if (loading) {
    return <div className="p-4">Loading financial reports...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Financial Reports</h1>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No financial reports available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">{report.reportName}</h2>
                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  <div className="flex justify-between text-sm text-gray-500 mt-4">
                    <span>Type: {report.reportType}</span>
                    <span>Generated: {new Date(report.generatedDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <a
                  href={report.fileUrl}
                  download
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FinancialReportsPage
