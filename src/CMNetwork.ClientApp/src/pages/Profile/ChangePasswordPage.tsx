import React, { useState } from 'react'
import { customerPortalService } from '../../services/customerPortalService'

const ChangePasswordPage: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await customerPortalService.changePassword(oldPassword, newPassword)
      setSuccess('Password changed successfully.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to change password. Please check your old password and try again.')
      console.error('Error changing password:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Change Password</h1>
      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-md">
        <div className="mb-6">
          <label htmlFor="oldPassword" className="block text-sm font-semibold text-gray-700 mb-2">Old Password</label>
          <input
            id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

export default ChangePasswordPage
