import { apiClient } from './apiClient'

export interface CustomerInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  totalAmount: number
  status: string
}

export interface CustomerInvoicesResponse {
  customerName: string
  customerCode: string
  invoices: CustomerInvoice[]
}

export const customerPortalService = {
  async getMyInvoices(): Promise<CustomerInvoicesResponse> {
    const response = await apiClient.get<CustomerInvoicesResponse>('/customer/invoices')
    return response.data
  },

  async downloadStatement(): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.get<Blob>('/customer/statement', {
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] ?? ''
    const filenameMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
    const fallback = `account-statement-${new Date().toISOString().slice(0, 10)}.pdf`
    return {
      blob: response.data,
      filename: filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].replaceAll('"', '')) : fallback,
    }
  },
}
