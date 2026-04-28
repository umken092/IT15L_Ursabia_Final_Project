import { useForm, Controller } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
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

  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

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
    const ok = await login(values)

    if (!ok) {
      pushToast('error', 'Invalid email or password.')
      return
    }

    pushToast('success', 'Sign in successful.')

    const from = (location.state as { from?: string } | null)?.from
    const latestUser = useAuthStore.getState().user
    const fallback = roleDashboardPath(latestUser?.role ?? 'employee')
    navigate(from || fallback, { replace: true })
  }

  if (isAuthenticated && user) {
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
              <Controller
                control={control}
                name="password"
                rules={{ required: 'Password is required.' }}
                render={({ field }) => <Input {...field} type="password" />}
              />
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

            <div className="recaptcha-badge">Protected by reCAPTCHA (visual only)</div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
