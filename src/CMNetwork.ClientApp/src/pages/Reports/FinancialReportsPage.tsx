import React, { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { customerPortalService, type FinancialReport } from '../../services/customerPortalService'

type Tab = 'reports' | 'statement'

const SectionRule = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
    <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</p>
  </div>
)

const REPORT_TYPE_COLORS: Record<string, string> = {
  'Profit & Loss': 'var(--primary)',
  'Balance Sheet': '#059669',
  'Cash Flow': '#7c3aed',
  'Aging Report': '#ca8a04',
}

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
        setReports(data); setError(null)
      } catch (err) {
        const status = (err as AxiosError)?.response?.status
        setError(status === 403 ? 'You do not have permission to view customer financial reports.' : 'Unable to load financial reports.')
        console.error('Error loading reports:', err)
      } finally { setLoading(false) }
    }
    fetchReports()
  }, [])

  const handleDownloadStatement = async () => {
    try {
      setDownloading(true); setError(null)
      const { blob, filename } = await customerPortalService.downloadStatement()
      const url = globalThis.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = filename
      document.body.appendChild(link); link.click(); link.remove()
      globalThis.URL.revokeObjectURL(url)
      setDlSuccess('Statement downloaded successfully.')
      setTimeout(() => setDlSuccess(null), 4000)
    } catch (err) {
      setError('Unable to download statement.')
      console.error('Error downloading statement:', err)
    } finally { setDownloading(false) }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[60, 80, 80, 80].map((h, i) => <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, marginBottom: 14, opacity: 1 - i * 0.18 }} />)}
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
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Reports</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          Access your financial reports and download account statements.
        </p>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="reports" label="Financial Reports" />
        <TabBtn id="statement" label="Account Statement" />
      </div>

      {/* Reports tab */}
      {tab === 'reports' && (
        <>
          <SectionRule label={`Available Reports (${reports.length})`} />
          {reports.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 13 }}>
              No financial reports available at this time.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map((report) => {
                const accentColor = REPORT_TYPE_COLORS[report.reportType] ?? 'var(--primary)'
                return (
                  <div key={report.id} style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${accentColor}`,
                    borderRadius: 10,
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow)',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 8, flexShrink: 0,
                      background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: accentColor,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {report.reportName}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-flex', padding: '2px 8px',
                          background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                          borderRadius: 5, fontSize: 10, fontWeight: 600,
                          color: accentColor, textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          {report.reportType}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Generated {new Date(report.generatedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {report.description && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.description}
                        </p>
                      )}
                    </div>

                    {/* Download */}
                    <a href={report.fileUrl} download style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      color: '#fff', background: 'var(--primary)', textDecoration: 'none',
                      flexShrink: 0, boxShadow: '0 2px 6px rgba(29,99,193,0.2)',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Statement tab */}
      {tab === 'statement' && (
        <>
          <SectionRule label="Account Statement" />
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', maxWidth: 540,
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)' }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Account Statement (PDF)</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Download a complete statement of all your transactions.</p>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dlSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                  {dlSuccess}
                </div>
              )}

              {/* Info list */}
              <div style={{ background: 'var(--surface-container)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {[
                  { icon: '📄', text: 'Statements are generated in PDF format' },
                  { icon: '📊', text: 'Includes all transactions and financial summaries' },
                  { icon: '📅', text: 'Statements are generated on a monthly basis' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDownloadStatement}
                disabled={downloading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: '#fff', background: 'var(--primary)', border: 'none',
                  cursor: 'pointer', opacity: downloading ? 0.6 : 1,
                  boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
                  alignSelf: 'flex-start',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? 'Downloading…' : 'Download Statement (PDF)'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FinancialReportsPage
