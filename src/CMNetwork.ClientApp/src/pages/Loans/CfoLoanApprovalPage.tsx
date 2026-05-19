import { useState, useEffect, useCallback } from 'react'
import { loanReviewService, type LoanApplicationSummary, type LoanApplicationDetail, type CfoDecisionHistory } from '../../services/loanReviewService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: 'var(--primary)',
  cardBg: 'var(--card-bg)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  shadow: 'var(--shadow)',
  surface: 'var(--surface-container, #f8f9fa)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#ca8a04',
  info: '#2563eb',
} as const

// ─── Primitives ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; text: string }> = {
    Submitted:  { bg: '#eff6ff', text: '#1e40af' },
    Approved:   { bg: '#f0fdf4', text: '#166534' },
    Rejected:   { bg: '#fef2f2', text: '#991b1b' },
    Disbursed:  { bg: '#f5f3ff', text: '#5b21b6' },
  }
  const c = map[status] ?? { bg: '#f3f4f6', text: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {status}
    </span>
  )
}

const SectionLabel = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
    <span style={{ width: 3, height: 16, borderRadius: 2, background: C.primary, flexShrink: 0 }} />
    <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
  </div>
)

const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
    <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
  </div>
)

const CreditExposurePanel = ({ detail }: { detail: LoanApplicationDetail }) => {
  const used = detail.creditLimit > 0 ? (detail.currentExposure / detail.creditLimit) * 100 : 0
  const pct = Math.min(used, 100)
  const barColor = pct >= 90 ? C.danger : pct >= 70 ? C.warning : C.success
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
      <SectionLabel label="Credit Exposure" />
      <InfoRow label="Credit Limit" value={fmt(detail.creditLimit)} />
      <InfoRow label="Current Exposure" value={fmt(detail.currentExposure)} />
      <InfoRow label="Available Credit" value={<span style={{ color: detail.availableCredit > 0 ? C.success : C.danger }}>{fmt(detail.availableCredit)}</span>} />
      <div style={{ marginTop: 10 }}>
        <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: 10, color: C.muted, marginTop: 4, display: 'block' }}>{pct.toFixed(1)}% utilized</span>
      </div>
    </div>
  )
}

const VALID_TERMS = [3, 6, 12, 24, 36, 48, 60]

// ─── Approval Panel ───────────────────────────────────────────────────────────
interface ApprovalPanelProps {
  applicationId: string
  tiers: { termMonths: number; annualInterestRate: number }[]
  onClose: () => void
  onSuccess: () => void
}

const ApprovalPanel = ({ applicationId, tiers, onClose, onSuccess }: ApprovalPanelProps) => {
  const pushToast = useNotificationStore((s) => s.push)
  const [detail, setDetail] = useState<LoanApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overrideTermMonths, setOverrideTermMonths] = useState('')
  const [cfoNotes, setCfoNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loanReviewService.getApplicationForReview(applicationId).then((d) => {
      if (cancelled) return
      setDetail(d)
      setOverrideAmount(String(d.approvedAmount ?? d.requestedAmount))
      setOverrideTermMonths(String(d.approvedTermMonths ?? d.requestedTermMonths))
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applicationId])

  const resolvedRate = tiers.find((t) => t.termMonths === Number(overrideTermMonths))?.annualInterestRate

  const monthlyPayment = (() => {
    const p = Number(overrideAmount)
    const n = Number(overrideTermMonths)
    if (!p || !n || !resolvedRate) return null
    const r = resolvedRate / 100 / 12
    if (r === 0) return p / n
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  })()

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await loanReviewService.approveLoan(applicationId, {
        cfoNotes: cfoNotes || undefined,
        approvedAmount: overrideAmount ? Number(overrideAmount) : undefined,
        approvedTermMonths: overrideTermMonths ? Number(overrideTermMonths) : undefined,
      })
      pushToast('success', 'Loan application approved.')
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Approval failed.'
      pushToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      pushToast('warning', 'Rejection reason is required.')
      return
    }
    setSubmitting(true)
    try {
      await loanReviewService.rejectLoan(applicationId, { rejectionReason: rejectReason })
      pushToast('success', 'Loan application rejected.')
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Rejection failed.'
      pushToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: C.cardBg, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>CFO Loan Decision</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted, lineHeight: 1 }}>×</button>
        </div>

        {loading || !detail ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading…</div>
        ) : (
          <>
            <SectionLabel label="Application Summary" />
            <InfoRow label="Customer" value={detail.customerName} />
            <InfoRow label="Requested Amount" value={fmt(detail.requestedAmount)} />
            <InfoRow label="Accountant Recommended" value={fmt(detail.approvedAmount ?? detail.requestedAmount)} />
            <InfoRow label="Term" value={`${detail.approvedTermMonths ?? detail.requestedTermMonths} months`} />
            <InfoRow label="Interest Rate (policy)" value={`${detail.interestRate ?? 0}% p.a.`} />
            <InfoRow label="Purpose" value={detail.purpose} />
            <InfoRow label="Reviewed" value={fmtDate(detail.reviewedAt)} />

            {detail.accountantReviewNotes && (
              <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#854d0e' }}>
                <strong>Accountant Notes:</strong> {detail.accountantReviewNotes}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <CreditExposurePanel detail={detail} />
            </div>

            {/* Action selection */}
            {action === null && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <button
                  onClick={() => setAction('approve')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setAction('reject')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: C.danger, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✕ Reject
                </button>
              </div>
            )}

            {action === 'approve' && (
              <>
                <SectionLabel label="CFO Override (Optional)" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Final Amount (₱)</label>
                    <input
                      type="number"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Final Term</label>
                    <select
                      value={overrideTermMonths}
                      onChange={(e) => setOverrideTermMonths(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13 }}
                    >
                      {VALID_TERMS.map((t) => {
                        const tier = tiers.find((x) => x.termMonths === t)
                        return (
                          <option key={t} value={t} disabled={!tier}>
                            {t} months{tier ? ` — ${tier.annualInterestRate}% p.a.` : ' (no tier)'}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                {resolvedRate !== undefined && monthlyPayment !== null && (
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 20,
                  }}>
                    <div><span style={{ fontSize: 11, color: '#166534' }}>Rate</span><br /><strong style={{ fontSize: 14, color: '#14532d' }}>{resolvedRate}% p.a.</strong></div>
                    <div><span style={{ fontSize: 11, color: '#166534' }}>Monthly</span><br /><strong style={{ fontSize: 14, color: '#14532d' }}>{fmt(monthlyPayment)}</strong></div>
                    <div><span style={{ fontSize: 11, color: '#166534' }}>Total</span><br /><strong style={{ fontSize: 14, color: '#14532d' }}>{fmt(monthlyPayment * Number(overrideTermMonths))}</strong></div>
                  </div>
                )}

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>CFO Notes (Optional)</label>
                  <textarea
                    value={cfoNotes}
                    onChange={(e) => setCfoNotes(e.target.value)}
                    rows={3}
                    placeholder="Approval notes for customer record…"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setAction(null)} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}>
                    Back
                  </button>
                  <button onClick={handleApprove} disabled={submitting} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Approving…' : 'Confirm Approval'}
                  </button>
                </div>
              </>
            )}

            {action === 'reject' && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Rejection Reason <span style={{ color: C.danger }}>*</span></label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="Explain why this application is rejected…"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setAction(null)} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}>
                    Back
                  </button>
                  <button onClick={handleReject} disabled={submitting} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: C.danger, color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Rejecting…' : 'Confirm Rejection'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Application Card ─────────────────────────────────────────────────────────
const PendingCard = ({ app, onOpen }: { app: LoanApplicationSummary; onOpen: () => void }) => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.warning}`,
    borderRadius: 10, padding: '16px 20px', boxShadow: C.shadow, marginBottom: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
  }}>
    <div style={{ flex: 1, minWidth: 200 }}>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{app.customerName}</p>
      <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
        Recommended: {fmt(app.approvedAmount ?? app.requestedAmount)} · {app.approvedTermMonths ?? app.requestedTermMonths} months
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
        Reviewed: {fmtDate(app.reviewedAt)} · Rate: {(app.annualInterestRate ?? app.interestRate ?? 0)}% p.a.
      </p>
      {app.accountantNotes && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>"{app.accountantNotes}"</p>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <StatusBadge status={app.status} />
      <button
        onClick={onOpen}
        style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: C.warning, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Decide
      </button>
    </div>
  </div>
)

// ─── Decision History Card ────────────────────────────────────────────────────
const HistoryCard = ({ decision }: { decision: CfoDecisionHistory }) => {
  const borderColor = decision.status === 'Approved' ? C.success : C.danger
  const statusColor = decision.status === 'Approved' ? '#f0fdf4' : '#fef2f2'
  const statusTextColor = decision.status === 'Approved' ? '#166534' : '#991b1b'
  
  return (
    <div style={{
      background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${borderColor}`,
      borderRadius: 10, padding: '16px 20px', boxShadow: C.shadow, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{decision.customerName}</p>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
            Amount: {fmt(decision.approvedAmount ?? decision.requestedAmount)} · {decision.approvedTermMonths ?? decision.requestedTermMonths} months
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Rate: {(decision.annualInterestRate ?? 0)}% p.a. · Decided: {fmtDate(decision.decidedAt)}
          </p>
        </div>
        <div style={{
          background: statusColor, color: statusTextColor, padding: '6px 12px',
          borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
        }}>
          {decision.status}
        </div>
      </div>
      {decision.cfoNotes && (
        <div style={{
          background: '#f3f4f6', border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '8px 12px', fontSize: 12, color: C.text, marginTop: 8
        }}>
          <strong>Notes:</strong> {decision.cfoNotes}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'history'

const CfoLoanApprovalPage: React.FC = () => {
  const pushToast = useNotificationStore((s) => s.push)
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<LoanApplicationSummary[]>([])
  const [history, setHistory] = useState<CfoDecisionHistory[]>([])
  const [tiers, setTiers] = useState<{ termMonths: number; annualInterestRate: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes, tiersRes] = await Promise.all([
        loanReviewService.getPendingCfoApproval(),
        loanReviewService.getCfoDecisionHistory(),
        loanReviewService.getLoanTiers(),
      ])
      setPending(pendingRes)
      setHistory(historyRes)
      setTiers(tiersRes.map((t) => ({ termMonths: t.termMonths, annualInterestRate: t.annualInterestRate })))
    } catch {
      pushToast('error', 'Failed to load CFO approval queue.')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => { load() }, [load])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending Approval', count: pending.length },
    { id: 'history', label: 'Decision History', count: history.length },
  ]

  const pendingRecommended = pending.reduce((sum, app) => sum + (app.approvedAmount ?? app.requestedAmount), 0)
  const averageRate = pending.length > 0
    ? pending.reduce((sum, app) => sum + (app.annualInterestRate ?? app.interestRate ?? 0), 0) / pending.length
    : 0

  return (
    <div className="loan-module-page">
      <div className="loan-module-header">
        <div>
          <h1 className="loan-module-title">Loan Approval</h1>
          <p className="loan-module-subtitle">Evaluate accountant recommendations, finalize loan decisions, and preserve policy alignment before disbursement.</p>
        </div>
      </div>

      <div className="loan-module-kpis">
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Pending Cases</span>
          <p className="loan-module-kpi-value">{pending.length}</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Recommended Value</span>
          <p className="loan-module-kpi-value" style={{ fontSize: '1.1rem' }}>{fmt(pendingRecommended)}</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Average Rate</span>
          <p className="loan-module-kpi-value">{averageRate.toFixed(2)}%</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Available Terms</span>
          <p className="loan-module-kpi-value">{tiers.length}</p>
        </div>
      </div>

      <div className="loan-module-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`loan-module-tab ${tab === t.id ? 'active' : ''}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="loan-module-tab-badge">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="loan-module-content">
        {loading ? (
          <div className="loan-module-state">Loading...</div>
        ) : (
          <>
          {tab === 'pending' && (
            <>
              {pending.length === 0 ? (
                <div className="loan-module-state">No applications pending CFO approval.</div>
              ) : (
                pending.map((app) => (
                  <PendingCard key={app.id} app={app} onOpen={() => setDecidingId(app.id)} />
                ))
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              {history.length === 0 ? (
                <div className="loan-module-state">No CFO decisions yet.</div>
              ) : (
                history.map((decision) => (
                  <HistoryCard key={decision.id} decision={decision} />
                ))
              )}
            </>
          )}
          </>
        )}
      </div>

      {decidingId && (
        <ApprovalPanel
          applicationId={decidingId}
          tiers={tiers}
          onClose={() => setDecidingId(null)}
          onSuccess={() => { setDecidingId(null); load() }}
        />
      )}
    </div>
  )
}

export default CfoLoanApprovalPage
