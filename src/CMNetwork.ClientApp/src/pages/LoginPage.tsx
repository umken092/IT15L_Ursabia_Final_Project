import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isTokenLikelyValid } from '../services/tokenUtils'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Button } from '@progress/kendo-react-buttons'
import { Input, Checkbox } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { Loader } from '@progress/kendo-react-indicators'
import type { LoginCredentials } from '../types/auth'
import { roleDashboardPath } from '../types/auth'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const pushToast = useNotificationStore((state) => state.push)
  const { executeRecaptcha } = useGoogleReCaptcha()

  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const loading = useAuthStore((state) => state.loading)
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Clear stale auth state when the JWT has expired during the session.
  // Without this, PrivateRoute redirects here but isAuthenticated stays true,
  // causing an infinite redirect loop between /login and the dashboard.
  useEffect(() => {
    if (isAuthenticated && !isTokenLikelyValid(token)) {
      void logout()
    }
  }, [isAuthenticated, token, logout])

  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  })

  const onSubmit = async (values: LoginCredentials) => {
    let recaptchaToken: string | undefined
    try {
      recaptchaToken = executeRecaptcha ? await executeRecaptcha('login') : undefined
    } catch {
      // reCAPTCHA optional in dev
    }

    const result = await login(values, recaptchaToken)

    if (result === 'error') {
      pushToast('error', 'Invalid email or password.')
      return
    }

    if (result === 'mfa') {
      pushToast('info', 'Two-factor authentication required.')
      navigate('/mfa/verify', { replace: true })
      return
    }

    pushToast('success', 'Sign in successful.')
    const from = (location.state as { from?: string } | null)?.from
    const latestUser = useAuthStore.getState().user
    const fallback = roleDashboardPath(latestUser?.role ?? 'employee')
    navigate(from || fallback, { replace: true })
  }

  if (isAuthenticated && user && isTokenLikelyValid(token)) {
    return <Navigate to={roleDashboardPath(user.role)} replace />
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardBody style={{ textAlign: 'center' }}>
          <img src="/CMN.png" alt="CMNetwork logo" className="login-logo" />
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>CMNetwork ERP</h2>
          <p style={{ marginBottom: '1.5rem' }}>Sign In to Your Account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <label>
              Email
              <Controller
                control={control}
                name="email"
                rules={{
                  required: 'Email is required.',
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: 'Please enter a valid email.',
                  },
                }}
                render={({ field }) => <Input {...field} type="email" />}
              />
              {errors.email ? (
                <span className="field-error">{errors.email.message}</span>
              ) : null}
            </label>

            <label>
              Password
              <div style={{ position: 'relative' }}>
                <Controller
                  control={control}
                  name="password"
                  rules={{ required: 'Password is required.' }}
                  render={({ field }) => (
                    <Input {...field} type={showPassword ? 'text' : 'password'} style={{ paddingRight: '2.5rem', width: '100%' }} />
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password ? (
                <span className="field-error">{errors.password.message}</span>
              ) : null}
            </label>

            <div className="form-row">
              <Controller
                control={control}
                name="rememberMe"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onChange={(event) => field.onChange(event.value)}
                    label="Remember me"
                  />
                )}
              />
              <a href="#">Forgot password?</a>
            </div>

            <Button type="submit" themeColor="primary" className="k-button" style={{ marginBottom: '0.75rem', width: '100%' }} disabled={loading}>
              {loading ? (
                <span className="button-loader">
                  <Loader type="infinite-spinner" size="small" /> Signing In
                </span>
              ) : (
                'Sign In'
              )}
            </Button>

            <p className="helper-link" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              No account yet? <a href="#">Create one</a>
            </p>

            <div className="recaptcha-badge" style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
              This site is protected by reCAPTCHA
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
