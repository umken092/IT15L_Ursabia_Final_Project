import React, { useEffect, useRef, useState } from 'react'
import { customerPortalService, type CustomerProfile } from '../../services/customerPortalService'

type EditableProfile = Pick<
  CustomerProfile,
  'firstName' | 'lastName' | 'phoneNumber' | 'companyName' | 'address' | 'city' | 'state' | 'country' | 'zipCode'
>

const emptyProfileForm: EditableProfile = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  companyName: '',
  address: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
}

const inputCls =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white'

const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#16a34a' }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
    Verified
  </span>
)

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getMyProfile()
        setProfile(data)
        setProfileForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          phoneNumber: data.phoneNumber ?? '',
          companyName: data.companyName ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          country: data.country ?? '',
          zipCode: data.zipCode ?? '',
        })
        setProfileError(null)
      } catch (err) {
        setProfileError('Unable to load profile information.')
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setProfileForm((prev) => ({ ...prev, [name]: value }))
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
      const updated = await customerPortalService.updateMyProfile({
        ...profileForm,
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
      })
      setProfile(updated)
      setProfileForm({
        firstName: updated.firstName ?? '',
        lastName: updated.lastName ?? '',
        phoneNumber: updated.phoneNumber ?? '',
        companyName: updated.companyName ?? '',
        address: updated.address ?? '',
        city: updated.city ?? '',
        state: updated.state ?? '',
        country: updated.country ?? '',
        zipCode: updated.zipCode ?? '',
      })
      setProfileSuccess('Profile updated successfully.')
      setTimeout(() => setProfileSuccess(null), 3000)
    } catch (err) {
      setProfileError('Unable to update profile.')
      console.error('Error updating profile:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    try {
      setSavingPassword(true)
      setPasswordError(null)
      await customerPortalService.changePassword(oldPassword, newPassword)
      setPasswordSuccess('Password changed successfully.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setPasswordSuccess(null), 4000)
    } catch (err) {
      setPasswordError('Incorrect current password or server error.')
      console.error('Error changing password:', err)
    } finally {
      setSavingPassword(false)
    }
  }

  // Profile strength: count non-empty editable fields out of 9
  const strengthFields = [
    profileForm.firstName, profileForm.lastName, profileForm.phoneNumber,
    profileForm.companyName, profileForm.address, profileForm.city,
    profileForm.state, profileForm.country, profileForm.zipCode,
  ]
  const filledCount = strengthFields.filter((v) => v.trim().length > 0).length
  // email always counts as filled (required on backend)
  const totalFields = strengthFields.length + 1
  const strengthPct = Math.round(((filledCount + 1) / totalFields) * 100)

  if (loading) {
    return (
      <div className="p-6 max-w-5xl animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 h-80 bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-40 bg-gray-200 rounded-xl" />
            <div className="h-48 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (profileError && !profile) {
    return (
      <div className="p-6">
        <div className="px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{profileError}</div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="p-6 max-w-5xl space-y-5">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Profile Settings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Manage your account details and security preferences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => formRef.current?.requestSubmit()}
          disabled={savingProfile}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity flex-shrink-0"
          style={{ background: 'var(--primary)' }}
        >
          {savingProfile ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Feedback banners ────────────────────────────────────────── */}
      {profileError && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{profileError}</div>
      )}
      {profileSuccess && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{profileSuccess}</div>
      )}

      {/* ── Main 2-column layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* LEFT — Account Details card */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold text-base" style={{ color: 'var(--text)' }}>Account Details</p>
          </div>

          <form ref={formRef} onSubmit={handleProfileSubmit} className="px-6 py-5 space-y-4">
            {/* Row 1 — Full Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                Full Name
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="firstName"
                  value={profileForm.firstName}
                  onChange={handleProfileChange}
                  placeholder="First name"
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  required
                />
                <input
                  type="text"
                  name="lastName"
                  value={profileForm.lastName}
                  onChange={handleProfileChange}
                  placeholder="Last name"
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  required
                />
              </div>
            </div>

            {/* Row 2 — Email (read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Email Address</label>
                <VerifiedBadge />
              </div>
              <input
                type="email"
                value={profile.email}
                readOnly
                className={`${inputCls} cursor-default`}
                style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-container)' }}
              />
            </div>

            {/* Row 3 — Phone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Phone Number</label>
                {profileForm.phoneNumber && <VerifiedBadge />}
              </div>
              <input
                type="tel"
                name="phoneNumber"
                value={profileForm.phoneNumber}
                onChange={handleProfileChange}
                placeholder="+1 555-0000"
                className={inputCls}
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            {/* ── Business Information ─────────────────────── */}
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
                Business Information
              </p>

              {/* Company Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={profileForm.companyName}
                  onChange={handleProfileChange}
                  placeholder="Your company"
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Office Address */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Office Address
                </label>
                <textarea
                  name="address"
                  value={[profileForm.address, profileForm.city, profileForm.state, profileForm.zipCode, profileForm.country].filter(Boolean).join('\n')}
                  onChange={(e) => {
                    // Split by newline and map back to fields
                    const lines = e.target.value.split('\n')
                    setProfileForm((prev) => ({
                      ...prev,
                      address: lines[0] ?? '',
                      city: lines[1] ?? '',
                      state: lines[2] ?? '',
                      zipCode: lines[3] ?? '',
                      country: lines[4] ?? '',
                    }))
                  }}
                  rows={3}
                  placeholder={'Street address\nCity, State ZIP\nCountry'}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
                />
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT — Sidebar panels */}
        <div className="space-y-4">

          {/* Profile Strength card */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Profile Strength
              </p>
              <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{strengthPct}%</p>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--border)' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${strengthPct}%`, background: 'var(--primary)' }}
              />
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Complete your profile to unlock all features.
            </p>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="w-full py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Complete Profile
            </button>
          </div>

          {/* Account Security card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="px-5 py-4 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Account Security</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* MFA */}
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Multi-Factor Authentication</p>
                <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--muted)' }}>Not configured</p>
                <a
                  href="/module/profile#mfa"
                  className="text-xs font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  Manage MFA
                </a>
              </div>

              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Password */}
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Password</p>
                {passwordSuccess && (
                  <p className="text-xs mt-0.5 mb-2" style={{ color: '#16a34a' }}>{passwordSuccess}</p>
                )}
                {!passwordSuccess && (
                  <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--muted)' }}>
                    Set a strong password to secure your account.
                  </p>
                )}

                {showPasswordForm ? (
                  <form onSubmit={handlePasswordSubmit} className="space-y-3 mt-2">
                    {passwordError && (
                      <p className="text-xs text-red-600">{passwordError}</p>
                    )}
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Current password"
                      className={inputCls}
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      required
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className={inputCls}
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      required
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={inputCls}
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: 'var(--primary)' }}
                      >
                        {savingPassword ? 'Updating…' : 'Update'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowPasswordForm(false); setPasswordError(null) }}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="w-full py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
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
