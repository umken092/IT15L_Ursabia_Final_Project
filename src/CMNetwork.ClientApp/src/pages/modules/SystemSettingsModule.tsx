import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import { Badge } from '@progress/kendo-react-indicators'
import { DashboardCard } from '../../components/DashboardCard'
import {
  adminService,
  type BackupRecord,
  type IntegrationSetting,
  type SecurityPolicy,
} from '../../services/adminService'
import { auditLogsService } from '../../services/extendedOperationsService'
import { useNotificationStore } from '../../store/notificationStore'

type SettingsView = 'overview' | 'security' | 'backup' | 'integrations' | 'audit'

const viewByHash: Record<string, SettingsView> = {
  '#security-policy': 'security',
  '#backup-restore': 'backup',
  '#integrations': 'integrations',
  '#audit-logs': 'audit',
}

const viewTitle: Record<SettingsView, string> = {
  overview: 'System Settings',
  security: 'System Settings / Security Policy',
  backup: 'System Settings / Backup & Restore',
  integrations: 'System Settings / Integrations',
  audit: 'System Settings / Audit Logs',
}

const isPasswordPolicy = (policy: SecurityPolicy) => {
  const text = `${policy.name} ${policy.description}`.toLowerCase()
  return text.includes('password') || text.includes('mfa') || text.includes('login')
}

// Convert camelCase / snake_case / kebab-case keys into a friendly label.
const humanizeKey = (key: string): string => {
  const spaced = key
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const formatLeafValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="settings-policy-pill settings-policy-pill-muted">—</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={`settings-policy-pill ${value ? 'settings-policy-pill-on' : 'settings-policy-pill-off'}`}
      >
        {value ? 'Enabled' : 'Disabled'}
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className="settings-policy-pill settings-policy-pill-num">{value.toLocaleString()}</span>
  }
  if (typeof value === 'string') {
    return value.trim().length === 0
      ? <span className="settings-policy-pill settings-policy-pill-muted">empty</span>
      : <span className="settings-policy-pill">{value}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="settings-policy-pill settings-policy-pill-muted">none</span>
    }
    return (
      <span className="settings-policy-pill-group">
        {value.map((item, i) => {
          const text = String(item)
          return (
            <span key={`${i}-${text}`} className="settings-policy-pill">{text}</span>
          )
        })}
      </span>
    )
  }
  return <span className="settings-policy-pill">{JSON.stringify(value)}</span>
}

const renderPolicyFields = (obj: Record<string, unknown>): React.ReactNode => (
  <div className="settings-policy-fields">
    {Object.entries(obj).map(([k, v]) => (
      <div className="settings-policy-field" key={k}>
        <span className="settings-policy-field-key">{humanizeKey(k)}</span>
        <span className="settings-policy-field-val">{formatLeafValue(v)}</span>
      </div>
    ))}
  </div>
)

const renderPolicyValue = (rawValue: string): React.ReactNode => {
  if (!rawValue?.trim()) return null
  const trimmed = rawValue.trim()
  // Only attempt JSON parsing for object / array literals.
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return <p className="settings-policy-value">{rawValue}</p>
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return <p className="settings-policy-value">{rawValue}</p>
  }

  if (parsed === null || typeof parsed !== 'object') {
    const primitive = parsed as string | number | boolean | null
    return <p className="settings-policy-value">{primitive === null ? '' : String(primitive)}</p>
  }

  if (Array.isArray(parsed)) {
    return (
      <div className="settings-policy-tree">
        <div className="settings-policy-section">
          <div className="settings-policy-section-title">Items</div>
          {renderPolicyFields(Object.fromEntries(parsed.map((v, i) => [String(i + 1), v])))}
        </div>
      </div>
    )
  }

  const obj = parsed as Record<string, unknown>
  const sectionEntries = Object.entries(obj)
  const allSectionsAreObjects = sectionEntries.every(
    ([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v),
  )

  if (allSectionsAreObjects && sectionEntries.length > 0) {
    return (
      <div className="settings-policy-tree">
        {sectionEntries.map(([sectionKey, sectionVal]) => (
          <div className="settings-policy-section" key={sectionKey}>
            <div className="settings-policy-section-title">{humanizeKey(sectionKey)}</div>
            {renderPolicyFields(sectionVal as Record<string, unknown>)}
          </div>
        ))}
      </div>
    )
  }

  // Flat object — render as one field grid.
  return (
    <div className="settings-policy-tree">
      <div className="settings-policy-section">{renderPolicyFields(obj)}</div>
    </div>
  )
}

const isSessionPolicy = (policy: SecurityPolicy) => {
  const text = `${policy.name} ${policy.description}`.toLowerCase()
  return text.includes('session') || text.includes('timeout')
}

const getIntegrationThemeColor = (status: IntegrationSetting['status']) => {
  if (status === 'active') {
    return 'success'
  }

  if (status === 'error') {
    return 'error'
  }

  return 'warning'
}

interface AuditLogItem {
  id: string
  date: string
  rawDate: string
  user: string
  area: string
  action: string
  reviewed: boolean
  details?: string | null
}

interface AuditChange {
  field: string
  before: string
  after: string
}

const humanize = (value: string | null | undefined): string => {
  if (!value) return ''
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .trim()
}

const FRIENDLY_ACTIONS: Record<string, string> = {
  GET: 'Viewed',
  POST: 'Submitted',
  PUT: 'Updated',
  PATCH: 'Updated',
  DELETE: 'Deleted',
  LoginSucceeded: 'Sign-In Succeeded',
  LoginFailed: 'Sign-In Failed',
  Logout: 'Signed Out',
  Reviewed: 'Marked Reviewed',
  Exported: 'Exported',
}

const AREA_BY_PATH: Array<{ test: RegExp; label: string }> = [
  { test: /\/auth\/login/i, label: 'Sign-In' },
  { test: /\/auth\//i, label: 'Authentication' },
  { test: /\/admin\/users/i, label: 'User Management' },
  { test: /\/admin\/security-policies/i, label: 'Security Policy' },
  { test: /\/admin\/backups/i, label: 'Backup & Restore' },
  { test: /\/admin\/integrations/i, label: 'Integrations' },
  { test: /\/admin\/audit-logs/i, label: 'Audit Logs' },
  { test: /\/auditor\/evidence-archives/i, label: 'Evidence Archive' },
  { test: /\/general-ledger/i, label: 'General Ledger' },
  { test: /\/reports\//i, label: 'Reports' },
  { test: /\/vendors/i, label: 'Vendor Master' },
  { test: /\/customers/i, label: 'Customer Master' },
]

const FRIENDLY_ENTITY: Record<string, string> = {
  Auth: 'Authentication',
  ApplicationUser: 'User Account',
  AuditLogEntry: 'Audit Log',
  SecurityPolicy: 'Security Policy',
  JournalEntry: 'Journal Entry',
  APInvoice: 'AP Invoice',
  ARInvoice: 'AR Invoice',
}

const friendlyArea = (entity: string | null | undefined): string => {
  if (!entity) return ''
  const apiMatch = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i.exec(entity)
  if (apiMatch) {
    const path = apiMatch[2]
    const hit = AREA_BY_PATH.find((entry) => entry.test.test(path))
    return hit ? hit.label : 'System Activity'
  }
  return FRIENDLY_ENTITY[entity] ?? humanize(entity)
}

const friendlyAction = (action: string | null | undefined): string => {
  if (!action) return ''
  return FRIENDLY_ACTIONS[action] ?? humanize(action)
}

const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const HASH64_PATTERN = /\b[0-9a-f]{64}\b/i

const hiddenFieldKeys = new Set(['id', 'recordid', 'path', 'querystring', 'useragent', 'ipaddress', 'checksum', 'hash', 'filepath'])

const asDisplay = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return 'Unavailable'
  }
}

const isTechnicalValue = (value: string): boolean => GUID_PATTERN.test(value) || HASH64_PATTERN.test(value) || /\/api\//i.test(value)

const pickValue = (source: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (Object.hasOwn(source, key)) {
      return source[key]
    }
  }
  return undefined
}

const extractAuditChanges = (detailsJson: string | null | undefined): AuditChange[] => {
  if (!detailsJson) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(detailsJson)
  } catch {
    return []
  }

  const rows: AuditChange[] = []
  const seen = new Set<string>()

  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node === null || node === undefined) return
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1))
      return
    }
    if (typeof node !== 'object') return

    const obj = node as Record<string, unknown>
    const fieldRaw = pickValue(obj, ['field', 'Field', 'property', 'Property', 'propertyName', 'PropertyName', 'columnName', 'ColumnName', 'name', 'Name'])
    const beforeRaw = pickValue(obj, ['before', 'Before', 'old', 'Old', 'oldValue', 'OldValue', 'originalValue', 'OriginalValue', 'from', 'From'])
    const afterRaw = pickValue(obj, ['after', 'After', 'new', 'New', 'newValue', 'NewValue', 'currentValue', 'CurrentValue', 'to', 'To', 'value', 'Value'])

    if (beforeRaw !== undefined && afterRaw !== undefined) {
      const fieldName = typeof fieldRaw === 'string' ? fieldRaw : 'Value'
      const field = humanize(fieldName)
      const fieldKey = field.toLowerCase().replaceAll(' ', '')
      const before = asDisplay(beforeRaw)
      const after = asDisplay(afterRaw)
      if (before !== after && !hiddenFieldKeys.has(fieldKey) && !(isTechnicalValue(before) && isTechnicalValue(after))) {
        const key = `${field}|${before}|${after}`
        if (!seen.has(key)) {
          seen.add(key)
          rows.push({ field, before, after })
        }
      }
    }

    Object.values(obj).forEach((value) => visit(value, depth + 1))
  }

  visit(parsed, 0)
  return rows.slice(0, 12)
}

export const SystemSettingsModule = () => {
  const location = useLocation()
  const pushToast = useNotificationStore((state) => state.push)

  const [policies, setPolicies] = useState<SecurityPolicy[]>([])
  const [policyDraft, setPolicyDraft] = useState<Record<string, boolean>>({})
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null)
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([])
  const [showAuditSearch, setShowAuditSearch] = useState(false)
  const [auditFilter, setAuditFilter] = useState({ user: '', area: '', action: '' })
  const [busyAction, setBusyAction] = useState<'backup' | 'restore' | 'save-policies' | null>(null)
  const [message, setMessage] = useState('')
  const activeView: SettingsView = viewByHash[location.hash] ?? 'overview'

  const selectedAuditChanges = useMemo(
    () => extractAuditChanges(selectedAuditLog?.details),
    [selectedAuditLog],
  )

  const filteredAuditLogs = useMemo(
    () => auditLogs.filter((item) =>
      (!auditFilter.user || item.user.toLowerCase().includes(auditFilter.user.toLowerCase()))
      && (!auditFilter.area || item.area.toLowerCase().includes(auditFilter.area.toLowerCase()))
      && (!auditFilter.action || item.action.toLowerCase().includes(auditFilter.action.toLowerCase())),
    ),
    [auditFilter.action, auditFilter.area, auditFilter.user, auditLogs],
  )

  const unreviewedFilteredIds = useMemo(
    () => filteredAuditLogs.filter((item) => !item.reviewed).map((item) => item.id),
    [filteredAuditLogs],
  )

  const loadSettingsData = async () => {
    try {
      const [policyData, backupData, integrationData, auditRes] = await Promise.all([
        adminService.getSecurityPolicies(),
        adminService.getBackups(),
        adminService.getIntegrations(),
        auditLogsService.getLogs({ page: 1, pageSize: 50 }),
      ])

      const auditItems = ((auditRes.data as {
        items?: Array<{
          id: string
          createdUtc: string
          entity: string
          action: string
          userEmail?: string | null
          performedBy: string
          isReviewed: boolean
          details?: string | null
        }>
      } | undefined)?.items ?? []).map((item) => ({
        id: item.id,
        rawDate: item.createdUtc,
        date: new Date(item.createdUtc).toLocaleString(),
        user: item.userEmail || item.performedBy,
        area: friendlyArea(item.entity),
        action: friendlyAction(item.action),
        reviewed: item.isReviewed,
        details: item.details,
      }))

      setPolicies(policyData)
      setPolicyDraft(Object.fromEntries(policyData.map((policy) => [policy.id, policy.enabled])))
      setBackups(backupData)
      setIntegrations(integrationData)
      setAuditLogs(auditItems)
      retainSelectableAuditIds(auditItems)
    } catch {
      pushToast('error', 'Unable to load system settings data.')
    }
  }

  useEffect(() => {
    void loadSettingsData()
  }, [])

  const enabledPolicies = useMemo(() => policies.filter((item) => item.enabled).length, [policies])
  const passwordPolicies = useMemo(() => policies.filter((policy) => isPasswordPolicy(policy)), [policies])
  const sessionPolicies = useMemo(() => policies.filter((policy) => isSessionPolicy(policy)), [policies])
  const remainingPolicies = useMemo(
    () => policies.filter((policy) => !isPasswordPolicy(policy) && !isSessionPolicy(policy)),
    [policies],
  )

  const changedPolicyIds = useMemo(
    () =>
      policies
        .filter((policy) => policyDraft[policy.id] !== undefined && policyDraft[policy.id] !== policy.enabled)
        .map((policy) => policy.id),
    [policies, policyDraft],
  )

  const runBackupNow = async () => {
    setBusyAction('backup')

    try {
      await adminService.runBackup()
      await loadSettingsData()
      setBusyAction(null)
      setMessage('Manual backup completed successfully.')
    } catch {
      setBusyAction(null)
      pushToast('error', 'Backup operation failed.')
    }
  }

  const restoreFromLatest = async () => {
    setBusyAction('restore')

    try {
      await adminService.restoreLatestBackup()
      setBusyAction(null)
      setMessage('Restore completed from the latest successful backup.')
    } catch {
      setBusyAction(null)
      pushToast('error', 'Restore operation failed.')
    }
  }

  const savePolicyChanges = async () => {
    if (changedPolicyIds.length === 0) {
      setMessage('No pending changes to save.')
      return
    }

    setBusyAction('save-policies')

    try {
      await Promise.all(changedPolicyIds.map((policyId) => adminService.toggleSecurityPolicy(policyId)))
      await loadSettingsData()
      setBusyAction(null)
      setMessage('Security policies updated successfully.')
    } catch {
      setBusyAction(null)
      pushToast('error', 'Failed to save security policy changes.')
    }
  }

  const handlePolicyToggle = (policyId: string, checked: boolean) => {
    setPolicyDraft((current) => ({
      ...current,
      [policyId]: checked,
    }))
  }

  const retainSelectableAuditIds = (items: AuditLogItem[]) => {
    const allowedIds = new Set(items.filter((item) => !item.reviewed).map((item) => item.id))
    setSelectedAuditIds((current) => current.filter((id) => allowedIds.has(id)))
  }

  const toggleAuditSelection = (auditId: string) => {
    setSelectedAuditIds((current) => {
      if (current.includes(auditId)) {
        return current.filter((id) => id !== auditId)
      }

      return [...current, auditId]
    })
  }

  const markAuditLogsReviewed = async () => {
    if (selectedAuditIds.length === 0) {
      pushToast('info', 'Select at least one audit log entry first.')
      return
    }

    try {
      await auditLogsService.markReviewed({ auditLogIds: selectedAuditIds })
      pushToast('success', `${selectedAuditIds.length} audit log entries marked reviewed.`)
      setSelectedAuditIds([])
      await loadSettingsData()
    } catch {
      pushToast('error', 'Unable to mark the selected audit logs as reviewed.')
    }
  }

  const renderPolicyCard = (title: string, cardPolicies: SecurityPolicy[]) => (
    <DashboardCard title={title} className="settings-card" key={title}>
      {cardPolicies.length === 0 ? (
        <div className="settings-empty">No policies available.</div>
      ) : (
        <div className="settings-policy-list">
          {cardPolicies.map((policy) => {
            const checked = policyDraft[policy.id] ?? policy.enabled
            return (
              <div className="settings-policy-item" key={policy.id}>
                <div>
                  <div className="settings-policy-title">{policy.name}</div>
                  <p className="settings-policy-description">{policy.description}</p>
                  {renderPolicyValue(policy.value)}
                </div>
                <label className="settings-switch" aria-label={`Toggle ${policy.name}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => handlePolicyToggle(policy.id, event.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )

  return (
    <section className="settings-scene">
      <div className="settings-header-row">
        <div>
          <h1 className="page-title">{viewTitle[activeView]}</h1>
          <p className="dashboard-hero-subtitle">Configure controls without leaving the main workspace.</p>
        </div>
        {activeView === 'security' && (
          <Button themeColor="primary" onClick={savePolicyChanges} disabled={busyAction === 'save-policies'}>
            {busyAction === 'save-policies' ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {message && <div className="settings-message">{message}</div>}

      {activeView === 'overview' && (
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
              <div className="kpi-value">{auditLogs.length}</div>
              <p className="kpi-subtitle">Latest events available</p>
            </div>
          </DashboardCard>
        </div>
      )}

      {activeView === 'security' && (
        <div className="dashboard-grid cols-2 settings-security-grid">
          {renderPolicyCard('Password Policy', passwordPolicies)}
          {renderPolicyCard('Session Timeout', sessionPolicies)}
          {renderPolicyCard('Additional Controls', remainingPolicies)}
        </div>
      )}

      {activeView === 'backup' && (
        <div className="settings-page-grid">
          <DashboardCard title="Backup & Restore" className="settings-card">
            <div className="quick-actions" style={{ marginBottom: 0 }}>
              <Button themeColor="primary" disabled={busyAction !== null} onClick={runBackupNow}>
                {busyAction === 'backup' ? 'Running backup...' : 'Run Backup Now'}
              </Button>
              <Button disabled={busyAction !== null} onClick={restoreFromLatest}>
                {busyAction === 'restore' ? 'Restoring...' : 'Restore Latest Backup'}
              </Button>
            </div>
          </DashboardCard>

          <DashboardCard title="Backup History" className="settings-card">
            <div className="settings-stack">
              {backups.length === 0 && (
                <div className="settings-empty">
                  No backups found yet. Run your first backup to establish a restore point.
                </div>
              )}

              {backups.map((backup) => (
                <div key={backup.id} className="settings-record-item">
                  <div className="kpi-with-arrow">
                    <strong>{backup.id}</strong>
                    <Badge
                      themeColor={backup.status === 'success' ? 'success' : 'warning'}
                      data-tooltip={`Backup ${backup.id} completed with status: ${backup.status}. Captured ${backup.timestamp} (${backup.size}, took ${backup.duration}).`}
                    >
                      {backup.status}
                    </Badge>
                  </div>
                  <div className="card-subtitle">{backup.timestamp}</div>
                  <div className="card-subtitle">{backup.size} · {backup.duration}</div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      )}

      {activeView === 'integrations' && (
        <DashboardCard title="Connected Integrations" className="settings-card">
          <div className="settings-stack">
            {integrations.length === 0 && (
              <div className="settings-empty">
                No integrations configured yet. Once connected, each integration will show endpoint, health status, and last sync time.
              </div>
            )}

            {integrations.map((integration) => (
              <div key={integration.id} className="settings-record-item">
                <div className="kpi-with-arrow">
                  <strong>{integration.name}</strong>
                  <Badge
                    themeColor={getIntegrationThemeColor(integration.status)}
                    data-tooltip={`${integration.name} is currently ${integration.status}. Endpoint: ${integration.endpoint}. Last sync: ${integration.lastSync}.`}
                  >
                    {integration.status}
                  </Badge>
                </div>
                <div className="card-subtitle">{integration.endpoint}</div>
                <div className="card-subtitle">Last sync: {integration.lastSync}</div>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {activeView === 'audit' && (
        <DashboardCard title="Recent Audit Activity" className="settings-card">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="quick-actions" style={{ marginBottom: 0 }}>
              <Button themeColor="primary" onClick={() => setShowAuditSearch(true)}>Search Logs</Button>
              <Button onClick={markAuditLogsReviewed} disabled={selectedAuditIds.length === 0}>Mark Reviewed</Button>
              <Button onClick={() => { setSelectedAuditIds([]); void loadSettingsData() }}>Refresh</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div className="kpi-card">
                <div className="kpi-title">Events</div>
                <div className="kpi-value">{filteredAuditLogs.length}</div>
                <p className="kpi-subtitle">Latest tracked admin and system actions</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Reviewed</div>
                <div className="kpi-value">{filteredAuditLogs.filter((item) => item.reviewed).length}</div>
                <p className="kpi-subtitle">Entries already acknowledged</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Selected</div>
                <div className="kpi-value">{selectedAuditIds.length}</div>
                <p className="kpi-subtitle">Ready to mark as reviewed</p>
              </div>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="settings-empty">
                No audit log entries match the current filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', width: 44 }}>
                        <input
                          type="checkbox"
                          checked={unreviewedFilteredIds.length > 0 && unreviewedFilteredIds.every((id) => selectedAuditIds.includes(id))}
                          onChange={(event) => setSelectedAuditIds(event.target.checked ? unreviewedFilteredIds : [])}
                          title="Select all unreviewed"
                        />
                      </th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Date & Time</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                          {!item.reviewed && (
                            <input
                              type="checkbox"
                              checked={selectedAuditIds.includes(item.id)}
                              onChange={() => toggleAuditSelection(item.id)}
                            />
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>{item.date}</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>{item.action} {item.area}</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>{item.user}</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: item.reviewed ? '#15803d' : '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
                            {item.reviewed ? 'Reviewed' : 'Pending review'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                          <Button size="small" onClick={() => setSelectedAuditLog(item)}>View Details</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardCard>
      )}

      {selectedAuditLog && (
        <Dialog title="Activity Details" onClose={() => setSelectedAuditLog(null)} width={820}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#1f4f8a' }}>Overview</h3>
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedAuditLog.user}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{selectedAuditLog.action} {selectedAuditLog.area}</div>
                <div style={{ color: '#64748b' }}>{selectedAuditLog.date}</div>
              </div>
            </section>

            <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.6rem' }}>Changes Made</h3>
              {selectedAuditChanges.length === 0 ? (
                <p style={{ margin: 0, color: '#64748b' }}>
                  No field-level before and after values were captured for this activity.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid #e5e7eb' }}>Field</th>
                        <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid #e5e7eb' }}>Before</th>
                        <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid #e5e7eb' }}>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAuditChanges.map((change) => (
                        <tr key={`${change.field}-${change.before}-${change.after}`}>
                          <td style={{ padding: '0.65rem', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{change.field}</td>
                          <td style={{ padding: '0.65rem', borderBottom: '1px solid #f1f5f9' }}>{change.before}</td>
                          <td style={{ padding: '0.65rem', borderBottom: '1px solid #f1f5f9', background: 'rgba(37, 99, 235, 0.08)' }}>{change.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Context</h3>
              <p style={{ margin: 0 }}><strong>Related Module:</strong> {selectedAuditLog.area}</p>
            </section>
          </div>
          <DialogActionsBar>
            <Button onClick={() => setSelectedAuditLog(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showAuditSearch && (
        <Dialog title="Search Audit Logs" onClose={() => setShowAuditSearch(false)}>
          <div style={{ minWidth: '520px', display: 'grid', gap: '0.75rem' }}>
            <div>
              <label htmlFor="settings-audit-user-filter">User</label>
              <Input
                id="settings-audit-user-filter"
                value={auditFilter.user}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, user: String(event.target.value) }))}
              />
            </div>
            <div>
              <label htmlFor="settings-audit-area-filter">Module</label>
              <Input
                id="settings-audit-area-filter"
                value={auditFilter.area}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, area: String(event.target.value) }))}
              />
            </div>
            <div>
              <label htmlFor="settings-audit-action-filter">Action</label>
              <Input
                id="settings-audit-action-filter"
                value={auditFilter.action}
                onChange={(event: InputChangeEvent) => setAuditFilter((current) => ({ ...current, action: String(event.target.value) }))}
              />
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={() => setShowAuditSearch(false)}>Apply Filter</Button>
            <Button onClick={() => { setAuditFilter({ user: '', area: '', action: '' }); setShowAuditSearch(false) }}>Clear Filter</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </section>
  )
}
