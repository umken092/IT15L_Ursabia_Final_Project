import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { authService } from '../services/authService'
import { useNotificationStore } from '../store/notificationStore'

type FormErrors = {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

type ErrorResponseData = {
  message?: string
  errors?: Record<string, unknown>
}

const getErrorResponseData = (error: unknown): ErrorResponseData | null => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null
  }

  const response = error.response

  if (!response || typeof response !== 'object' || !('data' in response)) {
    return null
  }

  const { data } = response

  return data && typeof data === 'object' ? (data as ErrorResponseData) : null
}

const getRegistrationErrorState = (error: unknown): { message: string; fieldErrors: FormErrors } => {
  const fallbackMessage = 'Registration failed. Please review your details and try again.'
  const responseData = getErrorResponseData(error)

  if (!responseData) {
    return { message: fallbackMessage, fieldErrors: {} }
  }

  const fieldErrors: FormErrors = {}

  for (const [key, value] of Object.entries(responseData.errors ?? {})) {
    const normalizedKey = key.toLowerCase()

    if (normalizedKey.includes('email')) {
      fieldErrors.email = String(value)
    }

    if (normalizedKey.includes('password')) {
      fieldErrors.password = String(value)
    }

    if (normalizedKey.includes('fullname')) {
      fieldErrors.fullName = String(value)
    }

    if (normalizedKey.includes('confirm')) {
      fieldErrors.confirmPassword = String(value)
    }
  }

  return {
    message: typeof responseData.message === 'string' ? responseData.message : fallbackMessage,
    fieldErrors,
  }
}

export const RegisterCustomerPage = () => {
  const navigate = useNavigate()
  const pushToast = useNotificationStore((state) => state.push)

  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required.'
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Please enter a valid email.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password.'
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault()

    if (!validate()) {
      return
    }

    try {
      setSubmitting(true)
      await authService.registerCustomer({
        fullName: fullName.trim(),
        companyName: companyName.trim() || undefined,
        email: email.trim(),
        password,
        confirmPassword,
      })

      pushToast('success', 'Registration successful. Please check your email for your OTP.')
      navigate('/verify-customer-otp', { state: { email: email.trim() }, replace: true })
    } catch (err: unknown) {
      const { message, fieldErrors } = getRegistrationErrorState(err)
      setErrors(fieldErrors)
      pushToast('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', textAlign: 'center' }}>Create Customer Account</h2>
          <p style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Register for customer portal access to view invoices and statements.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Full Name
              <Input value={fullName} onChange={(event) => setFullName(String(event.value ?? ''))} />
              {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
            </label>

            <label>
              Company Name (optional)
              <Input value={companyName} onChange={(event) => setCompanyName(String(event.value ?? ''))} />
            </label>

            <label>
              Email
              <Input type="email" value={email} onChange={(event) => setEmail(String(event.value ?? ''))} />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </label>

            <label>
              Password
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(String(event.value ?? ''))}
                autoComplete="new-password"
              />
              {errors.password ? <span className="field-error">{errors.password}</span> : null}
            </label>

            <label>
              Confirm Password
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(String(event.value ?? ''))}
                autoComplete="new-password"
              />
              {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
            </label>

            <Button type="submit" themeColor="primary" className="k-button" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Register now!'}
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
