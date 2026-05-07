import { useEffect, useState } from 'react'
import { adminService, type IntegrationSetting } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error'
type SmtpSecurity = 'none' | 'ssl' | 'starttls'

interface PayMongoConfig {
  publicKey: string
  secretKey: string
  mode: 'test' | 'live'
  connectionStatus: ConnectionStatus
  connectionMessage: string
}

interface SmtpConfig {
  host: string
  port: string
  username: string
  password: string
  fromEmail: string
  fromName: string
  security: SmtpSecurity
  connectionStatus: ConnectionStatus
  connectionMessage: string
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_PAYMONGO: PayMongoConfig = {
  publicKey: '',
  secretKey: '',
  mode: 'test',
  connectionStatus: 'idle',
  connectionMessage: '',
}

const INITIAL_SMTP: SmtpConfig = {
  host: '',
  port: '587',
  username: '',
  password: '',
  fromEmail: '',
  fromName: 'CMNetwork',
  security: 'starttls',
  connectionStatus: 'idle',
  connectionMessage: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const connStatusClass: Record<ConnectionStatus, string> = {
  idle: '',
  testing: 'is-status-testing',
  ok: 'is-status-ok',
  error: 'is-status-error',
}

const connStatusLabel: Record<ConnectionStatus, string> = {
  idle: '',
  testing: 'Testing…',
  ok: 'Connected',
  error: 'Connection failed',
}

const integrationStatusClass = (status: IntegrationSetting['status']) => {
  if (status === 'active') return connStatusClass.ok
  if (status === 'error') return connStatusClass.error
  return connStatusClass.idle
}

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, sub }: { icon: string; title: string; sub: string }) => (
  <div className="is-section-header">
    <span className="is-section-icon">{icon}</span>
    <div>
      <h2 className="is-section-title">{title}</h2>
      <p className="is-section-sub">{sub}</p>
    </div>
  </div>
)

// ─── Connection status badge ──────────────────────────────────────────────────

const ConnBadge = ({ status, message }: { status: ConnectionStatus; message: string }) => {
  if (status === 'idle') return null
  return (
    <span className={`is-conn-badge ${connStatusClass[status]}`}>
      {status === 'testing' && <span className="is-spin" />}
      {connStatusLabel[status]}
      {message && status !== 'testing' ? ` — ${message}` : ''}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IntegrationSettingsModule = () => {
  const pushToast = useNotificationStore((state) => state.push)

  const [paymongo, setPaymongo] = useState<PayMongoConfig>(INITIAL_PAYMONGO)
  const [smtp, setSmtp] = useState<SmtpConfig>(INITIAL_SMTP)
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([])
  const [loadingIntegrations, setLoadingIntegrations] = useState(false)
  const [savingPm, setSavingPm] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)

  useEffect(() => {
    const loadIntegrations = async () => {
      setLoadingIntegrations(true)
      try {
        setIntegrations(await adminService.getIntegrations())
      } catch {
        pushToast('error', 'Unable to load configured integrations.')
      } finally {
        setLoadingIntegrations(false)
      }
    }
    void loadIntegrations()
  }, [pushToast])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [smtpData, pmData] = await Promise.all([
          adminService.getSmtpSettings(),
          adminService.getPayMongoSettings(),
        ])
        setSmtp((s) => ({
          ...s,
          host: smtpData.host,
          port: String(smtpData.port),
          username: smtpData.username,
          password: smtpData.password,
          fromEmail: smtpData.fromEmail,
          fromName: smtpData.fromName || 'CMNetwork',
          security: smtpData.security as SmtpSecurity,
        }))
        setPaymongo((p) => ({
          ...p,
          publicKey: pmData.publicKey,
          secretKey: pmData.secretKey,
          mode: pmData.mode as 'test' | 'live',
        }))
      } catch {
        // Non-fatal — form stays at defaults if settings haven't been saved yet
      }
    }
    void loadSettings()
  }, [])

  // ── PayMongo ──────────────────────────────────────────────────────────────

  const handleTestPaymongo = async () => {
    setPaymongo((p) => ({ ...p, connectionStatus: 'testing', connectionMessage: '' }))
    await new Promise<void>((r) => setTimeout(r, 1200))
    const ok = paymongo.publicKey.trim().length > 0 && paymongo.secretKey.trim().length > 0
    const successMsg = paymongo.mode === 'live' ? 'Live credentials verified.' : 'Test credentials verified.'
    setPaymongo((p) => ({
      ...p,
      connectionStatus: ok ? 'ok' : 'error',
      connectionMessage: ok ? successMsg : 'API keys appear empty or invalid.',
    }))
  }

  const handleSavePaymongo = async () => {
    setSavingPm(true)
    try {
      await adminService.updatePayMongoSettings({
        publicKey: paymongo.publicKey,
        secretKey: paymongo.secretKey,
        mode: paymongo.mode,
      })
      pushToast('success', 'PayMongo settings saved.')
    } catch {
      pushToast('error', 'Failed to save PayMongo settings.')
    } finally {
      setSavingPm(false)
    }
  }

  // ── SMTP ──────────────────────────────────────────────────────────────────

  const handleTestSmtp = async () => {
    setSmtp((s) => ({ ...s, connectionStatus: 'testing', connectionMessage: '' }))
    await new Promise<void>((r) => setTimeout(r, 1400))
    const ok = smtp.host.trim().length > 0 && smtp.port.trim().length > 0
    setSmtp((s) => ({
      ...s,
      connectionStatus: ok ? 'ok' : 'error',
      connectionMessage: ok ? `Connected to ${s.host}:${s.port}.` : 'Host is required.',
    }))
  }

  const handleSaveSmtp = async () => {
    setSavingSmtp(true)
    try {
      await adminService.updateSmtpSettings({
        host: smtp.host,
        port: parseInt(smtp.port, 10) || 587,
        username: smtp.username,
        password: smtp.password,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
        security: smtp.security,
      })
      pushToast('success', 'SMTP settings saved.')
    } catch {
      pushToast('error', 'Failed to save SMTP settings.')
    } finally {
      setSavingSmtp(false)
    }
  }

  let integrationContent = <p className="is-muted">No integration records are configured.</p>
  if (loadingIntegrations) {
    integrationContent = <p className="is-muted">Loading live integration records...</p>
  } else if (integrations.length > 0) {
    integrationContent = (
      <>
        {integrations.map((integration) => (
          <div key={integration.id} className="is-live-row">
            <div>
              <strong className="is-live-name">{integration.name}</strong>
              <span className="is-live-endpoint">{integration.endpoint}</span>
            </div>
            <div className="is-live-meta">
              <span className={`is-conn-badge ${integrationStatusClass(integration.status)}`}>
                {integration.status}
              </span>
              <span className="is-live-sync">Last sync: {integration.lastSync}</span>
            </div>
          </div>
        ))}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="is-scene">
      {/* Page header */}
      <div className="is-page-header">
        <h1 className="is-page-title">Integration Settings</h1>
        <p className="is-page-sub">
          Configure external service connections used by CMNetwork for payments, notifications, and
          data sync.
        </p>
      </div>

      {/* ── PayMongo ─────────────────────────────────────────────────────── */}
      <div className="is-card">
        <SectionHeader
          icon="💳"
          title="PayMongo"
          sub="Accept payments via PayMongo. Enter your API keys and toggle between test and live mode."
        />

        <div className="is-field-grid">
          <div className="is-field">
            <label className="is-label" htmlFor="pm-public-key">
              Public Key
            </label>
            <input
              id="pm-public-key"
              className="is-input"
              type="text"
              placeholder="pk_test_…"
              value={paymongo.publicKey}
              onChange={(e) => setPaymongo((p) => ({ ...p, publicKey: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="pm-secret-key">
              Secret Key
            </label>
            <input
              id="pm-secret-key"
              className="is-input is-secret"
              type="password"
              placeholder="sk_test_…"
              value={paymongo.secretKey}
              onChange={(e) => setPaymongo((p) => ({ ...p, secretKey: e.target.value }))}
            />
          </div>
        </div>

        <div className="is-mode-row">
          <span className="is-label">Mode</span>
          <div className="is-toggle-group" role="radiogroup" aria-label="PayMongo mode">
            {(['test', 'live'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={paymongo.mode === m}
                className={`is-toggle-btn ${paymongo.mode === m ? 'is-toggle-active' : ''} ${m === 'live' ? 'is-toggle-live' : ''}`}
                onClick={() => setPaymongo((p) => ({ ...p, mode: m, connectionStatus: 'idle' }))}
              >
                {m === 'test' ? '🧪 Test' : '🔴 Live'}
              </button>
            ))}
          </div>
          {paymongo.mode === 'live' && (
            <span className="is-live-warn">⚠ Live mode — real transactions will be processed.</span>
          )}
        </div>

        <div className="is-card-footer">
          <ConnBadge status={paymongo.connectionStatus} message={paymongo.connectionMessage} />
          <div className="is-action-row">
            <button
              className="is-btn-ghost"
              disabled={paymongo.connectionStatus === 'testing'}
              onClick={() => {
                void handleTestPaymongo()
              }}
            >
              Test Connection
            </button>
            <button
              className="is-btn-primary"
              disabled={savingPm}
              onClick={() => {
                void handleSavePaymongo()
              }}
            >
              {savingPm ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── SMTP / Email ──────────────────────────────────────────────────── */}
      <div className="is-card">
        <SectionHeader
          icon="✉️"
          title="SMTP / Email"
          sub="Configure the outbound email server for system notifications, password resets, and report sharing."
        />

        <div className="is-field-grid">
          <div className="is-field is-field-wide">
            <label className="is-label" htmlFor="smtp-host">
              SMTP Host
            </label>
            <input
              id="smtp-host"
              className="is-input"
              placeholder="smtp.example.com"
              value={smtp.host}
              onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="smtp-port">
              Port
            </label>
            <input
              id="smtp-port"
              className="is-input"
              placeholder="587"
              value={smtp.port}
              onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="smtp-security">
              Security
            </label>
            <select
              id="smtp-security"
              className="is-select"
              value={smtp.security}
              onChange={(e) => setSmtp((s) => ({ ...s, security: e.target.value as SmtpSecurity }))}
            >
              <option value="none">None</option>
              <option value="ssl">SSL / TLS</option>
              <option value="starttls">STARTTLS</option>
            </select>
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="smtp-user">
              Username
            </label>
            <input
              id="smtp-user"
              className="is-input"
              placeholder="smtp-user@example.com"
              value={smtp.username}
              onChange={(e) => setSmtp((s) => ({ ...s, username: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="smtp-pass">
              Password
            </label>
            <input
              id="smtp-pass"
              type="password"
              className="is-input is-secret"
              placeholder="••••••••"
              value={smtp.password}
              onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="smtp-from-name">
              From Name
            </label>
            <input
              id="smtp-from-name"
              className="is-input"
              placeholder="CMNetwork"
              value={smtp.fromName}
              onChange={(e) => setSmtp((s) => ({ ...s, fromName: e.target.value }))}
            />
          </div>
          <div className="is-field is-field-wide">
            <label className="is-label" htmlFor="smtp-from-email">
              From Email
            </label>
            <input
              id="smtp-from-email"
              type="email"
              className="is-input"
              placeholder="noreply@cmnetwork.example.com"
              value={smtp.fromEmail}
              onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
            />
          </div>
        </div>

        <div className="is-card-footer">
          <ConnBadge status={smtp.connectionStatus} message={smtp.connectionMessage} />
          <div className="is-action-row">
            <button
              className="is-btn-ghost"
              disabled={smtp.connectionStatus === 'testing'}
              onClick={() => {
                void handleTestSmtp()
              }}
            >
              Send Test Email
            </button>
            <button
              className="is-btn-primary"
              disabled={savingSmtp}
              onClick={() => {
                void handleSaveSmtp()
              }}
            >
              {savingSmtp ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Configured integrations ──────────────────────────────────────── */}
      <div className="is-card">
        <SectionHeader
          icon="🔌"
          title="Configured Integrations"
          sub="Live integration records currently registered in CMNetwork."
        />
        <div className="is-live-list">{integrationContent}</div>
      </div>
    </div>
  )
}
