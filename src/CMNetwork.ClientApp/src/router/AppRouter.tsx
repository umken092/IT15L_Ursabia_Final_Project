import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
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
// Employee profile page (staff roles)
const EmployeeProfilePage = lazy(() =>
  import('../pages/Profile/EmployeeProfilePage').then((m) => ({ default: m.default })),
)
const ViewInvoicesPage = lazy(() =>
  import('../pages/Invoices/ViewInvoicesPage').then((m) => ({ default: m.default })),
)
const ViewBudgetsPage = lazy(() =>
  import('../pages/Budgets/ViewBudgetsPage').then((m) => ({ default: m.default })),
)
const ViewExpenseClaimsPage = lazy(() =>
  import('../pages/ExpenseClaims/ViewExpenseClaimsPage').then((m) => ({ default: m.default })),
)
const PendingApprovalsPage = lazy(() =>
  import('../pages/Approvals/PendingApprovalsPage').then((m) => ({ default: m.default })),
)
const FinancialReportsPage = lazy(() =>
  import('../pages/Reports/FinancialReportsPage').then((m) => ({ default: m.default })),
)
const ContactSupportPage = lazy(() =>
  import('../pages/Support/ContactSupportPage').then((m) => ({ default: m.default })),
)
const ViewLoansPage = lazy(() =>
  import('../pages/Loans/ViewLoansPage').then((m) => ({ default: m.ViewLoansPage })),
)
const LoanInstallmentCheckoutPage = lazy(() =>
  import('../pages/Loans/LoanInstallmentCheckoutPage').then((m) => ({ default: m.default })),
)
const LoanInstallmentResultPage = lazy(() =>
  import('../pages/Loans/LoanInstallmentResultPage').then((m) => ({ default: m.default })),
)
const AccountantLoanReviewPage = lazy(() =>
  import('../pages/Loans/AccountantLoanReviewPage').then((m) => ({ default: m.default })),
)
const CfoLoanApprovalPage = lazy(() =>
  import('../pages/Loans/CfoLoanApprovalPage').then((m) => ({ default: m.default })),
)
const LoanTierManagementPage = lazy(() =>
  import('../pages/Loans/LoanTierManagementPage').then((m) => ({ default: m.default })),
)
const PaymentResultPage = lazy(() =>
  import('../pages/modules/PaymentResultPage').then((m) => ({ default: m.PaymentResultPage })),
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
  'loan-review': 'Loan Review',
  'loan-approval': 'Loan Approval',
  'loan-tiers': 'Loan Interest Tiers',
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

  if (pathname === '/payment/result') {
    return `Payment Result | ${APP_TITLE}`
  }

  if (pathname === '/module/loans/installment-checkout') {
    return `Installment Checkout | ${APP_TITLE}`
  }

  if (pathname === '/module/loans/installment-result') {
    return `Installment Receipt | ${APP_TITLE}`
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

const ReportsRoute = () => {
  const location = useLocation()
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const user = useAuthStore((state) => state.user)
  const activeRole = selectedRole ?? user?.role

  if (activeRole === 'customer') {
    if (location.pathname === '/module/reports/statements') {
      return <FinancialReportsPage />
    }

    return <Navigate to="/module/reports/statements" replace />
  }

  if (activeRole === 'super-admin') {
    return <Navigate to="/module/financial-reports" replace />
  }

  if (activeRole === 'accountant' || activeRole === 'cfo' || activeRole === 'auditor') {
    return <Navigate to="/module/financial-reports" replace />
  }

  if (activeRole === 'authorized-viewer') {
    return <Navigate to="/module/av-reports" replace />
  }

  return <Navigate to="/" replace />
}

// Dispatches /module/profile to the appropriate profile page based on role.
// Customers → ViewProfilePage (loan-centric); all other staff → EmployeeProfilePage.
const ProfileRoute = () => {
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const user = useAuthStore((state) => state.user)
  const activeRole = selectedRole ?? user?.role
  return activeRole === 'customer' ? <ViewProfilePage /> : <EmployeeProfilePage />
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
            
            {/* Profile Routes — role-dispatched: customer → ViewProfilePage, staff → EmployeeProfilePage */}
            <Route path="/module/profile" element={<ProfileRoute />} />
            <Route path="/module/profile/view" element={<ProfileRoute />} />
            <Route path="/module/profile/edit" element={<ProfileRoute />} />
            <Route path="/module/profile/change-password" element={<ProfileRoute />} />
            
            {/* Customer Invoices Routes */}
            <Route path="/module/invoices" element={<ViewInvoicesPage />} />
            <Route path="/module/invoices/view" element={<ViewInvoicesPage />} />
            <Route path="/module/invoices/pay" element={<ViewInvoicesPage />} />
            
            {/* Customer Budgets Routes */}
            <Route path="/module/budgets" element={<ViewBudgetsPage />} />
            <Route path="/module/budgets/view" element={<ViewBudgetsPage />} />
            <Route path="/module/budgets/request-adjustment" element={<ViewBudgetsPage />} />
            
            {/* Customer Expense Claims Routes */}
            <Route path="/module/expense-claims" element={<ViewExpenseClaimsPage />} />
            <Route path="/module/expense-claims/submit" element={<ViewExpenseClaimsPage />} />
            <Route path="/module/expense-claims/view" element={<ViewExpenseClaimsPage />} />
            
            {/* Customer Approvals Routes */}
            <Route path="/module/approvals" element={<PendingApprovalsPage />} />
            <Route path="/module/approvals/pending" element={<PendingApprovalsPage />} />
            <Route path="/module/approvals/approved" element={<PendingApprovalsPage />} />
            
            {/* Customer Reports Routes */}
            <Route path="/module/reports" element={<ReportsRoute />} />
            <Route path="/module/reports/financial" element={<ReportsRoute />} />
            <Route path="/module/reports/statements" element={<ReportsRoute />} />
            
            {/* Customer Support Routes */}
            <Route path="/module/support" element={<ContactSupportPage />} />
            <Route path="/module/support/contact" element={<ContactSupportPage />} />
            <Route path="/module/support/faqs" element={<ContactSupportPage />} />

            {/* Customer Loans Routes */}
            <Route path="/module/loans" element={<ViewLoansPage />} />
            <Route path="/module/loans/apply" element={<ViewLoansPage />} />
            <Route path="/module/loans/active" element={<ViewLoansPage />} />
            <Route path="/module/loans/applications" element={<ViewLoansPage />} />
            <Route path="/module/loans/installment-checkout" element={<LoanInstallmentCheckoutPage />} />
            <Route path="/module/loans/installment-result" element={<LoanInstallmentResultPage />} />

            {/* Accountant Loan Review */}
            <Route path="/module/loan-review" element={<AccountantLoanReviewPage />} />
            <Route path="/module/loan-review/pending" element={<AccountantLoanReviewPage />} />
            <Route path="/module/loan-review/disbursement" element={<AccountantLoanReviewPage />} />

            {/* CFO Loan Approval */}
            <Route path="/module/loan-approval" element={<CfoLoanApprovalPage />} />
            <Route path="/module/loan-approval/pending" element={<CfoLoanApprovalPage />} />

            {/* Loan Tier Management (CFO / Super-Admin) */}
            <Route path="/module/loan-tiers" element={<LoanTierManagementPage />} />

            {/* Payment result page — PayMongo redirect target */}
            <Route path="/payment/result" element={<PaymentResultPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
