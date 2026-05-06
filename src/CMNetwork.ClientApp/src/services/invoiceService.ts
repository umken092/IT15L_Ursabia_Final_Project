import { apiClient } from './apiClient'

export interface InvoiceLineInput {
  chartOfAccountId: string
  description?: string
  quantity: number
  unitPrice: number
  amount: number
  taxAmount?: number
}

export interface CreateAPInvoiceInput {
  vendorId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lines: InvoiceLineInput[]
}

export interface UpdateAPInvoiceInput {
  invoiceDate: string
  dueDate: string
  lines?: InvoiceLineInput[]
}

export interface CreateARInvoiceInput {
  customerId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lines: InvoiceLineInput[]
}

export interface UpdateARInvoiceInput {
  invoiceDate: string
  dueDate: string
  lines?: InvoiceLineInput[]
}

export interface APInvoiceListItem {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  totalAmount: number
  status: number
  vendorName: string
  vendorCode: string
  createdUtc: string
}

export interface APInvoiceDetail extends APInvoiceListItem {
  vendorId: string
  lines: Array<{
    id: string
    chartOfAccountId: string
    accountCode: string
    accountName: string
    description?: string
    quantity: number
    unitPrice: number
    amount: number
    taxAmount?: number
  }>
}

export interface ARInvoiceListItem {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  totalAmount: number
  status: number
  customerName: string
  customerCode: string
  createdUtc: string
}

export interface ARInvoiceDetail extends ARInvoiceListItem {
  customerId: string
  lines: Array<{
    id: string
    chartOfAccountId: string
    accountCode: string
    accountName: string
    description?: string
    quantity: number
    unitPrice: number
    amount: number
    taxAmount?: number
  }>
}

export interface ChartOfAccountOption {
  id: string
  accountCode: string
  name: string
  type: number | string
  isActive?: boolean
}

export interface InvoiceListFilters {
  status?: number
  fromDate?: string
  toDate?: string
}

export const apInvoiceService = {
  getAPInvoices: async (filters?: InvoiceListFilters & { vendorId?: string }) => {
    return apiClient.get<APInvoiceListItem[]>('/apinvoices', {
      params: {
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters?.status !== undefined ? { status: filters.status } : {}),
        ...(filters?.fromDate ? { fromDate: filters.fromDate } : {}),
        ...(filters?.toDate ? { toDate: filters.toDate } : {}),
      },
    })
  },

  getAPInvoice: async (id: string) => {
    return apiClient.get<APInvoiceDetail>(`/apinvoices/${id}`)
  },

  createAPInvoice: async (data: CreateAPInvoiceInput) => {
    return apiClient.post('/apinvoices', data)
  },

  updateAPInvoice: async (id: string, data: UpdateAPInvoiceInput) => {
    return apiClient.put(`/apinvoices/${id}`, data)
  },

  approveAPInvoice: async (id: string) => {
    return apiClient.post(`/apinvoices/${id}/approve`)
  },

  voidAPInvoice: async (id: string) => {
    return apiClient.post(`/apinvoices/${id}/void`)
  },
}

export const arInvoiceService = {
  getARInvoices: async (filters?: InvoiceListFilters & { customerId?: string }) => {
    return apiClient.get<ARInvoiceListItem[]>('/arinvoices', {
      params: {
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.status !== undefined ? { status: filters.status } : {}),
        ...(filters?.fromDate ? { fromDate: filters.fromDate } : {}),
        ...(filters?.toDate ? { toDate: filters.toDate } : {}),
      },
    })
  },

  getARInvoice: async (id: string) => {
    return apiClient.get<ARInvoiceDetail>(`/arinvoices/${id}`)
  },

  createARInvoice: async (data: CreateARInvoiceInput) => {
    return apiClient.post('/arinvoices', data)
  },

  updateARInvoice: async (id: string, data: UpdateARInvoiceInput) => {
    return apiClient.put(`/arinvoices/${id}`, data)
  },

  sendARInvoice: async (id: string) => {
    return apiClient.post(`/arinvoices/${id}/send`)
  },

  voidARInvoice: async (id: string) => {
    return apiClient.post(`/arinvoices/${id}/void`)
  },
}

export const invoiceReferenceService = {
  getChartOfAccounts: async () => {
    return apiClient.get<ChartOfAccountOption[]>('/general-ledger/accounts')
  },
}
