import React, { useEffect, useState } from 'react'
import { customerPortalService, type FinancialReport } from '../../services/customerPortalService'

type Tab = 'reports' | 'statement'

const FinancialReportsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('reports')
  const [reports, setReports] = useState<FinancialReport[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dlSuccess, setDlSuccess] = useState<string | null>(null)

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

  const handleDownloadStatement = async () => {
    try {
      setDownloading(true)
      setError(null)
      const { blob, filename } = await customerPortalService.downloadStatement()
      const url = globalThis.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      globalThis.URL.revokeObjectURL(url)
      setDlSuccess('Statement downloaded successfully.')
      setTimeout(() => setDlSuccess(null), 4000)
    } catch (err) {
      setError('Unable to download statement.')
      console.error('Error downloading statement:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-28 bg-gray-200 rounded-xl" />
          <div className="h-28 bg-gray-200 rounded-xl" />
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
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Reports</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Access your financial reports and download account statements.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('reports', 'Financial Reports')}
        {tabBtn('statement', 'Account Statement')}
      </div>

      {/* Financial reports tab */}
      {tab === 'reports' && (
        <>
          {reports.length === 0 ? (
            <div
              className="rounded-xl px-6 py-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              No financial reports available at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl px-5 py-4 flex items-center gap-5"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 text-lg"
                    style={{ background: 'var(--surface-container)' }}
                  >
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--text)' }}>{report.reportName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {report.reportType} · Generated {new Date(report.generatedDate).toLocaleDateString()}
                    </p>
                    {report.description && (
                      <p className="text-sm mt-1 line-clamp-1" style={{ color: 'var(--muted)' }}>{report.description}</p>
                    )}
                  </div>
                  <a
                    href={report.fileUrl}
                    download
                    className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Account statement tab */}
      {tab === 'statement' && (
        <div
          className="rounded-xl overflow-hidden max-w-xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Account Statement (PDF)</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Download a complete statement of all your transactions.
            </p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {dlSuccess && (
              <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
                {dlSuccess}
              </div>
            )}
            <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
              <li>· Statements are generated in PDF format</li>
              <li>· Includes all transactions and financial summaries</li>
              <li>· Statements are generated on a monthly basis</li>
            </ul>
            <button
              onClick={handleDownloadStatement}
              disabled={downloading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {downloading ? 'Downloading…' : 'Download Statement (PDF)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FinancialReportsPage
