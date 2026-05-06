import { apiClient } from './apiClient'

export interface Vendor {
  id: string
  vendorCode: string
  name: string
  contactPerson?: string
  email?: string
  phoneNumber?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  taxId?: string
  creditLimit: number
  paymentTerms?: string
  isActive: boolean
  createdUtc: string
  lastUpdatedUtc?: string
}

export interface CreateVendorInput {
  vendorCode: string
  name: string
  contactPerson?: string
  email?: string
  phoneNumber?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  taxId?: string
  creditLimit: number
  paymentTerms?: string
}

export interface UpdateVendorInput extends CreateVendorInput {
  isActive: boolean
}

export interface Customer {
  id: string
  customerCode: string
  name: string
  contactPerson?: string
  email?: string
  phoneNumber?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  taxId?: string
  creditLimit: number
  paymentTerms?: string
  isActive: boolean
  createdUtc: string
  lastUpdatedUtc?: string
}

export interface CreateCustomerInput {
  customerCode: string
  name: string
  contactPerson?: string
  email?: string
  phoneNumber?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  taxId?: string
  creditLimit: number
  paymentTerms?: string
}

export interface UpdateCustomerInput extends CreateCustomerInput {
  isActive: boolean
}

/**
 * Vendor Service
 */
export const vendorService = {
  getVendors: async (isActive?: boolean) => {
    return apiClient.get<Vendor[]>('/vendors', {
      params: isActive !== undefined ? { isActive } : undefined,
    })
  },

  getVendor: async (id: string) => {
    return apiClient.get<Vendor>(`/vendors/${id}`)
  },

  createVendor: async (data: CreateVendorInput) => {
    return apiClient.post<Vendor>('/vendors', data)
  },

  updateVendor: async (id: string, data: UpdateVendorInput) => {
    return apiClient.put<Vendor>(`/vendors/${id}`, data)
  },

  deleteVendor: async (id: string) => {
    return apiClient.delete(`/vendors/${id}`)
  },
}

/**
 * Customer Service
 */
export const customerService = {
  getCustomers: async (isActive?: boolean) => {
    return apiClient.get<Customer[]>('/customers', {
      params: isActive !== undefined ? { isActive } : undefined,
    })
  },

  getCustomer: async (id: string) => {
    return apiClient.get<Customer>(`/customers/${id}`)
  },

  createCustomer: async (data: CreateCustomerInput) => {
    return apiClient.post<Customer>('/customers', data)
  },

  updateCustomer: async (id: string, data: UpdateCustomerInput) => {
    return apiClient.put<Customer>(`/customers/${id}`, data)
  },

  deleteCustomer: async (id: string) => {
    return apiClient.delete(`/customers/${id}`)
  },
}
