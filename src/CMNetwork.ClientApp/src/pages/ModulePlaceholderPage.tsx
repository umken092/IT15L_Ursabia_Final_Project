import type { ReactElement } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { ProgressBar } from '@progress/kendo-react-progressbars'
import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { convertCurrencyText, useDisplayCurrency } from '../store/currencyStore'
import { roleDashboardPath, roleLabels, type Role } from '../types/auth'
import { RoleGuard, moduleRoleMap } from '../components/RoleGuard'
import { AccountantOperationsModule } from './modules/AccountantOperationsModule'
import { APInvoicesModule } from './modules/APInvoicesModule'
import { ARInvoicesModule } from './modules/ARInvoicesModule'
import { AuditorModulesModule, type AuditorModuleKey } from './modules/AuditorModulesModule'
import { AuthorizedViewerModule, type AvModuleKey } from './modules/AuthorizedViewerModule'
import { EmployeeWorkspaceModule } from './modules/EmployeeWorkspaceModule'
import { ExtendedRoleOperationsModule } from './modules/ExtendedRoleOperationsModule'
import { FacultyAdminModule, type FacultyAdminModuleKey } from './modules/FacultyAdminModule'
import { FinancialReportsModule } from './modules/FinancialReportsModule'
import { AdminReportsModule } from './modules/AdminReportsModule'
import { FiscalPeriodsModule } from './modules/FiscalPeriodsModule'
import { IntegrationSettingsModule } from './modules/IntegrationSettingsModule'
import { JobQueueModule } from './modules/JobQueueModule'
import { SystemHealthModule } from './modules/SystemHealthModule'
import { RolesPermissionsModule } from './modules/RolesPermissionsModule'
import { SecurityPolicyModule } from './modules/SecurityPolicyModule'
import { SystemSettingsModule } from './modules/SystemSettingsModule'
import { UserManagementModule } from './modules/UserManagementModule'

type ModuleKey =
  | 'user-management'
  | 'system-settings'
  | 'general-ledger'
  | 'accounts-payable'
  | 'accounts-receivable'
  | 'bank-reconciliation'
  | 'department-report'
  | 'approvals'
  | 'dept-reports'
  | 'fa-approvals'
  | 'fa-reports'
  | 'expense-claims'
  | 'payslips'
  | 'executive-summary'
  | 'av-reports'
  | 'audit-logs'
  | 'sod-report'
  | 'user-activity-timeline'
  | 'general-ledger-inquiry'
  | 'trial-balance'
  | 'vendor-master'
  | 'customer-master'
  | 'balance-sheet'
  | 'income-statement'
  | 'ap-aging'
  | 'ar-aging'
  | 'evidence-archive'
  | 'approvals-inbox'
  | 'budget-control'
  | 'budget-cost-control'
  | 'financial-reports'
  | 'profile'
  | 'reports'
  | 'roles-permissions'
  | 'job-queue'
  | 'fiscal-periods'
  | 'integration-settings'
  | 'security-policy'
  | 'system-health'
  | 'admin-reports'

interface ModuleStat {
  label: string
  value: string
  detail: string
  progress?: number
}

interface ModuleAction {
  label: string
  description: string
}

interface ModuleRecord {
  title: string
  value: string
  detail: string
}

interface ModuleDefinition {
  title: string
  subtitle: string
  allowedRoles: Role[]
  accent: string
  summary: string
  stats: ModuleStat[]
  actions: ModuleAction[]
  records: ModuleRecord[]
}

const moduleDefinitions: Partial<Record<ModuleKey, ModuleDefinition>> = {
  'user-management': {
    title: 'User Management',
    subtitle: 'Provision users, assign roles, and review access requests.',
    allowedRoles: ['super-admin'],
    accent: '#1E3A5F',
    summary:
      'Centralize account lifecycle tasks, delegated access approvals, and role assignment controls for system administrators.',
    stats: [
      { label: 'Active Users', value: '1,248', detail: '42 added this month' },
      { label: 'Pending Requests', value: '8', detail: 'Access approvals awaiting review' },
      { label: 'Multi-role Accounts', value: '16', detail: 'Users with more than one role' },
    ],
    actions: [
      { label: 'Invite User', description: 'Send a new user invitation with a default role.' },
      { label: 'Review Access', description: 'Approve or reject account access requests.' },
      { label: 'Audit Roles', description: 'Check role assignments and elevated permissions.' },
    ],
    records: [
      { title: 'New hire onboarding', value: '3 accounts', detail: 'Ready for activation' },
      { title: 'Access review queue', value: '8 requests', detail: '2 marked urgent' },
      { title: 'Dormant users', value: '21 accounts', detail: 'Inactive for 90+ days' },
    ],
  },
  'system-settings': {
    title: 'System Settings',
    subtitle: 'Manage environment configuration, security, and operational controls.',
    allowedRoles: ['super-admin'],
    accent: '#2E7D32',
    summary:
      'Tune company-wide defaults, integration switches, and security policies without leaving the ERP workspace.',
    stats: [
      { label: 'Config Status', value: 'Healthy', detail: 'Last sync 4 minutes ago' },
      { label: 'Security Policies', value: '12', detail: 'All enforced' },
      { label: 'Automations Enabled', value: '27', detail: '5 scheduled jobs' },
    ],
    actions: [
      { label: 'Edit Policy', description: 'Adjust security and approval defaults.' },
      { label: 'Run Backup', description: 'Trigger a manual backup or restore check.' },
      { label: 'View Integrations', description: 'Inspect connected services and endpoints.' },
    ],
    records: [
      { title: 'Password policy', value: 'Enabled', detail: '90-day rotation active' },
      { title: 'Backup schedule', value: 'Daily', detail: '02:00 AM local time' },
      { title: 'Pending updates', value: '2 items', detail: 'Requires admin action' },
    ],
  },
  'general-ledger': {
    title: 'General Ledger',
    subtitle: 'Review journal entries, balances, and month-end close progress.',
    allowedRoles: ['accountant'],
    accent: '#1E3A5F',
    summary:
      'Track ledger integrity, post journals, and monitor reconciliation milestones from a single accounting workspace.',
    stats: [
      { label: 'Open Journals', value: '14', detail: '6 require review' },
      { label: 'Trial Balance', value: 'Balanced', detail: 'No mismatches detected' },
      { label: 'Close Progress', value: '68%', detail: 'Month-end close checklist', progress: 68 },
    ],
    actions: [
      { label: 'Create Journal', description: 'Open a new journal entry workflow.' },
      { label: 'Close Period', description: 'Review and finalize month-end close steps.' },
      { label: 'Export Ledger', description: 'Download ledger activity for audit support.' },
    ],
    records: [
      { title: 'JE-24018', value: 'Draft', detail: 'Revenue reclass entry' },
      { title: 'JE-24019', value: 'Pending', detail: 'Accrual for utilities' },
      { title: 'JE-24020', value: 'Posted', detail: 'Depreciation adjustment' },
    ],
  },
  'accounts-payable': {
    title: 'Accounts Payable',
    subtitle: 'Process invoices, approvals, and supplier obligations.',
    allowedRoles: ['accountant'],
    accent: '#2E7D32',
    summary:
      'Keep vendor invoices moving through approval, matching, and payment release with less manual effort.',
    stats: [
      { label: 'Open Invoices', value: '23', detail: 'PHP 1.2M pending' },
      { label: 'Due Today', value: '7', detail: '2 flagged for review' },
      { label: '3-Way Match', value: '91%', detail: 'Across current batch', progress: 91 },
    ],
    actions: [
      { label: 'Approve Batch', description: 'Release matched invoices for payment.' },
      { label: 'Match Invoice', description: 'Resolve PO and receipt discrepancies.' },
      { label: 'Supplier View', description: 'Open vendor history and payment status.' },
    ],
    records: [
      { title: 'V-1021', value: 'Urgent', detail: 'Office supplies - PHP 48,200' },
      { title: 'V-1022', value: 'Awaiting match', detail: 'Facilities maintenance - PHP 128,000' },
      { title: 'V-1023', value: 'Ready to pay', detail: 'IT subscriptions - PHP 22,500' },
    ],
  },
  'accounts-receivable': {
    title: 'Accounts Receivable',
    subtitle: 'Track customer invoices, collections, and aging balances.',
    allowedRoles: ['accountant'],
    accent: '#F9A825',
    summary:
      'Monitor receivables health, collections priorities, and cash-inflow timing from one operating view.',
    stats: [
      { label: 'Open Invoices', value: '31', detail: 'PHP 980K outstanding' },
      { label: '30+ Days Aging', value: '9', detail: 'Needs collection follow-up' },
      { label: 'Collections Rate', value: '86%', detail: 'This month', progress: 86 },
    ],
    actions: [
      { label: 'Send Reminder', description: 'Email overdue customers from the queue.' },
      { label: 'Post Receipt', description: 'Record incoming customer payments.' },
      { label: 'View Aging', description: 'Open customer aging and risk breakdown.' },
    ],
    records: [
      { title: 'INV-8812', value: '14 days overdue', detail: 'University services - PHP 120,000' },
      { title: 'INV-8813', value: 'Due tomorrow', detail: 'Conference billing - PHP 82,500' },
      { title: 'INV-8814', value: 'Collected', detail: 'Training services - PHP 56,000' },
    ],
  },
  'bank-reconciliation': {
    title: 'Bank Reconciliation',
    subtitle: 'Match bank transactions to ERP entries and clear differences.',
    allowedRoles: ['accountant'],
    accent: '#1E3A5F',
    summary:
      'Reconcile bank feeds, flag unmatched transactions, and close reconciliation batches with confidence.',
    stats: [
      { label: 'Matched Transactions', value: '184', detail: '17 still unmatched' },
      { label: 'Reconciliation Progress', value: '81%', detail: 'Current statement', progress: 81 },
      { label: 'Variance Amount', value: 'PHP 24K', detail: 'Needs investigation' },
    ],
    actions: [
      { label: 'Auto Match', description: 'Attempt to reconcile by reference and amount.' },
      { label: 'Review Variance', description: 'Open exception list for manual resolution.' },
      { label: 'Finalize Statement', description: 'Close the selected bank statement.' },
    ],
    records: [
      { title: 'BS-2026-04', value: 'Open', detail: 'Metrobank operating account' },
      { title: 'BS-2026-05', value: 'Matched', detail: 'Savings account statement' },
      { title: 'BS-2026-06', value: 'Variance', detail: 'Card settlement account' },
    ],
  },
  'department-report': {
    title: 'Department Report',
    subtitle: 'Review department budgets, usage, and variance trends.',
    allowedRoles: ['faculty-admin'],
    accent: '#2E7D32',
    summary:
      'Support faculty and department leads with budget snapshots, spending patterns, and forecast visibility.',
    stats: [
      { label: 'Budget Used', value: '74%', detail: 'PHP 125K of PHP 170K' },
      { label: 'Pending Requests', value: '4', detail: 'Awaiting your approval' },
      { label: 'Forecast Variance', value: '+3%', detail: 'Within acceptable range' },
    ],
    actions: [
      { label: 'Open Report', description: 'Review a detailed department statement.' },
      { label: 'Approve Request', description: 'Sign off on budget movements and purchases.' },
      { label: 'Export Summary', description: 'Share the current department report as PDF.' },
    ],
    records: [
      { title: 'Science Dept', value: '78%', detail: 'Budget utilization' },
      { title: 'Arts Dept', value: '69%', detail: 'Budget utilization' },
      { title: 'Engineering Dept', value: '82%', detail: 'Budget utilization' },
    ],
  },
  approvals: {
    title: 'Approvals Queue',
    subtitle: 'Handle department approvals and move work forward quickly.',
    allowedRoles: ['faculty-admin'],
    accent: '#F9A825',
    summary:
      'A compact queue for requests that need supervisory action, status review, or budget confirmation.',
    stats: [
      { label: 'Queued Items', value: '11', detail: '3 high priority' },
      { label: 'SLA Compliance', value: '96%', detail: 'Approvals within target' },
      { label: 'Avg. Turnaround', value: '1.4 days', detail: 'Across last 30 days' },
    ],
    actions: [
      { label: 'Approve Next', description: 'Process the next item in your queue.' },
      { label: 'Delegate', description: 'Assign an approval to another reviewer.' },
      { label: 'Escalate', description: 'Push urgent items to the next approver.' },
    ],
    records: [
      { title: 'Travel request', value: 'Urgent', detail: 'Conference trip for 4 staff' },
      { title: 'Lab equipment', value: 'Pending', detail: 'Budget confirmation required' },
      { title: 'Hiring memo', value: 'Under review', detail: 'New assistant position' },
    ],
  },
  'expense-claims': {
    title: 'Expense Claims',
    subtitle: 'Submit and track reimbursement requests with clear status updates.',
    allowedRoles: ['employee'],
    accent: '#1E3A5F',
    summary:
      'Employees can monitor claim progress, see what needs correction, and stay current on reimbursement timing.',
    stats: [
      { label: 'Draft Claims', value: '2', detail: 'Not submitted yet' },
      { label: 'Pending Review', value: '1', detail: 'Awaiting finance action' },
      { label: 'Average Payback', value: '4 days', detail: 'From submission to payout' },
    ],
    actions: [
      { label: 'New Claim', description: 'Start a reimbursement request.' },
      { label: 'Upload Receipt', description: 'Attach proof of purchase to a claim.' },
      { label: 'Track Status', description: 'Review the latest approval step.' },
    ],
    records: [
      { title: 'Claim CLM-201', value: 'Submitted', detail: 'PHP 1,250 travel meal' },
      { title: 'Claim CLM-202', value: 'Needs revision', detail: 'Receipt missing for taxi fare' },
      { title: 'Claim CLM-203', value: 'Paid', detail: 'Conference attendance reimbursement' },
    ],
  },
  payslips: {
    title: 'Payslips',
    subtitle: 'View payroll summaries, deductions, and year-to-date earnings.',
    allowedRoles: ['employee'],
    accent: '#2E7D32',
    summary:
      'A private payroll view for employees to inspect salary history, deductions, and tax-related summaries.',
    stats: [
      { label: 'Latest Net Pay', value: 'PHP 42,500', detail: '04/25/2026 payroll' },
      { label: 'Tax Year Earnings', value: 'PHP 255K', detail: 'YTD gross income' },
      { label: 'Deductions', value: 'PHP 6,340', detail: 'SSS, PhilHealth, Pag-IBIG' },
    ],
    actions: [
      { label: 'Download Slip', description: 'Export the latest payslip as PDF.' },
      { label: 'View History', description: 'Open previous payroll statements.' },
      { label: 'Check Deductions', description: 'Inspect current contribution breakdown.' },
    ],
    records: [
      { title: 'April 2026', value: 'Paid', detail: 'Net pay received on schedule' },
      { title: 'March 2026', value: 'Paid', detail: 'Holiday premium included' },
      { title: 'February 2026', value: 'Paid', detail: 'Regular monthly payroll' },
    ],
  },
  'executive-summary': {
    title: 'Executive Summary',
    subtitle: 'Read-only company snapshot for business leaders and stakeholders.',
    allowedRoles: ['authorized-viewer'],
    accent: '#1E3A5F',
    summary:
      'Provide leaders with a concise financial overview, trend summaries, and board-ready visibility.',
    stats: [
      { label: 'Revenue MTD', value: 'PHP 5.92M', detail: 'Up 9% month over month' },
      { label: 'Expenses MTD', value: 'PHP 4.07M', detail: 'Down 4% month over month' },
      { label: 'Net Income', value: 'PHP 1.85M', detail: 'Margin steady at 31%' },
    ],
    actions: [
      { label: 'Export Brief', description: 'Create a board-friendly summary package.' },
      { label: 'View Trends', description: 'Open monthly performance comparisons.' },
      { label: 'Share Snapshot', description: 'Send the current executive view by email.' },
    ],
    records: [
      { title: 'Revenue trend', value: 'Positive', detail: 'Six-month growth maintained' },
      { title: 'Expense trend', value: 'Controlled', detail: 'Spending below forecast' },
      { title: 'Cash runway', value: 'Healthy', detail: 'No liquidity concerns' },
    ],
  },
  'av-reports': {
    title: 'Financial Reports',
    subtitle: 'Aggregated P&L and Balance Sheet summaries for authorised stakeholders.',
    allowedRoles: ['authorized-viewer'],
    accent: '#1E3A5F',
    summary:
      'View top-level P&L and Balance Sheet groupings. No account-level detail, no vendor or employee data, and no drill-down.',
    stats: [
      { label: 'Total Revenue', value: 'PHP 5.98M', detail: 'MTD aggregated revenue' },
      { label: 'Net Income', value: 'PHP 1.16M', detail: 'MTD net after all expenses' },
      { label: 'Total Assets', value: 'PHP 18.21M', detail: 'Balance sheet total' },
    ],
    actions: [
      { label: 'P&L Summary', description: 'View top-level profit & loss categories.' },
      { label: 'Balance Sheet', description: 'View major asset, liability, and equity groupings.' },
      { label: 'Export PDF', description: 'Download watermarked summary report.' },
    ],
    records: [
      { title: 'Gross Profit', value: 'PHP 4.74M', detail: 'Revenue less COGS' },
      { title: 'Operating Income', value: 'PHP 1.16M', detail: 'After operating expenses' },
      { title: 'Equity', value: 'PHP 13.56M', detail: 'Owner equity balance' },
    ],
  },
  'audit-logs': {
    title: 'Audit Logs',
    subtitle: 'Inspect user activity, unusual events, and compliance signals.',
    allowedRoles: ['auditor'],
    accent: '#D32F2F',
    summary:
      'Give auditors a structured trail of important actions, exceptions, and policy breaches across the platform.',
    stats: [
      { label: 'High-Risk Events', value: '3', detail: 'Requires immediate review' },
      { label: 'Log Entries', value: '156', detail: 'Last 7 days' },
      { label: 'Investigations Open', value: '5', detail: 'Two escalated today' },
    ],
    actions: [
      { label: 'Search Logs', description: 'Filter records by user, date, or entity.' },
      { label: 'Export Evidence', description: 'Download a signed audit trail archive.' },
      { label: 'Mark Reviewed', description: 'Clear items after investigation.' },
    ],
    records: [
      { title: 'Failed login', value: 'Critical', detail: 'Unknown user at 09:15 AM' },
      { title: 'Vendor edit', value: 'Warning', detail: 'Bank details changed' },
      { title: 'Journal update', value: 'Normal', detail: 'Manual adjustment posted' },
    ],
  },
  'sod-report': {
    title: 'Segregation of Duties Report',
    subtitle: 'Detect users whose recent actions violate SoD rules.',
    allowedRoles: ['auditor'],
    accent: '#D32F2F',
    summary:
      'Surface combinations of activities that should never be performed by the same user (e.g., create vendor + approve payment) so that conflicts can be investigated.',
    stats: [
      { label: 'Active Rules', value: '12', detail: 'Pre-defined SoD checks' },
      { label: 'Open Conflicts', value: '4', detail: 'Across 3 users this period' },
      { label: 'Last Run', value: 'Today', detail: 'Auto-refreshed at 06:00' },
    ],
    actions: [
      { label: 'Run SoD Check', description: 'Execute the rule set against recent activity.' },
      { label: 'View Violations', description: 'Inspect users, timestamps, and conflicting actions.' },
      { label: 'Export Report', description: 'Generate a signed report for management or external audit.' },
    ],
    records: [
      { title: 'Vendor + Payment approval', value: '2 users', detail: 'Reviewed: 0' },
      { title: 'COA edit + Journal post', value: '1 user', detail: 'Reviewed: 0' },
      { title: 'Invoice create + Approve', value: '1 user', detail: 'Reviewed: 0' },
    ],
  },
  'user-activity-timeline': {
    title: 'User Activity Timeline',
    subtitle: 'Chronological feed of a single user\u2019s activity.',
    allowedRoles: ['auditor'],
    accent: '#D32F2F',
    summary:
      'Investigate suspicious behaviour by viewing every login, data change, approval, and export performed by a chosen user across time.',
    stats: [
      { label: 'Tracked Users', value: 'All', detail: 'Includes inactive accounts' },
      { label: 'Event Types', value: '6', detail: 'Login, change, approval, export, +' },
      { label: 'Retention', value: '7 years', detail: 'Immutable history' },
    ],
    actions: [
      { label: 'Pick a User', description: 'Select an account to view their activity feed.' },
      { label: 'Filter Events', description: 'Limit by date range or event type.' },
      { label: 'Export Timeline', description: 'Download the timeline as PDF/CSV.' },
    ],
    records: [
      { title: 'Recent investigations', value: '3', detail: 'Opened in last 30 days' },
      { title: 'Suspicious sign-ins', value: '0', detail: 'No anomalies flagged today' },
      { title: 'Mass exports', value: '1', detail: 'Reviewed and cleared' },
    ],
  },
  'general-ledger-inquiry': {
    title: 'General Ledger Inquiry',
    subtitle: 'Read-only ledger inquiry with drill-down to source documents.',
    allowedRoles: ['auditor'],
    accent: '#1E3A5F',
    summary:
      'Browse account balances and trace any figure through the journal entry to the originating document (invoice, receipt, payment).',
    stats: [
      { label: 'Accounts', value: '212', detail: 'Active in current fiscal year' },
      { label: 'Postings YTD', value: '8,431', detail: 'All sources combined' },
      { label: 'Last Posting', value: 'Today', detail: 'Auto-synced from sub-ledgers' },
    ],
    actions: [
      { label: 'Open Account', description: 'Inspect transactions for a specific GL account.' },
      { label: 'Drill to Source', description: 'Walk from balance to journal to source document.' },
      { label: 'Export Inquiry', description: 'Download the current inquiry view.' },
    ],
    records: [
      { title: 'Cash & Equivalents', value: 'Open', detail: 'Drill-down enabled' },
      { title: 'Accounts Receivable', value: 'Open', detail: 'Drill-down enabled' },
      { title: 'Accounts Payable', value: 'Open', detail: 'Drill-down enabled' },
    ],
  },
  'trial-balance': {
    title: 'Trial Balance',
    subtitle: 'Read-only trial balance as of any date.',
    allowedRoles: ['auditor'],
    accent: '#1E3A5F',
    summary:
      'Generate the trial balance for any point in time and drill down to underlying GL postings for verification.',
    stats: [
      { label: 'As-Of Date', value: 'Today', detail: 'Adjustable on demand' },
      { label: 'Out of Balance', value: 'PHP 0.00', detail: 'Debits = Credits' },
      { label: 'Accounts Listed', value: '212', detail: 'All active accounts' },
    ],
    actions: [
      { label: 'Run Trial Balance', description: 'Generate the report for a chosen date.' },
      { label: 'Compare Periods', description: 'View side-by-side period comparisons.' },
      { label: 'Export', description: 'Download as Excel or PDF for the audit file.' },
    ],
    records: [
      { title: 'Assets', value: 'Balanced', detail: 'No reconciling items' },
      { title: 'Liabilities & Equity', value: 'Balanced', detail: 'No reconciling items' },
      { title: 'Income & Expense', value: 'Balanced', detail: 'No reconciling items' },
    ],
  },
  'vendor-master': {
    title: 'Vendor Master List',
    subtitle: 'Read-only vendor records, including inactive and soft-deleted entries.',
    allowedRoles: ['auditor'],
    accent: '#1E3A5F',
    summary:
      'Inspect every vendor record and its full change history (bank account updates, credit limit changes, status changes).',
    stats: [
      { label: 'Active Vendors', value: '184', detail: 'Across all departments' },
      { label: 'Inactive / Deleted', value: '37', detail: 'Visible to auditor only' },
      { label: 'Recent Changes', value: '12', detail: 'Last 30 days' },
    ],
    actions: [
      { label: 'Browse Vendors', description: 'Open the vendor list with filters.' },
      { label: 'View History', description: 'See all changes to a selected vendor over time.' },
      { label: 'Export List', description: 'Download the current view for evidence.' },
    ],
    records: [
      { title: 'Bank account changes', value: '4', detail: 'Last 30 days' },
      { title: 'Credit limit changes', value: '6', detail: 'Last 30 days' },
      { title: 'Status changes', value: '2', detail: 'Last 30 days' },
    ],
  },
  'customer-master': {
    title: 'Customer Master List',
    subtitle: 'Read-only customer records with full change history.',
    allowedRoles: ['auditor'],
    accent: '#1E3A5F',
    summary:
      'Browse customer master data and audit every change made to a record (credit terms, billing details, status).',
    stats: [
      { label: 'Active Customers', value: '321', detail: 'Across all segments' },
      { label: 'Inactive / Deleted', value: '58', detail: 'Visible to auditor only' },
      { label: 'Recent Changes', value: '21', detail: 'Last 30 days' },
    ],
    actions: [
      { label: 'Browse Customers', description: 'Open the customer list with filters.' },
      { label: 'View History', description: 'See all changes to a selected customer over time.' },
      { label: 'Export List', description: 'Download the current view for evidence.' },
    ],
    records: [
      { title: 'Credit term changes', value: '5', detail: 'Last 30 days' },
      { title: 'Billing detail changes', value: '11', detail: 'Last 30 days' },
      { title: 'Status changes', value: '5', detail: 'Last 30 days' },
    ],
  },
  'balance-sheet': {
    title: 'Balance Sheet',
    subtitle: 'Read-only balance sheet with drill-down to source documents.',
    allowedRoles: ['auditor', 'accountant', 'cfo'],
    accent: '#1E3A5F',
    summary:
      'View the balance sheet as of any date and walk from any figure down to the GL account, journal entry, and source document.',
    stats: [
      { label: 'As-Of Date', value: 'Today', detail: 'Adjustable on demand' },
      { label: 'Compare Periods', value: 'Enabled', detail: 'Side-by-side comparison' },
      { label: 'Drill-down', value: 'Full', detail: 'All the way to source documents' },
    ],
    actions: [
      { label: 'Generate Balance Sheet', description: 'Render the statement for a chosen date.' },
      { label: 'Compare Periods', description: 'Place two balance sheets side by side.' },
      { label: 'Export', description: 'Download as Excel or PDF for the audit file.' },
    ],
    records: [
      { title: 'Total Assets', value: 'Drill', detail: 'Click to walk to source' },
      { title: 'Total Liabilities', value: 'Drill', detail: 'Click to walk to source' },
      { title: 'Total Equity', value: 'Drill', detail: 'Click to walk to source' },
    ],
  },
  'income-statement': {
    title: 'Income Statement (P&L)',
    subtitle: 'Read-only profit & loss with drill-down to source documents.',
    allowedRoles: ['auditor', 'accountant', 'cfo'],
    accent: '#1E3A5F',
    summary:
      'View the income statement for any date range and drill down from any figure to the underlying journal entries and source documents.',
    stats: [
      { label: 'Date Range', value: 'Adjustable', detail: 'Any period' },
      { label: 'Compare Periods', value: 'Enabled', detail: 'Side-by-side comparison' },
      { label: 'Drill-down', value: 'Full', detail: 'All the way to source documents' },
    ],
    actions: [
      { label: 'Generate P&L', description: 'Render the statement for the chosen range.' },
      { label: 'Compare Periods', description: 'Place two periods side by side.' },
      { label: 'Export', description: 'Download as Excel or PDF for the audit file.' },
    ],
    records: [
      { title: 'Revenue', value: 'Drill', detail: 'Click to walk to source' },
      { title: 'Operating Expenses', value: 'Drill', detail: 'Click to walk to source' },
      { title: 'Net Income', value: 'Drill', detail: 'Click to walk to source' },
    ],
  },
  'ap-aging': {
    title: 'AP Aging',
    subtitle: 'Read-only Accounts Payable aging analysis.',
    allowedRoles: ['auditor', 'accountant', 'cfo'],
    accent: '#1E3A5F',
    summary:
      'Inspect outstanding payables grouped into aging buckets and drill down to the originating vendor invoices.',
    stats: [
      { label: 'Total Outstanding', value: 'Open', detail: 'Across all buckets' },
      { label: 'Past Due > 30 days', value: 'Open', detail: 'Highlighted in report' },
      { label: 'As-Of Date', value: 'Today', detail: 'Adjustable on demand' },
    ],
    actions: [
      { label: 'Generate Report', description: 'Render the aging analysis for a chosen date.' },
      { label: 'Drill to Invoice', description: 'Open the source AP invoice.' },
      { label: 'Export', description: 'Download as Excel or PDF for the audit file.' },
    ],
    records: [
      { title: '0-30 days', value: 'Drill', detail: 'Click to view invoices' },
      { title: '31-60 days', value: 'Drill', detail: 'Click to view invoices' },
      { title: '60+ days', value: 'Drill', detail: 'Click to view invoices' },
    ],
  },
  'ar-aging': {
    title: 'AR Aging',
    subtitle: 'Read-only Accounts Receivable aging analysis.',
    allowedRoles: ['auditor', 'accountant', 'cfo'],
    accent: '#1E3A5F',
    summary:
      'Inspect outstanding receivables grouped into aging buckets and drill down to the originating customer invoices.',
    stats: [
      { label: 'Total Outstanding', value: 'Open', detail: 'Across all buckets' },
      { label: 'Past Due > 30 days', value: 'Open', detail: 'Highlighted in report' },
      { label: 'As-Of Date', value: 'Today', detail: 'Adjustable on demand' },
    ],
    actions: [
      { label: 'Generate Report', description: 'Render the aging analysis for a chosen date.' },
      { label: 'Drill to Invoice', description: 'Open the source AR invoice.' },
      { label: 'Export', description: 'Download as Excel or PDF for the audit file.' },
    ],
    records: [
      { title: '0-30 days', value: 'Drill', detail: 'Click to view invoices' },
      { title: '31-60 days', value: 'Drill', detail: 'Click to view invoices' },
      { title: '60+ days', value: 'Drill', detail: 'Click to view invoices' },
    ],
  },
  'evidence-archive': {
    title: 'Export Evidence Archive',
    subtitle: 'Download signed evidence packages for external regulators.',
    allowedRoles: ['auditor'],
    accent: '#D32F2F',
    summary:
      'Build a signed PDF/ZIP archive of selected audit log entries (with checksum) or access previously generated archives.',
    stats: [
      { label: 'Recent Archives', value: '7', detail: 'Generated in last 30 days' },
      { label: 'Storage Used', value: '128 MB', detail: 'Encrypted at rest' },
      { label: 'Retention', value: '7 years', detail: 'Per compliance policy' },
    ],
    actions: [
      { label: 'New Archive', description: 'Bundle selected logs into a signed package.' },
      { label: 'View Archives', description: 'Browse and re-download previous archives.' },
      { label: 'Verify Integrity', description: 'Re-check the checksum of an archive.' },
    ],
    records: [
      { title: 'Latest archive', value: 'Today', detail: 'Signed & checksum verified' },
      { title: 'Pending requests', value: '0', detail: 'No queued exports' },
      { title: 'Failed exports', value: '0', detail: 'All recent exports succeeded' },
    ],
  },
  'approvals-inbox': {
    title: 'Approvals Inbox',
    subtitle: 'Review enterprise approvals waiting for CFO attention.',
    allowedRoles: ['cfo'],
    accent: '#F9A825',
    summary:
      'A focused inbox for high-value approvals, sign-offs, and exceptions that require executive review.',
    stats: [
      { label: 'Pending Sign-offs', value: '12', detail: '4 marked urgent' },
      { label: 'High Value Items', value: '5', detail: 'Above PHP 500K' },
      { label: 'SLA Compliance', value: '94%', detail: 'Approvals within target', progress: 94 },
    ],
    actions: [
      { label: 'Approve Batch', description: 'Release a group of matched approvals.' },
      { label: 'Review Exception', description: 'Open the highest-risk request first.' },
      { label: 'Forward', description: 'Send to finance or operations for clarification.' },
    ],
    records: [
      { title: 'Period close sign-off', value: 'Urgent', detail: 'March 2026 final review' },
      { title: 'Large payment request', value: 'PHP 890K', detail: 'Vendor VX-442' },
      { title: 'Budget reallocation', value: 'Pending', detail: 'Operations request' },
    ],
  },
  'budget-control': {
    title: 'Budget Control',
    subtitle: 'Watch company budgets, forecasts, and reallocations in one place.',
    allowedRoles: ['cfo'],
    accent: '#2E7D32',
    summary:
      'Keep leadership informed on forecast drift, allocation changes, and department spending thresholds.',
    stats: [
      { label: 'Budget Utilized', value: '92%', detail: 'Company-wide close to cap', progress: 92 },
      { label: 'Variance vs Plan', value: '+PHP 180K', detail: 'Above forecast spend' },
      { label: 'Reallocation Requests', value: '3', detail: 'Pending CFO review' },
    ],
    actions: [
      { label: 'Review Forecast', description: 'Inspect current budget vs actual curves.' },
      { label: 'Approve Reallocation', description: 'Authorize budget movement between teams.' },
      { label: 'Export Plan', description: 'Share the budget control snapshot.' },
    ],
    records: [
      { title: 'Operations', value: '88%', detail: 'Spending on plan' },
      { title: 'IT', value: '104%', detail: 'Needs reallocation' },
      { title: 'Facilities', value: '79%', detail: 'Under target' },
    ],
  },
  'budget-cost-control': {
    title: 'Budget & Cost Control',
    subtitle: 'Read-only budget posture for faculty leadership.',
    allowedRoles: ['faculty-admin'],
    accent: '#2E7D32',
    summary: 'Read-only view of budget utilization, cost variances, and category spending trends.',
    stats: [
      { label: 'Budget Utilized', value: '74%', detail: 'Within target range' },
      { label: 'Cost Variance', value: '+2.1%', detail: 'Minor overrun in operations' },
      { label: 'Forecast Risk', value: 'Low', detail: 'Current trajectory stable' },
    ],
    actions: [
      { label: 'View Summary', description: 'Open read-only budget summary.' },
      { label: 'Inspect Trend', description: 'Review cost trend by month.' },
      { label: 'Export Snapshot', description: 'Download a snapshot for review.' },
    ],
    records: [
      { title: 'Personnel', value: '68%', detail: 'Spend vs budget' },
      { title: 'Operations', value: '77%', detail: 'Spend vs budget' },
      { title: 'Projects', value: '72%', detail: 'Spend vs budget' },
    ],
  },
  profile: {
    title: 'Profile',
    subtitle: 'Manage personal profile and account details.',
    allowedRoles: ['employee'],
    accent: '#1E3A5F',
    summary: 'Maintain contact details, preferred settings, and self-service account preferences.',
    stats: [
      { label: 'Profile Completion', value: '86%', detail: 'Update remaining optional fields' },
      { label: 'Security Level', value: 'Standard', detail: 'MFA optional for employee role' },
      { label: 'Recent Updates', value: '2', detail: 'Changes in last 30 days' },
    ],
    actions: [
      { label: 'Edit Profile', description: 'Update personal details and contacts.' },
      { label: 'Change Password', description: 'Update account password.' },
      { label: 'Notification Prefs', description: 'Manage alerts and reminders.' },
    ],
    records: [
      { title: 'Primary email', value: 'Verified', detail: 'Last verified Apr 2026' },
      { title: 'Phone number', value: 'On file', detail: 'Used for notifications' },
      { title: 'Address', value: 'Updated', detail: 'Last update this month' },
    ],
  },
  reports: {
    title: 'Reports',
    subtitle: 'Role-based analytics and exports.',
    allowedRoles: ['accountant', 'auditor', 'cfo'],
    accent: '#1E3A5F',
    summary: 'Consolidated reporting workspace with read-only and drill-down outputs based on role permissions.',
    stats: [
      { label: 'Saved Reports', value: '14', detail: 'Available in your role scope' },
      { label: 'Scheduled Exports', value: '6', detail: 'Auto-generated weekly/monthly' },
      { label: 'Drill-down Access', value: 'Enabled', detail: 'Role-dependent detail depth' },
    ],
    actions: [
      { label: 'Run Report', description: 'Execute selected report template.' },
      { label: 'Export Data', description: 'Download report output as file.' },
      { label: 'Open Drill-down', description: 'Inspect detailed report slices.' },
    ],
    records: [
      { title: 'Financial Summary', value: 'Ready', detail: 'Latest data loaded' },
      { title: 'Compliance Report', value: 'Ready', detail: 'Updated daily' },
      { title: 'Operations Trend', value: 'Ready', detail: 'Last refresh this morning' },
    ],
  },
  'financial-reports': {
    title: 'Financial Reports',
    subtitle: 'Income statement, balance sheet, cash flow, and aging reports.',
    allowedRoles: ['accountant', 'auditor', 'cfo'],
    accent: '#1E3A5F',
    summary: 'Generate and export financial statements with date range filters for income, balance sheet, cash flow, AP/AR aging, and department budgets.',
    stats: [
      { label: 'Income Statement', value: 'Available', detail: 'Date range filter' },
      { label: 'Balance Sheet', value: 'Available', detail: 'As-of date filter' },
      { label: 'AP/AR Aging', value: 'Available', detail: 'Aging buckets by date' },
    ],
    actions: [
      { label: 'Load Report', description: 'Generate selected report with date filter.' },
      { label: 'Export Excel', description: 'Download report as Excel file.' },
      { label: 'Export PDF', description: 'Download report as PDF.' },
    ],
    records: [
      { title: 'Income Statement', value: 'Ready', detail: 'Monthly or custom date range' },
      { title: 'Balance Sheet', value: 'Ready', detail: 'Point-in-time as-of date' },
      { title: 'Department Budget', value: 'Ready', detail: 'Budget vs actual variance' },
    ],
  },
  'dept-reports': {
    title: 'Department Reports',
    subtitle: 'Monitor real-time budget usage, variance trends, and export summaries.',
    allowedRoles: ['faculty-admin'],
    accent: '#2E7D32',
    summary: 'View your department\'s budget status, drill into spending by account, and compare actual vs budget for any period.',
    stats: [
      { label: 'Budget Used', value: '74%', detail: 'PHP 125K of PHP 170K', progress: 74 },
      { label: 'Variance', value: '+3%', detail: 'Within acceptable range' },
      { label: 'Open Commitments', value: '6', detail: 'Pending POs not yet invoiced' },
    ],
    actions: [
      { label: 'Budget Status', description: 'View real-time usage across all budget lines.' },
      { label: 'Variance Analysis', description: 'Compare budget vs actual for any period.' },
      { label: 'Export PDF Summary', description: 'Generate a PDF report for management review.' },
    ],
    records: [
      { title: 'Travel – Domestic', value: '82%', detail: 'PHP 41K of PHP 50K used' },
      { title: 'Supplies & Materials', value: '61%', detail: 'PHP 30.5K of PHP 50K used' },
      { title: 'Professional Services', value: '49%', detail: 'PHP 34.3K of PHP 70K used' },
    ],
  },
  'fa-approvals': {
    title: 'Approvals Inbox',
    subtitle: 'Review and act on expense claims, purchase requisitions, and budget transfers.',
    allowedRoles: ['faculty-admin'],
    accent: '#F9A825',
    summary: 'A structured queue for department-level approvals. Approve, reject, delegate, or escalate each item with full budget-impact visibility.',
    stats: [
      { label: 'Pending Items', value: '11', detail: '3 high priority' },
      { label: 'SLA Compliance', value: '96%', detail: 'Approvals within 2-day target' },
      { label: 'Avg. Turnaround', value: '1.4 days', detail: 'Across last 30 days' },
    ],
    actions: [
      { label: 'Approve Next', description: 'Process the oldest pending item in the queue.' },
      { label: 'Delegate', description: 'Assign to another Faculty Admin reviewer.' },
      { label: 'Escalate to CFO', description: 'Forward high-value or cross-department items upward.' },
    ],
    records: [
      { title: 'Expense Claim – Lab Supplies', value: 'High Priority', detail: 'Dr. Cruz · PHP 18,500' },
      { title: 'Purchase Requisition – Printers', value: 'Pending', detail: 'Ms. Tan · PHP 54,000' },
      { title: 'Budget Transfer – Travel → IT', value: 'Pending', detail: 'PHP 12,000 within department' },
    ],
  },
  'fa-reports': {
    title: 'Departmental Reports',
    subtitle: 'Department P&L statement with drill-down and export options.',
    allowedRoles: ['faculty-admin'],
    accent: '#1E3A5F',
    summary: 'A detailed departmental profit & loss view listing all revenues and expenses for your cost centre, with drill-down to individual transactions.',
    stats: [
      { label: 'Total Expenses MTD', value: 'PHP 125K', detail: 'Across all budget lines' },
      { label: 'Net vs Budget', value: '−3%', detail: 'Slightly under plan' },
      { label: 'Export Ready', value: 'Yes', detail: 'PDF available for current period' },
    ],
    actions: [
      { label: 'Open P&L Statement', description: 'View the departmental income and expense breakdown.' },
      { label: 'Export PDF', description: 'Generate a PDF for management meetings or audit requests.' },
      { label: 'Share via Email', description: 'Send a snapshot to the CFO or department head.' },
    ],
    records: [
      { title: 'Personnel Costs', value: 'PHP 80K', detail: 'Salaries and benefits' },
      { title: 'Operational Expenses', value: 'PHP 32K', detail: 'Supplies, travel, utilities' },
      { title: 'Professional Services', value: 'PHP 13K', detail: 'Consultants and training' },
    ],
  },
}

const labelize = (value: string) =>
  value
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const renderStatValue = (stat: ModuleStat) => {
  if (typeof stat.progress === 'number') {
    return (
      <>
        <strong className="metric">{convertCurrencyText(stat.value, 'PHP')}</strong>
        <ProgressBar value={stat.progress} />
      </>
    )
  }

  return <strong className="metric">{convertCurrencyText(stat.value, 'PHP')}</strong>
}

const SIMPLE_MODULE_MAP: Partial<Record<string, () => ReactElement>> = {
  'user-management':      () => <UserManagementModule />,
  'roles-permissions':    () => <RolesPermissionsModule />,
  'job-queue':            () => <JobQueueModule />,
  'fiscal-periods':       () => <FiscalPeriodsModule />,
  'integration-settings': () => <IntegrationSettingsModule />,
  'security-policy':      () => <SecurityPolicyModule />,
  'system-health':        () => <SystemHealthModule />,
  'admin-reports':        () => <AdminReportsModule />,
  'system-settings':      () => <SystemSettingsModule />,
  'accounts-payable':     () => <APInvoicesModule />,
  'accounts-receivable':  () => <ARInvoicesModule />,
}

function renderSpecialModule(moduleKey: string): ReactElement | null {
  const simpleRender = SIMPLE_MODULE_MAP[moduleKey]
  if (simpleRender) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}>{simpleRender()}</RoleGuard>
  }
  if (moduleKey === 'general-ledger' || moduleKey === 'bank-reconciliation') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AccountantOperationsModule moduleKey={moduleKey} /></RoleGuard>
  }
  if (moduleKey === 'financial-reports' || moduleKey === 'reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><FinancialReportsModule /></RoleGuard>
  }
  if (moduleKey === 'expense-claims' || moduleKey === 'payslips' || moduleKey === 'profile') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><EmployeeWorkspaceModule moduleKey={moduleKey} /></RoleGuard>
  }
  if (moduleKey === 'executive-summary' || moduleKey === 'av-reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AuthorizedViewerModule moduleKey={moduleKey as AvModuleKey} /></RoleGuard>
  }
  if (
    moduleKey === 'sod-report' || moduleKey === 'user-activity-timeline'
    || moduleKey === 'general-ledger-inquiry' || moduleKey === 'trial-balance'
    || moduleKey === 'vendor-master' || moduleKey === 'customer-master'
    || moduleKey === 'balance-sheet' || moduleKey === 'income-statement'
    || moduleKey === 'ap-aging' || moduleKey === 'ar-aging' || moduleKey === 'evidence-archive'
  ) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AuditorModulesModule moduleKey={moduleKey as AuditorModuleKey} /></RoleGuard>
  }
  if (moduleKey === 'dept-reports' || moduleKey === 'fa-approvals' || moduleKey === 'fa-reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><FacultyAdminModule moduleKey={moduleKey as FacultyAdminModuleKey} /></RoleGuard>
  }
  if (
    moduleKey === 'department-report' || moduleKey === 'approvals'
    || moduleKey === 'audit-logs'
    || moduleKey === 'approvals-inbox' || moduleKey === 'budget-control'
  ) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><ExtendedRoleOperationsModule moduleKey={moduleKey} /></RoleGuard>
  }
  return null
}

export const ModulePlaceholderPage = () => {
  useDisplayCurrency()
  const navigate = useNavigate()
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const user = useAuthStore((state) => state.user)

  const activeRole = selectedRole ?? user?.role ?? null

  // Handle specialized modules with custom components
  if (moduleKey) {
    const special = renderSpecialModule(moduleKey)
    if (special) return special
  }

  const resolvedModuleKey = moduleKey as ModuleKey | undefined
  const definition = resolvedModuleKey ? moduleDefinitions[resolvedModuleKey] : undefined
  const readableLabel = moduleKey ? labelize(moduleKey) : 'Module'
  const canView =
    definition &&
    (!activeRole || definition.allowedRoles.includes(activeRole))

  if (!definition) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{readableLabel}</CardTitle>
        </CardHeader>
        <CardBody>
          <p>This module is not recognized in the current CMNetwork configuration.</p>
          <Button themeColor="primary" onClick={() => navigate('/')}>Return Home</Button>
        </CardBody>
      </Card>
    )
  }

  if (!canView) {
    const allowedRoleLabels = definition.allowedRoles.map((role) => roleLabels[role]).join(', ')

    return (
      <Card>
        <CardHeader>
          <CardTitle>{definition.title}</CardTitle>
        </CardHeader>
        <CardBody>
          <p>
            This module is available to {allowedRoleLabels}. Switch to one of those roles to continue.
          </p>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => navigate(roleDashboardPath(definition.allowedRoles[0]))}>
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate('/')}>Return Home</Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <section className="page-fade-in">
      <div
        style={{
          border: '1px solid var(--border)',
          borderTop: `4px solid ${definition.accent}`,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface)',
          padding: '1.25rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="kpi-with-arrow" style={{ gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 0.35rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
              {activeRole ? `${roleLabels[activeRole]} workspace` : 'Module workspace'}
            </p>
            <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>
              {definition.title}
            </h1>
            <p style={{ margin: 0, color: 'var(--text)', maxWidth: '72ch' }}>{definition.summary}</p>
          </div>

        </div>

        <div className="quick-actions" style={{ marginTop: '1rem' }}>
          {definition.allowedRoles.map((role) => (
            <span
              key={role}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                fontSize: '0.85rem',
              }}
            >
              {roleLabels[role]}
            </span>
          ))}
        </div>
      </div>

      <div className="dashboard-grid cols-3">
        {definition.stats.map((stat) => (
          <Card key={stat.label} className="dashboard-card">
            <CardHeader>
              <CardTitle>{stat.label}</CardTitle>
            </CardHeader>
            <CardBody>
              {renderStatValue(stat)}
              <p className="card-subtitle" style={{ marginTop: '0.5rem' }}>{convertCurrencyText(stat.detail, 'PHP')}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid cols-2">
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Module Actions</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="plain-list">
              {definition.actions.map((action) => (
                <li key={action.label}>
                  <strong>{action.label}</strong>
                  <br />
                  <span className="card-subtitle">{action.description}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Current Queue</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="plain-list">
              {definition.records.map((record) => (
                <li key={record.title}>
                  <div className="kpi-with-arrow">
                    <strong>{record.title}</strong>
                    <span className="drill-arrow">{convertCurrencyText(record.value, 'PHP')}</span>
                  </div>
                  <span className="card-subtitle">{convertCurrencyText(record.detail, 'PHP')}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </section>
  )
}
