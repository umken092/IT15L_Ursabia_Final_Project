import { useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Badge } from '@progress/kendo-react-indicators'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { DashboardCard } from '../../components/DashboardCard'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import {
  backupHistory,
  integrations,
  recentAuditActivities,
  securityPolicies,
  type BackupRecord,
  type SecurityPolicy,
} from '../../services/mockDashboardData'

type SettingsDialog = 'none' | 'security' | 'backup' | 'integrations' | 'audit'

export const SystemSettingsModule = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'super-admin'

  const [activeDialog, setActiveDialog] = useState<SettingsDialog>('none')
  const [policies, setPolicies] = useState<SecurityPolicy[]>(securityPolicies)
  const [backups, setBackups] = useState<BackupRecord[]>(backupHistory)
  const [busyAction, setBusyAction] = useState<'backup' | 'restore' | null>(null)
  const [message, setMessage] = useState('')

  const enabledPolicies = useMemo(() => policies.filter((item) => item.enabled).length, [policies])

  const closeDialog = () => setActiveDialog('none')

  const togglePolicy = (policyId: string) => {
    setPolicies((current) =>
      current.map((policy) =>
        policy.id === policyId
          ? {
              ...policy,
              enabled: !policy.enabled,
            }
          : policy,
      ),
    )
  }

  const runBackupNow = () => {
    setBusyAction('backup')
    const now = new Date()

    setTimeout(() => {
      const id = `BKP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(backups.length + 1).padStart(2, '0')}`
      const timestamp = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })

      setBackups((current) => [
        {
          id,
          timestamp,
          status: 'success',
          size: '2.4 GB',
          duration: '16 minutes',
        },
        ...current,
      ])
      setBusyAction(null)
      setMessage('Manual backup completed successfully.')
    }, 1200)
  }

  const restoreFromLatest = () => {
    setBusyAction('restore')

    setTimeout(() => {
      setBusyAction(null)
      setMessage('Restore completed from the latest successful backup.')
    }, 1200)
  }

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} - {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Security Policies">
          <div className="kpi-card">
            <div className="kpi-title">Enabled Policies</div>
            <div className="kpi-value">{enabledPolicies}/{policies.length}</div>
            <p className="kpi-subtitle">Policy enforcement status</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Integrations">
          <div className="kpi-card">
            <div className="kpi-title">Connected Services</div>
            <div className="kpi-value">{integrations.length}</div>
            <p className="kpi-subtitle">Active + inactive endpoints</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Audit Logs">
          <div className="kpi-card">
            <div className="kpi-title">Recent Activities</div>
            <div className="kpi-value">{recentAuditActivities.length}</div>
            <p className="kpi-subtitle">Latest events available</p>
          </div>
        </DashboardCard>
      </div>

      <div className="quick-actions">
        <Button themeColor="secondary" onClick={() => setActiveDialog('security')}>
          Security Policy
        </Button>
        <Button onClick={() => setActiveDialog('backup')}>Backup & Restore</Button>
        <Button onClick={() => setActiveDialog('integrations')}>View Integrations</Button>
        <Button onClick={() => setActiveDialog('audit')}>Audit Logs</Button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)',
            background: 'color-mix(in srgb, var(--success) 12%, transparent)',
            color: 'var(--text)',
            padding: '0.8rem 1rem',
            borderRadius: '10px',
          }}
        >
          {message}
        </div>
      )}

      {activeDialog === 'security' && (
        <Dialog title="Security Policy" onClose={closeDialog}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {policies.map((policy) => (
              <div
                key={policy.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  padding: '0.75rem 0',
                  display: 'grid',
                  gap: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <strong>{policy.name}</strong>
                  <Badge themeColor={policy.enabled ? 'success' : 'warning'}>
                    {policy.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <span className="card-subtitle">{policy.description}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{policy.value}</span>
                <div>
                  <Button size="small" onClick={() => togglePolicy(policy.id)}>
                    {policy.enabled ? 'Disable Policy' : 'Enable Policy'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={closeDialog}>Save Changes</Button>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {activeDialog === 'backup' && (
        <Dialog title="Backup & Restore" onClose={closeDialog}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="quick-actions" style={{ marginBottom: 0 }}>
              <Button
                themeColor="primary"
                disabled={busyAction !== null}
                onClick={runBackupNow}
              >
                {busyAction === 'backup' ? 'Running backup...' : 'Run Backup Now'}
              </Button>
              <Button
                disabled={busyAction !== null}
                onClick={restoreFromLatest}
              >
                {busyAction === 'restore' ? 'Restoring...' : 'Restore Latest Backup'}
              </Button>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {backups.map((backup) => (
                <div key={backup.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.65rem 0.75rem' }}>
                  <div className="kpi-with-arrow">
                    <strong>{backup.id}</strong>
                    <Badge themeColor={backup.status === 'success' ? 'success' : 'warning'}>{backup.status}</Badge>
                  </div>
                  <div className="card-subtitle">{backup.timestamp}</div>
                  <div className="card-subtitle">{backup.size} · {backup.duration}</div>
                </div>
              ))}
            </div>
          </div>
          <DialogActionsBar>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {activeDialog === 'integrations' && (
        <Dialog title="View Integrations" onClose={closeDialog}>
          <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
            {integrations.map((integration) => (
              <div key={integration.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' }}>
                <div className="kpi-with-arrow">
                  <strong>{integration.name}</strong>
                  <Badge
                    themeColor={
                      integration.status === 'active'
                        ? 'success'
                        : integration.status === 'error'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {integration.status}
                  </Badge>
                </div>
                <div className="card-subtitle">{integration.endpoint}</div>
                <div className="card-subtitle">Last sync: {integration.lastSync}</div>
              </div>
            ))}
          </div>
          <DialogActionsBar>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {activeDialog === 'audit' && (
        <Dialog title="Audit Logs" onClose={closeDialog}>
          <ul className="plain-list" style={{ paddingLeft: '1.1rem' }}>
            {recentAuditActivities.map((activity) => (
              <li key={activity}>{activity}</li>
            ))}
          </ul>
          <DialogActionsBar>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}
