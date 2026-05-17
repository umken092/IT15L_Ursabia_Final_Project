import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerProfile } from '../../services/customerPortalService'

const EditProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Partial<CustomerProfile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getMyProfile()
        setProfile(data)
        setError(null)
      } catch (err) {
        setError('Unable to load profile information.')
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await customerPortalService.updateMyProfile(profile)
      setSuccess('Profile updated successfully.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to update profile.')
      console.error('Error updating profile:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading profile...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>
      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
            <input
              id="firstName"
              type="text"
              name="firstName"
              value={profile.firstName || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
            <input
              id="lastName"
              type="text"
              name="lastName"
              value={profile.lastName || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
            <input
              id="companyName"
              type="text"
              name="companyName"
              value={profile.companyName || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
            <input
              id="phoneNumber"
              type="tel"
              name="phoneNumber"
              value={profile.phoneNumber || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
            <input
              id="address"
              type="text"
              name="address"
              value={profile.address || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">City</label>
            <input
              id="city"
              type="text"
              name="city"
              value={profile.city || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">State</label>
            <input
              id="state"
              type="text"
              name="state"
              value={profile.state || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
            <input
              id="country"
              type="text"
              name="country"
              value={profile.country || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">Zip Code</label>
            <input
              id="zipCode"
              type="text"
              name="zipCode"
              value={profile.zipCode || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

export default EditProfilePage
