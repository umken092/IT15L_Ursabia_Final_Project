import React, { useEffect, useRef, useState } from 'react'
import { customerPortalService, type CustomerProfile } from '../../services/customerPortalService'

type EditableProfile = {
  firstName: string
  lastName: string
  phoneNumber?: string
  companyName?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  tin?: string
  sss?: string
  bankAccount?: string
  bankName?: string
  birthDate?: string
  age?: string
  gender?: string
  maritalStatus?: string
}

const emptyProfileForm: EditableProfile = {
  firstName: '', lastName: '', phoneNumber: '', companyName: '',
  address: '', city: '', state: '', country: '', zipCode: '',
  tin: '', sss: '', bankAccount: '', bankName: '', birthDate: '', age: '', gender: '', maritalStatus: '',
}

const calculateAgeFromBirthDate = (birthDate: string): string => {
  if (!birthDate) return ''
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return ''

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  const hasBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= dob.getDate())
  if (!hasBirthdayPassed) age -= 1
  return age >= 0 ? String(age) : ''
}

const parseApiError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return 'Unable to update profile.'
  const maybeError = error as { response?: { data?: any } }
  const data = maybeError.response?.data

  if (!data) return 'Unable to update profile.'
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (typeof data.title === 'string' && data.title.trim()) return data.title

  const errors = data.errors as Record<string, string[]> | undefined
  if (errors) {
    const first = Object.values(errors).flat().find(Boolean)
    if (first) return first
  }

  return 'Unable to update profile.'
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 7, fontSize: 13, color: 'var(--text)', background: 'var(--card-bg)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
}

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
  </label>
)

const VerifiedBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#059669' }}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
    Verified
  </span>
)

const SectionDivider = ({ title }: { title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, marginBottom: 16 }}>
    <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{title}</p>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
)

const Alert = ({ type, message }: { type: 'error' | 'success' | 'info'; message: string }) => {
  const map = {
    error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    info: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  }
  const s = map[type]
  return (
    <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {message}
    </div>
  )
}

const ViewProfilePage: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileForm, setProfileForm] = useState<EditableProfile>(emptyProfileForm)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loanAccess, setLoanAccess] = useState<{ canAccessLoans: boolean; profileCompletionPercentage: number; isBankVerified: boolean } | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getMyProfile()
        setProfile(data)
        setProfileForm({
          firstName: data.firstName ?? '', lastName: data.lastName ?? '',
          phoneNumber: data.phoneNumber ?? '', companyName: data.companyName ?? '',
          address: data.address ?? '', city: data.city ?? '',
          state: data.state ?? '', country: data.country ?? '', zipCode: data.zipCode ?? data.postalCode ?? '',
          tin: data.tin ?? '', sss: data.sss ?? '', bankAccount: data.bankAccount ?? '', bankName: data.bankName ?? '',
          birthDate: data.birthDate ?? '', age: typeof data.age === 'number' ? String(data.age) : '', gender: data.gender ?? '', maritalStatus: data.maritalStatus ?? '',
        })
        const loanCheck = await customerPortalService.checkLoanAccess()
        setLoanAccess(loanCheck)
      } catch {
        setProfileError('Unable to load profile information.')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setProfileForm((prev) => {
      if (name === 'birthDate') {
        return { ...prev, birthDate: value, age: calculateAgeFromBirthDate(value) }
      }
      return { ...prev, [name]: value }
    })
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileError('First name and last name are required.')
      return
    }
    try {
      setSavingProfile(true)
      setProfileError(null)
      const parsedAge = profileForm.age?.trim() ? Number(profileForm.age) : undefined
      const updated = await customerPortalService.updateMyProfile({
        ...profileForm,
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        postalCode: profileForm.zipCode,
      })
      setProfile(updated)
      setProfileForm({
        firstName: updated.firstName ?? '', lastName: updated.lastName ?? '',
        phoneNumber: updated.phoneNumber ?? '', companyName: updated.companyName ?? '',
        address: updated.address ?? '', city: updated.city ?? '',
        state: updated.state ?? '', country: updated.country ?? '', zipCode: updated.zipCode ?? updated.postalCode ?? '',
        tin: updated.tin ?? '', sss: updated.sss ?? '', bankAccount: updated.bankAccount ?? '', bankName: updated.bankName ?? '',
        birthDate: updated.birthDate ?? '', age: typeof updated.age === 'number' ? String(updated.age) : '', gender: updated.gender ?? '', maritalStatus: updated.maritalStatus ?? '',
      })
      const loanCheck = await customerPortalService.checkLoanAccess()
      setLoanAccess(loanCheck)
      setProfileSuccess('Profile updated successfully.')
      setTimeout(() => setProfileSuccess(null), 3000)
    } catch (error) {
      setProfileError(parseApiError(error))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) { setPasswordError('All password fields are required.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    try {
      setSavingPassword(true)
      setPasswordError(null)
      await customerPortalService.changePassword(oldPassword, newPassword)
      setPasswordSuccess('Password changed successfully.')
      setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setPasswordSuccess(null), 4000)
    } catch {
      setPasswordError('Incorrect current password or server error.')
    } finally {
      setSavingPassword(false)
    }
  }

  const strengthFields = [
    profileForm.firstName, profileForm.lastName, profileForm.phoneNumber,
    profileForm.companyName, profileForm.address, profileForm.city,
    profileForm.state, profileForm.country, profileForm.zipCode,
    profileForm.birthDate, profileForm.age, profileForm.gender, profileForm.maritalStatus,
    profileForm.tin, profileForm.sss, profileForm.bankAccount, profileForm.bankName,
  ]
  const filledCount = strengthFields.filter((v) => v && v.trim().length > 0).length
  const strengthPct = Math.round(((filledCount + 1) / (strengthFields.length + 1)) * 100)
  const strengthColor = strengthPct < 40 ? '#dc2626' : strengthPct < 70 ? '#ca8a04' : '#059669'

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: i === 1 ? 48 : 120, background: '#f1f5f9', borderRadius: 8, marginBottom: 16, opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    )
  }

  if (profileError && !profile) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <Alert type="error" message={profileError} />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 24px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 4, height: 26, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Profile Settings</h1>
          </div>
          <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
            Manage your account details and security preferences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={savingProfile}
          style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            color: '#fff', background: 'var(--primary)', border: 'none',
            cursor: 'pointer', opacity: savingProfile ? 0.6 : 1,
            boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
            transition: 'opacity 0.2s',
          }}
        >
          {savingProfile ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Feedback */}
      {profileError && <Alert type="error" message={profileError} />}
      {profileSuccess && <Alert type="success" message={profileSuccess} />}

      {/* ── 2-Column Layout ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Account Details */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Account Details</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Update your personal and business information.</p>
          </div>

          <form ref={formRef} onSubmit={handleProfileSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionDivider title="Personal Information" />

            {/* Full Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel required>First Name</FieldLabel>
                <input type="text" name="firstName" value={profileForm.firstName} onChange={handleProfileChange}
                  placeholder="First name" style={inputStyle} required />
              </div>
              <div>
                <FieldLabel required>Last Name</FieldLabel>
                <input type="text" name="lastName" value={profileForm.lastName} onChange={handleProfileChange}
                  placeholder="Last name" style={inputStyle} required />
              </div>
            </div>

            {/* Birthdate and Age */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Birthdate</FieldLabel>
                <input type="date" name="birthDate" value={profileForm.birthDate} onChange={handleProfileChange}
                  style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Age</FieldLabel>
                <input type="number" name="age" value={profileForm.age} onChange={handleProfileChange}
                  min={0} max={150} style={inputStyle} />
              </div>
            </div>

            {/* Gender and Marital Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Gender</FieldLabel>
                <select name="gender" value={profileForm.gender} onChange={handleProfileChange}
                  style={inputStyle}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <FieldLabel>Marital Status</FieldLabel>
                <select name="maritalStatus" value={profileForm.maritalStatus} onChange={handleProfileChange}
                  style={inputStyle}>
                  <option value="">Select marital status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
            </div>

            {/* Email */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <FieldLabel>Email Address</FieldLabel>
                <VerifiedBadge />
              </div>
              <input type="email" value={profile.email} readOnly
                style={{ ...inputStyle, background: 'var(--surface-container)', color: 'var(--muted)', cursor: 'default' }} />
            </div>

            {/* Phone */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <FieldLabel>Phone Number</FieldLabel>
                {profileForm.phoneNumber && <VerifiedBadge />}
              </div>
              <input type="tel" name="phoneNumber" value={profileForm.phoneNumber} onChange={handleProfileChange}
                placeholder="+63 9XX XXX XXXX" style={inputStyle} />
            </div>

            <SectionDivider title="Business Information" />

            {/* Company */}
            <div>
              <FieldLabel>Company Name</FieldLabel>
              <input type="text" name="companyName" value={profileForm.companyName} onChange={handleProfileChange}
                placeholder="Your company or organization" style={inputStyle} />
            </div>

            {/* Address fields */}
            <div>
              <FieldLabel>Street Address</FieldLabel>
              <input type="text" name="address" value={profileForm.address} onChange={handleProfileChange}
                placeholder="Street address" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>City</FieldLabel>
                <input type="text" name="city" value={profileForm.city} onChange={handleProfileChange}
                  placeholder="City" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>State / Province</FieldLabel>
                <input type="text" name="state" value={profileForm.state} onChange={handleProfileChange}
                  placeholder="State" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>ZIP / Postal Code</FieldLabel>
                <input type="text" name="zipCode" value={profileForm.zipCode} onChange={handleProfileChange}
                  placeholder="ZIP Code" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <input type="text" name="country" value={profileForm.country} onChange={handleProfileChange}
                  placeholder="Country" style={inputStyle} />
              </div>
            </div>

            <SectionDivider title="Tax & Government IDs" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>TIN (Tax ID)</FieldLabel>
                <input type="text" name="tin" value={profileForm.tin} onChange={handleProfileChange}
                  placeholder="xxx-xxx-xxx-xxx" style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>Tax Identification Number</p>
              </div>
              <div>
                <FieldLabel>SSS Number</FieldLabel>
                <input type="text" name="sss" value={profileForm.sss} onChange={handleProfileChange}
                  placeholder="xx-xxxxxxx-x" style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>Social Security System</p>
              </div>
            </div>

            <SectionDivider title="Bank Information" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Bank Name</FieldLabel>
                <input type="text" name="bankName" value={profileForm.bankName} onChange={handleProfileChange}
                  placeholder="Bank name" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Bank Account Number</FieldLabel>
                <input type="text" name="bankAccount" value={profileForm.bankAccount} onChange={handleProfileChange}
                  placeholder="Account number" style={inputStyle} />
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT — Sidebar panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Loan Access Status */}
          {loanAccess && (
            <div style={{ background: 'var(--card-bg)', border: `1px solid ${loanAccess.canAccessLoans ? '#d1fae5' : '#fee2e2'}`, borderRadius: 10, padding: 16, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: loanAccess.canAccessLoans ? '#d1fae5' : '#fee2e2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700,
                  color: loanAccess.canAccessLoans ? '#059669' : '#dc2626'
                }}>
                  {loanAccess.canAccessLoans ? '✓' : '○'}
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {loanAccess.canAccessLoans ? 'Loan Access Enabled' : 'Loan Access Locked'}
                </p>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>Profile Completion:</strong> {loanAccess.profileCompletionPercentage}%
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Bank Verified:</strong> {loanAccess.isBankVerified ? <span style={{ color: '#059669' }}>Yes ✓</span> : <span style={{ color: '#dc2626' }}>No</span>}
                </p>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 12px' }}>
                {loanAccess.canAccessLoans
                  ? 'You can now access loan products.'
                  : loanAccess.profileCompletionPercentage < 80
                    ? `Complete ${100 - loanAccess.profileCompletionPercentage}% more of your profile to unlock loans.`
                    : 'Verify your bank account to access loans.'}
              </p>
              {loanAccess.canAccessLoans && (
                <button
                  type="button"
                  onClick={() => { window.location.href = '/module/loans' }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Loans & Apply
                </button>
              )}
            </div>
          )}

          {/* Profile Strength */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Profile Strength
              </p>
              <span style={{ fontSize: 18, fontWeight: 700, color: strengthColor }}>{strengthPct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: 6, borderRadius: 999, background: strengthColor, width: `${strengthPct}%`, transition: 'width 0.4s' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
              {strengthPct < 50 ? 'Complete your profile to unlock all features.' : strengthPct < 80 ? 'Looking good — a few more details to go.' : 'Your profile is complete!'}
            </p>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 12,
                fontWeight: 600, color: 'var(--text)', background: 'transparent',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              Save Profile
            </button>
          </div>

          {/* Security */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{
              padding: '12px 18px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-container)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Account Security</p>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* MFA */}
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Multi-Factor Authentication</p>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--muted)' }}>Not configured — recommended for security.</p>
                <a href="/module/profile#mfa" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                  Manage MFA →
                </a>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Password */}
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Password</p>
                {passwordSuccess && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#059669' }}>{passwordSuccess}</p>}
                {!passwordSuccess && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>Set a strong password to secure your account.</p>}

                {showPasswordForm ? (
                  <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {passwordError && <Alert type="error" message={passwordError} />}
                    {['Current password', 'New password', 'Confirm new password'].map((ph, i) => {
                      const values = [oldPassword, newPassword, confirmPassword]
                      const setters = [setOldPassword, setNewPassword, setConfirmPassword]
                      return (
                        <input
                          key={ph}
                          type="password"
                          value={values[i]}
                          onChange={(e) => setters[i](e.target.value)}
                          placeholder={ph}
                          style={{ ...inputStyle }}
                          required
                        />
                      )
                    })}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" disabled={savingPassword}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
                          fontWeight: 600, color: '#fff', background: 'var(--primary)',
                          border: 'none', cursor: 'pointer', opacity: savingPassword ? 0.6 : 1,
                        }}>
                        {savingPassword ? 'Updating…' : 'Update Password'}
                      </button>
                      <button type="button" onClick={() => { setShowPasswordForm(false); setPasswordError(null) }}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
                          fontWeight: 600, color: 'var(--text)', background: 'transparent',
                          border: '1px solid var(--border)', cursor: 'pointer',
                        }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    style={{
                      width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 12,
                      fontWeight: 600, color: 'var(--text)', background: 'transparent',
                      border: '1px solid var(--border)', cursor: 'pointer',
                    }}
                  >
                    Change Password
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewProfilePage
