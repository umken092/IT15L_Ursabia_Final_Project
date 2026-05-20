import { apiClient } from './apiClient'
import { useAuthStore } from '../store/authStore'

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

export interface PaymentStatusResponse {
  paymentId: string
  status: string
  isTerminal?: boolean
  completedAt?: string
}

export interface ConfirmPaymentResponse {
  message: string
  paymentId: string
  status?: string
  providerStatus?: string
  completed?: boolean
  completedAt?: string
}

export interface LoanInstallment {
  id: string
  dueAt: string
  principalAmount: number
  interestAmount: number
  totalAmount: number
  status: 'Scheduled' | 'Completed' | 'Overdue' | 'Waived'
  completedAt?: string | null
  paymentMethod?: string | null
  externalReference?: string | null
  payMongoCheckoutSessionId?: string | null
}

export interface LoanPaymentScheduleResponse {
  loanId: string
  principalAmount: number
  outstandingPrincipal: number
  totalInterestAccrued: number
  interestRate: number
  status: string
  payments: LoanInstallment[]
}

export interface LoanPaymentResult {
  message: string
  paymentId: string
  amount: number
  outstandingPrincipal: number
  loanStatus: string
}

export interface CreateLoanInstallmentPaymentIntentResponse {
  paymentId: string
  checkoutSessionId: string
  redirectUrl: string
  amount: number
}

export interface ConfirmLoanInstallmentPaymentResponse {
  message: string
  paymentId: string
  status: string
  providerStatus: string
  completed: boolean
  completedAt?: string
  referenceNo?: string
  amount: number
  loanId: string
  paymentMethod?: string
}

export interface LoanInstallmentPaymentStatusResponse {
  paymentId: string
  status: string
  isTerminal: boolean
  completedAt?: string
  amount: number
  referenceNo?: string
  loanId: string
  paymentMethod?: string
}

export interface LoanInstallmentCallbackContext {
  loanId?: string
  paymentId?: string
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

export type BankVerificationStatus = 'NotVerified' | 'Pending' | 'Verified'

export interface BankVerificationResponse {
  message: string
  bankVerificationStatus: BankVerificationStatus
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

const isEmployeeSession = (): boolean => {
  const { selectedRole, user } = useAuthStore.getState()
  const role = (selectedRole ?? user?.role ?? '').toLowerCase()
  return role === 'employee'
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

  async confirmPayment(refId: string): Promise<ConfirmPaymentResponse> {
    const response = await apiClient.post<ConfirmPaymentResponse>(
      `/customer/payments/confirm?refId=${encodeURIComponent(refId)}`,
    )
    return response.data
  },

  async getPaymentStatus(refId: string): Promise<PaymentStatusResponse> {
    const response = await apiClient.get<PaymentStatusResponse>(
      `/customer/payments/status?refId=${encodeURIComponent(refId)}`,
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
    if (isEmployeeSession()) {
      const response = await apiClient.get<any>('/profile')
      const data = response.data ?? {}
      const names = String(data.fullName ?? '').trim().split(/\s+/)
      const firstName = String(data.firstName ?? names[0] ?? '')
      const lastName = String(data.lastName ?? names.slice(1).join(' ') ?? '')
      return {
        id: String(data.id ?? ''),
        firstName,
        lastName,
        email: String(data.email ?? ''),
        phoneNumber: String(data.phone ?? ''),
        companyName: '',
        address: String(data.address ?? ''),
        city: '',
        state: '',
        country: '',
        zipCode: '',
        birthDate: data.birthDate,
        age: undefined,
        gender: data.gender,
      }
    }

    const response = await apiClient.get<CustomerProfile>('/customer/profile')
    return response.data
  },

  async updateMyProfile(profile: Partial<CustomerProfile>): Promise<CustomerProfile> {
    if (isEmployeeSession()) {
      let fallbackEmail = profile.email
      if (!fallbackEmail) {
        const current = await apiClient.get<any>('/profile')
        fallbackEmail = current.data?.email
      }

      const payload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        birthDate: profile.birthDate,
        gender: profile.gender,
        email: fallbackEmail,
        phone: profile.phoneNumber,
        address: profile.address,
      }
      const response = await apiClient.put<any>('/profile', payload)
      const data = response.data ?? {}
      return {
        id: String(data.id ?? ''),
        firstName: String(data.firstName ?? ''),
        lastName: String(data.lastName ?? ''),
        email: String(data.email ?? ''),
        phoneNumber: String(data.phone ?? ''),
        companyName: '',
        address: String(data.address ?? ''),
        city: '',
        state: '',
        country: '',
        zipCode: '',
        birthDate: data.birthDate,
        gender: data.gender,
      }
    }

    const response = await apiClient.put<CustomerProfile>('/customer/profile', profile)
    return response.data
  },

  async getCustomerBanks(): Promise<CustomerBankDirectoryEntry[]> {
    if (isEmployeeSession()) {
      return []
    }

    const response = await apiClient.get<CustomerBankDirectoryEntry[]>('/customer/banks')
    return Array.isArray(response.data) ? response.data : []
  },

  async requestBankVerification(): Promise<BankVerificationResponse> {
    const response = await apiClient.post<BankVerificationResponse>('/customer/bank-verification/request')
    return response.data
  },

  async setBankVerificationStatus(customerId: string, status: BankVerificationStatus): Promise<BankVerificationResponse> {
    const response = await apiClient.post<BankVerificationResponse>(`/customers/${customerId}/bank-verification`, { status })
    return response.data
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
    if (isEmployeeSession()) {
      const response = await apiClient.get<any[]>('/expense-claims')
      const items = Array.isArray(response.data) ? response.data : []
      return items.map((x) => ({
        id: String(x.id),
        claimNumber: String(x.claimNumber ?? ''),
        description: String(x.description ?? ''),
        amount: Number(x.amount ?? 0),
        category: String(x.category ?? ''),
        submittedDate: String(x.submittedAtUtc ?? x.createdAtUtc ?? new Date().toISOString()),
        status: String(x.status ?? 'Draft'),
        approvedDate: x.reviewedAtUtc,
        rejectReason: x.reviewNotes,
      }))
    }

    const response = await apiClient.get<{ claims: ExpenseClaim[] } | ExpenseClaim[]>('/customer/expense-claims')
    const data = response.data
    return Array.isArray(data) ? data : (data?.claims ?? [])
  },

  async submitExpenseClaim(claim: SubmitExpenseClaimRequest): Promise<{ message: string; claimId: string }> {
    if (isEmployeeSession()) {
      const create = await apiClient.post<any>('/expense-claims', {
        date: new Date().toISOString().slice(0, 10),
        category: claim.category,
        description: claim.description,
        amount: claim.amount,
      })

      const claimId = String(create.data?.id ?? create.data?.claimId ?? '')
      if (claimId) {
        await apiClient.post(`/expense-claims/${claimId}/submit`)
      }

      return { message: 'Claim submitted for approval.', claimId }
    }

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
    const data = response.data
    return Array.isArray(data) ? data : (data?.approvals ?? [])
  },

  async getApprovedRequests(): Promise<Approval[]> {
    const response = await apiClient.get<{ approvals: Approval[] } | Approval[]>('/customer/approvals/approved')
    const data = response.data
    return Array.isArray(data) ? data : (data?.approvals ?? [])
  },

  // Reports operations
  async getFinancialReports(): Promise<FinancialReport[]> {
    const response = await apiClient.get<{ reports: FinancialReport[] } | FinancialReport[]>('/customer/reports/financial')
    const data = response.data
    return Array.isArray(data) ? data : (data?.reports ?? [])
  },

  // Support operations
  async getMyTickets(): Promise<SupportTicket[]> {
    const response = await apiClient.get<{ tickets: SupportTicket[] } | SupportTicket[]>('/customer/support/tickets')
    const data = response.data
    return Array.isArray(data) ? data : (data?.tickets ?? [])
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
    const data = response.data
    return Array.isArray(data) ? data : (data?.faqs ?? [])
  },

  // Loan access check (100% profile + verified bank)
  async checkLoanAccess(): Promise<{ canAccessLoans: boolean; profileCompletionPercentage: number; isBankVerified: boolean; message: string }> {
    if (isEmployeeSession()) {
      return {
        canAccessLoans: false,
        profileCompletionPercentage: 0,
        isBankVerified: false,
        message: 'Loan access is available for customer accounts only.',
      }
    }

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

  async getLoanPaymentSchedule(loanId: string): Promise<LoanPaymentScheduleResponse> {
    const response = await apiClient.get<LoanPaymentScheduleResponse>(`/loan-payments/loans/${loanId}/schedule`)
    return response.data
  },

  async payLoanInstallmentManual(loanId: string, amount: number): Promise<LoanPaymentResult> {
    const response = await apiClient.post<LoanPaymentResult>(`/loan-payments/loans/${loanId}/pay-manual`, {
      amount,
    })
    return response.data
  },

  async createLoanInstallmentPaymentIntent(
    loanId: string,
    paymentId: string,
    idempotencyKey?: string,
  ): Promise<CreateLoanInstallmentPaymentIntentResponse> {
    const response = await apiClient.post<CreateLoanInstallmentPaymentIntentResponse>(
      `/loan-payments/loans/${loanId}/installments/${paymentId}/intent`,
      {},
      {
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : undefined,
      },
    )
    return response.data
  },

  async confirmLoanInstallmentPayment(refId: string, context?: LoanInstallmentCallbackContext): Promise<ConfirmLoanInstallmentPaymentResponse> {
    const query = new URLSearchParams()
    if (refId) {
      query.set('refId', refId)
    }
    if (context?.loanId) {
      query.set('loanId', context.loanId)
    }
    if (context?.paymentId) {
      query.set('paymentId', context.paymentId)
    }

    const url = `/loan-payments/installments/confirm?${query.toString()}`
    console.log('[customerPortalService] confirmLoanInstallmentPayment:', {
      refId,
      context,
      queryString: query.toString(),
      fullUrl: url,
    })

    // Try POST first (canonical for state-changing op); on 404/405 fall back to GET
    // (endpoint accepts both verbs — GET fallback works around proxy/middleware
    // edge cases that occasionally drop POST routing in production).
    try {
      const response = await apiClient.post<ConfirmLoanInstallmentPaymentResponse>(url)
      return response.data
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } }
      const status = axiosErr?.response?.status
      if (status === 404 || status === 405) {
        console.warn('[customerPortalService] confirmLoanInstallmentPayment POST failed, retrying as GET', { status })
        const response = await apiClient.get<ConfirmLoanInstallmentPaymentResponse>(url)
        return response.data
      }
      throw err
    }
  },

  async getLoanInstallmentPaymentStatus(refId: string, context?: LoanInstallmentCallbackContext): Promise<LoanInstallmentPaymentStatusResponse> {
    const query = new URLSearchParams()
    if (refId) {
      query.set('refId', refId)
    }
    if (context?.loanId) {
      query.set('loanId', context.loanId)
    }
    if (context?.paymentId) {
      query.set('paymentId', context.paymentId)
    }

    const url = `/loan-payments/installments/status?${query.toString()}`
    console.log('[customerPortalService] getLoanInstallmentPaymentStatus:', {
      refId,
      context,
      queryString: query.toString(),
      fullUrl: url,
    })

    const response = await apiClient.get<LoanInstallmentPaymentStatusResponse>(url)
    return response.data
  },

  async forceCompleteLoanInstallmentPayment(
    loanId: string,
    paymentId: string,
    reason?: string,
  ): Promise<ConfirmLoanInstallmentPaymentResponse> {
    const query = new URLSearchParams({ loanId })
    if (reason) query.set('reason', reason)
    const url = `/loan-payments/installments/${paymentId}/force-complete?${query.toString()}`
    const response = await apiClient.post<ConfirmLoanInstallmentPaymentResponse>(url)
    return response.data
  },
}

