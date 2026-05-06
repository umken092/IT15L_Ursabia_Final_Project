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

createRoot(rootElement).render(
  <StrictMode>
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleReCaptchaProvider>
  </StrictMode>,
)
