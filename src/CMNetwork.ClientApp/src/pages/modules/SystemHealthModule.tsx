import { useCallback, useEffect, useState } from 'react'
import {
  adminService,
  type AdminApiStat,
  type AdminHealthCheck,
  type AdminRequestLog,
} from '../../services/adminService'

type ConnStatus = 'checking' | 'ok' | 'error'

const methodColor: Record<string, string> = {
  GET: 'sh-m-get',
  POST: 'sh-m-post',
  PUT: 'sh-m-put',
  DELETE: 'sh-m-delete',
  PATCH: 'sh-m-patch',
}

const httpStatusClass = (code: number) => {
  if (code < 300) return 'sh-sc-ok'
  if (code < 400) return 'sh-sc-redirect'
  if (code < 500) return 'sh-sc-client'
  return 'sh-sc-server'
}

const trendIcon: Record<AdminApiStat['trend'], string> = {
  up: '▲',
  down: '▼',
  neutral: '-',
}

const trendClass: Record<AdminApiStat['trend'], string> = {
  up: 'sh-trend-up',
  down: 'sh-trend-down',
  neutral: 'sh-trend-neutral',
}

const dotClass = (status: ConnStatus) => {
  if (status === 'ok') return 'sh-dot-ok'
  if (status === 'error') return 'sh-dot-error'
  return 'sh-dot-checking'
}

const statusLabel = (status: ConnStatus) => {
  if (status === 'ok') return 'Connected'
  if (status === 'error') return 'Error'
  return 'Checking...'
}

const bannerClass = (checking: boolean, checks: AdminHealthCheck[]) => {
  if (checking) return 'sh-banner-checking'
  if (checks.some((check) => check.status === 'error')) return 'sh-banner-error'
  return 'sh-banner-ok'
}

const bannerText = (
  checking: boolean,
  checks: AdminHealthCheck[],
  error: string | null,
) => {
  if (checking) return 'Loading live system health...'
  if (error) return error
  if (checks.some((check) => check.status === 'error')) {
    return 'One or more services are unreachable.'
  }
  if (checks.length > 0) return 'All monitored services are reachable.'
  return 'No health data returned by the API.'
}

export const SystemHealthModule = () => {
  const [checks, setChecks] = useState<AdminHealthCheck[]>([])
  const [stats, setStats] = useState<AdminApiStat[]>([])
  const [log, setLog] = useState<AdminRequestLog[]>([])
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const result = await adminService.getSystemHealth()
      setChecks(result.checks)
      setStats(result.stats)
      setLog(result.recentRequests)
      setLastChecked(new Date().toLocaleTimeString())
    } catch {
      setChecks([])
      setStats([])
      setLog([])
      setError('Unable to load live system health from the server.')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const displayedChecks:
    Array<AdminHealthCheck | {
      name: string
      status: 'checking'
      latencyMs: number
      message: string
    }> =
    checking && checks.length === 0
      ? [{
        name: 'Loading health checks',
        status: 'checking',
        latencyMs: 0,
        message: '',
      }]
      : checks

  return (
    <div className="sh-scene">
      <div className="sh-page-header">
        <div>
          <h1 className="sh-page-title">System Health</h1>
          <p className="sh-page-sub">
            Monitor database connectivity and live API request statistics.
          </p>
        </div>
        <div className="sh-header-right">
          {lastChecked && <span className="sh-last-checked">Last checked: {lastChecked}</span>}
          <button className="sh-btn-primary" disabled={checking} onClick={() => { void loadHealth() }}>
            {checking ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={`sh-status-banner ${bannerClass(checking, checks)}`}>
        <span className="sh-banner-dot" />
        <span className="sh-banner-text">{bannerText(checking, checks, error)}</span>
      </div>

      <div className="sh-card">
        <div className="sh-card-header">
          <span className="sh-card-icon">DB</span>
          <div>
            <h2 className="sh-card-title">Service Connectivity</h2>
            <p className="sh-card-sub">Live probes against CMNetwork server dependencies.</p>
          </div>
        </div>

        <div className="sh-db-list">
          {displayedChecks.map((check) => (
            <div key={check.name} className="sh-db-row">
              <div className="sh-db-left">
                <span className={`sh-db-dot ${dotClass(check.status)}`} />
                <span className="sh-db-name">{check.name}</span>
              </div>
              <div className="sh-db-right">
                {check.status === 'checking' ? (
                  <span className="sh-db-pending">Checking...</span>
                ) : (
                  <>
                    <span className={`sh-db-badge ${check.status === 'ok' ? 'sh-badge-ok' : 'sh-badge-error'}`}>
                      {statusLabel(check.status)}
                    </span>
                    <span className="sh-db-latency">{check.latencyMs} ms</span>
                    {check.message && <span className="sh-db-msg">{check.message}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sh-card">
        <div className="sh-card-header">
          <span className="sh-card-icon">API</span>
          <div>
            <h2 className="sh-card-title">API Request Statistics</h2>
            <p className="sh-card-sub">Aggregated from audited API traffic.</p>
          </div>
        </div>

        <div className="sh-stats-grid">
          {stats.length === 0 && !checking ? (
            <div className="sh-stat-card">
              <span className="sh-stat-value">0</span>
              <span className="sh-stat-label">No request metrics available</span>
              <span className="sh-stat-trend sh-trend-neutral">- Awaiting API traffic</span>
            </div>
          ) : (
            stats.map((stat) => (
              <div key={stat.label} className="sh-stat-card">
                <span className="sh-stat-value">{stat.value}</span>
                <span className="sh-stat-label">{stat.label}</span>
                <span className={`sh-stat-trend ${trendClass[stat.trend]}`}>
                  {trendIcon[stat.trend]} {stat.sub}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="sh-log-table-wrap">
          <table className="sh-log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr>
                  <td colSpan={5}>No audited API requests in the selected window.</td>
                </tr>
              ) : (
                log.map((entry, index) => (
                  <tr key={entry.id ?? `${entry.timestamp}-${entry.method}-${entry.path}-${entry.status}-${entry.durationMs}-${index}`}>
                    <td className="sh-log-time">{entry.timestamp}</td>
                    <td>
                      <span className={`sh-method-badge ${methodColor[entry.method] ?? 'sh-m-get'}`}>
                        {entry.method}
                      </span>
                    </td>
                    <td className="sh-log-path">{entry.path}</td>
                    <td>
                      <span className={`sh-status-badge ${httpStatusClass(entry.status)}`}>{entry.status}</span>
                    </td>
                    <td className="sh-log-dur">{entry.durationMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
