import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerProfile } from '../../services/customerPortalService'

const ViewProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return <div className="p-4">Loading profile...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  if (!profile) {
    return <div className="p-4">No profile data available.</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="block text-sm font-semibold text-gray-700">First Name</p>
            <p className="text-gray-900 mt-1">{profile.firstName}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Last Name</p>
            <p className="text-gray-900 mt-1">{profile.lastName}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Email</p>
            <p className="text-gray-900 mt-1">{profile.email}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Phone Number</p>
            <p className="text-gray-900 mt-1">{profile.phoneNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Company Name</p>
            <p className="text-gray-900 mt-1">{profile.companyName || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Address</p>
            <p className="text-gray-900 mt-1">{profile.address || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">City</p>
            <p className="text-gray-900 mt-1">{profile.city || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">State</p>
            <p className="text-gray-900 mt-1">{profile.state || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Country</p>
            <p className="text-gray-900 mt-1">{profile.country || 'N/A'}</p>
          </div>
          <div>
            <p className="block text-sm font-semibold text-gray-700">Zip Code</p>
            <p className="text-gray-900 mt-1">{profile.zipCode || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewProfilePage
