import { apiClient } from './apiClient'

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface LoanApplicationSummary {
  id: string
  customerId: string
  customerName: string
  requestedAmount: number
  approvedAmount: number | null
  requestedTermMonths: number
  approvedTermMonths: number | null
  annualInterestRate: number | null
  interestRate: number | null
  purpose: string
  status: string
  submittedAt: string
  reviewedAt: string | null
  approvedAt: string | null
  accountantNotes: string | null
}

export interface LoanApplicationDetail extends LoanApplicationSummary {
  creditLimit: number
  currentExposure: number
  availableCredit: number
  accountantReviewNotes: string | null
  cfoNotes: string | null
  approvedOrRejectedAt: string | null
}

export interface DisbursementApplication {
  id: string
  customerId: string
  customerName: string
  requestedAmount: number
  approvedAmount: number | null
  requestedTermMonths: number
  approvedTermMonths: number | null
  purpose: string
  interestRate: number | null
  approvedAt: string | null
}

export interface ActiveLoanSummary {
  id: string
  customerId: string
  customerName: string
  principalAmount: number
  outstandingPrincipal: number
  interestRate: number
  termMonths: number
  status: string
  disbursedAt: string
}

export interface LoanInterestTier {
  id: string
  termMonths: number
  annualInterestRate: number
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string | null
  createdBy: string
  updatedBy: string | null
}

export interface UpsertTierRequest {
  termMonths: number
  annualInterestRate: number
  isActive: boolean
}

export interface ReviewApplicationRequest {
  accountantNotes: string
  approvedAmount?: number
  approvedTermMonths?: number
}

export interface ApproveApplicationRequest {
  cfoNotes?: string
  approvedAmount?: number
  approvedTermMonths?: number
}

export interface RejectApplicationRequest {
  rejectionReason: string
}

// ─── Accountant: Loan Review ──────────────────────────────────────────────────

const getPendingApplications = async (): Promise<LoanApplicationSummary[]> => {
  const res = await apiClient.get<LoanApplicationSummary[]>('/loan-review/pending-applications')
  return res.data
}

const getApplicationForReview = async (id: string): Promise<LoanApplicationDetail> => {
  const res = await apiClient.get<LoanApplicationDetail>(`/loan-review/applications/${id}`)
  return res.data
}

const reviewApplication = async (id: string, payload: ReviewApplicationRequest): Promise<void> => {
  await apiClient.post(`/loan-review/applications/${id}/review`, payload)
}

const getApprovedForDisbursement = async (): Promise<DisbursementApplication[]> => {
  const res = await apiClient.get<DisbursementApplication[]>('/loan-review/approved-for-disbursement')
  return res.data
}

const disburseLoan = async (id: string): Promise<void> => {
  await apiClient.post(`/loan-review/applications/${id}/disburse`, {})
}

const getActiveLoans = async (): Promise<ActiveLoanSummary[]> => {
  const res = await apiClient.get<ActiveLoanSummary[]>('/loan-review/active-loans')
  return res.data
}

// ─── CFO: Loan Approval ───────────────────────────────────────────────────────

const getPendingCfoApproval = async (): Promise<LoanApplicationSummary[]> => {
  const res = await apiClient.get<LoanApplicationSummary[]>('/loan-review/pending-cfo-approval')
  return res.data
}

const approveLoan = async (id: string, payload: ApproveApplicationRequest): Promise<void> => {
  await apiClient.post(`/loan-review/applications/${id}/approve`, payload)
}

const rejectLoan = async (id: string, payload: RejectApplicationRequest): Promise<void> => {
  await apiClient.post(`/loan-review/applications/${id}/reject`, payload)
}

// ─── Loan Interest Tier Management ────────────────────────────────────────────

const getLoanTiers = async (includeInactive = false): Promise<LoanInterestTier[]> => {
  const res = await apiClient.get<LoanInterestTier[]>('/system/loan-configuration/tiers', {
    params: { includeInactive },
  })
  return res.data
}

const createTier = async (payload: UpsertTierRequest): Promise<void> => {
  await apiClient.post('/system/loan-configuration/tiers', payload)
}

const updateTier = async (id: string, payload: UpsertTierRequest): Promise<void> => {
  await apiClient.put(`/system/loan-configuration/tiers/${id}`, payload)
}

const deleteTier = async (id: string): Promise<void> => {
  await apiClient.delete(`/system/loan-configuration/tiers/${id}`)
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const loanReviewService = {
  getPendingApplications,
  getApplicationForReview,
  reviewApplication,
  getApprovedForDisbursement,
  disburseLoan,
  getActiveLoans,
  getPendingCfoApproval,
  approveLoan,
  rejectLoan,
  getLoanTiers,
  createTier,
  updateTier,
  deleteTier,
}
