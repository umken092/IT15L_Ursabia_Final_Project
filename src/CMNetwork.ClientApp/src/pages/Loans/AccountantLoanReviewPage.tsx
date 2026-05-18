import { useState, useEffect, useCallback } from 'react'
import { loanReviewService, type LoanApplicationSummary, type LoanApplicationDetail, type DisbursementApplication } from '../../services/loanReviewService'
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

// ─── Reusable primitives ──────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; text: string }> = {
    Submitted:  { bg: '#eff6ff', text: '#1e40af' },
    UnderReview:{ bg: '#fef3c7', text: '#92400e' },
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
        <span style={{ fontSize: 10, color: C.muted, marginTop: 4, display: 'block' }}>
          {pct.toFixed(1)}% utilized
        </span>
      </div>
    </div>
  )
}

const VALID_TERMS = [3, 6, 12, 24, 36, 48, 60]

// ─── Review Panel ─────────────────────────────────────────────────────────────
interface ReviewPanelProps {
  applicationId: string
  tiers: { termMonths: number; annualInterestRate: number }[]
  onClose: () => void
  onSuccess: () => void
}

const ReviewPanel = ({ applicationId, tiers, onClose, onSuccess }: ReviewPanelProps) => {
  const pushToast = useNotificationStore((s) => s.push)
  const [detail, setDetail] = useState<LoanApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [approvedTermMonths, setApprovedTermMonths] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loanReviewService.getApplicationForReview(applicationId).then((d) => {
      if (cancelled) return
      setDetail(d)
      setApprovedAmount(String(d.approvedAmount ?? d.requestedAmount))
      setApprovedTermMonths(String(d.approvedTermMonths ?? d.requestedTermMonths))
      setNotes(d.accountantReviewNotes ?? '')
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applicationId])

  const resolvedRate = tiers.find((t) => t.termMonths === Number(approvedTermMonths))?.annualInterestRate

  const monthlyPayment = (() => {
    const p = Number(approvedAmount)
    const n = Number(approvedTermMonths)
    if (!p || !n || !resolvedRate) return null
    const r = resolvedRate / 100 / 12
    if (r === 0) return p / n
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  })()

  const handleSubmit = async () => {
    if (!notes.trim()) {
      pushToast('warning', 'Review notes are required.')
      return
    }
    setSubmitting(true)
    try {
      await loanReviewService.reviewApplication(applicationId, {
        accountantNotes: notes,
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        approvedTermMonths: approvedTermMonths ? Number(approvedTermMonths) : undefined,
      })
      pushToast('success', 'Application forwarded to CFO for approval.')
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit review.'
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
        width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Review Loan Application</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted, lineHeight: 1 }}>×</button>
        </div>

        {loading || !detail ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading…</div>
        ) : (
          <>
            <SectionLabel label="Application Details" />
            <InfoRow label="Customer" value={detail.customerName} />
            <InfoRow label="Requested Amount" value={fmt(detail.requestedAmount)} />
            <InfoRow label="Requested Term" value={`${detail.requestedTermMonths} months`} />
            <InfoRow label="Purpose" value={detail.purpose} />
            <InfoRow label="Submitted" value={fmtDate(detail.submittedAt)} />
            <InfoRow label="Status" value={<StatusBadge status={detail.status} />} />

            <div style={{ marginTop: 18 }}>
              <CreditExposurePanel detail={detail} />
            </div>

            <SectionLabel label="Adjustment" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Approved Amount (₱)</label>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Approved Term</label>
                <select
                  value={approvedTermMonths}
                  onChange={(e) => setApprovedTermMonths(e.target.value)}
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
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 20,
              }}>
                <div><span style={{ fontSize: 11, color: '#1e40af' }}>Interest Rate</span><br /><strong style={{ fontSize: 14, color: '#1e3a8a' }}>{resolvedRate}% p.a.</strong></div>
                <div><span style={{ fontSize: 11, color: '#1e40af' }}>Monthly Payment</span><br /><strong style={{ fontSize: 14, color: '#1e3a8a' }}>{fmt(monthlyPayment)}</strong></div>
                <div><span style={{ fontSize: 11, color: '#1e40af' }}>Total Repayment</span><br /><strong style={{ fontSize: 14, color: '#1e3a8a' }}>{fmt(monthlyPayment * Number(approvedTermMonths))}</strong></div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Review Notes <span style={{ color: C.danger }}>*</span></label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Notes for CFO regarding this application…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{ padding: '8px 20px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: C.info, color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Forwarding…' : 'Forward to CFO'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Application Row ──────────────────────────────────────────────────────────
const AppRow = ({ app, onReview }: { app: LoanApplicationSummary; onReview: () => void }) => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.info}`,
    borderRadius: 10, padding: '16px 20px', boxShadow: C.shadow, marginBottom: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
  }}>
    <div style={{ flex: 1, minWidth: 200 }}>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{app.customerName}</p>
      <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
        {fmt(app.requestedAmount)} · {app.requestedTermMonths} months · {fmtDate(app.submittedAt)}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>{app.purpose}</p>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <StatusBadge status={app.status} />
      <button
        onClick={onReview}
        style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: C.info, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Review
      </button>
    </div>
  </div>
)

// ─── Disbursement Row ─────────────────────────────────────────────────────────
const DisburseRow = ({ app, onDisburse, disbursing }: { app: DisbursementApplication; onDisburse: () => void; disbursing: boolean }) => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.success}`,
    borderRadius: 10, padding: '16px 20px', boxShadow: C.shadow, marginBottom: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
  }}>
    <div style={{ flex: 1, minWidth: 200 }}>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{app.customerName}</p>
      <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
        Approved: {fmt(app.approvedAmount ?? app.requestedAmount)} · {app.approvedTermMonths ?? app.requestedTermMonths} months · {(app.interestRate ?? 0)}% p.a.
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>{app.purpose}</p>
    </div>
    <button
      onClick={onDisburse}
      disabled={disbursing}
      style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: C.success, color: '#fff', fontSize: 12, fontWeight: 600, cursor: disbursing ? 'not-allowed' : 'pointer', opacity: disbursing ? 0.7 : 1 }}
    >
      {disbursing ? 'Disbursing…' : 'Disburse Loan'}
    </button>
  </div>
)

// ─── Forwarded Row (read-only) ────────────────────────────────────────────────
const ForwardedRow = ({ app }: { app: LoanApplicationSummary }) => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.warning}`,
    borderRadius: 10, padding: '16px 20px', boxShadow: C.shadow, marginBottom: 10,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{app.customerName}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          Recommended: {fmt(app.approvedAmount ?? app.requestedAmount)} · {app.approvedTermMonths ?? app.requestedTermMonths} months
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
          Reviewed: {fmtDate(app.reviewedAt)} · Rate: {(app.annualInterestRate ?? app.interestRate ?? 0)}% p.a.
        </p>
      </div>
      <StatusBadge status="Pending CFO" />
    </div>
    {app.accountantNotes && (
      <p style={{ margin: '10px 0 0', fontSize: 12, color: C.muted, fontStyle: 'italic', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        Notes: {app.accountantNotes}
      </p>
    )}
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'forwarded' | 'disbursement'

const AccountantLoanReviewPage: React.FC = () => {
  const pushToast = useNotificationStore((s) => s.push)
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<LoanApplicationSummary[]>([])
  const [forwarded, setForwarded] = useState<LoanApplicationSummary[]>([])
  const [disbursementQueue, setDisbursementQueue] = useState<DisbursementApplication[]>([])
  const [tiers, setTiers] = useState<{ termMonths: number; annualInterestRate: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [disbursingId, setDisbursingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, disbursementRes, tiersRes] = await Promise.all([
        loanReviewService.getPendingApplications(),
        loanReviewService.getApprovedForDisbursement(),
        loanReviewService.getLoanTiers(),
      ])
      const notYetReviewed = pendingRes.filter((a) => !a.reviewedAt)
      const reviewed = pendingRes.filter((a) => !!a.reviewedAt)
      setPending(notYetReviewed)
      setForwarded(reviewed)
      setDisbursementQueue(disbursementRes)
      setTiers(tiersRes.map((t) => ({ termMonths: t.termMonths, annualInterestRate: t.annualInterestRate })))
    } catch {
      pushToast('error', 'Failed to load loan data.')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => { load() }, [load])

  const handleDisburse = async (id: string) => {
    setDisbursingId(id)
    try {
      await loanReviewService.disburseLoan(id)
      pushToast('success', 'Loan disbursed successfully.')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Disbursement failed.'
      pushToast('error', msg)
    } finally {
      setDisbursingId(null)
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending Review', count: pending.length },
    { id: 'forwarded', label: 'Forwarded to CFO', count: forwarded.length },
    { id: 'disbursement', label: 'Disbursement Queue', count: disbursementQueue.length },
  ]

  const totalPendingAmount = pending.reduce((sum, item) => sum + item.requestedAmount, 0)
  const totalDisbursementAmount = disbursementQueue.reduce((sum, item) => sum + (item.approvedAmount ?? item.requestedAmount), 0)

  return (
    <div className="loan-module-page">
      <div className="loan-module-header">
        <div>
          <h1 className="loan-module-title">Loan Review</h1>
          <p className="loan-module-subtitle">Review customer loan applications, forward recommendations to CFO, and release approved disbursements from one control center.</p>
        </div>
      </div>

      <div className="loan-module-kpis">
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Pending Review</span>
          <p className="loan-module-kpi-value">{pending.length}</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Forwarded to CFO</span>
          <p className="loan-module-kpi-value">{forwarded.length}</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Pending Amount</span>
          <p className="loan-module-kpi-value" style={{ fontSize: '1.1rem' }}>{fmt(totalPendingAmount)}</p>
        </div>
        <div className="loan-module-kpi">
          <span className="loan-module-kpi-label">Disbursement Queue</span>
          <p className="loan-module-kpi-value" style={{ fontSize: '1.1rem' }}>{fmt(totalDisbursementAmount)}</p>
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
            {t.count > 0 && (
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
                <div className="loan-module-state">No applications pending review.</div>
              ) : (
                pending.map((app) => (
                  <AppRow key={app.id} app={app} onReview={() => setReviewingId(app.id)} />
                ))
              )}
            </>
          )}

          {tab === 'forwarded' && (
            <>
              {forwarded.length === 0 ? (
                <div className="loan-module-state">No applications forwarded to CFO yet.</div>
              ) : (
                forwarded.map((app) => <ForwardedRow key={app.id} app={app} />)
              )}
            </>
          )}

          {tab === 'disbursement' && (
            <>
              {disbursementQueue.length === 0 ? (
                <div className="loan-module-state">No approved loans awaiting disbursement.</div>
              ) : (
                disbursementQueue.map((app) => (
                  <DisburseRow
                    key={app.id}
                    app={app}
                    disbursing={disbursingId === app.id}
                    onDisburse={() => handleDisburse(app.id)}
                  />
                ))
              )}
            </>
          )}
          </>
        )}
      </div>

      {reviewingId && (
        <ReviewPanel
          applicationId={reviewingId}
          tiers={tiers}
          onClose={() => setReviewingId(null)}
          onSuccess={() => { setReviewingId(null); load() }}
        />
      )}
    </div>
  )
}

export default AccountantLoanReviewPage
