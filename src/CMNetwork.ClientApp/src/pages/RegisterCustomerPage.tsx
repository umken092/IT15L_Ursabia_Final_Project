import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody } from '@progress/kendo-react-layout'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { authService } from '../services/authService'
import { useNotificationStore } from '../store/notificationStore'

type FormErrors = {
  firstName?: string
  middleName?: string
  lastName?: string
  birthDate?: string
  age?: string
  gender?: string
  maritalStatus?: string
  address?: string
  city?: string
  country?: string
  postalCode?: string
  contactNumber?: string
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

const calculateAge = (birthDate: string): number | null => {
  if (!birthDate) {
    return null
  }

  const parsed = new Date(birthDate)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const now = new Date()
  let age = now.getFullYear() - parsed.getFullYear()
  const monthDiff = now.getMonth() - parsed.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1
  }

  return age
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
    const message = String(value)

    if (normalizedKey.includes('first')) fieldErrors.firstName = message
    if (normalizedKey.includes('middle')) fieldErrors.middleName = message
    if (normalizedKey.includes('last')) fieldErrors.lastName = message
    if (normalizedKey.includes('birth')) fieldErrors.birthDate = message
    if (normalizedKey.includes('age')) fieldErrors.age = message
    if (normalizedKey.includes('gender')) fieldErrors.gender = message
    if (normalizedKey.includes('marital')) fieldErrors.maritalStatus = message
    if (normalizedKey.includes('address')) fieldErrors.address = message
    if (normalizedKey.includes('city')) fieldErrors.city = message
    if (normalizedKey.includes('country')) fieldErrors.country = message
    if (normalizedKey.includes('postal')) fieldErrors.postalCode = message
    if (normalizedKey.includes('contact') || normalizedKey.includes('phone')) fieldErrors.contactNumber = message
    if (normalizedKey.includes('email')) fieldErrors.email = message
    if (normalizedKey.includes('password') && !normalizedKey.includes('confirm')) fieldErrors.password = message
    if (normalizedKey.includes('confirm')) fieldErrors.confirmPassword = message
  }

  return {
    message: typeof responseData.message === 'string' ? responseData.message : fallbackMessage,
    fieldErrors,
  }
}

export const RegisterCustomerPage = () => {
  const navigate = useNavigate()
  const pushToast = useNotificationStore((state) => state.push)
  const { executeRecaptcha } = useGoogleReCaptcha()

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Prefer not to say'>('Male')
  const [maritalStatus, setMaritalStatus] = useState<'Single' | 'Married' | 'Separated' | 'Divorced' | 'Widowed'>('Single')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Philippines')
  const [postalCode, setPostalCode] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const passwordChecklist = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasLetter: /[A-Za-z]/.test(password),
      hasNumber: /\d/.test(password),
    }
  }, [password])

  const passwordIsPolicyCompliant =
    passwordChecklist.minLength && passwordChecklist.hasLetter && passwordChecklist.hasNumber

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!firstName.trim()) nextErrors.firstName = 'First name is required.'
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required.'

    if (!birthDate.trim()) {
      nextErrors.birthDate = 'Birthdate is required.'
    }

    const parsedAge = Number(age)
    if (!age.trim() || Number.isNaN(parsedAge)) {
      nextErrors.age = 'Age is required.'
    } else if (parsedAge < 0 || parsedAge > 150) {
      nextErrors.age = 'Please enter a valid age.'
    }

    const calculatedAge = calculateAge(birthDate)
    if (!nextErrors.age && calculatedAge !== null && Math.abs(calculatedAge - parsedAge) > 1) {
      nextErrors.age = 'Age should match the selected birthdate.'
    }

    if (!address.trim()) nextErrors.address = 'Address is required.'
    if (!city.trim()) nextErrors.city = 'City is required.'
    if (!country.trim()) nextErrors.country = 'Country is required.'
    if (!postalCode.trim()) nextErrors.postalCode = 'Postal code is required.'

    if (!contactNumber.trim()) {
      nextErrors.contactNumber = 'Contact number is required.'
    } else if (!/^\+?[0-9\-\s()]{7,20}$/.test(contactNumber.trim())) {
      nextErrors.contactNumber = 'Please enter a valid contact number.'
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Please enter a valid email.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (!passwordIsPolicyCompliant) {
      nextErrors.password = 'Use at least 8 characters with letters and numbers.'
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
      let recaptchaToken: string | undefined

      if (executeRecaptcha) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const token = await executeRecaptcha('register_customer')
            if (token?.trim()) {
              recaptchaToken = token
              break
            }
          } catch {
            // Retry once in case script initialization is still in progress.
          }

          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 250))
          }
        }

        if (!recaptchaToken) {
          pushToast('warning', 'Security verification is not ready. Please wait a moment and try again.')
          return
        }
      }

      const normalizedFirstName = firstName.trim()
      const normalizedMiddleName = middleName.trim()
      const normalizedLastName = lastName.trim()

      await authService.registerCustomer({
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName || undefined,
        lastName: normalizedLastName,
        fullName: [normalizedFirstName, normalizedMiddleName, normalizedLastName].filter(Boolean).join(' '),
        birthDate,
        age: Number(age),
        gender,
        maritalStatus,
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        postalCode: postalCode.trim(),
        contactNumber: contactNumber.trim(),
        companyName: companyName.trim() || undefined,
        email: email.trim(),
        password,
        confirmPassword,
        recaptchaToken,
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
      <Card className="login-card" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', textAlign: 'center' }}>Create Customer Account</h2>
          <p style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Complete your details to register for customer portal access.
          </p>

          <form onSubmit={handleSubmit} className="login-form" style={{ gap: '0.9rem' }}>
            <label>
              First Name
              <Input value={firstName} onChange={(event) => setFirstName(String(event.value ?? ''))} />
              {errors.firstName ? <span className="field-error">{errors.firstName}</span> : null}
            </label>

            <label>
              Middle Name
              <Input value={middleName} onChange={(event) => setMiddleName(String(event.value ?? ''))} />
              {errors.middleName ? <span className="field-error">{errors.middleName}</span> : null}
            </label>

            <label>
              Last Name
              <Input value={lastName} onChange={(event) => setLastName(String(event.value ?? ''))} />
              {errors.lastName ? <span className="field-error">{errors.lastName}</span> : null}
            </label>

            <label>
              Birthdate
              <input
                type="date"
                value={birthDate}
                onChange={(event) => {
                  const nextBirthDate = event.target.value
                  setBirthDate(nextBirthDate)
                  const computed = calculateAge(nextBirthDate)
                  if (computed !== null && computed >= 0) {
                    setAge(String(computed))
                  }
                }}
                className="k-input k-textbox"
                style={{ width: '100%' }}
              />
              {errors.birthDate ? <span className="field-error">{errors.birthDate}</span> : null}
            </label>

            <label>
              Age
              <Input type="number" value={age} onChange={(event) => setAge(String(event.value ?? ''))} />
              {errors.age ? <span className="field-error">{errors.age}</span> : null}
            </label>

            <label>
              Gender
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as 'Male' | 'Female' | 'Other' | 'Prefer not to say')}
                className="role-select"
                style={{ width: '100%' }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              {errors.gender ? <span className="field-error">{errors.gender}</span> : null}
            </label>

            <label>
              Marital Status
              <select
                value={maritalStatus}
                onChange={(event) =>
                  setMaritalStatus(event.target.value as 'Single' | 'Married' | 'Separated' | 'Divorced' | 'Widowed')
                }
                className="role-select"
                style={{ width: '100%' }}
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
              {errors.maritalStatus ? <span className="field-error">{errors.maritalStatus}</span> : null}
            </label>

            <label>
              Address
              <Input value={address} onChange={(event) => setAddress(String(event.value ?? ''))} />
              {errors.address ? <span className="field-error">{errors.address}</span> : null}
            </label>

            <label>
              City
              <Input value={city} onChange={(event) => setCity(String(event.value ?? ''))} />
              {errors.city ? <span className="field-error">{errors.city}</span> : null}
            </label>

            <label>
              Country
              <Input value={country} onChange={(event) => setCountry(String(event.value ?? ''))} />
              {errors.country ? <span className="field-error">{errors.country}</span> : null}
            </label>

            <label>
              Postal Code
              <Input value={postalCode} onChange={(event) => setPostalCode(String(event.value ?? ''))} />
              {errors.postalCode ? <span className="field-error">{errors.postalCode}</span> : null}
            </label>

            <label>
              Contact Number
              <Input value={contactNumber} onChange={(event) => setContactNumber(String(event.value ?? ''))} />
              {errors.contactNumber ? <span className="field-error">{errors.contactNumber}</span> : null}
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
              <div
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.8rem',
                  color: passwordIsPolicyCompliant ? 'var(--success, #2e7d32)' : 'var(--text-secondary, #5f6368)',
                }}
              >
                Use at least 8 characters and include both letters and numbers.
              </div>
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
