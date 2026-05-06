import { z } from 'zod'

/**
 * Department Report Schemas
 */
export const departmentReportSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  reportType: z.enum(['Statement', 'Summary', 'Drill-Down']),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  exportFormat: z.enum(['PDF', 'Excel', 'CSV']).optional(),
})

export type DepartmentReportInput = z.infer<typeof departmentReportSchema>

/**
 * Approvals Queue Schemas
 */
export const processApprovalSchema = z.object({
  approvalId: z.string().min(1, 'Approval is required'),
  action: z.enum(['Approve', 'Reject', 'Delegate', 'Forward']),
  delegateTo: z.string().optional(),
  forwardTo: z.string().optional(),
  comments: z.string().max(1000).optional(),
})

export type ProcessApprovalInput = z.infer<typeof processApprovalSchema>

export const escalateRequestSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  reason: z.enum(['Urgent', 'Complex', 'Missing Info', 'Other']),
  escalateTo: z.string().min(1, 'Escalate to is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  notes: z.string().max(500).optional(),
})

export type EscalateRequestInput = z.infer<typeof escalateRequestSchema>

/**
 * Expense Claims Schemas
 */
export const createExpenseClaimSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  category: z.enum(['Travel', 'Meals', 'Equipment', 'Other']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500),
  merchantName: z.string().optional(),
  projectCode: z.string().optional(),
})

export type CreateExpenseClaimInput = z.infer<typeof createExpenseClaimSchema>

export const uploadReceiptSchema = z.object({
  claimId: z.string().min(1, 'Claim is required'),
  file: z.instanceof(File, { message: 'File is required' }).refine(
    (file) => file.size <= 5242880,
    'File size must not exceed 5MB'
  ),
  description: z.string().optional(),
})

export type UploadReceiptInput = z.infer<typeof uploadReceiptSchema>

/**
 * Payslips Schemas
 */
export const downloadPayslipSchema = z.object({
  month: z.string().min(1, 'Month is required'),
  format: z.enum(['PDF', 'Excel']),
})

export type DownloadPayslipInput = z.infer<typeof downloadPayslipSchema>

export const viewDeductionsSchema = z.object({
  payslipId: z.string().min(1, 'Payslip is required'),
})

export type ViewDeductionsInput = z.infer<typeof viewDeductionsSchema>

/**
 * Executive Summary Schemas
 */
export const exportBriefSchema = z.object({
  format: z.enum(['PDF', 'Excel', 'PowerPoint']),
  includeCharts: z.boolean().default(true),
  includeTrends: z.boolean().default(true),
})

export type ExportBriefInput = z.infer<typeof exportBriefSchema>

export const shareSnapshotSchema = z.object({
  email: z.string().email('Valid email is required'),
  format: z.enum(['PDF', 'Link']),
  expirationDays: z.number().min(1).max(30).default(7),
})

export type ShareSnapshotInput = z.infer<typeof shareSnapshotSchema>

/**
 * Audit Logs Schemas
 */
export const searchAuditLogsSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  action: z.enum(['Create', 'Update', 'Delete', 'Login', 'All']).optional(),
  table: z.string().optional(),
})

export type SearchAuditLogsInput = z.infer<typeof searchAuditLogsSchema>

export const markReviewedSchema = z.object({
  auditLogIds: z.array(z.string()).min(1, 'Select at least one log'),
  reviewedBy: z.string().min(1, 'Reviewer name is required'),
})

export type MarkReviewedInput = z.infer<typeof markReviewedSchema>

/**
 * Budget Control Schemas
 */
export const manageBudgetSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  fiscalYear: z.number().min(2000).max(2100),
  budgetAmount: z.number().positive('Budget must be positive'),
  notes: z.string().optional(),
})

export type ManageBudgetInput = z.infer<typeof manageBudgetSchema>

export const createBudgetReallocationSchema = z.object({
  // Department IDs come from the backend and are validated server-side as Guid.
  // Some seeded IDs are non-v1-v5 UUID variants, so we only require non-empty selection here.
  sourceDepartmentId: z.string().min(1, 'Source department is required'),
  targetDepartmentId: z.string().min(1, 'Target department is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(3).max(8),
  justification: z.string().min(5, 'Justification is required').max(1000),
  effectiveDate: z.string().min(1, 'Effective date is required'),
})

export type CreateBudgetReallocationInput = z.infer<typeof createBudgetReallocationSchema>
