import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { adminService, type AdminJob } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

type FilterTab = 'all' | 'recurring' | 'scheduled' | 'failed'

const statusLabel: Record<AdminJob['status'], string> = {
  running: 'Running',
  scheduled: 'Scheduled',
  succeeded: 'Succeeded',
  failed: 'Failed',
  recurring: 'Recurring',
}

const typeLabel: Record<AdminJob['type'], string> = {
  recurring: 'Recurring',
  scheduled: 'Scheduled',
  'ad-hoc': 'Ad-hoc',
}

const statusClass: Record<AdminJob['status'], string> = {
  running: 'jq-s-running',
  scheduled: 'jq-s-scheduled',
  succeeded: 'jq-s-succeeded',
  failed: 'jq-s-failed',
  recurring: 'jq-s-recurring',
}

const typeClass: Record<AdminJob['type'], string> = {
  recurring: 'jq-t-recurring',
  scheduled: 'jq-t-scheduled',
  'ad-hoc': 'jq-t-adhoc',
}

export const JobQueueModule = () => {
  const pushToast = useNotificationStore((state) => state.push)
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [showTriggerDialog, setShowTriggerDialog] = useState(false)
  const [triggerKey, setTriggerKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [workingJobId, setWorkingJobId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await adminService.getJobs()
      setJobs(result)
      const firstRecurring = result.find((job) => job.type === 'recurring')
      setTriggerKey((current) => current || firstRecurring?.id || '')
    } catch {
      setJobs([])
      setLoadError('Unable to load live background jobs from Hangfire.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const filtered = jobs.filter((job) => {
    if (filter === 'all') return true
    if (filter === 'recurring') return job.type === 'recurring'
    if (filter === 'scheduled') return job.type === 'scheduled'
    if (filter === 'failed') return job.status === 'failed'
    return true
  })

  const counts = useMemo(() => ({
    all: jobs.length,
    recurring: jobs.filter((job) => job.type === 'recurring').length,
    scheduled: jobs.filter((job) => job.type === 'scheduled').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  }), [jobs])

  const runningCount = jobs.filter((job) => job.status === 'running').length
  const failedCount = jobs.filter((job) => job.status === 'failed').length
  const recurringJobs = jobs.filter((job) => job.type === 'recurring')

  const handleRetry = async (id: string) => {
    setWorkingJobId(id)
    try {
      await adminService.retryJob(id)
      pushToast('success', 'Failed job requeued.')
      await loadJobs()
    } catch {
      pushToast('error', 'Unable to retry the selected job.')
    } finally {
      setWorkingJobId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setWorkingJobId(id)
    try {
      await adminService.deleteJob(id)
      pushToast('success', 'Job removed from Hangfire storage.')
      await loadJobs()
    } catch {
      pushToast('error', 'Unable to delete the selected job.')
    } finally {
      setWorkingJobId(null)
    }
  }

  const handleTrigger = async () => {
    if (!triggerKey) return
    setWorkingJobId(triggerKey)
    try {
      await adminService.triggerJob(triggerKey)
      setShowTriggerDialog(false)
      pushToast('success', 'Recurring job triggered.')
      await loadJobs()
    } catch {
      pushToast('error', 'Unable to trigger the selected recurring job.')
    } finally {
      setWorkingJobId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedJob((current) => (current === id ? null : id))
  }

  return (
    <div className="jq-scene">
      <div className="jq-page-header">
        <div>
          <h1 className="jq-page-title">Job Queue</h1>
          <p className="jq-page-sub">
            Monitor live Hangfire jobs, manually trigger recurring tasks, and manage failed runs.
          </p>
        </div>
        <div className="jq-actions-row">
          <button className="jq-btn-secondary" disabled={loading} onClick={() => { void loadJobs() }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="jq-btn-primary" disabled={recurringJobs.length === 0} onClick={() => setShowTriggerDialog(true)}>
            Trigger Job
          </button>
        </div>
      </div>

      {loadError && <p className="jq-empty">{loadError}</p>}

      <div className="jq-stats-row">
        <div className="jq-stat-card">
          <span className="jq-stat-value">{jobs.length}</span>
          <span className="jq-stat-label">Total Jobs</span>
        </div>
        <div className="jq-stat-card">
          <span className={`jq-stat-value ${runningCount > 0 ? 'jq-val-running' : ''}`}>{runningCount}</span>
          <span className="jq-stat-label">Running</span>
        </div>
        <div className="jq-stat-card">
          <span className={`jq-stat-value ${failedCount > 0 ? 'jq-val-failed' : ''}`}>{failedCount}</span>
          <span className="jq-stat-label">Failed</span>
        </div>
        <div className="jq-stat-card">
          <span className="jq-stat-value">{jobs.filter((job) => job.status === 'succeeded').length}</span>
          <span className="jq-stat-label">Succeeded</span>
        </div>
      </div>

      <div className="jq-card">
        <div className="jq-tabbar">
          {(['all', 'recurring', 'scheduled', 'failed'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`jq-tab${filter === tab ? ' jq-tab-active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'all' ? 'All Jobs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className={`jq-tab-count${tab === 'failed' && counts.failed > 0 ? ' jq-tab-count-danger' : ''}`}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="jq-empty">{loading ? 'Loading live jobs...' : 'No jobs in this category.'}</p>
        ) : (
          <ul className="jq-list">
            {filtered.map((job) => (
              <li key={job.id} className={`jq-item${job.status === 'failed' ? ' jq-item-failed' : ''}`}>
                <div className="jq-item-main">
                  <div className="jq-item-left">
                    <span className={`jq-status-dot jq-dot-${job.status}`} />
                    <div className="jq-item-info">
                      <span className="jq-item-name">{job.name}</span>
                      <div className="jq-item-meta">
                        <span className={`jq-type-badge ${typeClass[job.type]}`}>{typeLabel[job.type]}</span>
                        {job.cron && <code className="jq-cron">{job.cron}</code>}
                        <span className="jq-meta-sep">·</span>
                        <span className="jq-meta-text">Last run: {job.lastRun}</span>
                        {job.nextRun && (
                          <>
                            <span className="jq-meta-sep">·</span>
                            <span className="jq-meta-text">Next: {job.nextRun}</span>
                          </>
                        )}
                        {job.duration && (
                          <>
                            <span className="jq-meta-sep">·</span>
                            <span className="jq-meta-text">{job.duration}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="jq-item-right">
                    <span className={`jq-status-badge ${statusClass[job.status]}`}>
                      {job.status === 'running' && <span className="jq-spin" />}
                      {statusLabel[job.status]}
                    </span>

                    {job.status === 'failed' && (
                      <>
                        <button
                          className="jq-action-btn jq-btn-retry"
                          disabled={workingJobId === job.id}
                          onClick={() => { void handleRetry(job.id) }}
                        >
                          Retry
                        </button>
                        <button
                          className="jq-action-btn jq-btn-delete"
                          disabled={workingJobId === job.id}
                          onClick={() => { void handleDelete(job.id) }}
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {job.error && (
                      <button className="jq-expand-btn" aria-expanded={expandedJob === job.id} onClick={() => toggleExpand(job.id)}>
                        {expandedJob === job.id ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </div>

                {job.error && expandedJob === job.id && (
                  <div className="jq-error-box">
                    <strong>Error:</strong> {job.error}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showTriggerDialog && (
        <Dialog title="Trigger Recurring Job" onClose={() => setShowTriggerDialog(false)} width={460}>
          <div className="jq-dialog-body">
            {recurringJobs.length === 0 ? (
              <p className="jq-empty">No recurring jobs are registered in Hangfire.</p>
            ) : (
              <label className="jq-field" htmlFor="trigger-job-select">
                <span className="jq-label">Job</span>
                <select
                  id="trigger-job-select"
                  className="jq-select"
                  value={triggerKey}
                  onChange={(event) => setTriggerKey(event.target.value)}
                >
                  {recurringJobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <DialogActionsBar>
            <button className="jq-btn-ghost" onClick={() => setShowTriggerDialog(false)}>Cancel</button>
            <button
              className="jq-btn-primary"
              disabled={!triggerKey || workingJobId === triggerKey}
              onClick={() => { void handleTrigger() }}
            >
              {workingJobId === triggerKey ? 'Triggering...' : 'Trigger Now'}
            </button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
