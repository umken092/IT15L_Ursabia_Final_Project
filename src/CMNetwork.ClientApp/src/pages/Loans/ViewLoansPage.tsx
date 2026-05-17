import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerPortalService } from '../../services/customerPortalService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: 'var(--primary)',
  cardBg: 'var(--card-bg)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  shadow: 'var(--shadow)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#ca8a04',
} as const

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    Active: { bg: '#f0fdf4', text: '#166534' },
    FullyPaid: { bg: '#f0fdf4', text: '#166534' },
    Overdue: { bg: '#fef2f2', text: '#991b1b' },
    Restructured: { bg: '#fef3c7', text: '#92400e' },
    WrittenOff: { bg: '#f3f4f6', text: '#6b7280' },
    Submitted: { bg: '#eff6ff', text: '#1e40af' },
    Approved: { bg: '#f5f3ff', text: '#5b21b6' },
    Rejected: { bg: '#fef2f2', text: '#991b1b' },
    Withdrawn: { bg: '#f3f4f6', text: '#6b7280' },
  }
  const c = colors[status] || colors.Active
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
    }}>
      {status}
    </span>
  )
}

const SectionHeader = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    <span style={{ display: 'block', width: 3, height: 16, borderRadius: 2, background: C.primary, flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </p>
  </div>
)

export const ViewLoansPage = () => {
  const navigate = useNavigate()
  const pushToast = useNotificationStore((state) => state.push)

  const [loanAccess, setLoanAccess] = useState<{ canAccessLoans: boolean; profileCompletionPercentage: number; isBankVerified: boolean } | null>(null)
  const [loansData, setLoansData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<'overview' | 'apply' | 'active' | 'applications'>('overview')

  // Form state
  const [formData, setFormData] = useState({
    requestedAmount: '',
    interestRate: '0',
    termMonths: '12',
    purpose: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const access = await customerPortalService.checkLoanAccess()
      setLoanAccess(access)
      if (access.canAccessLoans) {
        const loans = await customerPortalService.getMyLoans()
        setLoansData(loans)
      }
    } catch {
      pushToast('error', 'Unable to load loan information.')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.requestedAmount || parseFloat(formData.requestedAmount) <= 0) {
      pushToast('warning', 'Please enter a valid requested amount.')
      return
    }
    if (!formData.purpose.trim()) {
      pushToast('warning', 'Please enter the purpose of the loan.')
      return
    }

    setSubmitting(true)
    try {
      const result = await customerPortalService.applyForLoan({
        requestedAmount: parseFloat(formData.requestedAmount),
        interestRate: parseFloat(formData.interestRate),
        termMonths: parseInt(formData.termMonths),
        purpose: formData.purpose,
      })
      pushToast('success', result.message)
      setFormData({ requestedAmount: '', interestRate: '0', termMonths: '12', purpose: '' })
      setTab('applications')
      await loadData()
    } catch (error: any) {
      pushToast('error', error?.response?.data?.message || 'Unable to submit application.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', textAlign: 'center', color: C.muted }}>
        <p>Loading loan information...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '20px 24px',
        boxShadow: C.shadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{
            width: 4, height: 28, borderRadius: 2,
            background: C.primary, display: 'block', flexShrink: 0,
          }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
            Loans
          </h1>
        </div>
        <p style={{ margin: '2px 0 0 14px', fontSize: 12, color: C.muted }}>
          Apply for loans, view active loans, and manage repayments.
        </p>
      </div>

      {/* ── Loan Access Status ──────────────────────────────────────────────── */}
      {loanAccess && (
        <div style={{
          background: C.cardBg,
          border: `1px solid ${loanAccess.canAccessLoans ? '#d1fae5' : '#fee2e2'}`,
          borderRadius: 10,
          padding: 16,
          boxShadow: C.shadow,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: loanAccess.canAccessLoans ? '#d1fae5' : '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: loanAccess.canAccessLoans ? '#059669' : '#dc2626',
            }}>
              {loanAccess.canAccessLoans ? '✓' : '○'}
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
              {loanAccess.canAccessLoans ? 'Loan Access Enabled' : 'Loan Access Locked'}
            </p>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Profile Completion:</strong> {loanAccess.profileCompletionPercentage}% / 100%
            </p>
            <p style={{ margin: 0 }}>
              <strong>Bank Verified:</strong> {loanAccess.isBankVerified ? <span style={{ color: '#059669' }}>Yes ✓</span> : <span style={{ color: '#dc2626' }}>No</span>}
            </p>
          </div>
          {!loanAccess.canAccessLoans && (
            <button
              type="button"
              onClick={() => navigate('/module/profile')}
              style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 12,
                background: C.primary, color: '#fff', border: 'none',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Complete Profile
            </button>
          )}
        </div>
      )}

      {!loanAccess?.canAccessLoans ? (
        <div style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '20px 24px',
          textAlign: 'center',
          color: C.muted,
        }}>
          <p>Complete your profile (100%) and verify your bank account to apply for loans.</p>
        </div>
      ) : (
        <>
          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`,
            paddingBottom: 0, overflow: 'auto',
          }}>
            {(['overview', 'active', 'applications', 'apply'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '12px 16px', fontSize: 13, fontWeight: 600,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: tab === t ? C.primary : C.muted,
                  borderBottom: tab === t ? `2px solid ${C.primary}` : 'none',
                  transition: 'color 0.2s',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ──────────────────────────────────────────────── */}
          {tab === 'overview' && loansData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader label="Loan Summary" />
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}>
                <div style={{
                  background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: 16, boxShadow: C.shadow,
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Active Loans
                  </p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
                    {loansData.activeLoans?.length || 0}
                  </p>
                </div>
                <div style={{
                  background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: 16, boxShadow: C.shadow,
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total Outstanding
                  </p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
                    {formatCurrency(loansData.activeLoans?.reduce((sum: number, l: any) => sum + l.outstandingPrincipal, 0) || 0)}
                  </p>
                </div>
                <div style={{
                  background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: 16, boxShadow: C.shadow,
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Pending Applications
                  </p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
                    {loansData.pendingApplications?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Active Loans Tab ──────────────────────────────────────────── */}
          {tab === 'active' && loansData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader label="Active Loans" />
              {loansData.activeLoans?.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No active loans.</p>
              ) : (
                loansData.activeLoans.map((loan: any) => (
                  <div key={loan.id} style={{
                    background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: 16, boxShadow: C.shadow,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                          {formatCurrency(loan.principalAmount)} at {loan.interestRate}%
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>
                          {loan.termMonths} months • Outstanding: {formatCurrency(loan.outstandingPrincipal)}
                        </p>
                      </div>
                      <StatusBadge status={loan.status} />
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                      Disbursed: {new Date(loan.disbursedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Applications Tab ──────────────────────────────────────────── */}
          {tab === 'applications' && loansData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionHeader label="Loan Applications" />
              {loansData.allApplications?.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No applications yet.</p>
              ) : (
                loansData.allApplications.map((app: any) => (
                  <div key={app.id} style={{
                    background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: 16, boxShadow: C.shadow,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                          {formatCurrency(app.requestedAmount)} requested
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>
                          {app.purpose}
                        </p>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: C.muted }}>
                      Submitted: {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Apply Tab ──────────────────────────────────────────────────── */}
          {tab === 'apply' && (
            <form onSubmit={handleApplySubmit} style={{
              background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '24px', boxShadow: C.shadow, display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <SectionHeader label="Apply for Loan" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Requested Amount (PHP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 50000"
                  value={formData.requestedAmount}
                  onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                  style={{
                    padding: '10px 12px', borderRadius: 6, fontSize: 13,
                    border: `1px solid ${C.border}`, background: 'var(--surface)',
                    color: C.text,
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                    style={{
                      padding: '10px 12px', borderRadius: 6, fontSize: 13,
                      border: `1px solid ${C.border}`, background: 'var(--surface)',
                      color: C.text,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Term (Months)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.termMonths}
                    onChange={(e) => setFormData({ ...formData, termMonths: e.target.value })}
                    style={{
                      padding: '10px 12px', borderRadius: 6, fontSize: 13,
                      border: `1px solid ${C.border}`, background: 'var(--surface)',
                      color: C.text,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Purpose
                </label>
                <textarea
                  placeholder="e.g., Business expansion, Working capital, Equipment purchase"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                  style={{
                    padding: '10px 12px', borderRadius: 6, fontSize: 13,
                    border: `1px solid ${C.border}`, background: 'var(--surface)',
                    color: C.text, fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 20px', borderRadius: 6, fontSize: 13,
                  background: C.primary, color: '#fff', border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600,
                  opacity: submitting ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
