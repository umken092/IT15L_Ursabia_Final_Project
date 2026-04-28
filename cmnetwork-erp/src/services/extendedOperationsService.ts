import { apiClient } from './apiClient'
import type {
  DepartmentReportInput,
  ProcessApprovalInput,
  EscalateRequestInput,
  CreateExpenseClaimInput,
  UploadReceiptInput,
  DownloadPayslipInput,
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
  getApprovalQueue: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/approvals/queue', { params })
  },

  processApproval: async (data: ProcessApprovalInput) => {
    return apiClient.post('/v1/approvals/process', data)
  },

  escalateRequest: async (data: EscalateRequestInput) => {
    return apiClient.post('/v1/approvals/escalate', data)
  },

  getApprovalInbox: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/approvals/inbox', { params })
  },

  approveBatch: async (params: { itemIds: string[] }) => {
    return apiClient.post('/v1/approvals/batch-approve', params)
  },
}

/**
 * Expense Claims Service
 */
export const expenseClaimsService = {
  createClaim: async (data: CreateExpenseClaimInput) => {
    return apiClient.post('/v1/expense-claims/create', data)
  },

  uploadReceipt: async (data: UploadReceiptInput) => {
    const formData = new FormData()
    formData.append('claimId', data.claimId)
    formData.append('file', data.file)
    if (data.description) {
      formData.append('description', data.description)
    }
    return apiClient.post('/v1/expense-claims/upload-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getClaims: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/expense-claims', { params })
  },

  getClaimTimeline: async (claimId: string) => {
    return apiClient.get(`/v1/expense-claims/${claimId}/timeline`)
  },
}

/**
 * Payslips Service
 */
export const payslipsService = {
  downloadPayslip: async (data: DownloadPayslipInput) => {
    return apiClient.get('/v1/payslips/download', {
      params: data,
      responseType: 'blob',
    })
  },

  getPayslipHistory: async (params: {
    skip: number
    take: number
  }) => {
    return apiClient.get('/v1/payslips/history', { params })
  },

  getDeductionDetails: async (payslipId: string) => {
    return apiClient.get(`/v1/payslips/${payslipId}/deductions`)
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
    return apiClient.get('/v1/audit-logs/search', { params: data })
  },

  export: async (params: {
    fromDate?: string
    toDate?: string
  }) => {
    return apiClient.get('/v1/audit-logs/export', {
      params,
      responseType: 'blob',
    })
  },

  markReviewed: async (data: MarkReviewedInput) => {
    return apiClient.post('/v1/audit-logs/mark-reviewed', data)
  },

  getLogs: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/audit-logs', { params })
  },
}

/**
 * Budget Control Service
 */
export const budgetControlService = {
  manageBudget: async (data: ManageBudgetInput) => {
    return apiClient.post('/v1/budget-control/manage', data)
  },

  getBudgets: async (params: {
    skip: number
    take: number
  }) => {
    return apiClient.get('/v1/budget-control', { params })
  },

  getUtilization: async (params: {
    department: string
    fiscalYear: number
  }) => {
    return apiClient.get('/v1/budget-control/utilization', { params })
  },
}
