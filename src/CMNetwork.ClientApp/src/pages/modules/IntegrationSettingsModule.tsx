import { useEffect, useState } from 'react'
import { adminService, type IntegrationSetting } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error'
type SmtpSecurity = 'none' | 'ssl' | 'starttls'
type EmailProvider = 'smtp' | 'sendgrid'

interface PayMongoConfig {
  publicKey: string
  secretKey: string
  mode: 'test' | 'live'
  secretKeyConfigured: boolean
  baseUrl: string
  connectionStatus: ConnectionStatus
  connectionMessage: string
}

interface EmailConfig {
  provider: EmailProvider
  // SMTP fields
  host: string
  port: string
  username: string
  password: string
  security: SmtpSecurity
  // SendGrid fields
  apiKey: string
  // Common fields
  fromEmail: string
  fromName: string
  connectionStatus: ConnectionStatus
  connectionMessage: string
}

interface RecaptchaConfig {
  siteKey: string
  secretKey: string
  secretKeyConfigured: boolean
  enabled: boolean
  minScore: string
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_PAYMONGO: PayMongoConfig = {
  publicKey: '',
  secretKey: '',
  mode: 'test',
  secretKeyConfigured: false,
  baseUrl: '',
  connectionStatus: 'idle',
  connectionMessage: '',
}

const INITIAL_EMAIL: EmailConfig = {
  provider: 'smtp',
  host: '',
  port: '587',
  username: '',
  password: '',
  security: 'starttls',
  apiKey: '',
  fromEmail: '',
  fromName: 'CMNetwork',
  connectionStatus: 'idle',
  connectionMessage: '',
}

const INITIAL_RECAPTCHA: RecaptchaConfig = {
  siteKey: '',
  secretKey: '',
  secretKeyConfigured: false,
  enabled: false,
  minScore: '0.5',
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
  const [recaptcha, setRecaptcha] = useState<RecaptchaConfig>(INITIAL_RECAPTCHA)
  const [email, setEmail] = useState<EmailConfig>(INITIAL_EMAIL)
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([])
  const [loadingIntegrations, setLoadingIntegrations] = useState(false)
  const [savingPm, setSavingPm] = useState(false)
  const [savingRecaptcha, setSavingRecaptcha] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

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
        const [emailData, pmData, recaptchaData] = await Promise.all([
          adminService.getSmtpSettings(),
          adminService.getPayMongoSettings(),
          adminService.getRecaptchaSettings(),
        ])
        setEmail((e) => ({
          ...e,
          provider: emailData.provider || 'smtp',
          host: emailData.host,
          port: String(emailData.port),
          username: emailData.username,
          password: emailData.password,
          fromEmail: emailData.fromEmail,
          fromName: emailData.fromName || 'CMNetwork',
          security: emailData.security,
          apiKey: emailData.apiKey || '',
        }))
        setPaymongo((p) => ({
          ...p,
          publicKey: pmData.publicKey,
          secretKey: '',
          mode: pmData.mode,
          secretKeyConfigured: Boolean(pmData.secretKeyConfigured),
          baseUrl: pmData.baseUrl || '',
        }))
        setRecaptcha((r) => ({
          ...r,
          siteKey: recaptchaData.siteKey,
          secretKey: '',
          secretKeyConfigured: Boolean(recaptchaData.secretKeyConfigured),
          enabled: Boolean(recaptchaData.enabled),
          minScore: String(recaptchaData.minScore ?? 0.5),
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
    try {
      const result = await adminService.testPayMongoSettings({
        secretKey: paymongo.secretKey,
        baseUrl: paymongo.baseUrl || undefined,
      })
      setPaymongo((p) => ({
        ...p,
        connectionStatus: result.success ? 'ok' : 'error',
        connectionMessage: result.message,
      }))
    } catch {
      setPaymongo((p) => ({
        ...p,
        connectionStatus: 'error',
        connectionMessage: 'Unable to test connection right now.',
      }))
    }
  }

  const handleSavePaymongo = async () => {
    if (!paymongo.publicKey.trim()) {
      pushToast('error', 'Public key is required.')
      return
    }
    if (!paymongo.secretKeyConfigured && !paymongo.secretKey.trim()) {
      pushToast('error', 'Secret key is required for initial setup.')
      return
    }

    setSavingPm(true)
    try {
      await adminService.updatePayMongoSettings({
        publicKey: paymongo.publicKey,
        secretKey: paymongo.secretKey,
        mode: paymongo.mode,
        baseUrl: paymongo.baseUrl || undefined,
      })
      setPaymongo((p) => ({ ...p, secretKey: '', secretKeyConfigured: true }))
      pushToast('success', 'PayMongo settings saved.')
    } catch {
      pushToast('error', 'Failed to save PayMongo settings.')
    } finally {
      setSavingPm(false)
    }
  }

  // ── reCAPTCHA ────────────────────────────────────────────────────────────

  const handleSaveRecaptcha = async () => {
    const normalizedSiteKey = recaptcha.siteKey.trim()
    const normalizedMinScore = Number.parseFloat(recaptcha.minScore)
    const minScore = Number.isNaN(normalizedMinScore) ? 0.5 : Math.max(0.1, Math.min(1, normalizedMinScore))

    if (recaptcha.enabled && !normalizedSiteKey) {
      pushToast('error', 'Site key is required when reCAPTCHA is enabled.')
      return
    }
    if (recaptcha.enabled && !recaptcha.secretKeyConfigured && !recaptcha.secretKey.trim()) {
      pushToast('error', 'Secret key is required for initial reCAPTCHA setup.')
      return
    }

    setSavingRecaptcha(true)
    try {
      await adminService.updateRecaptchaSettings({
        siteKey: normalizedSiteKey,
        secretKey: recaptcha.secretKey,
        enabled: recaptcha.enabled,
        minScore,
      })
      setRecaptcha((r) => ({
        ...r,
        secretKey: '',
        secretKeyConfigured: r.enabled ? true : false,
        minScore: String(minScore),
      }))
      pushToast('success', 'reCAPTCHA settings saved.')
    } catch {
      pushToast('error', 'Failed to save reCAPTCHA settings.')
    } finally {
      setSavingRecaptcha(false)
    }
  }

  // ── Email (SMTP/SendGrid) ─────────────────────────────────────────────

  const handleTestEmail = async () => {
    setEmail((e) => ({ ...e, connectionStatus: 'testing', connectionMessage: '' }))
    try {
      const payload: Record<string, unknown> = {
        provider: email.provider,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
      }

      if (email.provider === 'sendgrid') {
        payload.apiKey = email.apiKey
      } else {
        payload.host = email.host
        payload.port = parseInt(email.port, 10) || 587
        payload.username = email.username
        payload.password = email.password
        payload.security = email.security
      }

      const result = await adminService.testSmtpSettings(payload)
      setEmail((e) => ({
        ...e,
        connectionStatus: result.success ? 'ok' : 'error',
        connectionMessage: result.message,
      }))
    } catch {
      setEmail((e) => ({
        ...e,
        connectionStatus: 'error',
        connectionMessage: 'Unable to test connection right now.',
      }))
    }
  }

  const handleSaveEmail = async () => {
    setSavingEmail(true)
    try {
      const payload: Record<string, unknown> = {
        provider: email.provider,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
      }

      if (email.provider === 'sendgrid') {
        payload.apiKey = email.apiKey
      } else {
        payload.host = email.host
        payload.port = parseInt(email.port, 10) || 587
        payload.username = email.username
        payload.password = email.password
        payload.security = email.security
      }

      await adminService.updateSmtpSettings(payload)
      pushToast('success', 'Email settings saved.')
    } catch {
      pushToast('error', 'Failed to save email settings.')
    } finally {
      setSavingEmail(false)
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
              placeholder={paymongo.secretKeyConfigured ? 'Configured (leave blank to keep existing)' : 'sk_test_…'}
              value={paymongo.secretKey}
              onChange={(e) => setPaymongo((p) => ({ ...p, secretKey: e.target.value }))}
            />
            {paymongo.secretKeyConfigured && !paymongo.secretKey && (
              <small className="is-muted">A secret key is already configured.</small>
            )}
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="pm-base-url">
              API Base URL (optional)
            </label>
            <input
              id="pm-base-url"
              className="is-input"
              type="text"
              placeholder="https://api.paymongo.com"
              value={paymongo.baseUrl}
              onChange={(e) => setPaymongo((p) => ({ ...p, baseUrl: e.target.value }))}
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

      {/* ── reCAPTCHA ───────────────────────────────────────────────────── */}
      <div className="is-card">
        <SectionHeader
          icon="🛡️"
          title="Google reCAPTCHA v3"
          sub="Protect login and customer registration endpoints using score-based bot detection."
        />

        <div className="is-field-grid">
          <div className="is-field is-field-wide">
            <label className="is-label" htmlFor="rc-site-key">
              Site Key (Public)
            </label>
            <input
              id="rc-site-key"
              className="is-input"
              type="text"
              placeholder="6Le..."
              value={recaptcha.siteKey}
              onChange={(e) => setRecaptcha((r) => ({ ...r, siteKey: e.target.value }))}
            />
          </div>
          <div className="is-field is-field-wide">
            <label className="is-label" htmlFor="rc-secret-key">
              Secret Key
            </label>
            <input
              id="rc-secret-key"
              className="is-input is-secret"
              type="password"
              placeholder={recaptcha.secretKeyConfigured ? 'Configured (leave blank to keep existing)' : 'Enter secret key'}
              value={recaptcha.secretKey}
              onChange={(e) => setRecaptcha((r) => ({ ...r, secretKey: e.target.value }))}
            />
            {recaptcha.secretKeyConfigured && !recaptcha.secretKey && (
              <small className="is-muted">A secret key is already configured.</small>
            )}
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="rc-min-score">
              Minimum Score
            </label>
            <input
              id="rc-min-score"
              className="is-input"
              type="number"
              min="0.1"
              max="1"
              step="0.1"
              value={recaptcha.minScore}
              onChange={(e) => setRecaptcha((r) => ({ ...r, minScore: e.target.value }))}
            />
          </div>
          <div className="is-field">
            <label className="is-label" htmlFor="rc-enabled">
              Status
            </label>
            <select
              id="rc-enabled"
              className="is-select"
              value={recaptcha.enabled ? 'enabled' : 'disabled'}
              onChange={(e) => setRecaptcha((r) => ({ ...r, enabled: e.target.value === 'enabled' }))}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        <div className="is-card-footer">
          <span className="is-muted">This applies to login and customer registration.</span>
          <div className="is-action-row">
            <button
              className="is-btn-primary"
              disabled={savingRecaptcha}
              onClick={() => {
                void handleSaveRecaptcha()
              }}
            >
              {savingRecaptcha ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── SMTP / Email ──────────────────────────────────────────────────── */}
      <div className="is-card">
        <SectionHeader
          icon="✉️"
          title="Email"
          sub="Configure email delivery for system notifications, password resets, and report sharing."
        />

        {/* Provider selector */}
        <div className="is-field">
          <label className="is-label" htmlFor="email-provider">
            Provider
          </label>
          <select
            id="email-provider"
            className="is-select"
            value={email.provider}
            onChange={(e) => setEmail((s) => ({ ...s, provider: e.target.value as EmailProvider, connectionStatus: 'idle' }))}
          >
            <option value="smtp">SMTP Server</option>
            <option value="sendgrid">SendGrid (API)</option>
          </select>
        </div>

        {/* SMTP fields */}
        {email.provider === 'smtp' && (
          <div className="is-field-grid">
            <div className="is-field is-field-wide">
              <label className="is-label" htmlFor="smtp-host">
                SMTP Host
              </label>
              <input
                id="smtp-host"
                className="is-input"
                placeholder="smtp.example.com"
                value={email.host}
                onChange={(e) => setEmail((s) => ({ ...s, host: e.target.value }))}
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
                value={email.port}
                onChange={(e) => setEmail((s) => ({ ...s, port: e.target.value }))}
              />
            </div>
            <div className="is-field">
              <label className="is-label" htmlFor="smtp-security">
                Security
              </label>
              <select
                id="smtp-security"
                className="is-select"
                value={email.security}
                onChange={(e) => setEmail((s) => ({ ...s, security: e.target.value as SmtpSecurity }))}
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
                value={email.username}
                onChange={(e) => setEmail((s) => ({ ...s, username: e.target.value }))}
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
                value={email.password}
                onChange={(e) => setEmail((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* SendGrid fields */}
        {email.provider === 'sendgrid' && (
          <div className="is-field-grid">
            <div className="is-field is-field-wide">
              <label className="is-label" htmlFor="sendgrid-key">
                SendGrid API Key
              </label>
              <input
                id="sendgrid-key"
                type="password"
                className="is-input is-secret"
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={email.apiKey}
                onChange={(e) => setEmail((s) => ({ ...s, apiKey: e.target.value }))}
              />
              <small className="is-muted">
                Get your API key from{' '}
                <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer">
                  SendGrid dashboard
                </a>
              </small>
            </div>
          </div>
        )}

        {/* Common fields */}
        <div className="is-field-grid">
          <div className="is-field">
            <label className="is-label" htmlFor="email-from-name">
              From Name
            </label>
            <input
              id="email-from-name"
              className="is-input"
              placeholder="CMNetwork"
              value={email.fromName}
              onChange={(e) => setEmail((s) => ({ ...s, fromName: e.target.value }))}
            />
          </div>
          <div className="is-field is-field-wide">
            <label className="is-label" htmlFor="email-from-address">
              From Email
            </label>
            <input
              id="email-from-address"
              type="email"
              className="is-input"
              placeholder="noreply@cmnetwork.example.com"
              value={email.fromEmail}
              onChange={(e) => setEmail((s) => ({ ...s, fromEmail: e.target.value }))}
            />
          </div>
        </div>

        <div className="is-card-footer">
          <ConnBadge status={email.connectionStatus} message={email.connectionMessage} />
          <div className="is-action-row">
            <button
              className="is-btn-ghost"
              disabled={email.connectionStatus === 'testing'}
              onClick={() => {
                void handleTestEmail()
              }}
            >
              Test Connection
            </button>
            <button
              className="is-btn-primary"
              disabled={savingEmail}
              onClick={() => {
                void handleSaveEmail()
              }}
            >
              {savingEmail ? 'Saving…' : 'Save'}
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
