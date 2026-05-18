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

export interface CustomerProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  companyName: string
  address: string
  city: string
  state: string
  country: string
  postalCode?: string
  zipCode: string
  birthDate?: string
  age?: number
  gender?: string
  maritalStatus?: string
  tin?: string
  sss?: string
  bankAccount?: string
  bankName?: string
  bankVerificationStatus?: 'NotVerified' | 'Pending' | 'Verified'
  bankVerifiedAtUtc?: string
}

export interface CustomerBankDirectoryEntry {
  name: string
  accountNumberPattern: string
  accountNumberSample: string
  country?: string
  branchName?: string
}

export interface Budget {
  id: string
  name: string
  allocatedAmount: number
  spentAmount: number
  remainingAmount: number
  startDate: string
  endDate: string
  status: string
}

export interface BudgetAdjustmentRequest {
  budgetId: string
  requestedAmount: number
  reason: string
}

export interface ExpenseClaim {
  id: string
  claimNumber: string
  description: string
  amount: number
  category: string
  submittedDate: string
  status: string
  approvedDate?: string
  rejectReason?: string
}

export interface SubmitExpenseClaimRequest {
  description: string
  amount: number
  category: string
  attachments?: File[]
}

export interface Approval {
  id: string
  title: string
  description: string
  type: string
  status: string
  submittedDate: string
  approvedDate?: string
}

export interface FinancialReport {
  id: string
  reportName: string
  reportType: string
  generatedDate: string
  description: string
  fileUrl: string
}

export interface SupportTicket {
  id: string
  ticketNumber: string
  subject: string
  description: string
  status: string
  priority: string
  createdDate: string
  lastUpdatedDate: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
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

  // Profile operations
  async getMyProfile(): Promise<CustomerProfile> {
    const response = await apiClient.get<CustomerProfile>('/customer/profile')
    return response.data
  },

  async updateMyProfile(profile: Partial<CustomerProfile>): Promise<CustomerProfile> {
    const response = await apiClient.put<CustomerProfile>('/customer/profile', profile)
    return response.data
  },

  async getCustomerBanks(): Promise<CustomerBankDirectoryEntry[]> {
    const response = await apiClient.get<CustomerBankDirectoryEntry[]>('/customer/banks')
    return Array.isArray(response.data) ? response.data : []
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/customer/change-password', {
      oldPassword,
      newPassword,
    })
    return response.data
  },

  // Budget operations
  async getMyBudgets(): Promise<Budget[]> {
    const response = await apiClient.get<{ budgets: Budget[] }>('/customer/budgets')
    return Array.isArray(response.data) ? response.data : (response.data?.budgets ?? [])
  },

  async requestBudgetAdjustment(request: BudgetAdjustmentRequest): Promise<{ message: string; adjustmentId: string }> {
    const response = await apiClient.post<{ message: string; adjustmentId: string }>('/customer/budgets/request-adjustment', request)
    return response.data
  },

  // Expense Claims operations
  async getMyExpenseClaims(): Promise<ExpenseClaim[]> {
    const response = await apiClient.get<{ claims: ExpenseClaim[] } | ExpenseClaim[]>('/customer/expense-claims')
    return Array.isArray(response.data) ? response.data : ((response.data as { claims: ExpenseClaim[] })?.claims ?? [])
  },

  async submitExpenseClaim(claim: SubmitExpenseClaimRequest): Promise<{ message: string; claimId: string }> {
    const response = await apiClient.post<{ message: string; claimId: string }>('/customer/expense-claims/submit', {
      description: claim.description,
      amount: claim.amount,
      category: claim.category,
    })
    return response.data
  },

  // Approvals operations
  async getPendingApprovals(): Promise<Approval[]> {
    const response = await apiClient.get<{ approvals: Approval[] } | Approval[]>('/customer/approvals/pending')
    return Array.isArray(response.data) ? response.data : ((response.data as { approvals: Approval[] })?.approvals ?? [])
  },

  async getApprovedRequests(): Promise<Approval[]> {
    const response = await apiClient.get<{ approvals: Approval[] } | Approval[]>('/customer/approvals/approved')
    return Array.isArray(response.data) ? response.data : ((response.data as { approvals: Approval[] })?.approvals ?? [])
  },

  // Reports operations
  async getFinancialReports(): Promise<FinancialReport[]> {
    const response = await apiClient.get<{ reports: FinancialReport[] } | FinancialReport[]>('/customer/reports/financial')
    return Array.isArray(response.data) ? response.data : ((response.data as { reports: FinancialReport[] })?.reports ?? [])
  },

  // Support operations
  async getMyTickets(): Promise<SupportTicket[]> {
    const response = await apiClient.get<{ tickets: SupportTicket[] } | SupportTicket[]>('/customer/support/tickets')
    return Array.isArray(response.data) ? response.data : ((response.data as { tickets: SupportTicket[] })?.tickets ?? [])
  },

  async createSupportTicket(subject: string, description: string, priority: string): Promise<{ message: string; ticketId: string }> {
    const response = await apiClient.post<{ message: string; ticketId: string }>('/customer/support/tickets', {
      subject,
      description,
      priority,
    })
    return response.data
  },

  async getFAQs(): Promise<FAQ[]> {
    const response = await apiClient.get<{ faqs: FAQ[] } | FAQ[]>('/customer/support/faqs')
    return Array.isArray(response.data) ? response.data : ((response.data as { faqs: FAQ[] })?.faqs ?? [])
  },

  // Loan access check (100% profile + verified bank)
  async checkLoanAccess(): Promise<{ canAccessLoans: boolean; profileCompletionPercentage: number; isBankVerified: boolean; message: string }> {
    const response = await apiClient.get<{ canAccessLoans: boolean; profileCompletionPercentage: number; isBankVerified: boolean; message: string }>('/customer/loan-access-check')
    return response.data
  },

  async getLoanInterestTiers(): Promise<Array<{ termMonths: number; annualInterestRate: number }>> {
    const response = await apiClient.get<Array<{ termMonths: number; annualInterestRate: number }>>('/customer/loans/interest-tiers')
    return Array.isArray(response.data) ? response.data : []
  },

  async estimateLoan(requestedAmount: number, termMonths: number): Promise<{ annualInterestRate: number; monthlyPayment: number; totalRepayment: number; totalInterest: number; availableCredit: number }> {
    const response = await apiClient.get<{ annualInterestRate: number; monthlyPayment: number; totalRepayment: number; totalInterest: number; availableCredit: number }>(
      `/customer/loans/estimate?requestedAmount=${requestedAmount}&termMonths=${termMonths}`,
    )
    return response.data
  },

  // Loan application
  async applyForLoan(request: { requestedAmount: number; termMonths: number; purpose: string }): Promise<{ message: string; applicationId: string; status: string; annualInterestRate?: number; estimatedMonthlyPayment?: number }> {
    const response = await apiClient.post<{ message: string; applicationId: string; status: string; annualInterestRate?: number; estimatedMonthlyPayment?: number }>('/customer/loans/apply', request)
    return response.data
  },

  // Get all loans and applications
  async getMyLoans(): Promise<{ activeLoans: any[]; allLoans: any[]; pendingApplications: any[]; allApplications: any[] }> {
    const response = await apiClient.get<{ activeLoans: any[]; allLoans: any[]; pendingApplications: any[]; allApplications: any[] }>('/customer/loans')
    return response.data
  },

  // Get loan details
  async getLoanDetail(loanId: string): Promise<any> {
    const response = await apiClient.get(`/customer/loans/${loanId}`)
    return response.data
  },

  // Get loan application status
  async getApplicationDetail(applicationId: string): Promise<any> {
    const response = await apiClient.get(`/customer/loans/applications/${applicationId}`)
    return response.data
  },
}

