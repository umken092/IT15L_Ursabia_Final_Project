import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SkeletonKpiGrid } from '../../components/SkeletonCard'
import {
  adminService,
  type AdminJob,
  type AdminSystemHealth,
  type AdminUser,
  type AuditActivity,
  type BackupRecord,
  type IntegrationSetting,
  type AdminReports,
} from '../../services/adminService'
import { useAuthStore } from '../../store/authStore'

interface AuditRow {
  time: string
  user: string
  action: string
  detail: string
  badge: 'info' | 'success' | 'warning' | 'danger'
}

const friendlyAction = (action: string): string => {
  const value = action.toLowerCase()
  if (value === 'loginsucceeded' || value === 'login') return 'Signed in'
  if (value === 'loginfailed') return 'Failed login'
  if (value === 'loginmfachallenge') return 'MFA challenge'
  if (value === 'logout') return 'Signed out'
  if (value === 'get') return 'Viewed'
  if (value === 'post' || value === 'create') return 'Created'
  if (value === 'put' || value === 'update') return 'Updated'
  if (value === 'delete') return 'Deleted'
  if (value === 'export') return 'Exported'
  return action
}

const friendlyEntity = (entity: string): string => {
  if (!entity) return 'System'
  const value = entity.toLowerCase()
  if (value.includes('/api/admin/users')) return 'User Management'
  if (value.includes('/api/admin/integrations')) return 'Integrations'
  if (value.includes('/api/admin/security-policies')) return 'Security Policies'
  if (value.includes('/api/admin/backups')) return 'Backups'
  if (value.includes('/api/admin/audit')) return 'Audit Logs'
  if (value.includes('/api/auth')) return 'Authentication'
  if (value.includes('/api/')) return 'System API'
  if (value === 'auth') return 'Authentication'
  if (value === 'apinvoice') return 'AP Invoice'
  if (value === 'arinvoice') return 'AR Invoice'
  if (value === 'journalentry') return 'Journal Entry'
  if (value === 'user') return 'User'
  if (value === 'department') return 'Department'
  return entity
}

const actionBadge = (action: string): AuditRow['badge'] => {
  const value = action.toLowerCase()
  if (value === 'loginfailed') return 'danger'
  if (value === 'loginsucceeded' || value === 'login') return 'success'
  if (value === 'logout' || value === 'loginmfachallenge') return 'info'
  if (value === 'delete') return 'danger'
  if (value === 'post' || value === 'create' || value === 'put' || value === 'update') {
    return 'warning'
  }
  return 'info'
}

const mapAuditRow = (activity: AuditActivity): AuditRow => ({
  time: new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  user: activity.user?.length > 20 ? 'system' : (activity.user || 'system'),
  action: friendlyAction(activity.action),
  detail: `${friendlyAction(activity.action)} · ${friendlyEntity(activity.entity)}`,
  badge: actionBadge(activity.action),
})

const getLicenseColor = (pct: number): string => {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#22c55e'
}

const integrationIcon = (name: string): string => {
  const value = name.toLowerCase()
  if (value.includes('paymongo')) return '💳'
  if (value.includes('paypal')) return '🅿️'
  if (value.includes('smtp') || value.includes('email') || value.includes('mail')) return '📧'
  if (value.includes('slack')) return '💬'
  if (value.includes('aws')) return '☁️'
  return '🔌'
}

const integrationPillClass = (status: string): string => {
  if (status === 'active') return 'sad-pill-ok'
  if (status === 'error') return 'sad-pill-err'
  return 'sad-pill-off'
}

const integrationLabel = (status: string): string => {
  if (status === 'active') return 'Connected'
  if (status === 'error') return 'Error'
  return 'Disconnected'
}

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const IconServer = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
)

const IconUsers = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconJobs = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconDatabase = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
)

const IconShield = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const IconBolt = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const IconGear = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconLog = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
  </svg>
)

// NOSONAR - Dashboard composition intentionally keeps sections inline for maintainability.
export const SuperAdminDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([])
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [health, setHealth] = useState<AdminSystemHealth | null>(null)
  const [reports, setReports] = useState<AdminReports | null>(null)
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date())
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const failures: string[] = []

      const [
        usersRes,
        integrationsRes,
        backupsRes,
        auditRes,
        healthRes,
        reportsRes,
        jobsRes,
      ] = await Promise.allSettled([
        adminService.getUsers(),
        adminService.getIntegrations(),
        adminService.getBackups(),
        adminService.getAuditActivities(),
        adminService.getSystemHealth(),
        adminService.getSystemReports(),
        adminService.getJobs(),
      ])

      if (cancelled) return

      if (usersRes.status === 'fulfilled') setUsers(usersRes.value)
      else failures.push('users')

      if (integrationsRes.status === 'fulfilled') setIntegrations(integrationsRes.value)
      else failures.push('integrations')

      if (backupsRes.status === 'fulfilled') setBackups(backupsRes.value)
      else failures.push('backups')

      if (auditRes.status === 'fulfilled') setAuditRows(auditRes.value.slice(0, 8).map(mapAuditRow))
      else failures.push('audit activities')

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
      else failures.push('system health')

      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value)
      else failures.push('system reports')

      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value)
      else failures.push('job queue')

      setErrors(failures)
      setRefreshedAt(new Date())
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const handleBackupNow = async () => {
    setBackingUp(true)
    try {
      await adminService.runBackup()
      const latestBackups = await adminService.getBackups()
      setBackups(latestBackups)
      setRefreshedAt(new Date())
    } catch {
      setErrors((current) => {
        if (current.includes('backups')) return current
        return [...current, 'backups']
      })
    } finally {
      setBackingUp(false)
    }
  }

  const activeUsers = users.filter((row) => row.status === 'active').length
  const totalUsers = users.length

  const lastBackup = backups[0]
  const backupStatus = lastBackup?.status ?? 'No backup records returned'
  const backupOk = backupStatus.toLowerCase().includes('success')
    || backupStatus.toLowerCase().includes('ok')
    || !lastBackup
  const backupTime = lastBackup
    ? new Date(lastBackup.timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null
  const backupSize = lastBackup?.size ?? null

  const healthChecks = health?.checks ?? []

  const jobsRunning = jobs.filter((row) => row.status === 'running').length
  const jobsScheduled = jobs.filter((row) => row.status === 'scheduled').length
  const jobsSucceeded = jobs.filter((row) => row.status === 'succeeded').length
  const jobsFailed = jobs.filter((row) => row.status === 'failed').length

  const licenseUsersActive = reports?.licenseUsers.filter((row) => row.status === 'active').length ?? activeUsers
  const licenseLimit = Math.max(licenseUsersActive, reports?.licenseLimit ?? totalUsers)
  const licensePercent =
    licenseLimit === 0
      ? 0
      : Math.min(Math.round((licenseUsersActive / licenseLimit) * 100), 100)
  const licenseColor = getLicenseColor(licensePercent)

  const recentAlerts = useMemo(() => {
    const critical = auditRows.filter((row) => row.badge === 'danger')
    return critical.length > 0 ? critical : auditRows
  }, [auditRows])

  const activityData = useMemo(
    () => (reports?.peakHours ?? []).map((row) => ({ label: row.hour, value: row.requests })),
    [reports],
  )

  return (
    <section className="dashboard-scene super-admin-dashboard sad-scene">
      <div className="sad-page-header">
        <div>
          <h1 className="sad-page-title">Welcome, {user?.fullName ?? 'Super Admin'}</h1>
          <p className="sad-page-sub">Admin Command Centre · System Overview</p>
        </div>
        <span className="sad-refreshed-at">Refreshed {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {errors.length > 0 && (
        <p className="sad-card-sub">Some live sections are unavailable: {errors.join(', ')}.</p>
      )}

      {loading ? <SkeletonKpiGrid count={4} /> : (
        <>
          <div className="sad-kpi-row">
            <div className="sad-kpi-card">
              <div className="sad-kpi-icon sad-icon-blue"><IconServer /></div>
              <div className="sad-kpi-body">
                <p className="sad-kpi-label">System Health</p>
                <div className="sad-health-list">
                  {healthChecks.length === 0 ? (
                    <p className="sad-kpi-sub">No live health checks returned.</p>
                  ) : (
                    healthChecks.map((check) => {
                      const isOk = check.status === 'ok'
                      return (
                        <div key={check.name} className="sad-health-row">
                          <span className={`sad-health-dot ${isOk ? 'sad-dot-up' : 'sad-dot-down'}`} />
                          <span className="sad-health-name">{check.name}</span>
                          <span className={`sad-health-badge ${isOk ? 'sad-badge-up' : 'sad-badge-down'}`}>
                            {isOk ? 'Online' : 'Down'}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="sad-kpi-card">
              <div className="sad-kpi-icon sad-icon-indigo"><IconUsers /></div>
              <div className="sad-kpi-body">
                <p className="sad-kpi-label">Active Users</p>
                <p className="sad-kpi-value">{activeUsers}</p>
                <p className="sad-kpi-sub">{totalUsers} total accounts</p>
              </div>
            </div>

            <div className="sad-kpi-card">
              <div className="sad-kpi-icon sad-icon-violet"><IconJobs /></div>
              <div className="sad-kpi-body">
                <p className="sad-kpi-label">Background Jobs</p>
                <div className="sad-jobs-grid">
                  <span className="sad-job-pill sad-jp-running">{jobsRunning} Running</span>
                  <span className="sad-job-pill sad-jp-scheduled">{jobsScheduled} Scheduled</span>
                  <span className="sad-job-pill sad-jp-done">{jobsSucceeded} Done</span>
                  <span className="sad-job-pill sad-jp-failed">{jobsFailed} Failed</span>
                </div>
              </div>
            </div>

            <div className="sad-kpi-card sad-backup-card">
              <div className={`sad-kpi-icon ${backupOk ? 'sad-icon-green' : 'sad-icon-red'}`}><IconDatabase /></div>
              <div className="sad-kpi-body">
                <p className="sad-kpi-label">Last Backup</p>
                <p className={`sad-kpi-value-sm ${backupOk ? 'sad-val-ok' : 'sad-val-err'}`}>{backupStatus}</p>
                {backupTime && <p className="sad-kpi-sub">{backupTime}{backupSize ? ` · ${backupSize}` : ''}</p>}
                <button
                  type="button"
                  className="sad-backup-btn"
                  disabled={backingUp}
                  onClick={() => { void handleBackupNow() }}
                >
                  {backingUp ? 'Running...' : 'Backup Now'}
                </button>
              </div>
            </div>
          </div>

          <div className="sad-row2">
            <div className="sad-card">
              <h3 className="sad-card-title">Integration Status</h3>
              <ul className="sad-integ-list">
                {integrations.length === 0 ? (
                  <li className="sad-integ-row">
                    <span className="sad-integ-name">No integrations configured</span>
                  </li>
                ) : (
                  integrations.map((integration) => (
                    <li key={integration.id} className="sad-integ-row">
                      <span className="sad-integ-icon">{integrationIcon(integration.name)}</span>
                      <span className="sad-integ-name">{integration.name}</span>
                      <span className={`sad-integ-pill ${integrationPillClass(integration.status)}`}>
                        {integrationLabel(integration.status)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                className="sad-link-btn"
                onClick={() => navigate('/module/system-settings#integrations')}
              >
                Manage integrations →
              </button>
            </div>

            <div className="sad-card">
              <div className="sad-card-title-row">
                <h3 className="sad-card-title">Audit Log Alerts</h3>
                <span className="sad-live-dot-badge">Live</span>
              </div>
              <p className="sad-card-sub">Critical events in the last 24 hours</p>
              {recentAlerts.length === 0 ? (
                <p className="sad-empty-hint">No recent alerts</p>
              ) : (
                <ul className="sad-alert-list">
                  {recentAlerts.slice(0, 6).map((row, idx) => (
                    <li key={`${row.time}-${idx}`} className="sad-alert-item">
                      <span className={`sad-alert-badge sad-ab-${row.badge}`}>{row.action}</span>
                      <div className="sad-alert-info">
                        <span className="sad-alert-detail">{row.detail}</span>
                        <span className="sad-alert-time">{row.time}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="sad-link-btn"
                onClick={() => navigate('/module/system-settings#audit-logs')}
              >
                View all audit logs →
              </button>
            </div>
          </div>

          <div className="sad-row3">
            <div className="sad-card sad-license-card">
              <h3 className="sad-card-title">User License Usage</h3>
              <div className="sad-license-top">
                <span className="sad-license-used">{licenseUsersActive}</span>
                <span className="sad-license-sep">/ {licenseLimit} seats</span>
                <span className="sad-license-pct" style={{ color: licenseColor }}>{licensePercent}%</span>
              </div>
              <div className="sad-progress-track">
                <div
                  className="sad-progress-bar"
                  style={{ width: `${licensePercent}%`, background: licenseColor }}
                />
              </div>
              <p className="sad-license-sub">
                {licenseLimit - licenseUsersActive} {(licenseLimit - licenseUsersActive) === 1 ? 'seat' : 'seats'} available
                {licensePercent >= 90 && <span className="sad-license-warn"> · Approaching limit</span>}
              </p>
            </div>

            <div className="sad-card">
              <h3 className="sad-card-title">Quick Actions</h3>
              <div className="sad-qa-grid">
                <button type="button" className="sad-qa-btn" onClick={() => navigate('/module/user-management')}>
                  <IconUsers /><span>Add New User</span>
                </button>
                <button type="button" className="sad-qa-btn" onClick={() => navigate('/module/system-settings#fiscal-periods')}>
                  <IconGear /><span>Fiscal Periods</span>
                </button>
                <button type="button" className="sad-qa-btn" onClick={() => navigate('/module/system-settings#audit-logs')}>
                  <IconLog /><span>View Audit Logs</span>
                </button>
                <button type="button" className="sad-qa-btn" onClick={() => navigate('/module/system-settings#security-policy')}>
                  <IconShield /><span>Security Policy</span>
                </button>
                <button
                  type="button"
                  className="sad-qa-btn sad-qa-btn-primary"
                  disabled={backingUp}
                  onClick={() => { void handleBackupNow() }}
                >
                  <IconBolt /><span>{backingUp ? 'Running...' : 'Run Backup'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="sad-card sad-chart-card">
            <h3 className="sad-card-title">System Activity <span className="sad-chart-sub">— API requests per hour</span></h3>
            {activityData.length === 0 ? (
              <p className="sad-card-sub">No live API activity data available for today.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activityData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sadActivityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D63C1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1D63C1" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip formatter={(value) => [`${value ?? 0} requests`, 'Requests']} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1D63C1"
                    fill="url(#sadActivityGrad)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </section>
  )
}
