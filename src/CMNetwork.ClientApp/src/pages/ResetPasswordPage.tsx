import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { authService } from '../services/authService'
import { useNotificationStore } from '../store/notificationStore'

type FormErrors = {
  password?: string
  confirmPassword?: string
}

export const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const pushToast = useNotificationStore((state) => state.push)
  const [searchParams] = useSearchParams()

  const email = useMemo(() => (searchParams.get('email') ?? '').trim(), [searchParams])
  const token = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams])
  const isValidLink = email.length > 0 && token.length > 0

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!password) {
      nextErrors.password = 'New password is required.'
    } else if (password.length < 8) {
      nextErrors.password = 'New password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your new password.'
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault()

    if (!isValidLink) {
      pushToast('error', 'The reset link is invalid or incomplete.')
      return
    }

    if (!validate()) {
      return
    }

    try {
      setSubmitting(true)
      await authService.resetPassword({
        email,
        token,
        newPassword: password,
      })
      pushToast('success', 'Password reset successful. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch {
      pushToast('error', 'Password reset failed. Please request a new reset link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', textAlign: 'center' }}>Reset Password</h2>
          <p style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Set a new password for your CMNetwork account.
          </p>

          {isValidLink ? (
            <form onSubmit={handleSubmit} className="login-form">
              <label>
                Email
                <Input value={email} disabled />
              </label>

              <label>
                New Password
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(String(event.value ?? ''))}
                  autoComplete="new-password"
                />
                {errors.password ? <span className="field-error">{errors.password}</span> : null}
              </label>

              <label>
                Confirm New Password
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(String(event.value ?? ''))}
                  autoComplete="new-password"
                />
                {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
              </label>

              <Button type="submit" themeColor="primary" className="k-button" disabled={submitting}>
                {submitting ? 'Resetting...' : 'Reset Password'}
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
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p className="field-error" style={{ margin: 0 }}>
                This reset link is invalid. Request a new password reset email from the sign-in page.
              </p>
              <Button type="button" onClick={() => navigate('/login')}>
                Back to Sign In
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
