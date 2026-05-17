import React, { useEffect, useState } from 'react'
import { customerPortalService, type FAQ } from '../../services/customerPortalService'

type Tab = 'contact' | 'faqs'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  Low:    { color: '#059669', bg: '#f0fdf4' },
  Medium: { color: '#2563eb', bg: '#eff6ff' },
  High:   { color: '#ca8a04', bg: '#fefce8' },
  Urgent: { color: '#dc2626', bg: '#fef2f2' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid var(--border)', borderRadius: 7,
  fontSize: 13, color: 'var(--text)', background: 'var(--card-bg)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
    {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
  </label>
)

const SectionRule = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
    <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</p>
  </div>
)

const ContactSupportPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('contact')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
          setFaqs(data); setFaqError(null)
        } catch (err) {
          setFaqError('Unable to load FAQs.')
          console.error('Error loading FAQs:', err)
        } finally { setFaqLoading(false) }
      }
      fetchFAQs()
    }
  }, [tab, faqs.length, faqLoading])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!subject || !description) { setError('Please fill in all required fields.'); return }
    try {
      setSubmitting(true); setError(null)
      await customerPortalService.createSupportTicket(subject, description, priority)
      setSuccess('Support ticket created. Our team will get back to you soon.')
      setSubject(''); setDescription(''); setPriority('Medium')
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError('Unable to create support ticket.')
      console.error('Error creating ticket:', err)
    } finally { setSubmitting(false) }
  }

  const groupedFAQs = faqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
    const cat = faq.category || 'General'
    ;(acc[cat] ??= []).push(faq)
    return acc
  }, {})

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button type="button" onClick={() => setTab(id)} style={{
      padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: tab === id ? 600 : 500,
      color: tab === id ? 'var(--primary)' : 'var(--muted)',
      background: tab === id ? 'var(--card-bg)' : 'transparent',
      boxShadow: tab === id ? 'var(--shadow)' : 'none',
      border: tab === id ? '1px solid var(--border)' : '1px solid transparent',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 24px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 4, height: 26, borderRadius: 2, background: 'var(--primary)', display: 'block', flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Support Center</h1>
        </div>
        <p style={{ margin: '0 0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          Submit a ticket or browse frequently asked questions.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9, width: 'fit-content', background: 'var(--surface-container)' }}>
        <TabBtn id="contact" label="Contact Support" />
        <TabBtn id="faqs" label="FAQs" />
      </div>

      {/* Contact form */}
      {tab === 'contact' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

          {/* Form */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)' }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Submit a Support Ticket</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Describe your issue and we'll respond as soon as possible.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{error}</div>}
              {success && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{success}</div>}

              <div>
                <FieldLabel required>Subject</FieldLabel>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  style={inputStyle} placeholder="Brief subject of your inquiry" required />
              </div>

              {/* Priority */}
              <div>
                <FieldLabel>Priority Level</FieldLabel>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRIORITIES.map((p) => {
                    const ps = PRIORITY_STYLE[p]
                    const isSelected = priority === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                          background: isSelected ? ps.bg : 'transparent',
                          color: isSelected ? ps.color : 'var(--muted)',
                          border: isSelected ? `1px solid ${ps.color}30` : '1px solid var(--border)',
                        }}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <FieldLabel required>Description</FieldLabel>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }} rows={5}
                  placeholder="Describe your issue or inquiry in detail…" required />
              </div>

              <button type="submit" disabled={submitting} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: '#fff', background: 'var(--primary)', border: 'none',
                cursor: 'pointer', opacity: submitting ? 0.6 : 1,
                alignSelf: 'flex-start', boxShadow: '0 2px 6px rgba(29,99,193,0.25)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </form>
          </div>

          {/* Info sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Hours */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Support Hours</p>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { day: 'Monday – Friday', hours: '9:00 AM – 6:00 PM', open: true },
                  { day: 'Saturday', hours: '10:00 AM – 3:00 PM', open: true },
                  { day: 'Sunday', hours: 'Closed', open: false },
                ].map((item) => (
                  <div key={item.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.day}</span>
                    <span style={{ fontSize: 12, color: item.open ? '#059669' : '#dc2626', fontWeight: 600 }}>{item.hours}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Contact Information</p>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }}>✉️</span>
                  <a href="mailto:support@cmnetwork.com" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                    support@cmnetwork.com
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }}>📞</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>+1 (555) 123-4567</span>
                </div>
              </div>
            </div>

            {/* Expected response */}
            <div style={{ background: 'color-mix(in srgb, var(--primary) 5%, white)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Expected Response Time</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--primary)', opacity: 0.8 }}>Low/Medium: within 24 hours</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--primary)', opacity: 0.8 }}>High/Urgent: within 4 hours</p>
            </div>
          </div>
        </div>
      )}

      {/* FAQs tab */}
      {tab === 'faqs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {faqLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 52, background: '#f1f5f9', borderRadius: 8, opacity: 1 - i * 0.2 }} />)}
            </div>
          )}
          {faqError && <div style={{ padding: '10px 14px', borderRadius: 7, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{faqError}</div>}
          {!faqLoading && faqs.length === 0 && !faqError && (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 13 }}>
              No FAQs available at this time.
            </div>
          )}
          {Object.entries(groupedFAQs).map(([category, items]) => (
            <div key={category}>
              <SectionRule label={category} />
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                {items.map((faq, i) => (
                  <div key={faq.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                      style={{
                        width: '100%', padding: '14px 18px', textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        background: expandedId === faq.id ? 'color-mix(in srgb, var(--primary) 3%, white)' : 'transparent',
                        border: 'none', cursor: 'pointer', color: 'var(--text)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{faq.question}</span>
                      <span style={{
                        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                        background: expandedId === faq.id ? 'var(--primary)' : 'var(--surface-container)',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: expandedId === faq.id ? '#fff' : 'var(--muted)',
                        fontSize: 11, fontWeight: 700,
                        transform: expandedId === faq.id ? 'rotate(180deg)' : 'none',
                        transition: 'all 0.2s',
                      }}>▼</span>
                    </button>
                    {expandedId === faq.id && (
                      <div style={{
                        padding: '0 18px 16px',
                        fontSize: 13, color: 'var(--muted)', lineHeight: 1.6,
                        borderTop: '1px solid var(--border)',
                        paddingTop: 12,
                      }}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!faqLoading && faqs.length > 0 && (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 20px', boxShadow: 'var(--shadow)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Still can't find an answer?
              </p>
              <button
                type="button"
                onClick={() => setTab('contact')}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: '#fff', background: 'var(--primary)', border: 'none',
                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(29,99,193,0.2)',
                }}
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
