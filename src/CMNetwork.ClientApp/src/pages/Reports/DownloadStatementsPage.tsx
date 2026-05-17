import React, { useState } from 'react'
import { customerPortalService } from '../../services/customerPortalService'

const DownloadStatementsPage: React.FC = () => {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleDownloadStatement = async () => {
    try {
      setDownloading(true)
      setError(null)
      const { blob, filename } = await customerPortalService.downloadStatement()
      
      // Create a blob URL and trigger download
      const url = globalThis.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      globalThis.URL.revokeObjectURL(url)
      
      setSuccess('Statement downloaded successfully.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to download statement.')
      console.error('Error downloading statement:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Download Statements</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Statement</h2>
        <p className="text-gray-600 mb-6">
          Download your account statement in PDF format. This includes all transactions and financial information for your account.
        </p>

        <button
          onClick={handleDownloadStatement}
          disabled={downloading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {downloading ? 'Downloading...' : 'Download Statement (PDF)'}
        </button>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Statement Information</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Statements are available in PDF format</li>
            <li>• Each statement includes a summary of all transactions</li>
            <li>• Statements are generated on a monthly basis</li>
            <li>• You can download statements for any period</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default DownloadStatementsPage
