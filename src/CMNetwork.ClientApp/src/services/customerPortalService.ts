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

export interface CustomerPaymentRecord {
  id: string
  amount: number
  status: string
  payMongoCheckoutSessionId?: string
  createdAt: string
  completedAt?: string
  invoiceIds: string
}

export interface CreatePaymentIntentResponse {
  paymentId: string
  checkoutSessionId: string
  redirectUrl: string
  amount: number
}

export const customerPortalService = {
  async getMyInvoices(): Promise<CustomerInvoicesResponse> {
    const response = await apiClient.get<CustomerInvoicesResponse>('/customer/invoices')
    return response.data
  },

  async getMyPayments(): Promise<CustomerPaymentRecord[]> {
    const response = await apiClient.get<CustomerPaymentRecord[]>('/customer/payments')
    return response.data
  },

  async createPaymentIntent(invoiceIds: string[], amount?: number, idempotencyKey?: string): Promise<CreatePaymentIntentResponse> {
    const response = await apiClient.post<CreatePaymentIntentResponse>('/customer/payments/intent', {
      invoiceIds,
      amount: amount ?? 0,
    }, {
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : undefined,
    })
    return response.data
  },

  async confirmPayment(refId: string): Promise<{ message: string; paymentId: string }> {
    const response = await apiClient.post<{ message: string; paymentId: string }>(
      `/customer/payments/confirm?refId=${encodeURIComponent(refId)}`,
    )
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
