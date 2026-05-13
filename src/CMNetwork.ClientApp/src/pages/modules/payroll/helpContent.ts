export type PayrollHelpRole = 'accountant' | 'cfo' | 'employee' | 'super-admin'
export type PayrollHelpPage = 'overview' | 'periods' | 'processing' | 'approval' | 'payslips'

export interface PayrollFaqItem {
  id: string
  roles: PayrollHelpRole[]
  pages: PayrollHelpPage[]
  question: string
  answer: string
}

export const payrollFaqItems: PayrollFaqItem[] = [
  {
    id: 'acc-process-button',
    roles: ['accountant', 'super-admin'],
    pages: ['processing'],
    question: 'I do not see Process Payroll actions. What should I do?',
    answer: 'Select an active pay period first, then click Load Setup. If no period exists, create one in Pay Periods.',
  },
  {
    id: 'acc-calc-refresh',
    roles: ['accountant', 'super-admin'],
    pages: ['processing'],
    question: 'Gross pay is not updating after I edited hours.',
    answer: 'Click Calculate to recompute the register. The screen does not auto-recalculate to avoid accidental recalculations.',
  },
  {
    id: 'acc-withdraw',
    roles: ['accountant', 'super-admin'],
    pages: ['processing'],
    question: 'I submitted payroll with wrong overtime. Can I fix it?',
    answer: 'Yes. Use Withdraw while the run is still Submitted and not yet approved by CFO. It returns the run to Draft for editing.',
  },
  {
    id: 'acc-missing-employee',
    roles: ['accountant', 'super-admin'],
    pages: ['processing'],
    question: 'One employee is missing from the register.',
    answer: 'Verify the employee has an active account and an hourly rate/salary setup. Employees without payroll setup are excluded.',
  },
  {
    id: 'acc-post-gl',
    roles: ['accountant', 'super-admin'],
    pages: ['processing'],
    question: 'What does Post to GL do?',
    answer: 'It creates payroll journal entries after approval. Use it when the run is Approved or Processed.',
  },
  {
    id: 'cfo-approve-disabled',
    roles: ['cfo', 'super-admin'],
    pages: ['approval'],
    question: 'Approve button is disabled.',
    answer: 'Approve is only available for Submitted runs. Draft runs are view-only until accountant submits.',
  },
  {
    id: 'cfo-reject',
    roles: ['cfo', 'super-admin'],
    pages: ['approval'],
    question: 'How do I return a run for correction?',
    answer: 'Click Reject and provide a reason. The run goes to Rejected and the accountant can update and resubmit.',
  },
  {
    id: 'cfo-reopen-window',
    roles: ['cfo', 'super-admin'],
    pages: ['approval'],
    question: 'When can I re-open an approved run?',
    answer: 'CFO can re-open within 24 hours after approval and before posting/payment. SuperAdmin can re-open any non-paid run.',
  },
  {
    id: 'emp-payslip-missing',
    roles: ['employee', 'super-admin'],
    pages: ['payslips'],
    question: 'I cannot see my payslip for this month.',
    answer: 'Payslips are generated after CFO approval. Refresh the list and confirm the period is approved/processed.',
  },
  {
    id: 'emp-pdf-blank',
    roles: ['employee', 'super-admin'],
    pages: ['payslips'],
    question: 'The payslip PDF is blank or does not download.',
    answer: 'Allow pop-ups for this site and try again. If it persists, report it with the payslip number.',
  },
  {
    id: 'general-status',
    roles: ['accountant', 'cfo', 'employee', 'super-admin'],
    pages: ['overview', 'processing', 'approval', 'payslips'],
    question: 'What do payroll statuses mean?',
    answer: 'Draft: editable, Submitted: waiting for CFO, Rejected: needs correction, Approved/Processed: finalized by CFO, Paid/Posted: posted to accounting.',
  },
]
