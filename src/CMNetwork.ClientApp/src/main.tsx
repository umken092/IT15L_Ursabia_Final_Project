import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import '@progress/kendo-theme-default/dist/all.css'
import './index.css'
import App from './App.tsx'

const configuredRecaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim()
const RECAPTCHA_SITE_KEY =
  configuredRecaptchaKey && configuredRecaptchaKey.length > 0
    ? configuredRecaptchaKey
    : '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

globalThis.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const msg = reason instanceof Error ? reason.message : String(reason ?? '')
  if (msg.toLowerCase().includes('recaptcha')) {
    event.preventDefault()
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const bootstrap = async () => {
  let runtimeSiteKey = RECAPTCHA_SITE_KEY

  try {
    const response = await fetch('/api/auth/recaptcha/site-key')
    if (response.ok) {
      const data = await response.json() as { enabled?: boolean; siteKey?: string }
      if (data.enabled && typeof data.siteKey === 'string' && data.siteKey.trim().length > 0) {
        runtimeSiteKey = data.siteKey.trim()
      }
    }
  } catch {
    // Fall back to env-provided site key
  }

  createRoot(rootElement).render(
    <StrictMode>
      <GoogleReCaptchaProvider reCaptchaKey={runtimeSiteKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleReCaptchaProvider>
    </StrictMode>,
  )
}

void bootstrap()
