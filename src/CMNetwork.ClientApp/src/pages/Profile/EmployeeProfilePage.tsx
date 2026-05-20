import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../services/apiClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeProfile {
  id: string
  fullName: string
  firstName: string
  middleName: string
  lastName: string
  birthDate?: string
  gender: string
  email: string
  phone: string
  address: string
  department: string
  departmentId?: string
  tin: string
  sss: string
  bankAccount: string
  joinDate?: string
  lastLoginUtc?: string
  hourlyRate?: number
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
}

interface EditableFields {
  firstName: string
  middleName: string
  lastName: string
  birthDate: string
  gender: string
  phone: string
  address: string
  tin: string
  sss: string
  bankAccount: string
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
}

interface ChangePasswordFields {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const

const formatTin = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 12)
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 12)].filter(Boolean)
  return parts.join('-')
}

const formatSss = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  const parts = [digits.slice(0, 2), digits.slice(2, 9), digits.slice(9, 10)].filter(Boolean)
  return parts.join('-')
}

const parseApiError = (err: unknown): string => {
  if (typeof err !== 'object' || err === null) return 'An error occurred.'
  const e = err as { response?: { data?: { message?: string; title?: string; errors?: Record<string, string[]> } } }
  const data = e.response?.data
  if (!data) return 'An error occurred.'
  if (data.message) return data.message
  if (data.title) return data.title
  const first = Object.values(data.errors ?? {}).flat().find(Boolean)
  return first ?? 'An error occurred.'
}

const formatDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCss: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--card-bg)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const cardCss: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '24px 28px',
  marginBottom: 20,
}

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
  </label>
)

const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: 16 }}>{icon}</span>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>{title}</h3>
  </div>
)

const Toggle = ({ label, checked, onChange, desc }: { label: string; checked: boolean; onChange: (v: boolean) => void; desc?: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
        background: checked ? 'var(--accent, #2563eb)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      }} />
    </button>
  </div>
)

// ── Component ─────────────────────────────────────────────────────────────────

const EmployeeProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState<EditableFields>({
    firstName: '', middleName: '', lastName: '',
    birthDate: '', gender: '', phone: '', address: '',
    tin: '', sss: '', bankAccount: '',
    emailNotificationsEnabled: true, smsNotificationsEnabled: false, inAppNotificationsEnabled: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showPwdForm, setShowPwdForm] = useState(false)
  const [pwd, setPwd] = useState<ChangePasswordFields>({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)

  // Load profile
  useEffect(() => {
    setLoading(true)
    apiClient.get<EmployeeProfile>('/profile')
      .then((res) => {
        setProfile(res.data)
        const p = res.data
        setFields({
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
          gender: p.gender,
          phone: p.phone,
          address: p.address,
          tin: p.tin,
          sss: p.sss,
          bankAccount: p.bankAccount,
          emailNotificationsEnabled: p.emailNotificationsEnabled,
          smsNotificationsEnabled: p.smsNotificationsEnabled,
          inAppNotificationsEnabled: p.inAppNotificationsEnabled,
        })
      })
      .catch(() => setError('Unable to load profile. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const field = (key: keyof EditableFields, val: unknown) =>
    setFields((prev) => ({ ...prev, [key]: val }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const payload = {
        email: profile.email,
        firstName: fields.firstName,
        middleName: fields.middleName,
        lastName: fields.lastName,
        birthDate: fields.birthDate || undefined,
        gender: fields.gender || undefined,
        phone: fields.phone,
        address: fields.address,
        tin: fields.tin,
        sss: fields.sss,
        bankAccount: fields.bankAccount,
        emailNotificationsEnabled: fields.emailNotificationsEnabled,
        smsNotificationsEnabled: fields.smsNotificationsEnabled,
        inAppNotificationsEnabled: fields.inAppNotificationsEnabled,
      }
      const res = await apiClient.put<EmployeeProfile>('/profile', payload)
      setProfile(res.data)
      setSaveSuccess(true)
      setEditing(false)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      setSaveError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(false)
    if (pwd.newPassword !== pwd.confirmPassword) {
      setPwdError('New passwords do not match.')
      return
    }
    if (pwd.newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters.')
      return
    }
    setPwdSaving(true)
    try {
      await apiClient.post('/auth/password/change', {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      })
      setPwdSuccess(true)
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => { setPwdSuccess(false); setShowPwdForm(false) }, 3000)
    } catch (err) {
      setPwdError(parseApiError(err))
    } finally {
      setPwdSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280, color: 'var(--muted)', fontSize: 14 }}>
        Loading profile…
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <p style={{ color: 'var(--text)', fontSize: 14 }}>{error ?? 'Profile unavailable.'}</p>
          <button style={{ ...btnPrimary, marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  const displayName = profile.fullName || user?.email || 'Employee'
  const roleLabel = (user?.role ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>My Profile</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
          Manage your personal information, statutory IDs, and account settings.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* ── Left column (main form) ── */}
        <div>
          {/* Identity card */}
          <div style={{ ...cardCss, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent, #2563eb)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, flexShrink: 0,
            }}>
              {initials(displayName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{profile.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {profile.department && (
                  <span style={{ fontSize: 11, fontWeight: 600, background: 'color-mix(in srgb, var(--accent, #2563eb) 12%, transparent)', color: 'var(--accent, #2563eb)', borderRadius: 6, padding: '3px 10px', border: '1px solid color-mix(in srgb, var(--accent, #2563eb) 25%, transparent)' }}>
                    {profile.department}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, background: 'color-mix(in srgb, #64748b 10%, transparent)', color: '#64748b', borderRadius: 6, padding: '3px 10px', border: '1px solid color-mix(in srgb, #64748b 25%, transparent)' }}>
                  {roleLabel}
                </span>
              </div>
            </div>
            <div>
              {!editing
                ? <button style={btnPrimary} onClick={() => setEditing(true)}>Edit Profile</button>
                : <button style={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
              }
            </div>
          </div>

          {/* Success / error banners */}
          {saveSuccess && (
            <div style={{ ...successBanner, marginBottom: 16 }}>✓ Profile updated successfully.</div>
          )}
          {saveError && (
            <div style={{ ...errorBanner, marginBottom: 16 }}>{saveError}</div>
          )}

          <form onSubmit={handleSave}>
            {/* Personal Information */}
            <div style={cardCss}>
              <SectionHeader icon="👤" title="Personal Information" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <Label required>First Name</Label>
                  <input style={inputCss} value={fields.firstName} disabled={!editing}
                    onChange={(e) => field('firstName', e.target.value)} required />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <input style={inputCss} value={fields.middleName} disabled={!editing}
                    onChange={(e) => field('middleName', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <Label required>Last Name</Label>
                  <input style={inputCss} value={fields.lastName} disabled={!editing}
                    onChange={(e) => field('lastName', e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <Label>Date of Birth</Label>
                  <input type="date" style={inputCss} value={fields.birthDate} disabled={!editing}
                    onChange={(e) => field('birthDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select style={inputCss} value={fields.gender} disabled={!editing}
                    onChange={(e) => field('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Label>Phone Number</Label>
                  <input style={inputCss} value={fields.phone} disabled={!editing}
                    onChange={(e) => field('phone', e.target.value)} placeholder="+639XXXXXXXXX" />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputCss, paddingRight: 76, background: 'color-mix(in srgb, var(--muted) 8%, var(--card-bg))' }}
                      value={profile.email} disabled title="Email cannot be changed from this form." readOnly />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '2px 7px' }}>
                      verified
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div style={cardCss}>
              <SectionHeader icon="🏠" title="Address" />
              <Label>Home / Mailing Address</Label>
              <textarea style={{ ...inputCss, minHeight: 72, resize: 'vertical' }}
                value={fields.address} disabled={!editing}
                onChange={(e) => field('address', e.target.value)}
                placeholder="Street, Barangay, City, Province, ZIP" />
            </div>

            {/* Statutory IDs */}
            <div style={cardCss}>
              <SectionHeader icon="🪪" title="Statutory Identification Numbers" />
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
                Used for payroll deductions (BIR, SSS). Keep these up to date for accurate computation.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <Label>TIN (BIR Tax Identification)</Label>
                  <input style={inputCss} value={fields.tin} disabled={!editing}
                    placeholder="000-000-000-000"
                    onChange={(e) => field('tin', formatTin(e.target.value))} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Format: XXX-XXX-XXX-XXX</div>
                </div>
                <div>
                  <Label>SSS Number</Label>
                  <input style={inputCss} value={fields.sss} disabled={!editing}
                    placeholder="00-0000000-0"
                    onChange={(e) => field('sss', formatSss(e.target.value))} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Format: XX-XXXXXXX-X</div>
                </div>
              </div>
            </div>

            {/* Salary Bank Account */}
            <div style={cardCss}>
              <SectionHeader icon="🏦" title="Salary Bank Account" />
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
                This account is used for payroll salary crediting. Contact HR to change the bank.
              </p>
              <div>
                <Label>Bank Account Number</Label>
                <input style={inputCss} value={fields.bankAccount} disabled={!editing}
                  placeholder="Account number for salary crediting"
                  onChange={(e) => field('bankAccount', e.target.value)} />
              </div>
            </div>

            {/* Notification Preferences */}
            <div style={cardCss}>
              <SectionHeader icon="🔔" title="Notification Preferences" />
              <Toggle
                label="Email Notifications"
                desc="Receive updates, alerts, and reports via email."
                checked={fields.emailNotificationsEnabled}
                onChange={(v) => { if (editing) field('emailNotificationsEnabled', v) }}
              />
              <Toggle
                label="SMS Notifications"
                desc="Receive time-sensitive alerts via SMS."
                checked={fields.smsNotificationsEnabled}
                onChange={(v) => { if (editing) field('smsNotificationsEnabled', v) }}
              />
              <Toggle
                label="In-App Notifications"
                desc="Show notifications within the CMNetwork portal."
                checked={fields.inAppNotificationsEnabled}
                onChange={(v) => { if (editing) field('inAppNotificationsEnabled', v) }}
              />
            </div>

            {editing && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" style={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" style={btnPrimary} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── Right column (sidebar) ── */}
        <div>
          {/* Employment Summary */}
          <div style={cardCss}>
            <SectionHeader icon="🏢" title="Employment Info" />
            <InfoRow label="Department" value={profile.department || '—'} />
            <InfoRow label="Join Date" value={profile.joinDate ? formatDate(profile.joinDate + 'T00:00:00') : '—'} />
            <InfoRow label="Last Login" value={profile.lastLoginUtc ? formatDate(profile.lastLoginUtc) : '—'} />
            {profile.hourlyRate != null && (
              <InfoRow label="Hourly Rate" value={`₱${profile.hourlyRate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
            )}
          </div>

          {/* Security */}
          <div style={cardCss}>
            <SectionHeader icon="🔐" title="Account Security" />

            {/* MFA */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Two-Factor Authentication (MFA)</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Add an extra layer of security with an authenticator app.
              </div>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => navigate('/settings/mfa')}
              >
                Manage MFA
              </button>
            </div>

            {/* Change Password */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Change Password</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Update your account password. Use a strong, unique password.
              </div>
              {!showPwdForm
                ? (
                  <button type="button" style={btnSecondary} onClick={() => setShowPwdForm(true)}>
                    Change Password
                  </button>
                )
                : (
                  <form onSubmit={handlePasswordChange}>
                    {pwdSuccess && <div style={{ ...successBanner, marginBottom: 10 }}>Password changed successfully!</div>}
                    {pwdError && <div style={{ ...errorBanner, marginBottom: 10 }}>{pwdError}</div>}
                    <div style={{ marginBottom: 10 }}>
                      <Label required>Current Password</Label>
                      <input type="password" style={inputCss} value={pwd.currentPassword} required autoComplete="current-password"
                        onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <Label required>New Password</Label>
                      <input type="password" style={inputCss} value={pwd.newPassword} required autoComplete="new-password" minLength={8}
                        onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <Label required>Confirm New Password</Label>
                      <input type="password" style={inputCss} value={pwd.confirmPassword} required autoComplete="new-password"
                        onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={btnSecondary} onClick={() => { setShowPwdForm(false); setPwdError(null) }}>Cancel</button>
                      <button type="submit" style={btnPrimary} disabled={pwdSaving}>{pwdSaving ? 'Saving…' : 'Update'}</button>
                    </div>
                  </form>
                )}
            </div>
          </div>

          {/* Quick help */}
          <div style={{ ...cardCss, background: 'color-mix(in srgb, var(--accent, #2563eb) 6%, var(--card-bg))' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Need Help?</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
              For changes to your department, position, or official records, contact HR or the system administrator.
            </p>
            <button type="button" style={btnSecondary} onClick={() => navigate('/module/support')}>
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
  </div>
)

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
  background: 'var(--accent, #2563eb)', color: '#fff', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer',
  background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const successBanner: React.CSSProperties = {
  background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
  borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500,
}
const errorBanner: React.CSSProperties = {
  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
  borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500,
}

export default EmployeeProfilePage
