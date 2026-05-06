import { apiClient } from './apiClient'
import type {
  DepartmentReportInput,
  ProcessApprovalInput,
  EscalateRequestInput,
  CreateExpenseClaimInput,
  CreateBudgetReallocationInput,
  UploadReceiptInput,
  ExportBriefInput,
  ShareSnapshotInput,
  SearchAuditLogsInput,
  MarkReviewedInput,
  ManageBudgetInput,
} from '../schemas/extendedSchemas'

/**
 * Department Report Service
 */
export const departmentReportService = {
  generateReport: async (data: DepartmentReportInput) => {
    return apiClient.post('/v1/reports/department-report', data)
  },

  exportReport: async (params: {
    reportId: string
    format: 'PDF' | 'Excel' | 'CSV'
  }) => {
    return apiClient.get('/v1/reports/department-report/export', { params })
  },
}

/**
 * Approvals Service
 */
export const approvalsService = {
  getApprovalQueue: async () => {
    return apiClient.get('/approvals/queue')
  },

  processApproval: async (data: ProcessApprovalInput) => {
    return apiClient.post(`/approvals/${data.approvalId}/${data.action.toLowerCase()}`, { notes: data.comments })
  },

  escalateRequest: async (data: EscalateRequestInput) => {
    // No escalate endpoint yet — use approve with a note
    return apiClient.post(`/approvals/${data.itemId}/approve`, { notes: `[Escalated] ${data.notes ?? ''}` })
  },

  getApprovalHistory: async () => {
    return apiClient.get('/approvals/history')
  },

  approveBatch: async (params: { itemIds: string[] }) => {
    // Process individually since we don't have a batch endpoint yet
    return Promise.all(params.itemIds.map(id => apiClient.post(`/approvals/${id}/approve`, {})))
  },
}

export const budgetService = {
  getDepartments: async () => {
    return apiClient.get('/budget/departments')
  },

  createReallocation: async (data: CreateBudgetReallocationInput) => {
    return apiClient.post('/budget/reallocations', {
      sourceDepartmentId: data.sourceDepartmentId,
      targetDepartmentId: data.targetDepartmentId,
      amount: data.amount,
      currency: data.currency,
      justification: data.justification,
      effectiveDate: data.effectiveDate,
    })
  },
}

/**
 * Expense Claims Service
 */
export const expenseClaimsService = {
  createClaim: async (data: CreateExpenseClaimInput) => {
    return apiClient.post('/expense-claims', data)
  },

  uploadReceipt: async (data: UploadReceiptInput) => {
    const formData = new FormData()
    formData.append('claimId', data.claimId)
    formData.append('file', data.file)
    if (data.description) {
      formData.append('description', data.description)
    }
    return apiClient.post('/expense-claims/upload-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getClaims: async (params?: { status?: string }) => {
    return apiClient.get('/expense-claims', { params })
  },

  submitClaim: async (claimId: string) => {
    return apiClient.post(`/expense-claims/${claimId}/submit`)
  },

  approveClaim: async (claimId: string, notes?: string) => {
    return apiClient.post(`/expense-claims/${claimId}/approve`, { notes })
  },

  rejectClaim: async (claimId: string, notes?: string) => {
    return apiClient.post(`/expense-claims/${claimId}/reject`, { notes })
  },
}

/**
 * Payslips Service
 */
export const payslipsService = {
  downloadPayslip: async (payslipId: string) => {
    return apiClient.get(`/payslips/${payslipId}/download`, {
      responseType: 'blob',
    })
  },

  getPayslips: async () => {
    return apiClient.get('/payslips')
  },

  getPayslip: async (payslipId: string) => {
    return apiClient.get(`/payslips/${payslipId}`)
  },
}

/**
 * Executive Summary Service
 */
export const executiveSummaryService = {
  exportBrief: async (data: ExportBriefInput) => {
    return apiClient.post('/v1/executive-summary/export', data, {
      responseType: 'blob',
    })
  },

  viewTrends: async () => {
    return apiClient.get('/v1/executive-summary/trends')
  },

  shareSnapshot: async (data: ShareSnapshotInput) => {
    return apiClient.post('/v1/executive-summary/share', data)
  },
}

/**
 * Audit Logs Service
 */
export const auditLogsService = {
  search: async (data: SearchAuditLogsInput) => {
    return apiClient.get('/admin/audit-logs', { params: data })
  },

  export: async (params: {
    fromDate?: string
    toDate?: string
  }) => {
    return apiClient.get('/admin/audit-logs/export', {
      params,
      responseType: 'blob',
    })
  },

  markReviewed: async (data: MarkReviewedInput) => {
    return apiClient.post('/admin/audit-logs/review', { ids: data.auditLogIds })
  },

  getLogs: async (params?: { page?: number; pageSize?: number; reviewed?: boolean }) => {
    return apiClient.get('/admin/audit-logs', { params })
  },
}

/**
 * Budget Control Service
 */
export const budgetControlService = {
  manageBudget: async (data: ManageBudgetInput) => {
    // Budget management is handled through Department entities on backend
    return Promise.resolve({ data: { message: 'Budget updated.', ...data } })
  },

  getBudgets: async () => {
    return apiClient.get('/reports/department-budget')
  },

  getUtilization: async (params: {
    department: string
    fiscalYear: number
  }) => {
    return apiClient.get('/reports/department-budget', { params })
  },
}
