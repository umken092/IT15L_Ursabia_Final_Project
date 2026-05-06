import { useEffect, useState } from 'react'
import { adminService, type MfaLevel, type SecurityPolicySettings } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type SecurityPolicyState = SecurityPolicySettings

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: SecurityPolicyState = {
  password: {
    minLength: 12,
    maxLength: 128,
    blockedTerms: ['password', '123456', '12345678', 'qwerty', 'admin', 'administrator', 'welcome', 'letmein', 'abc123'].join('\n'),
    forbidUserContext: true,
    forbidCompanyName: true,
    expireOnlyOnCompromise: true,
    allowUnicode: true,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSymbols: false,
    preventReuse: 0,
  },
  lockout: {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    resetCounterAfterMinutes: 30,
  },
  session: {
    idleTimeoutMinutes: 30,
    absoluteTimeoutHours: 8,
    singleSessionPerUser: false,
  },
  mfa: {
    level: 'high-privilege',
  },
  ip: {
    mode: 'disabled',
    allowedRanges: '',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mfaLabels: Record<MfaLevel, string> = {
  none: 'Not required',
  'high-privilege': 'Required for high-privilege roles (Super Admin, CFO, Auditor)',
  all: 'Required for all users',
}

const mfaOptionPrefixes: Record<MfaLevel, string> = {
  none: '',
  'high-privilege': '',
  all: '',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard = ({
  icon,
  title,
  sub,
  children,
}: {
  icon: string
  title: string
  sub: string
  children: React.ReactNode
}) => (
  <div className="sp-card">
    <div className="sp-card-header">
      <span className="sp-card-icon">{icon}</span>
      <div>
        <h2 className="sp-card-title">{title}</h2>
        <p className="sp-card-sub">{sub}</p>
      </div>
    </div>
    <div className="sp-card-body">{children}</div>
  </div>
)

const Toggle = ({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) => (
  <label className="sp-toggle-row" htmlFor={id}>
    <span className="sp-toggle-label">{label}</span>
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      className={`sp-toggle ${checked ? 'sp-toggle-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sp-toggle-knob" />
    </button>
  </label>
)

const NumberField = ({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (v: number) => void
}) => (
  <div className="sp-number-field">
    <label className="sp-field-label" htmlFor={id}>
      {label}
    </label>
    <div className="sp-number-input-wrap">
      <input
        id={id}
        type="number"
        className="sp-number-input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(v) && v >= min && v <= max) onChange(v)
        }}
      />
      {suffix && <span className="sp-number-suffix">{suffix}</span>}
    </div>
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────

export const SecurityPolicyModule = () => {
  const pushToast = useNotificationStore((state) => state.push)

  const [policy, setPolicy] = useState<SecurityPolicyState>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadPolicy = async () => {
      try {
        const savedPolicy = await adminService.getSecurityPolicySettings()
        if (isMounted) {
          setPolicy(savedPolicy)
          setDirty(false)
        }
      } catch {
        if (isMounted) {
          pushToast('error', 'Failed to load saved security policy settings.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadPolicy()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const update = <K extends keyof SecurityPolicyState>(
    section: K,
    patch: Partial<SecurityPolicyState[K]>,
  ) => {
    setPolicy((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const savedPolicy = await adminService.updateSecurityPolicySettings(policy)
      setPolicy(savedPolicy)
      setDirty(false)
      pushToast('success', 'Security policy saved and applied.')
    } catch {
      pushToast('error', 'Failed to save security policy settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPolicy(DEFAULTS)
    setDirty(true)
    pushToast('info', 'Defaults restored. Save policy to apply them.')
  }

  const passwordRules = [
    { label: `${policy.password.minLength}-${policy.password.maxLength} character length window`, active: true },
    { label: 'Common breached and dictionary passwords blocked', active: policy.password.blockedTerms.trim().length > 0 },
    { label: 'Username, first name, last name, and email terms blocked', active: policy.password.forbidUserContext },
    { label: 'Company name blocked', active: policy.password.forbidCompanyName },
    { label: 'No forced calendar-based password expiration', active: policy.password.expireOnlyOnCompromise },
    { label: 'Standard ASCII and Unicode characters allowed', active: policy.password.allowUnicode },
  ]
  let saveButtonText = 'Save Policy'
  if (loading) {
    saveButtonText = 'Loading…'
  } else if (saving) {
    saveButtonText = 'Saving…'
  }

  return (
    <div className="sp-scene">
      {/* Page header */}
      <div className="sp-page-header">
        <div>
          <h1 className="sp-page-title">Security Policy</h1>
          <p className="sp-page-sub">
            Define and enforce global authentication and access control rules for all users.
          </p>
        </div>
        <div className="sp-header-actions">
          {dirty && (
            <span className="sp-unsaved">● Unsaved changes</span>
          )}
          <button className="sp-btn-ghost" disabled={loading || saving} onClick={handleReset}>
            Reset to Defaults
          </button>
          <button
            className="sp-btn-primary"
            disabled={loading || saving || !dirty}
            onClick={() => {
              void handleSave()
            }}
          >
            {saveButtonText}
          </button>
        </div>
      </div>

      {/* ── Password Policy ───────────────────────────────────────────────── */}
      <SectionCard
        icon="🔑"
        title="Password Policy"
        sub="Favor long passphrases, block weak terms, and avoid arbitrary password rotation."
      >
        <div className="sp-two-col">
          <div className="sp-left-col">
            <NumberField
              id="sp-min-len"
              label="Minimum length"
              value={policy.password.minLength}
              min={8}
              max={15}
              suffix="characters"
              onChange={(v) => update('password', { minLength: v })}
            />
            <NumberField
              id="sp-max-len"
              label="Maximum length"
              value={policy.password.maxLength}
              min={64}
              max={256}
              suffix="characters"
              onChange={(v) => update('password', { maxLength: v })}
            />
          </div>
          <div className="sp-right-col">
            <Toggle
              id="sp-context"
              label="Block user names, usernames, and email terms"
              checked={policy.password.forbidUserContext}
              onChange={(v) => update('password', { forbidUserContext: v })}
            />
            <Toggle
              id="sp-company"
              label="Block company name in passwords"
              checked={policy.password.forbidCompanyName}
              onChange={(v) => update('password', { forbidCompanyName: v })}
            />
            <Toggle
              id="sp-expire-compromise"
              label="Expire passwords only when compromise is suspected"
              checked={policy.password.expireOnlyOnCompromise}
              onChange={(v) => update('password', { expireOnlyOnCompromise: v })}
            />
            <Toggle
              id="sp-unicode"
              label="Allow standard ASCII and Unicode characters"
              checked={policy.password.allowUnicode}
              onChange={(v) => update('password', { allowUnicode: v })}
            />
          </div>
        </div>

        <div className="sp-blocklist-editor">
          <label className="sp-field-label" htmlFor="sp-blocked-terms">
            Blocked password terms <span className="sp-field-hint">one per line or comma separated</span>
          </label>
          <textarea
            id="sp-blocked-terms"
            className="sp-policy-textarea"
            rows={5}
            value={policy.password.blockedTerms}
            onChange={(e) => update('password', { blockedTerms: e.target.value })}
          />
        </div>

        <div className="sp-policy-summary">
          {passwordRules.map((rule) => (
            <span key={rule.label} className={`sp-rule-chip ${rule.active ? 'sp-rule-on' : ''}`}>
              {rule.active ? 'On' : 'Off'} - {rule.label}
            </span>
          ))}
        </div>

        <div className="sp-hint-card">
          <strong>Complexity rules are intentionally disabled.</strong>
          <div>
            Users can create longer passphrases without mandatory uppercase, number, or symbol rules.
            Weak, compromised, dictionary-style, company, and user-context passwords are rejected instead.
          </div>
        </div>
      </SectionCard>

      {/* ── Account Lockout ───────────────────────────────────────────────── */}
      <SectionCard
        icon="🔒"
        title="Account Lockout"
        sub="Lock accounts after repeated failed sign-in attempts."
      >
        <div className="sp-three-col">
          <NumberField
            id="sp-max-fail"
            label="Max failed attempts"
            value={policy.lockout.maxFailedAttempts}
            min={1}
            max={20}
            suffix="attempts"
            onChange={(v) => update('lockout', { maxFailedAttempts: v })}
          />
          <NumberField
            id="sp-lockout-dur"
            label="Lockout duration"
            value={policy.lockout.lockoutDurationMinutes}
            min={1}
            max={1440}
            suffix="minutes"
            onChange={(v) => update('lockout', { lockoutDurationMinutes: v })}
          />
          <NumberField
            id="sp-reset-counter"
            label="Reset counter after"
            value={policy.lockout.resetCounterAfterMinutes}
            min={1}
            max={1440}
            suffix="minutes"
            onChange={(v) => update('lockout', { resetCounterAfterMinutes: v })}
          />
        </div>
        <p className="sp-hint">
          After <strong>{policy.lockout.maxFailedAttempts}</strong> failed attempts the account
          is locked for <strong>{policy.lockout.lockoutDurationMinutes} min</strong>. The failure
          counter resets after <strong>{policy.lockout.resetCounterAfterMinutes} min</strong> of
          inactivity.
        </p>
      </SectionCard>

      {/* ── Session Timeout ───────────────────────────────────────────────── */}
      <SectionCard
        icon="⏱"
        title="Session Timeout"
        sub="Automatically expire inactive or long-running sessions."
      >
        <div className="sp-three-col">
          <NumberField
            id="sp-idle"
            label="Idle timeout"
            value={policy.session.idleTimeoutMinutes}
            min={5}
            max={480}
            suffix="minutes"
            onChange={(v) => update('session', { idleTimeoutMinutes: v })}
          />
          <NumberField
            id="sp-abs-timeout"
            label="Absolute timeout"
            value={policy.session.absoluteTimeoutHours}
            min={1}
            max={24}
            suffix="hours"
            onChange={(v) => update('session', { absoluteTimeoutHours: v })}
          />
        </div>
        <Toggle
          id="sp-single-session"
          label="Allow only one active session per user (force sign-out on new login)"
          checked={policy.session.singleSessionPerUser}
          onChange={(v) => update('session', { singleSessionPerUser: v })}
        />
      </SectionCard>

      {/* ── MFA Enforcement ───────────────────────────────────────────────── */}
      <SectionCard
        icon="🛡"
        title="Multi-Factor Authentication (MFA)"
        sub="Require a second factor for sign-in based on user privilege level."
      >
        <div className="sp-radio-group" role="radiogroup" aria-label="MFA enforcement level">
          {(['none', 'high-privilege', 'all'] as MfaLevel[]).map((lvl) => {
            const lvlLabels = ['Not required', 'High-privilege roles only', 'All users']
            const lvlIdx = ['none', 'high-privilege', 'all'].indexOf(lvl)
            const lvlPrefix = mfaOptionPrefixes[lvl]
            return (
              <label
                key={lvl}
                className={`sp-radio-option ${policy.mfa.level === lvl ? 'sp-radio-active' : ''}`}
                aria-label={lvlLabels[lvlIdx]}
              >
                <input
                  type="radio"
                  name="mfa-level"
                  className="sp-radio-input"
                  value={lvl}
                  checked={policy.mfa.level === lvl}
                  onChange={() => update('mfa', { level: lvl })}
                />
                <div className="sp-radio-body">
                  <span className="sp-radio-label">{lvlPrefix}{lvlLabels[lvlIdx]}</span>
                  <span className="sp-radio-hint">{mfaLabels[lvl]}</span>
                </div>
              </label>
            )
          })}
        </div>
      </SectionCard>

      {/* ── IP Whitelisting ───────────────────────────────────────────────── */}
      <SectionCard
        icon="🌐"
        title="IP Whitelisting (Optional)"
        sub="Restrict system access to specific IP addresses or CIDR ranges."
      >
        <div className="sp-ip-toggle-row">
          <Toggle
            id="sp-ip-enable"
            label="Enable IP whitelisting"
            checked={policy.ip.mode === 'allowlist'}
            onChange={(v) => update('ip', { mode: v ? 'allowlist' : 'disabled' })}
          />
        </div>

        {policy.ip.mode === 'allowlist' && (
          <div className="sp-ip-editor">
            <label className="sp-field-label" htmlFor="sp-ip-ranges">
              Allowed IP addresses / CIDR ranges{' '}
              <span className="sp-field-hint">(one per line)</span>
            </label>
            <textarea
              id="sp-ip-ranges"
              className="sp-ip-textarea"
              rows={6}
              placeholder={'192.168.1.0/24\n10.0.0.1\n203.0.113.42'}
              value={policy.ip.allowedRanges}
              onChange={(e) => update('ip', { allowedRanges: e.target.value })}
            />
            <p className="sp-ip-warn">
              ⚠ Misconfigured IP rules can lock all users out. Ensure your own IP is included
              before saving.
            </p>
          </div>
        )}

        {policy.ip.mode === 'disabled' && (
          <p className="sp-hint">
            IP whitelisting is currently <strong>disabled</strong>. All IP addresses can reach the
            login page.
          </p>
        )}
      </SectionCard>
    </div>
  )
}
