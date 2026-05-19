import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  customerPortalService,
  type ConfirmLoanInstallmentPaymentResponse,
} from '../../services/customerPortalService'
import { useNotificationStore } from '../../store/notificationStore'

type ResultState = 'loading' | 'success' | 'pending' | 'failed' | 'cancelled'

const C = {
  primary: 'var(--primary)',
  cardBg: 'var(--card-bg)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  shadow: 'var(--shadow)',
  success: '#059669',
  successBg: '#ecfdf5',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warningBg: '#fffbeb',
  warning: '#b45309',
} as const

const POLL_INTERVAL_MS = 5000
const POLL_MAX_MS = 90000

const fmtAmount = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

const fmtDate = (iso?: string) => {
  if (!iso) {
    return '—'
  }

  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export const LoanInstallmentResultPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pushToast = useNotificationStore((state) => state.push)

  const refId = searchParams.get('refId') ?? ''
  const loanIdFromQuery = searchParams.get('loanId') ?? ''
  const paymentIdFromQuery = searchParams.get('paymentId') ?? ''
  const outcome = searchParams.get('outcome') ?? ''
  const isPlaceholderRefId = refId.trim() === '{CHECKOUT_SESSION_ID}'
  const effectiveRefId = isPlaceholderRefId ? '' : refId

  const [resultState, setResultState] = useState<ResultState>('loading')
  const [details, setDetails] = useState<ConfirmLoanInstallmentPaymentResponse | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartedAtRef = useRef<number>(Date.now())
  const resolvedRef = useRef(false)

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const handleClose = useCallback(() => {
    const loanId = details?.loanId || loanIdFromQuery
    const params = new URLSearchParams({ tab: 'payments' })
    if (loanId) {
      params.set('loanId', loanId)
    }
    navigate(`/module/loans?${params.toString()}`)
  }, [details?.loanId, loanIdFromQuery, navigate])

  const confirmPayment = useCallback(async () => {
    const hasLookupContext = Boolean(loanIdFromQuery && paymentIdFromQuery)
    if (!effectiveRefId && !hasLookupContext) {
      setResultState('failed')
      return
    }

    try {
      const response = await customerPortalService.confirmLoanInstallmentPayment(effectiveRefId, {
        loanId: loanIdFromQuery || undefined,
        paymentId: paymentIdFromQuery || undefined,
      })
      setDetails(response)

      if (response.completed) {
        resolvedRef.current = true
        stopPolling()
        setResultState('success')
        pushToast('success', 'Installment payment confirmed.')
      } else {
        setResultState('pending')
      }
    } catch {
      setResultState('failed')
    }
  }, [effectiveRefId, loanIdFromQuery, paymentIdFromQuery, pushToast])

  const pollStatus = useCallback(async () => {
    const hasLookupContext = Boolean(loanIdFromQuery && paymentIdFromQuery)
    if ((!effectiveRefId && !hasLookupContext) || resolvedRef.current) {
      return
    }

    try {
      const status = await customerPortalService.getLoanInstallmentPaymentStatus(effectiveRefId, {
        loanId: loanIdFromQuery || undefined,
        paymentId: paymentIdFromQuery || undefined,
      })
      if (status.status === 'Completed') {
        await confirmPayment()
        return
      }

      if (status.isTerminal && status.status !== 'Completed') {
        resolvedRef.current = true
        stopPolling()
        setResultState('failed')
        return
      }
    } catch {
      // continue polling
    }

    const elapsed = Date.now() - pollStartedAtRef.current
    if (elapsed >= POLL_MAX_MS) {
      stopPolling()
      return
    }

    pollTimerRef.current = setTimeout(() => {
      void pollStatus()
    }, POLL_INTERVAL_MS)
  }, [confirmPayment, effectiveRefId, loanIdFromQuery, paymentIdFromQuery])

  useEffect(() => {
    if (outcome === 'cancel') {
      setResultState('cancelled')
      return
    }

    const hasLookupContext = Boolean(loanIdFromQuery && paymentIdFromQuery)
    if (!effectiveRefId && !hasLookupContext) {
      setResultState('failed')
      return
    }

    pollStartedAtRef.current = Date.now()
    void confirmPayment().then(() => {
      if (!resolvedRef.current) {
        void pollStatus()
      }
    })

    return () => {
      stopPolling()
    }
  }, [confirmPayment, effectiveRefId, loanIdFromQuery, outcome, paymentIdFromQuery, pollStatus])

  const handleRefresh = useCallback(async () => {
    const hasLookupContext = Boolean(loanIdFromQuery && paymentIdFromQuery)
    if (!effectiveRefId && !hasLookupContext) {
      return
    }

    setIsRefreshing(true)
    try {
      await confirmPayment()
      if (!resolvedRef.current) {
        await pollStatus()
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [confirmPayment, effectiveRefId, loanIdFromQuery, paymentIdFromQuery, pollStatus])

  if (resultState === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: C.muted }}>
        <p>Verifying installment payment...</p>
      </div>
    )
  }

  const isSuccess = resultState === 'success'
  const isPending = resultState === 'pending'
  const isCancelled = resultState === 'cancelled'

  return (
    <div style={{ padding: '24px 28px', display: 'grid', gap: 16 }}>
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: C.shadow,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Installment Payment Result</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>Vendor: PayMongo</p>
      </div>

      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: C.shadow,
      }}>
        {isSuccess && (
          <div style={{
            border: `1px solid #86efac`,
            borderRadius: 10,
            background: C.successBg,
            padding: 14,
            marginBottom: 12,
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.success }}>Payment Completed</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text }}>Your installment was confirmed and posted successfully.</p>
          </div>
        )}

        {isPending && (
          <div style={{
            border: `1px solid #fde68a`,
            borderRadius: 10,
            background: C.warningBg,
            padding: 14,
            marginBottom: 12,
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.warning }}>Payment Processing</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text }}>We are waiting for payment confirmation from PayMongo.</p>
          </div>
        )}

        {(resultState === 'failed' || isCancelled) && (
          <div style={{
            border: `1px solid #fecaca`,
            borderRadius: 10,
            background: C.dangerBg,
            padding: 14,
            marginBottom: 12,
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.danger }}>
              {isCancelled ? 'Payment Cancelled' : 'Payment Not Completed'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text }}>
              {isCancelled ? 'You cancelled the hosted checkout before completion.' : 'We could not verify your installment payment.'}
            </p>
          </div>
        )}

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: C.muted }}>Amount</span>
            <strong style={{ color: C.text }}>{details ? fmtAmount(details.amount) : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: C.muted }}>Receipt Date</span>
            <strong style={{ color: C.text }}>{fmtDate(details?.completedAt)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 10 }}>
            <span style={{ color: C.muted, flexShrink: 0 }}>Reference Number</span>
            <strong style={{ color: C.text, textAlign: 'right', wordBreak: 'break-all' }}>{details?.referenceNo || effectiveRefId || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: C.muted }}>Installment Payment ID</span>
            <strong style={{ color: C.text }}>{details?.paymentId || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: C.muted }}>Status</span>
            <strong style={{ color: C.text }}>{details?.status || resultState}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          {isPending && (
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: '#fff',
                color: C.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.7 : 1,
              }}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: C.primary,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close and Return to Payment Page
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoanInstallmentResultPage
