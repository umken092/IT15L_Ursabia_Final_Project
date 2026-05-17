import React, { useEffect, useState } from 'react'
import { customerPortalService, type FAQ } from '../../services/customerPortalService'

type Tab = 'contact' | 'faqs'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const inputCls =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors'

const ContactSupportPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('contact')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // FAQ state
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [faqLoading, setFaqLoading] = useState(false)
  const [faqError, setFaqError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (tab === 'faqs' && faqs.length === 0 && !faqLoading) {
      const fetchFAQs = async () => {
        try {
          setFaqLoading(true)
          const data = await customerPortalService.getFAQs()
          setFaqs(data)
          setFaqError(null)
        } catch (err) {
          setFaqError('Unable to load FAQs.')
          console.error('Error loading FAQs:', err)
        } finally {
          setFaqLoading(false)
        }
      }
      fetchFAQs()
    }
  }, [tab, faqs.length, faqLoading])

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
      setSuccess('Support ticket created. Our team will get back to you soon.')
      setSubject('')
      setDescription('')
      setPriority('Medium')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError('Unable to create support ticket.')
      console.error('Error creating ticket:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: tab === id ? 'var(--card-bg)' : 'transparent',
        color: tab === id ? 'var(--primary)' : 'var(--muted)',
        boxShadow: tab === id ? 'var(--shadow)' : 'none',
        fontWeight: tab === id ? 600 : 400,
      }}
    >
      {label}
    </button>
  )

  // Group FAQs by category
  const groupedFAQs = faqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
    const cat = faq.category || 'General'
    ;(acc[cat] ??= []).push(faq)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Support</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Submit a ticket or browse frequently asked questions.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-container)' }}>
        {tabBtn('contact', 'Contact Support')}
        {tabBtn('faqs', 'FAQs')}
      </div>

      {/* Contact form tab */}
      {tab === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div
            className="lg:col-span-2 rounded-xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Submit a Support Ticket</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Describe your issue and we'll respond as soon as possible.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
              )}
              {success && (
                <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{success}</div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="Brief subject of your inquiry"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
                  rows={5}
                  placeholder="Describe your issue or inquiry in detail…"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </form>
          </div>

          {/* Side info panel */}
          <div
            className="rounded-xl overflow-hidden h-fit"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Support Hours</p>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              {[['Monday – Friday', '9:00 AM – 6:00 PM'], ['Saturday', '10:00 AM – 3:00 PM'], ['Sunday', 'Closed']].map(([day, hours]) => (
                <div key={day}>
                  <p className="font-medium" style={{ color: 'var(--text)' }}>{day}</p>
                  <p style={{ color: 'var(--muted)' }}>{hours}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t space-y-2 text-sm" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Contact</p>
              <p style={{ color: 'var(--muted)' }}>support@cmnetwork.com</p>
              <p style={{ color: 'var(--muted)' }}>+1 (555) 123-4567</p>
            </div>
          </div>
        </div>
      )}

      {/* FAQs tab */}
      {tab === 'faqs' && (
        <div className="space-y-5">
          {faqLoading && (
            <div className="animate-pulse space-y-3">
              <div className="h-14 bg-gray-200 rounded-xl" />
              <div className="h-14 bg-gray-200 rounded-xl" />
              <div className="h-14 bg-gray-200 rounded-xl" />
            </div>
          )}
          {faqError && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{faqError}</div>
          )}
          {!faqLoading && faqs.length === 0 && !faqError && (
            <div
              className="rounded-xl px-6 py-12 text-center"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              No FAQs available at this time.
            </div>
          )}
          {Object.entries(groupedFAQs).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
                {category}
              </p>
              <div
                className="rounded-xl overflow-hidden divide-y"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', borderColor: 'var(--border)' }}
              >
                {items.map((faq) => (
                  <div key={faq.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4"
                      style={{ color: 'var(--text)' }}
                    >
                      <span className="font-medium text-sm">{faq.question}</span>
                      <span
                        className="flex-shrink-0 text-xs transition-transform"
                        style={{
                          color: 'var(--muted)',
                          transform: expandedId === faq.id ? 'rotate(180deg)' : 'none',
                          display: 'inline-block',
                        }}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedId === faq.id && (
                      <div
                        className="px-5 pb-4 text-sm"
                        style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px' }}
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!faqLoading && faqs.length > 0 && (
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Still can't find an answer?
              </p>
              <button
                type="button"
                onClick={() => setTab('contact')}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--primary)' }}
              >
                Contact Support
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ContactSupportPage
