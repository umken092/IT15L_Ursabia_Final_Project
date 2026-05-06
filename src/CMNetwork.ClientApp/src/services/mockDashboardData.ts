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
    { label: 'User Management', path: '/module/user-management' },
    {
      label: 'System Settings',
      path: '/module/system-settings',
      children: [
        { label: 'Security Policy', path: '/module/system-settings' },
        { label: 'Backup & Restore', path: '/module/system-settings' },
        { label: 'View Integrations', path: '/module/system-settings' },
        { label: 'Audit Logs', path: '/module/system-settings' },
      ],
    },
  ],
  accountant: [
    { label: 'Dashboard', path: dashboardPath('accountant') },
    { label: 'General Ledger', path: '/module/general-ledger' },
    { label: 'Accounts Payable', path: '/module/accounts-payable' },
    { label: 'Accounts Receivable', path: '/module/accounts-receivable' },
    { label: 'Bank Reconciliation', path: '/module/bank-reconciliation' },
    { label: 'Financial Reports', path: '/module/financial-reports' },
    { label: 'Reports', path: '/module/reports' },
  ],
  'faculty-admin': [
    { label: 'Dashboard', path: dashboardPath('faculty-admin') },
    {
      label: 'Department Reports',
      path: '/module/dept-reports',
      children: [
        { label: 'Budget Status', path: '/module/dept-reports' },
        { label: 'Variance Analysis', path: '/module/dept-reports' },
        { label: 'Export PDF Summary', path: '/module/dept-reports' },
      ],
    },
    {
      label: 'Approvals Inbox',
      path: '/module/fa-approvals',
      children: [
        { label: 'Expense Claims', path: '/module/fa-approvals' },
        { label: 'Purchase Requisitions', path: '/module/fa-approvals' },
        { label: 'Budget Transfers', path: '/module/fa-approvals' },
      ],
    },
    {
      label: 'Reports',
      path: '/module/fa-reports',
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
    {
      label: 'Executive Summary',
      path: '/module/executive-summary',
      children: [
        { label: 'Monthly Performance', path: '/module/executive-summary#monthly-performance' },
        { label: 'Trend Charts', path: '/module/executive-summary#trend-charts' },
        { label: 'Export Brief', path: '/module/executive-summary#export-brief' },
      ],
    },
    {
      label: 'Reports',
      path: '/module/av-reports',
      children: [
        { label: 'P&L Summary', path: '/module/av-reports#pl-summary' },
        { label: 'Balance Sheet Summary', path: '/module/av-reports#balance-sheet' },
      ],
    },
  ],
  auditor: [
    { label: 'Dashboard', path: dashboardPath('auditor') },
    { label: 'Audit Logs', path: '/module/audit-logs' },
    { label: 'Financial Reports', path: '/module/financial-reports' },
    { label: 'Reports', path: '/module/reports' },
  ],
  cfo: [
    { label: 'Dashboard', path: dashboardPath('cfo') },
    { label: 'Approval Inbox', path: '/module/approvals-inbox' },
    { label: 'Budget Control', path: '/module/budget-control' },
    { label: 'Financial Reports', path: '/module/financial-reports' },
    { label: 'Reports', path: '/module/reports' },
  ],
}

export const chartData = {
  cashPosition: [430000, 445000, 421000, 468000, 472000, 489000],
  budgetVsActualBudget: [520000, 490000, 550000, 580000, 605000, 620000],
  budgetVsActualActual: [500000, 472000, 535000, 565000, 590000, 598000],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
}

export const pendingApprovals = [
  { id: 'APR-1201', title: 'Expense Claim - Lab Supplies', owner: 'Dr. Cruz' },
  { id: 'APR-1202', title: 'Purchase Requisition - Printers', owner: 'Ms. Tan' },
  { id: 'APR-1203', title: 'Travel Liquidation - Seminar', owner: 'Mr. Lopez' },
]

export const recentAuditActivities = [
  'GL entry JE-4801 modified',
  'Payment batch PB-218 submitted for review',
  'Vendor profile VX-332 bank details changed',
  'Month-end close checklist marked complete for AP',
]

// Super Admin: Security Policies
export interface SecurityPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  value: string
}

export const securityPolicies: SecurityPolicy[] = [
  {
    id: 'pwd-policy',
    name: 'Password Policy',
    description: 'Enforce strong passwords and rotation',
    enabled: true,
    value: 'Minimum 12 characters, uppercase + numbers + symbols. Rotate every 90 days.',
  },
  {
    id: 'mfa-policy',
    name: 'Multi-Factor Authentication',
    description: 'Require MFA for sensitive operations',
    enabled: false,
    value: 'SMS or authenticator app',
  },
  {
    id: 'session-policy',
    name: 'Session Timeout',
    description: 'Automatic logout after inactivity',
    enabled: true,
    value: '30 minutes inactivity timeout',
  },
  {
    id: 'ip-policy',
    name: 'IP Whitelist',
    description: 'Restrict access to known IPs',
    enabled: false,
    value: 'Not configured',
  },
  {
    id: 'audit-policy',
    name: 'Audit Logging',
    description: 'Log all user actions and changes',
    enabled: true,
    value: 'All events logged and archived',
  },
]

// Super Admin: Integrations
export interface Integration {
  id: string
  name: string
  status: 'active' | 'inactive' | 'error'
  endpoint: string
  lastSync: string
}

export const integrations: Integration[] = [
  {
    id: 'payroll-svc',
    name: 'Payroll Service',
    status: 'active',
    endpoint: 'https://payroll.cmnetwork.internal/api',
    lastSync: '2026-04-28 08:15 AM',
  },
  {
    id: 'tax-compliance',
    name: 'Tax Compliance Engine',
    status: 'active',
    endpoint: 'https://tax.cmnetwork.internal/api',
    lastSync: '2026-04-28 07:30 AM',
  },
  {
    id: 'bank-feed',
    name: 'Bank Feed Service',
    status: 'active',
    endpoint: 'https://banking.cmnetwork.internal/api',
    lastSync: '2026-04-28 03:45 AM',
  },
  {
    id: 'email-svc',
    name: 'Email & Notifications',
    status: 'active',
    endpoint: 'https://notify.cmnetwork.internal/api',
    lastSync: '2026-04-28 09:00 AM',
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    status: 'inactive',
    endpoint: 'https://analytics.cmnetwork.internal/api',
    lastSync: '2026-04-27 11:20 PM',
  },
]

// Super Admin: Employees/Users
export interface Employee {
  id: string
  email: string
  fullName: string
  department: string
  role: Role
  status: 'active' | 'inactive' | 'pending'
  joinDate: string
}

export const mockEmployees: Employee[] = [
  {
    id: 'EMP-001',
    email: 'admin@cmnetwork.com',
    fullName: 'Admin User',
    department: 'IT',
    role: 'super-admin',
    status: 'active',
    joinDate: '2024-01-15',
  },
  {
    id: 'EMP-002',
    email: 'accountant@cmnetwork.com',
    fullName: 'Maria Santos',
    department: 'Finance',
    role: 'accountant',
    status: 'active',
    joinDate: '2024-02-20',
  },
  {
    id: 'EMP-003',
    email: 'cfo@cmnetwork.com',
    fullName: 'Robert Chen',
    department: 'Finance',
    role: 'cfo',
    status: 'active',
    joinDate: '2023-06-10',
  },
  {
    id: 'EMP-004',
    email: 'faculty.admin@cmnetwork.com',
    fullName: 'Dr. Ana Garcia',
    department: 'Human Resources',
    role: 'faculty-admin',
    status: 'active',
    joinDate: '2024-03-01',
  },
  {
    id: 'EMP-005',
    email: 'john.doe@cmnetwork.com',
    fullName: 'John Doe',
    department: 'Operations',
    role: 'employee',
    status: 'active',
    joinDate: '2024-04-05',
  },
  {
    id: 'EMP-006',
    email: 'pending.user@cmnetwork.com',
    fullName: 'Jane Smith',
    department: 'Finance',
    role: 'accountant',
    status: 'pending',
    joinDate: '2026-04-28',
  },
]

// Super Admin: Backup History
export interface BackupRecord {
  id: string
  timestamp: string
  status: 'success' | 'in-progress' | 'failed'
  size: string
  duration: string
}

export const backupHistory: BackupRecord[] = [
  {
    id: 'BKP-20260428-01',
    timestamp: '2026-04-28 02:00 AM',
    status: 'success',
    size: '2.3 GB',
    duration: '15 minutes',
  },
  {
    id: 'BKP-20260427-01',
    timestamp: '2026-04-27 02:00 AM',
    status: 'success',
    size: '2.1 GB',
    duration: '14 minutes',
  },
  {
    id: 'BKP-20260426-01',
    timestamp: '2026-04-26 02:00 AM',
    status: 'success',
    size: '2.0 GB',
    duration: '13 minutes',
  },
]
