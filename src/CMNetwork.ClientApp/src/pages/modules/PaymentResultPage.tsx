import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { customerPortalService, type ConfirmPaymentResponse, type CustomerPaymentRecord } from '../../services/customerPortalService'
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
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  warning: '#d97706',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
} as const

type PageState = 'loading' | 'success' | 'pending' | 'failed' | 'cancelled'

interface PaymentDetails {
  paymentId: string
  amount?: number
  status: string
  completedAt?: string
  invoiceIds?: string
  sessionId?: string
}

// ─── Timeline component ───────────────────────────────────────────────────────
type StepStatus = 'done' | 'active' | 'pending'

interface TimelineStep {
  label: string
  description: string
  status: StepStatus
}

const Timeline = ({ steps }: { steps: TimelineStep[] }) => (
  <div style={{ margin: '32px 0' }}>
    {steps.map((step, i) => (
      <div key={step.label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: i < steps.length - 1 ? 0 : undefined }}>
        {/* Connector column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 28 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            background: step.status === 'done' ? C.success : step.status === 'active' ? C.primary : '#e5e7eb',
            color: step.status === 'pending' ? '#9ca3af' : '#fff',
            border: step.status === 'active' ? `2px solid ${C.primary}` : 'none',
            boxSizing: 'border-box',
          }}>
            {step.status === 'done' ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 2,
              flexGrow: 1,
              minHeight: 28,
              background: step.status === 'done' ? C.success : '#e5e7eb',
            }} />
          )}
        </div>
        {/* Content column */}
        <div style={{ paddingBottom: i < steps.length - 1 ? 20 : 0, paddingTop: 2 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: step.status === 'pending' ? '#9ca3af' : C.text }}>{step.label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{step.description}</p>
        </div>
      </div>
    ))}
  </div>
)

// ─── State illustrations ──────────────────────────────────────────────────────
const SuccessIcon = () => (
  <div style={{
    width: 72, height: 72, borderRadius: '50%',
    background: C.successBg, border: `2px solid ${C.successBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, margin: '0 auto 16px',
  }}>✓</div>
)

const PendingIcon = () => (
  <div style={{
    width: 72, height: 72, borderRadius: '50%',
    background: C.warningBg, border: `2px solid ${C.warningBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, margin: '0 auto 16px',
  }}>⏳</div>
)

const FailedIcon = () => (
  <div style={{
    width: 72, height: 72, borderRadius: '50%',
    background: C.dangerBg, border: `2px solid ${C.dangerBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, margin: '0 auto 16px',
  }}>✕</div>
)

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Detail row ───────────────────────────────────────────────────────────────
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border}`, gap: 16 }}>
    <span style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: C.text, fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
)

// ─── Btn ──────────────────────────────────────────────────────────────────────
interface BtnProps {
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'success'
  disabled?: boolean
  children: React.ReactNode
}
const Btn = ({ onClick, variant = 'primary', disabled, children }: BtnProps) => {
  const bg = variant === 'primary' ? C.primary : variant === 'success' ? C.success : 'transparent'
  const color = variant === 'secondary' ? C.primary : '#fff'
  const border = variant === 'secondary' ? `1.5px solid ${C.primary}` : 'none'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '10px 20px', borderRadius: 8, border,
        background: disabled ? '#e5e7eb' : bg, color: disabled ? '#9ca3af' : color,
        fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5_000
const POLL_MAX_MS = 90_000

export const PaymentResultPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const pushToast = useNotificationStore((state) => state.push)

  const refId = searchParams.get('refId') ?? ''
  const outcome = searchParams.get('outcome') ?? '' // 'success' | 'cancel'

  const [pageState, setPageState] = useState<PageState>('loading')
  const [details, setDetails] = useState<PaymentDetails | null>(null)
  const [paymentRecord, setPaymentRecord] = useState<CustomerPaymentRecord | null>(null)
  const [pollElapsed, setPollElapsed] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number>(Date.now())
  const resolvedRef = useRef(false)

  // Build timeline steps based on current state
  const buildTimeline = (state: PageState): TimelineStep[] => {
    const intentDone = state !== 'loading' && state !== 'cancelled'
    const checkoutDone = state === 'success' || state === 'pending'
    const confirmedDone = state === 'success'
    const journalDone = state === 'success'

    return [
      {
        label: 'Payment Intent Created',
        description: 'Your payment session was initialized.',
        status: intentDone ? 'done' : 'active',
      },
      {
        label: 'Checkout Completed',
        description: 'PayMongo received your payment.',
        status: checkoutDone ? 'done' : state === 'cancelled' || state === 'failed' ? 'pending' : 'active',
      },
      {
        label: 'Payment Confirmed',
        description: 'Our system verified and applied the payment.',
        status: confirmedDone ? 'done' : state === 'pending' ? 'active' : 'pending',
      },
      {
        label: 'Journal Entry Posted',
        description: 'Accounting records updated.',
        status: journalDone ? 'done' : 'pending',
      },
    ]
  }

  const stopPolling = () => {
    if (pollRef.current) clearTimeout(pollRef.current)
  }

  const pollStatus = useCallback(async (id: string) => {
    if (resolvedRef.current) return
    try {
      const status = await customerPortalService.getPaymentStatus(id)
      if (status.status === 'Completed') {
        resolvedRef.current = true
        stopPolling()
        setDetails((prev) => prev ? { ...prev, status: status.status, completedAt: status.completedAt } : prev)
        setPageState('success')
        pushToast('success', 'Payment has been confirmed and applied.')
        return
      }
      if (status.status === 'Failed' || status.isTerminal) {
        resolvedRef.current = true
        stopPolling()
        setPageState('failed')
        return
      }
    } catch {
      // keep polling
    }

    const elapsed = Date.now() - pollStartRef.current
    setPollElapsed(elapsed)
    if (elapsed >= POLL_MAX_MS) {
      stopPolling()
      // Leave in pending state — user can manually refresh
      return
    }
    pollRef.current = setTimeout(() => void pollStatus(id), POLL_INTERVAL_MS)
  }, [pushToast])

  useEffect(() => {
    if (outcome === 'cancel') {
      setPageState('cancelled')
      return
    }

    if (!refId) {
      setPageState('failed')
      return
    }

    const run = async () => {
      try {
        // Confirm in parallel with fetching payment list for detail display
        const [confirmation, allPayments] = await Promise.allSettled([
          customerPortalService.confirmPayment(refId),
          customerPortalService.getMyPayments(),
        ])

        let confirmData: ConfirmPaymentResponse | null = null
        if (confirmation.status === 'fulfilled') {
          confirmData = confirmation.value
        }

        // Match payment record
        if (allPayments.status === 'fulfilled') {
          const match = allPayments.value.find(
            (p) => p.payMongoCheckoutSessionId === refId || (confirmData && p.id === confirmData.paymentId),
          )
          if (match) setPaymentRecord(match)
        }

        if (confirmData) {
          setDetails({
            paymentId: confirmData.paymentId,
            status: confirmData.status ?? 'Unknown',
            completedAt: confirmData.completedAt,
            sessionId: refId,
            amount: allPayments.status === 'fulfilled'
              ? allPayments.value.find((p) => p.id === confirmData!.paymentId)?.amount
              : undefined,
            invoiceIds: allPayments.status === 'fulfilled'
              ? allPayments.value.find((p) => p.id === confirmData!.paymentId)?.invoiceIds
              : undefined,
          })

          if (confirmData.completed) {
            resolvedRef.current = true
            setPageState('success')
          } else {
            // Not yet completed — start polling
            setPageState('pending')
            pollStartRef.current = Date.now()
            pollRef.current = setTimeout(() => void pollStatus(refId), POLL_INTERVAL_MS)
          }
        } else {
          // Confirm call failed (network error etc.) — show pending
          setPageState('pending')
          pollStartRef.current = Date.now()
          pollRef.current = setTimeout(() => void pollStatus(refId), POLL_INTERVAL_MS)
        }
      } catch {
        setPageState('pending')
        pollStartRef.current = Date.now()
        pollRef.current = setTimeout(() => void pollStatus(refId), POLL_INTERVAL_MS)
      }
    }

    void run()
    return stopPolling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualRefresh = async () => {
    if (!refId || isRefreshing) return
    setIsRefreshing(true)
    try {
      const status = await customerPortalService.getPaymentStatus(refId)
      if (status.status === 'Completed') {
        resolvedRef.current = true
        stopPolling()
        setDetails((prev) => prev ? { ...prev, status: status.status, completedAt: status.completedAt } : prev)
        setPageState('success')
        pushToast('success', 'Payment has been confirmed and applied.')
      } else if (status.isTerminal) {
        setPageState('failed')
      } else {
        pushToast('info', 'Payment is still being processed. Please wait a moment and try again.')
      }
    } catch {
      pushToast('error', 'Unable to check payment status. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const goToLoans = () => navigate('/module/loans')
  const goToInvoices = () => navigate('/module/invoices')

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Verifying your payment…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const timeline = buildTimeline(pageState)
  const invoiceCount = (details?.invoiceIds ?? paymentRecord?.invoiceIds ?? '')
    .split(',').filter(Boolean).length

  // ── Shared card wrapper ──────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{
        background: C.cardBg,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
      }}>
        {/* Status banner */}
        <div style={{
          padding: '32px 32px 24px',
          textAlign: 'center',
          borderBottom: `1px solid ${C.border}`,
          background: pageState === 'success' ? C.successBg : pageState === 'pending' ? C.warningBg : C.dangerBg,
        }}>
          {pageState === 'success' && <SuccessIcon />}
          {pageState === 'pending' && <PendingIcon />}
          {(pageState === 'failed' || pageState === 'cancelled') && <FailedIcon />}

          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: C.text }}>
            {pageState === 'success' && 'Payment Successful'}
            {pageState === 'pending' && 'Payment Pending'}
            {pageState === 'failed' && 'Payment Failed'}
            {pageState === 'cancelled' && 'Payment Cancelled'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            {pageState === 'success' && 'Your payment has been confirmed and applied to your account.'}
            {pageState === 'pending' && 'Your payment is being processed. This may take a few seconds.'}
            {pageState === 'failed' && 'We could not confirm your payment. Please contact support or try again.'}
            {pageState === 'cancelled' && 'You cancelled the payment session. No charges were made.'}
          </p>

          {pageState === 'pending' && pollElapsed < POLL_MAX_MS && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted }}>
              Auto-checking in {Math.max(0, Math.ceil((POLL_INTERVAL_MS - (pollElapsed % POLL_INTERVAL_MS)) / 1000))}s…
            </p>
          )}
        </div>

        {/* Details section */}
        {(details || paymentRecord) && (
          <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>
              Payment Details
            </p>
            {(details?.amount ?? paymentRecord?.amount) !== undefined && (
              <DetailRow label="Amount" value={fmt.format(details?.amount ?? paymentRecord?.amount ?? 0)} />
            )}
            {(details?.paymentId ?? paymentRecord?.id) && (
              <DetailRow label="Payment ID" value={details?.paymentId ?? paymentRecord?.id ?? '—'} />
            )}
            {details?.sessionId && (
              <DetailRow label="Session ID" value={details.sessionId} />
            )}
            {invoiceCount > 0 && (
              <DetailRow label="Invoices Covered" value={`${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`} />
            )}
            {pageState === 'success' && (details?.completedAt ?? paymentRecord?.completedAt) && (
              <DetailRow label="Confirmed At" value={fmtDate(details?.completedAt ?? paymentRecord?.completedAt)} />
            )}
          </div>
        )}

        {/* Timeline */}
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>
            Progress
          </p>
          <Timeline steps={timeline} />
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 32px', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
          {pageState === 'success' && (
            <>
              <Btn variant="secondary" onClick={goToInvoices}>View Invoices</Btn>
              <Btn variant="success" onClick={goToLoans}>Back to Loans</Btn>
            </>
          )}
          {pageState === 'pending' && (
            <>
              <Btn variant="secondary" onClick={goToLoans}>Back to Loans</Btn>
              <Btn variant="primary" onClick={() => void handleManualRefresh()} disabled={isRefreshing}>
                {isRefreshing ? 'Checking…' : 'Refresh Status'}
              </Btn>
            </>
          )}
          {(pageState === 'failed' || pageState === 'cancelled') && (
            <>
              <Btn variant="secondary" onClick={goToLoans}>Back to Loans</Btn>
              <Btn variant="primary" onClick={goToInvoices}>View Invoices</Btn>
            </>
          )}
        </div>
      </div>

      {/* Support note */}
      {(pageState === 'failed' || pageState === 'pending') && (
        <p style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 16 }}>
          Need help? Contact support with your session ID: <strong>{refId || '—'}</strong>
        </p>
      )}
    </div>
  )
}
