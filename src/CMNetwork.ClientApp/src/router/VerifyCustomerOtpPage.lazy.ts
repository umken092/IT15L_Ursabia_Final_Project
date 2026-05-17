import { lazy } from 'react'

export const VerifyCustomerOtpPage = lazy(() => import('../pages/VerifyCustomerOtpPage').then((m) => ({ default: m.VerifyCustomerOtpPage })))
