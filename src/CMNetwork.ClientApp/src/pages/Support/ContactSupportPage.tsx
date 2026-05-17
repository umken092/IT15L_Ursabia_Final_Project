import React, { useState } from 'react'
import { customerPortalService } from '../../services/customerPortalService'

const ContactSupportPage: React.FC = () => {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const priorities = ['Low', 'Medium', 'High', 'Urgent']

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    if (!subject || !description) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await customerPortalService.createSupportTicket(subject, description, priority)
      setSuccess('Support ticket created successfully. We will get back to you soon.')
      setSubject('')
      setDescription('')
      setPriority('Medium')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to create support ticket.')
      console.error('Error creating ticket:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">Contact Support</h1>
      <p className="text-gray-600 mb-6">Need help? Submit a ticket and our support team will assist you shortly.</p>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">Subject *</label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Brief subject of your inquiry"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              rows={5}
              placeholder="Describe your issue or inquiry in detail"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="priority" className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support Hours</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900">Monday - Friday</p>
              <p>9:00 AM - 6:00 PM</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Saturday</p>
              <p>10:00 AM - 3:00 PM</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Sunday</p>
              <p>Closed</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-2">Contact Info</h3>
            <p className="text-sm text-gray-600">
              <strong>Email:</strong> support@cmnetwork.com
            </p>
            <p className="text-sm text-gray-600">
              <strong>Phone:</strong> +1 (555) 123-4567
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactSupportPage
