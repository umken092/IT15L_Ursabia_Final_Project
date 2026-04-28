import { z } from 'zod'

/**
 * General Ledger Schemas
 */
export const createJournalSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reference: z.string().min(1, 'Reference is required').max(50),
  debit: z.number().positive('Debit must be positive').or(z.literal(0)),
  credit: z.number().positive('Credit must be positive').or(z.literal(0)),
  description: z.string().optional(),
  recurring: z.boolean().default(false),
  recurringEndDate: z.string().optional(),
})

export type CreateJournalInput = z.infer<typeof createJournalSchema>

export const monthEndCloseSchema = z.object({
  fiscalYear: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  confirmNoOutstanding: z.boolean(),
  approverName: z.string().min(1, 'Approver name is required'),
})

export type MonthEndCloseInput = z.infer<typeof monthEndCloseSchema>

/**
 * Accounts Payable Schemas
 */
export const approveInvoicesSchema = z.object({
  invoiceIds: z.array(z.string()).min(1, 'Select at least one invoice'),
  paymentMethod: z.enum(['Check', 'ACH', 'Wire', 'Credit Card']),
  scheduledDate: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional(),
})

export type ApproveInvoicesInput = z.infer<typeof approveInvoicesSchema>

export const threeWayMatchSchema = z.object({
  poNumber: z.string().min(1, 'PO number is required'),
  receiptNumber: z.string().min(1, 'Receipt number is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  tolerance: z.number().min(0).max(100).default(2),
})

export type ThreeWayMatchInput = z.infer<typeof threeWayMatchSchema>

export const supplierViewSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  includeAll: z.boolean().default(false),
})

export type SupplierViewInput = z.infer<typeof supplierViewSchema>

/**
 * Accounts Receivable Schemas
 */
export const sendRemindersSchema = z.object({
  invoiceIds: z.array(z.string()).min(1, 'Select at least one invoice'),
  reminderTemplate: z.enum(['Email', 'SMS', 'Both']),
  customMessage: z.string().max(500).optional(),
})

export type SendRemindersInput = z.infer<typeof sendRemindersSchema>

export const postReceiptSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  amountReceived: z.number().positive('Amount must be positive'),
  receiptDate: z.string().min(1, 'Receipt date is required'),
  receiptMethod: z.enum(['Cash', 'Check', 'ACH', 'Credit Card', 'Wire']),
  referenceNumber: z.string().min(1, 'Reference number is required'),
  notes: z.string().optional(),
})

export type PostReceiptInput = z.infer<typeof postReceiptSchema>

/**
 * Bank Reconciliation Schemas
 */
export const manualMatchSchema = z.object({
  bankLineIds: z.array(z.string()).min(1, 'Select bank lines'),
  systemLineIds: z.array(z.string()).min(1, 'Select system lines'),
  differenceAmount: z.number().optional(),
  reason: z.enum(['Timing Difference', 'Bank Fee', 'Error', 'Other']).optional(),
  notes: z.string().max(500).optional(),
})

export type ManualMatchInput = z.infer<typeof manualMatchSchema>

export const finalizeStatementSchema = z.object({
  statementDate: z.string().min(1, 'Statement date is required'),
  openingBalance: z.number(),
  closingBalance: z.number(),
  confirmedNoOutstanding: z.boolean(),
  reviewerName: z.string().min(1, 'Reviewer name is required'),
})

export type FinalizeStatementInput = z.infer<typeof finalizeStatementSchema>
