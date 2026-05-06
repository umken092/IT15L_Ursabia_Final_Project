import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { adminService, type AdminReports } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

type ExportFormat = 'csv' | 'xlsx' | 'pdf'

const EMPTY_REPORTS: AdminReports = {
  usageRows: [],
  moduleUsage: [],
  peakHours: [],
  licenseLimit: 0,
  licenseUsers: [],
}

const SectionCard = ({
  icon,
  title,
  sub,
  children,
  action,
}: {
  icon: string
  title: string
  sub: string
  children: ReactNode
  action?: ReactNode
}) => (
  <div className="ar-card">
    <div className="ar-card-header">
      <div className="ar-card-header-left">
        <span className="ar-card-icon">{icon}</span>
        <div>
          <h2 className="ar-card-title">{title}</h2>
          <p className="ar-card-sub">{sub}</p>
        </div>
      </div>
      {action && <div className="ar-card-action">{action}</div>}
    </div>
    <div className="ar-card-body">{children}</div>
  </div>
)

const downloadBlobFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const barClass = (pct: number) => {
  if (pct >= 90) return 'ar-bar-danger'
  if (pct >= 70) return 'ar-bar-warn'
  return 'ar-bar-ok'
}

const badgeClass = (pct: number) => {
  if (pct >= 90) return 'ar-badge-danger'
  if (pct >= 70) return 'ar-badge-warn'
  return 'ar-badge-ok'
}

export const AdminReportsModule = () => {
  const pushToast = useNotificationStore((state) => state.push)
  const [reports, setReports] = useState<AdminReports>(EMPTY_REPORTS)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setReports(await adminService.getSystemReports())
    } catch {
      setReports(EMPTY_REPORTS)
      setLoadError('Unable to load live system reports from the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports()
  }, [loadReports])

  const activeCount = reports.licenseUsers.filter((user) => user.status === 'active').length
  const licenseLimit = Math.max(activeCount, reports.licenseLimit)
  const licencePct =
    licenseLimit === 0
      ? 0
      : Math.min(Math.round((activeCount / licenseLimit) * 100), 100)
  const licenceBarClass = barClass(licencePct)
  const licenceBadgeClass = badgeClass(licencePct)

  const peakMax = useMemo(
    () => Math.max(1, ...reports.peakHours.map((hour) => hour.requests)),
    [reports.peakHours],
  )

  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      const file = await adminService.exportSystemReports(format)
      downloadBlobFile(file.blob, file.filename)
      pushToast('success', `System Usage Report exported as ${format.toUpperCase()}.`)
    } catch {
      pushToast('error', `Unable to export ${format.toUpperCase()} report.`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="ar-scene">
      <div className="ar-page-header">
        <h1 className="ar-page-title">System Reports</h1>
        <p className="ar-page-sub">
          Analyse usage patterns and track license consumption across the organisation.
        </p>
      </div>

      {loadError && <p className="ar-license-warn">{loadError}</p>}

      <SectionCard
        icon="REP"
        title="System Usage Report"
        sub="User logins, most-used modules, and peak usage times from live audit data."
        action={
          <div className="ar-export-row">
            <button className="ar-export-btn" disabled={loading} onClick={() => { void loadReports() }}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                className="ar-export-btn"
                disabled={exporting !== null || reports.usageRows.length === 0}
                onClick={() => { void handleExport(fmt) }}
              >
                {exporting === fmt ? 'Exporting...' : `Download ${fmt.toUpperCase()}`}
              </button>
            ))}
          </div>
        }
      >
        <h3 className="ar-sub-heading">User Login Log</h3>
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Logins</th>
                <th>Top Module</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {reports.usageRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>{loading ? 'Loading live usage rows...' : 'No login data recorded.'}</td>
                </tr>
              ) : (
                reports.usageRows.map((row) => (
                  <tr key={row.user}>
                    <td className="ar-td-user">{row.user}</td>
                    <td><span className="ar-role-chip">{row.role}</span></td>
                    <td className="ar-td-num">{row.logins}</td>
                    <td>{row.topModule}</td>
                    <td className="ar-td-date">{row.lastLogin}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 className="ar-sub-heading" style={{ marginTop: '1.5rem' }}>Most-Used Modules</h3>
        <div className="ar-module-bars">
          {reports.moduleUsage.length === 0 ? (
            <p className="ar-td-date">No audited module activity recorded.</p>
          ) : (
            reports.moduleUsage.map((item) => (
              <div key={item.module} className="ar-module-row">
                <span className="ar-module-name">{item.module}</span>
                <div className="ar-bar-track">
                  <div className="ar-bar-fill ar-bar-ok" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="ar-module-count">{item.sessions}</span>
              </div>
            ))
          )}
        </div>

        <h3 className="ar-sub-heading" style={{ marginTop: '1.5rem' }}>Peak Usage Times (Today)</h3>
        <div className="ar-peak-chart">
          {reports.peakHours.length === 0 ? (
            <p className="ar-td-date">No peak-hour data recorded today.</p>
          ) : (
            reports.peakHours.map((hour) => {
              const heightPct = Math.round((hour.requests / peakMax) * 100)
              return (
                <div key={hour.hour} className="ar-peak-col">
                  <span className="ar-peak-val">{hour.requests}</span>
                  <div className="ar-peak-bar-wrap">
                    <div className="ar-peak-bar" style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="ar-peak-label">{hour.hour}</span>
                </div>
              )
            })
          )}
        </div>
      </SectionCard>

      <SectionCard icon="LIC" title="License Utilisation" sub="Track active users against the configured seat limit.">
        <div className="ar-license-summary">
          <div className="ar-license-numbers">
            <span className="ar-license-active">{activeCount}</span>
            <span className="ar-license-sep">/</span>
            <span className="ar-license-total">{licenseLimit}</span>
            <span className="ar-license-label">seats in use</span>
          </div>
          <span className={`ar-license-pct-badge ${licenceBadgeClass}`}>{licencePct}%</span>
        </div>

        <div className="ar-license-bar-track">
          <div className={`ar-bar-fill ${licenceBarClass}`} style={{ width: `${licencePct}%` }} />
        </div>

        {licencePct >= 90 && (
          <p className="ar-license-warn">
            Active users are approaching the configured seat limit.
          </p>
        )}

        <div className="ar-table-wrap" style={{ marginTop: '1.25rem' }}>
          <table className="ar-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {reports.licenseUsers.length === 0 ? (
                <tr>
                  <td colSpan={4}>{loading ? 'Loading live user data...' : 'No user records found.'}</td>
                </tr>
              ) : (
                reports.licenseUsers.map((user) => (
                  <tr key={user.name}>
                    <td className="ar-td-user">{user.name}</td>
                    <td><span className="ar-role-chip">{user.role}</span></td>
                    <td>
                      <span className={`ar-status-dot ${user.status === 'active' ? 'ar-dot-active' : 'ar-dot-inactive'}`} />
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </td>
                    <td className="ar-td-date">{user.lastSeen}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
