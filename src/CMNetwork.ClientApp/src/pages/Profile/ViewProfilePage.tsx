import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerProfile } from '../../services/customerPortalService'

type Tab = 'info' | 'security'

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
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors'

const InfoField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
      {label}
    </p>
    <p className="text-sm font-medium" style={{ color: value ? 'var(--text)' : 'var(--muted)' }}>
      {value || '—'}
    </p>
  </div>
)

const ViewProfilePage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('info')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileForm, setProfileForm] = useState<EditableProfile>(emptyProfileForm)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
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

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setPasswordError('New password must be at least 8 characters long.')
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
      setTimeout(() => setPasswordSuccess(null), 3000)
    } catch (err) {
      setPasswordError('Unable to change password. Please check your old password and try again.')
      console.error('Error changing password:', err)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
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

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: tab === id ? 'var(--card-bg)' : 'transparent',
        color: tab === id ? 'var(--primary)' : 'var(--muted)',
        boxShadow: tab === id ? 'var(--shadow-lg)' : 'none',
        fontWeight: tab === id ? 600 : 400,
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>My Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Manage your personal information and account security.
        </p>
      </div>

      {/* Profile header card */}
      <div
        className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold flex-shrink-0"
          style={{ background: 'var(--primary)', color: 'white' }}
        >
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{profile.email}</p>
          {profile.companyName && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{profile.companyName}</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('info', 'Profile Information')}
        {tabBtn('security', 'Security')}
      </div>

      {/* Profile info tab */}
      {tab === 'info' && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {/* Read-only summary */}
          <div className="px-6 pt-5 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Current Details
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <InfoField label="First Name" value={profile.firstName} />
              <InfoField label="Last Name" value={profile.lastName} />
              <InfoField label="Phone" value={profile.phoneNumber} />
              <InfoField label="Company" value={profile.companyName} />
              <InfoField label="City" value={profile.city} />
              <InfoField label="State / Country" value={[profile.state, profile.country].filter(Boolean).join(', ')} />
              <InfoField label="Zip Code" value={profile.zipCode} />
              <div className="col-span-2 md:col-span-3">
                <InfoField label="Address" value={profile.address} />
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Edit Profile
            </p>
            {profileError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
                {profileSuccess}
              </div>
            )}
            <form onSubmit={handleProfileSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={profileForm.firstName}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={profileForm.lastName}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={profileForm.phoneNumber}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={profileForm.companyName}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={profileForm.address}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={profileForm.city}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={profileForm.state}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={profileForm.country}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                    Zip Code
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={profileForm.zipCode}
                    onChange={handleProfileChange}
                    className={inputCls}
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
              </div>
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div
          className="rounded-xl max-w-lg"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Change Password</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Choose a strong password with at least 8 characters.
            </p>
          </div>
          <div className="px-6 py-5">
            {passwordError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
                {passwordSuccess}
              </div>
            )}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {savingPassword ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewProfilePage
