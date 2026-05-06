import { z } from 'zod'

/**
 * Vendor Schemas
 */
export const createVendorSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required').max(32),
  name: z.string().min(1, 'Vendor name is required').max(256),
  contactPerson: z.string().max(128).optional(),
  email: z.string().email('Invalid email').max(256).optional(),
  phoneNumber: z.string().max(32).optional(),
  address: z.string().max(512).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  postalCode: z.string().max(16).optional(),
  country: z.string().max(128).optional(),
  taxId: z.string().max(64).optional(),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.string().max(64).optional(),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>

export const updateVendorSchema = createVendorSchema.extend({
  isActive: z.boolean().default(true),
})

export type UpdateVendorInput = z.infer<typeof updateVendorSchema>

/**
 * Customer Schemas
 */
export const createCustomerSchema = z.object({
  customerCode: z.string().min(1, 'Customer code is required').max(32),
  name: z.string().min(1, 'Customer name is required').max(256),
  contactPerson: z.string().max(128).optional(),
  email: z.string().email('Invalid email').max(256).optional(),
  phoneNumber: z.string().max(32).optional(),
  address: z.string().max(512).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  postalCode: z.string().max(16).optional(),
  country: z.string().max(128).optional(),
  taxId: z.string().max(64).optional(),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.string().max(64).optional(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

export const updateCustomerSchema = createCustomerSchema.extend({
  isActive: z.boolean().default(true),
})

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
