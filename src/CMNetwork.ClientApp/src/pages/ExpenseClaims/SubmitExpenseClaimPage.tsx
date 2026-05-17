import React, { useState } from 'react'
import { customerPortalService } from '../../services/customerPortalService'

const SubmitExpenseClaimPage: React.FC = () => {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const categories = ['Travel', 'Meals', 'Equipment', 'Office Supplies', 'Other']

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    if (!description || !amount || !category) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await customerPortalService.submitExpenseClaim({
        description,
        amount: Number.parseFloat(amount),
        category,
        attachments,
      })
      setSuccess('Expense claim submitted successfully.')
      setDescription('')
      setAmount('')
      setCategory('')
      setAttachments([])
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Unable to submit expense claim.')
      console.error('Error submitting claim:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Submit Expense Claim</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-100 text-green-800 rounded">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            rows={4}
            placeholder="Describe the expense"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">-- Select a category --</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="attachments" className="block text-sm font-semibold text-gray-700 mb-2">Attachments</label>
          <input
            id="attachments"
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {attachments.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Selected files:</p>
              <ul className="space-y-1">
                {attachments.map((file) => (
                  <li key={file.name} className="text-sm text-gray-600">
                    • {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>
    </div>
  )
}

export default SubmitExpenseClaimPage
