import React, { useEffect, useState } from 'react'
import { customerPortalService, type FAQ } from '../../services/customerPortalService'

const FAQsPage: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        setLoading(true)
        const data = await customerPortalService.getFAQs()
        setFaqs(data)
        setError(null)
      } catch (err) {
        setError('Unable to load FAQs.')
        console.error('Error loading FAQs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFAQs()
  }, [])

  if (loading) {
    return <div className="p-4">Loading FAQs...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  // Group FAQs by category
  const groupedFAQs = faqs.reduce(
    (acc, faq) => {
      const category = faq.category || 'General'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(faq)
      return acc
    },
    {} as Record<string, FAQ[]>
  )

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">Find answers to common questions about our services.</p>

      {faqs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No FAQs available at this time.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedFAQs).map(([category, categoryFaqs]) => (
            <div key={category}>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{category}</h2>
              <div className="space-y-3">
                {categoryFaqs.map((faq) => (
                  <div key={faq.id} className="bg-white rounded-lg shadow">
                    <button
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                      className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50"
                    >
                      <span className="font-semibold text-gray-900">{faq.question}</span>
                      <span
                        className={`text-2xl text-gray-500 transition-transform ${
                          expandedId === faq.id ? 'rotate-180' : ''
                        }`}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedId === faq.id && (
                      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <p className="text-gray-700">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 bg-blue-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Still have questions?</h2>
        <p className="text-gray-700 mb-4">
          If you couldn't find the answer you were looking for, please don't hesitate to contact our support team.
        </p>
        <a
          href="/module/support/contact"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Contact Support
        </a>
      </div>
    </div>
  )
}

export default FAQsPage
