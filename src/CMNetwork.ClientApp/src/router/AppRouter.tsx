import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { roleLabels, type Role } from '../types/auth'

const MainLayout = lazy(() => import('../layout/MainLayout').then((m) => ({ default: m.MainLayout })))
const LandingPage = lazy(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterCustomerPage = lazy(() =>
  import('../pages/RegisterCustomerPage').then((m) => ({ default: m.RegisterCustomerPage })),
)
const VerifyCustomerOtpPage = lazy(() =>
  import('../pages/VerifyCustomerOtpPage').then((m) => ({ default: m.VerifyCustomerOtpPage })),
)
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const MfaVerifyPage = lazy(() => import('../pages/MfaVerifyPage').then((m) => ({ default: m.MfaVerifyPage })))
const MfaSetupPage = lazy(() => import('../pages/MfaSetupPage').then((m) => ({ default: m.MfaSetupPage })))
const ModulePlaceholderPage = lazy(() =>
  import('../pages/ModulePlaceholderPage').then((m) => ({ default: m.ModulePlaceholderPage })),
)
const RoleDashboardPage = lazy(() =>
  import('../pages/RoleDashboardPage').then((m) => ({ default: m.RoleDashboardPage })),
)
const PrivateRoute = lazy(() => import('../routes/PrivateRoute').then((m) => ({ default: m.PrivateRoute })))

// Customer pages
const ViewProfilePage = lazy(() =>
  import('../pages/Profile/ViewProfilePage').then((m) => ({ default: m.default })),
)
const EditProfilePage = lazy(() =>
  import('../pages/Profile/EditProfilePage').then((m) => ({ default: m.default })),
)
const ChangePasswordPage = lazy(() =>
  import('../pages/Profile/ChangePasswordPage').then((m) => ({ default: m.default })),
)
const ViewInvoicesPage = lazy(() =>
  import('../pages/Invoices/ViewInvoicesPage').then((m) => ({ default: m.default })),
)
const PayInvoicesPage = lazy(() =>
  import('../pages/Invoices/PayInvoicesPage').then((m) => ({ default: m.default })),
)
const ViewBudgetsPage = lazy(() =>
  import('../pages/Budgets/ViewBudgetsPage').then((m) => ({ default: m.default })),
)
const RequestBudgetAdjustmentPage = lazy(() =>
  import('../pages/Budgets/RequestBudgetAdjustmentPage').then((m) => ({ default: m.default })),
)
const SubmitExpenseClaimPage = lazy(() =>
  import('../pages/ExpenseClaims/SubmitExpenseClaimPage').then((m) => ({ default: m.default })),
)
const ViewExpenseClaimsPage = lazy(() =>
  import('../pages/ExpenseClaims/ViewExpenseClaimsPage').then((m) => ({ default: m.default })),
)
const PendingApprovalsPage = lazy(() =>
  import('../pages/Approvals/PendingApprovalsPage').then((m) => ({ default: m.default })),
)
const ApprovedRequestsPage = lazy(() =>
  import('../pages/Approvals/ApprovedRequestsPage').then((m) => ({ default: m.default })),
)
const FinancialReportsPage = lazy(() =>
  import('../pages/Reports/FinancialReportsPage').then((m) => ({ default: m.default })),
)
const DownloadStatementsPage = lazy(() =>
  import('../pages/Reports/DownloadStatementsPage').then((m) => ({ default: m.default })),
)
const ContactSupportPage = lazy(() =>
  import('../pages/Support/ContactSupportPage').then((m) => ({ default: m.default })),
)
const FAQsPage = lazy(() =>
  import('../pages/Support/FAQsPage').then((m) => ({ default: m.default })),
)

const APP_TITLE = 'CMNetwork ERP'

const modulePageTitles: Record<string, string> = {
  'user-management': 'User Management',
  'system-settings': 'System Settings',
  'general-ledger': 'General Ledger',
  'accounts-payable': 'Accounts Payable',
  'accounts-receivable': 'Accounts Receivable',
  'bank-reconciliation': 'Bank Reconciliation',
  'department-report': 'Department Report',
  approvals: 'Approvals',
  'dept-reports': 'Department Reports',
  'fa-approvals': 'Approvals Inbox',
  'fa-reports': 'Departmental Reports',
  'expense-claims': 'Expense Claims',
  payslips: 'Payslips',
  'executive-summary': 'Executive Summary',
  'av-reports': 'Reports',
  'audit-logs': 'Audit Logs',
  'sod-report': 'SOD Report',
  'user-activity-timeline': 'User Activity Timeline',
  'general-ledger-inquiry': 'General Ledger Inquiry',
  'trial-balance': 'Trial Balance',
  'vendor-master': 'Vendor Master',
  'customer-master': 'Customer Master',
  'balance-sheet': 'Balance Sheet',
  'income-statement': 'Income Statement',
  'ap-aging': 'AP Aging',
  'ar-aging': 'AR Aging',
  'evidence-archive': 'Evidence Archive',
  'approvals-inbox': 'Approvals Inbox',
  'budget-control': 'Budget Control',
  'budget-cost-control': 'Budget Control',
  'financial-reports': 'Financial Reports',
  profile: 'Profile',
  reports: 'Reports',
  'roles-permissions': 'Roles & Permissions',
  'job-queue': 'Job Queue',
  'fiscal-periods': 'Fiscal Periods',
  'integration-settings': 'Integration Settings',
  'security-policy': 'Security Policy',
  'system-health': 'System Health',
  'admin-reports': 'Admin Reports',
  'bank-directory': 'Bank Directory',
  payroll: 'Payroll',
}

const labelize = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const isRole = (value: string): value is Role => value in roleLabels

const getPageTitle = (pathname: string) => {
  if (pathname === '/') {
    return APP_TITLE
  }

  if (pathname === '/login') {
    return `Sign In | ${APP_TITLE}`
  }

  if (pathname === '/reset-password') {
    return `Reset Password | ${APP_TITLE}`
  }

  if (pathname === '/register') {
    return `Register | ${APP_TITLE}`
  }

  if (pathname === '/verify-customer-otp') {
    return `Verify Email | ${APP_TITLE}`
  }

  if (pathname === '/mfa/verify') {
    return `MFA Verification | ${APP_TITLE}`
  }

  if (pathname === '/mfa/setup' || pathname === '/settings/mfa') {
    return `MFA Setup | ${APP_TITLE}`
  }

  const [, section, key] = pathname.split('/')

  if (section === 'dashboard' && key) {
    const dashboardLabel = isRole(key) ? roleLabels[key] : labelize(key)
    return `${dashboardLabel} Dashboard | ${APP_TITLE}`
  }

  if (section === 'module' && key) {
    return `${modulePageTitles[key] ?? labelize(key)} | ${APP_TITLE}`
  }

  return APP_TITLE
}

const DocumentTitle = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  return null
}

const RouterFallback = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--text)',
      background: 'var(--bg)',
    }}
  >
    Loading...
  </div>
)

export const AppRouter = () => {
  return (
    <Suspense fallback={<RouterFallback />}>
      <DocumentTitle />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterCustomerPage />} />
        <Route path="/verify-customer-otp" element={<VerifyCustomerOtpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/mfa/verify" element={<MfaVerifyPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard/:role" element={<RoleDashboardPage />} />
            <Route path="/module/:moduleKey" element={<ModulePlaceholderPage />} />
            <Route path="/mfa/setup" element={<MfaSetupPage />} />
            <Route path="/settings/mfa" element={<MfaSetupPage />} />
            
            {/* Customer Profile Routes */}
            <Route path="/module/profile/view" element={<ViewProfilePage />} />
            <Route path="/module/profile/edit" element={<EditProfilePage />} />
            <Route path="/module/profile/change-password" element={<ChangePasswordPage />} />
            
            {/* Customer Invoices Routes */}
            <Route path="/module/invoices/view" element={<ViewInvoicesPage />} />
            <Route path="/module/invoices/pay" element={<PayInvoicesPage />} />
            
            {/* Customer Budgets Routes */}
            <Route path="/module/budgets/view" element={<ViewBudgetsPage />} />
            <Route path="/module/budgets/request-adjustment" element={<RequestBudgetAdjustmentPage />} />
            
            {/* Customer Expense Claims Routes */}
            <Route path="/module/expense-claims/submit" element={<SubmitExpenseClaimPage />} />
            <Route path="/module/expense-claims/view" element={<ViewExpenseClaimsPage />} />
            
            {/* Customer Approvals Routes */}
            <Route path="/module/approvals/pending" element={<PendingApprovalsPage />} />
            <Route path="/module/approvals/approved" element={<ApprovedRequestsPage />} />
            
            {/* Customer Reports Routes */}
            <Route path="/module/reports/financial" element={<FinancialReportsPage />} />
            <Route path="/module/reports/statements" element={<DownloadStatementsPage />} />
            
            {/* Customer Support Routes */}
            <Route path="/module/support/contact" element={<ContactSupportPage />} />
            <Route path="/module/support/faqs" element={<FAQsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
