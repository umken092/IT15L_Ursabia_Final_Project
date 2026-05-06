import { z } from 'zod'

export const invoiceLineSchema = z.object({
  chartOfAccountId: z.string().min(1, 'Account is required'),
  description: z.string().max(512).optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price must be zero or greater'),
  taxAmount: z.number().min(0, 'Tax amount must be zero or greater').optional(),
})

export const createAPInvoiceSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(64),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
})

export const updateAPInvoiceSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required').optional(),
})

export const createARInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(64),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
})

export const updateARInvoiceSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required').optional(),
})

export type InvoiceLineSchemaInput = z.infer<typeof invoiceLineSchema>
export type CreateAPInvoiceSchemaInput = z.infer<typeof createAPInvoiceSchema>
export type UpdateAPInvoiceSchemaInput = z.infer<typeof updateAPInvoiceSchema>
export type CreateARInvoiceSchemaInput = z.infer<typeof createARInvoiceSchema>
export type UpdateARInvoiceSchemaInput = z.infer<typeof updateARInvoiceSchema>
