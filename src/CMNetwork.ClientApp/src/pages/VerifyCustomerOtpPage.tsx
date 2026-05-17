import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { authService } from '../services/authService'
import { useNotificationStore } from '../store/notificationStore'

type VerifyCustomerOtpLocationState = {
  email?: string
}

type VerifyOtpErrorResponse = {
  message?: string
}

const getVerifyOtpErrorMessage = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return 'OTP verification failed.'
  }

  const response = error.response

  if (!response || typeof response !== 'object' || !('data' in response)) {
    return 'OTP verification failed.'
  }

  const { data } = response

  if (!data || typeof data !== 'object') {
    return 'OTP verification failed.'
  }

  const responseData = data as VerifyOtpErrorResponse
  return responseData.message || 'OTP verification failed.'
}

export const VerifyCustomerOtpPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const pushToast = useNotificationStore((state) => state.push)

  const params = new URLSearchParams(location.search)
  const state = (location.state ?? null) as VerifyCustomerOtpLocationState | null
  const initialEmail = params.get('email') || state?.email || ''

  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email.trim() || !otp.trim()) {
      setError('Email and OTP are required.')
      return
    }

    setSubmitting(true)

    try {
      const response = await authService.verifyCustomerOtp({ email: email.trim(), otp: otp.trim() })

      if (response.success) {
        setSuccess(true)
        pushToast('success', response.message || 'OTP verified! You can now sign in.')
        setTimeout(() => navigate('/login', { replace: true }), 2000)
        return
      }

      setError(response.message || 'OTP verification failed.')
    } catch (err: unknown) {
      setError(getVerifyOtpErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    setError(null)

    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }

    setResending(true)

    try {
      const response = await authService.resendCustomerOtp({ email: email.trim() })
      pushToast(response.success ? 'success' : 'warning', response.message)
    } catch (err: unknown) {
      setError(getVerifyOtpErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', textAlign: 'center' }}>Verify Your Email</h2>
          <p style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Enter the 6-digit OTP sent to your email to activate your account.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Email
              <Input
                value={email}
                onChange={(event) => setEmail(String(event.value ?? ''))}
                type="email"
                autoComplete="email"
              />
            </label>

            <label>
              OTP
              <Input value={otp} onChange={(event) => setOtp(String(event.value ?? ''))} maxLength={6} />
            </label>

            {error && <span className="field-error">{error}</span>}
            {success && <span style={{ color: 'green', display: 'block', marginTop: 8 }}>OTP verified! Redirecting...</span>}

            <Button type="submit" themeColor="primary" className="k-button" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Verify OTP'}
            </Button>

            <Button
              type="button"
              fillMode="outline"
              className="k-button"
              disabled={resending}
              onClick={() => { void handleResendOtp() }}
            >
              {resending ? 'Sending new OTP...' : 'Resend OTP'}
            </Button>

            <button
              type="button"
              className="link-button"
              onClick={() => navigate('/login')}
              style={{ justifySelf: 'center' }}
            >
              Back to Sign In
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
