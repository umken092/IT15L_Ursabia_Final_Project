import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { Loader } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { roleDashboardPath } from '../types/auth'

export const MfaVerifyPage = () => {
  const navigate = useNavigate()
  const pushToast = useNotificationStore((s) => s.push)

  const completeMfaLogin = useAuthStore((s) => s.completeMfaLogin)
  const mfaPending       = useAuthStore((s) => s.mfaPending)
  const loading          = useAuthStore((s) => s.loading)
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated)
  const user             = useAuthStore((s) => s.user)

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated && user) {
    return <Navigate to={roleDashboardPath(user.role)} replace />
  }

  if (!mfaPending) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const ok = await completeMfaLogin(code)
    if (!ok) {
      setError('Invalid code. Please try again.')
      pushToast('error', 'Invalid MFA code.')
      return
    }
    pushToast('success', 'Signed in successfully.')
    const latestUser = useAuthStore.getState().user
    navigate(roleDashboardPath(latestUser?.role ?? 'employee'), { replace: true })
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardBody style={{ textAlign: 'center' }}>
          <img src="/CMN.png" alt="CMNetwork logo" className="login-logo" />
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Two-Factor Authentication</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Enter the 6-digit code from your authenticator app for<br />
            <strong>{mfaPending.email}</strong>
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Verification Code
              <Input
                value={code}
                onChange={(e) => setCode(e.value as string)}
                placeholder="000000"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '0.4rem', fontSize: '1.5rem' }}
              />
              {error && <span className="field-error">{error}</span>}
            </label>

            <Button
              type="submit"
              themeColor="primary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <span className="button-loader">
                  <Loader type="infinite-spinner" size="small" /> Verifying
                </span>
              ) : (
                'Verify & Sign In'
              )}
            </Button>

            <Button
              type="button"
              fillMode="flat"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => navigate('/login', { replace: true })}
            >
              Back to Sign In
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
