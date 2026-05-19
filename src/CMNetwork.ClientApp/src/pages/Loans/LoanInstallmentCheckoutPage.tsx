import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { customerPortalService } from '../../services/customerPortalService'
import { useNotificationStore } from '../../store/notificationStore'

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
} as const

const fmt = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

const fmtDate = (iso: string) => {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export const LoanInstallmentCheckoutPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pushToast = useNotificationStore((state) => state.push)

  const loanId = searchParams.get('loanId') ?? ''
  const paymentId = searchParams.get('paymentId') ?? ''
  const totalAmount = Number.parseFloat(searchParams.get('totalAmount') ?? '0')
  const principalAmount = Number.parseFloat(searchParams.get('principalAmount') ?? '0')
  const interestAmount = Number.parseFloat(searchParams.get('interestAmount') ?? '0')
  const dueAt = searchParams.get('dueAt') ?? ''

  const [processing, setProcessing] = useState(false)

  const canProceed = useMemo(() => {
    return Boolean(loanId && paymentId && Number.isFinite(totalAmount) && totalAmount > 0)
  }, [loanId, paymentId, totalAmount])

  useEffect(() => {
    if (!canProceed) {
      pushToast('error', 'Invalid installment checkout details.')
    }
  }, [canProceed, pushToast])

  const handleClose = useCallback(() => {
    const params = new URLSearchParams({
      tab: 'payments',
      loanId,
    })
    navigate(`/module/loans?${params.toString()}`)
  }, [loanId, navigate])

  const handleProceedToHostedCheckout = useCallback(async () => {
    if (!canProceed) {
      return
    }

    setProcessing(true)
    try {
      const idempotencyKey = `loan-installment-${loanId}-${paymentId}`
      const intent = await customerPortalService.createLoanInstallmentPaymentIntent(loanId, paymentId, idempotencyKey)
      globalThis.location.href = intent.redirectUrl
    } catch (error: any) {
      pushToast('error', error?.response?.data?.message || 'Unable to continue to PayMongo checkout.')
    } finally {
      setProcessing(false)
    }
  }, [canProceed, loanId, paymentId, pushToast])

  return (
    <div style={{ padding: '24px 28px', display: 'grid', gap: 16 }}>
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: C.shadow,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Installment Payment</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
          Vendor: PayMongo
        </p>
      </div>

      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: C.shadow,
        display: 'grid',
        gap: 12,
      }}>
        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 14,
          background: '#fff',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Payment Summary
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: C.text }}>{fmt(totalAmount)}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>Due date: {dueAt ? fmtDate(dueAt) : 'N/A'}</p>
        </div>

        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 14,
          background: '#fff',
          display: 'grid',
          gap: 8,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Checkout Details
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
            <span>Principal</span>
            <strong>{fmt(principalAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
            <span>Interest</span>
            <strong>{fmt(interestAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
            <span>Total</span>
            <strong>{fmt(totalAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
            <span>Installment ID</span>
            <strong>{paymentId || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text }}>
            <span>Prepared At</span>
            <strong>{fmtDate(new Date().toISOString())}</strong>
          </div>
        </div>

        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 12,
          background: '#ffffff',
          fontSize: 12,
          color: C.muted,
        }}>
          You will be redirected to the official PayMongo hosted checkout to complete this installment.
          After payment, CMNetwork will show your receipt and reference number, then you can close and return to the payment table.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: '#fff',
              color: C.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void handleProceedToHostedCheckout()}
            disabled={!canProceed || processing}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: C.primary,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: !canProceed || processing ? 'not-allowed' : 'pointer',
              opacity: !canProceed || processing ? 0.7 : 1,
            }}
          >
            {processing ? 'Opening Checkout...' : 'Proceed to PayMongo Checkout'}
          </button>
        </div>

        {!canProceed && (
          <p style={{ margin: 0, fontSize: 12, color: C.danger }}>
            Missing or invalid installment details. Please restart from the Loans payment workspace.
          </p>
        )}
      </div>
    </div>
  )
}

export default LoanInstallmentCheckoutPage
