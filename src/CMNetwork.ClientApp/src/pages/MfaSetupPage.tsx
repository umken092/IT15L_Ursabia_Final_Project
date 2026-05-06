import { useState, useEffect } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Input } from '@progress/kendo-react-inputs'
import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import { Loader } from '@progress/kendo-react-indicators'
import { authService, type MfaSetupApiResponse } from '../services/authService'
import { useNotificationStore } from '../store/notificationStore'

export const MfaSetupPage = () => {
  const pushToast = useNotificationStore((s) => s.push)

  const [setup, setSetup]       = useState<MfaSetupApiResponse | null>(null)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [code, setCode]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enabled, setEnabled]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    authService.getMfaSetup()
      .then(setSetup)
      .catch(() => pushToast('error', 'Failed to load MFA setup.'))
      .finally(() => setLoadingSetup(false))
  }, [pushToast])

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authService.enableMfa(code)
      setEnabled(true)
      pushToast('success', 'Two-factor authentication enabled.')
    } catch {
      setError('Invalid code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingSetup) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader type="infinite-spinner" size="large" />
      </div>
    )
  }

  if (enabled) {
    return (
      <Card style={{ maxWidth: 480, margin: '2rem auto' }}>
        <CardBody style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h3 style={{ color: 'var(--primary)' }}>MFA Enabled</h3>
          <p>Two-factor authentication is now active on your account.</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card style={{ maxWidth: 480, margin: '2rem auto' }}>
      <CardHeader>
        <CardTitle>Set Up Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardBody style={{ padding: '1.5rem' }}>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 2 }}>
          <li>Install an authenticator app (Google Authenticator, Authy, Microsoft Authenticator)</li>
          <li>Scan the QR code below — or enter the key manually</li>
          <li>Enter the 6-digit code to confirm</li>
        </ol>

        {setup && (
          <>
            <div style={{
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '1rem',
              margin: '1rem 0',
              textAlign: 'center'
            }}>
              <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.9rem' }}>
                {setup.sharedKey}
              </p>
              <a
                href={setup.authenticatorUri}
                style={{ fontSize: '0.8rem', color: 'var(--primary)' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Authenticator App
              </a>
            </div>

            <form onSubmit={handleEnable}>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Verification Code
                </span>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.value as string)}
                  placeholder="000000"
                  maxLength={6}
                  style={{ textAlign: 'center', letterSpacing: '0.4rem', fontSize: '1.5rem' }}
                />
                {error && (
                  <span style={{ color: 'red', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    {error}
                  </span>
                )}
              </label>

              <Button
                type="submit"
                themeColor="primary"
                style={{ width: '100%' }}
                disabled={submitting || code.length !== 6}
              >
                {submitting ? (
                  <span className="button-loader">
                    <Loader type="infinite-spinner" size="small" /> Enabling MFA
                  </span>
                ) : (
                  'Enable Two-Factor Authentication'
                )}
              </Button>
            </form>
          </>
        )}
      </CardBody>
    </Card>
  )
}
