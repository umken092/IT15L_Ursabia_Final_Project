import type { Role } from '../types/auth'

export interface SidebarMenuItem {
  label: string
  path: string
  children?: SidebarMenuItem[]
}

const dashboardPath = (role: Role) => `/dashboard/${role}`

export const menuByRole: Record<Role, SidebarMenuItem[]> = {
  'super-admin': [
    { label: 'Dashboard', path: dashboardPath('super-admin') },
    {
      label: 'User Management',
      path: '/module/user-management',
      children: [
        { label: 'Manage Users', path: '/module/user-management' },
        { label: 'Roles & Permissions', path: '/module/roles-permissions' },
      ],
    },
    { label: 'Payroll', path: '/module/payroll' },
    {
      label: 'System Settings',
      path: '/module/system-settings',
      children: [
        { label: 'Fiscal Periods', path: '/module/fiscal-periods' },
        { label: 'Integration Settings', path: '/module/integration-settings' },
        { label: 'Customers', path: '/module/customers' },
        { label: 'Bank Directory', path: '/module/bank-directory' },
        { label: 'Security Policy', path: '/module/security-policy' },
        { label: 'Backup & Restore', path: '/module/system-settings#backup-restore' },
      ],
    },
    {
      label: 'Monitoring',
      path: '/module/system-settings#audit-logs',
      children: [
        { label: 'Audit Logs', path: '/module/system-settings#audit-logs' },
        { label: 'Job Queue', path: '/module/job-queue' },
        { label: 'System Health', path: '/module/system-health' },
      ],
    },
    {
      label: 'Reports',
      path: '/module/system-settings#reports',
      children: [
        { label: 'Financial Reports', path: '/module/financial-reports' },
        { label: 'System Reports', path: '/module/admin-reports' },
      ],
    },
  ],
  accountant: [
    { label: 'Dashboard', path: dashboardPath('accountant') },
    { label: 'Payroll', path: '/module/payroll' },
    { label: 'General Ledger', path: '/module/general-ledger' },
    { label: 'Accounts Payable', path: '/module/accounts-payable' },
    { label: 'Accounts Receivable', path: '/module/accounts-receivable' },
    { label: 'Bank Reconciliation', path: '/module/bank-reconciliation' },
    {
      label: 'Loans',
      path: '/module/loan-review',
      children: [
        { label: 'Review Applications', path: '/module/loan-review' },
      ],
    },
    { label: 'Customers', path: '/module/customers' },
    { label: 'Reports', path: '/module/financial-reports' },
  ],
  'faculty-admin': [
    { label: 'Dashboard', path: dashboardPath('faculty-admin') },
    {
      label: 'Department Reports',
      path: '/module/dept-reports',
      children: [
        { label: 'Budget Status', path: '/module/dept-reports#budget-status' },
        { label: 'Variance Analysis', path: '/module/dept-reports#variance-analysis' },
        { label: 'Export PDF Summary', path: '/module/dept-reports#export-pdf' },
      ],
    },
    {
      label: 'Approvals Inbox',
      path: '/module/fa-approvals',
    },
  ],
  employee: [
    { label: 'My Dashboard', path: dashboardPath('employee') },
    { label: 'Expense Claims', path: '/module/expense-claims' },
    { label: 'Payslips', path: '/module/payslips' },
    { label: 'Profile', path: '/module/profile' },
  ],
  'authorized-viewer': [
    { label: 'Executive Dashboard', path: dashboardPath('authorized-viewer') },
    { label: 'Executive Summary', path: '/module/executive-summary' },
    { label: 'Reports', path: '/module/av-reports' },
  ],
  auditor: [
    { label: 'Dashboard', path: dashboardPath('auditor') },
    {
      label: 'Audit Investigation',
      path: '/module/audit-logs',
      children: [
        { label: 'Audit Log Viewer', path: '/module/audit-logs' },
        { label: 'Segregation of Duties Report', path: '/module/sod-report' },
        { label: 'User Activity Timeline', path: '/module/user-activity-timeline' },
      ],
    },
    {
      label: 'Financial Review',
      path: '/module/general-ledger-inquiry',
      children: [
        { label: 'General Ledger Inquiry', path: '/module/general-ledger-inquiry' },
        { label: 'Trial Balance', path: '/module/trial-balance' },
        { label: 'Vendor Master List', path: '/module/vendor-master' },
        { label: 'Customer Master List', path: '/module/customer-master' },
      ],
    },
    {
      label: 'Reports',
      path: '/module/balance-sheet',
      children: [
        { label: 'Balance Sheet', path: '/module/balance-sheet' },
        { label: 'Income Statement (P&L)', path: '/module/income-statement' },
        { label: 'Accounts Payable Aging', path: '/module/ap-aging' },
        { label: 'Accounts Receivable Aging', path: '/module/ar-aging' },
      ],
    },
    {
      label: 'Settings',
      path: '/module/evidence-archive',
      children: [
        { label: 'Export Evidence Archive', path: '/module/evidence-archive' },
      ],
    },
  ],
  cfo: [
    { label: 'Dashboard', path: dashboardPath('cfo') },
    { label: 'Payroll', path: '/module/payroll' },
    { label: 'Approval Inbox', path: '/module/approvals-inbox' },
    { label: 'Budget Control', path: '/module/budget-control' },
    {
      label: 'Loans',
      path: '/module/loan-approval',
      children: [
        { label: 'Approve Applications', path: '/module/loan-approval' },
        { label: 'Interest Rate Tiers', path: '/module/loan-tiers' },
      ],
    },
    { label: 'Customers', path: '/module/customers' },
    { label: 'Reports', path: '/module/financial-reports' },
  ],
  customer: [
    { label: 'Dashboard', path: '/dashboard/customer' },
    { label: 'Profile', path: '/module/profile' },
    { label: 'Loans', path: '/module/loans' },
    { label: 'Invoices', path: '/module/invoices' },
    { label: 'Budgets', path: '/module/budgets' },
    { label: 'Approvals', path: '/module/approvals' },
    { label: 'Statements', path: '/module/reports/statements' },
    { label: 'Support', path: '/module/support' },
  ],
}
