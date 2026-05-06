import { apiClient } from './apiClient'
import type {
  CreateJournalInput,
  MonthEndCloseInput,
  ApproveInvoicesInput,
  ThreeWayMatchInput,
  SupplierViewInput,
  SendRemindersInput,
  PostReceiptInput,
} from '../schemas/accountantSchemas'

type TemplateVisibility = 'Private' | 'Team'
type ScheduleCadence = 'Daily' | 'Weekly' | 'Monthly'
type ScheduleTarget = 'Excel' | 'PDF'

interface ReportTemplateDto {
  id: string
  name: string
  type: string
  visibility: TemplateVisibility
  updatedAt: string
}

interface ReportScheduleDto {
  id: string
  label: string
  type: string
  cadence: ScheduleCadence
  target: ScheduleTarget
  active: boolean
  updatedAt?: string
}

const getWithFallback = async (preferredUrl: string, legacyUrl: string, params?: unknown) => {
  try {
    return await apiClient.get(preferredUrl, { params })
  } catch {
    return apiClient.get(legacyUrl, { params })
  }
}

const postWithFallback = async (preferredUrl: string, legacyUrl: string, data?: unknown) => {
  try {
    return await apiClient.post(preferredUrl, data)
  } catch {
    return apiClient.post(legacyUrl, data)
  }
}

/**
 * General Ledger Service
 */
export const generalLedgerService = {
  createJournal: async (data: CreateJournalInput) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)
    if (totalDebit !== totalCredit) {
      throw new Error('Journal entry must be balanced (debit = credit)')
    }
    return apiClient.post('/general-ledger/journals', data)
  },

  getAccounts: async () => {
    return apiClient.get('/general-ledger/accounts')
  },

  getFiscalPeriods: async () => {
    return apiClient.get('/general-ledger/periods')
  },

  createFiscalPeriod: async (data: { name: string; startDate: string; endDate: string }) => {
    return apiClient.post('/general-ledger/periods', data)
  },

  closeFiscalPeriod: async (id: string) => {
    return apiClient.post(`/general-ledger/periods/${id}/close`)
  },

  reopenFiscalPeriod: async (id: string) => {
    return apiClient.post(`/general-ledger/periods/${id}/reopen`)
  },

  monthEndClose: async (data: MonthEndCloseInput) => {
    return apiClient.post('/general-ledger/month-end-close', data)
  },

  exportLedgerActivity: async (params: {
    fromDate: string
    toDate: string
    format: 'csv' | 'excel'
  }) => {
    return apiClient.get<Blob>('/general-ledger/journals/export', {
      params,
      responseType: 'blob',
    })
  },

  getJournalEntries: async (status?: 'Draft' | 'Posted') => {
    return apiClient.get('/general-ledger/journals', {
      params: status ? { status } : undefined,
    })
  },

  getJournalEntry: async (id: string) => {
    return apiClient.get(`/general-ledger/journals/${id}`)
  },

  updateJournal: async (id: string, data: CreateJournalInput) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)
    if (totalDebit !== totalCredit) {
      throw new Error('Journal entry must be balanced (debit = credit)')
    }
    return apiClient.put(`/general-ledger/journals/${id}`, data)
  },

  getTrialBalance: async (asOfDate?: string) => {
    return apiClient.get('/general-ledger/trial-balance', {
      params: asOfDate ? { asOfDate } : undefined,
    })
  },

  postJournal: async (id: string) => {
    return apiClient.post(`/general-ledger/journals/${id}/post`)
  },

  monthEndChecklist: async (fiscalYear: number, month: number) => {
    return apiClient.get(`/general-ledger/month-end-checklist/${fiscalYear}/${month}`)
  },
}

/**
 * Accounts Payable Service
 */
export const accountsPayableService = {
  approveInvoices: async (data: ApproveInvoicesInput) => {
    return postWithFallback('/accounts-payable/approve-invoices', '/v1/accounting/ap/approve-invoices', data)
  },

  threeWayMatch: async (data: ThreeWayMatchInput) => {
    return postWithFallback('/accounts-payable/three-way-match', '/v1/accounting/ap/three-way-match', data)
  },

  getSupplierView: async (data: SupplierViewInput) => {
    return getWithFallback('/accounts-payable/supplier-view', '/v1/accounting/ap/supplier-view', data)
  },

  getPayableInvoices: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return getWithFallback('/accounts-payable/invoices', '/v1/accounting/ap/invoices', params)
  },
}

/**
 * Accounts Receivable Service
 */
export const accountsReceivableService = {
  sendReminders: async (data: SendRemindersInput) => {
    return postWithFallback('/accounts-receivable/send-reminders', '/v1/accounting/ar/send-reminders', data)
  },

  postReceipt: async (data: PostReceiptInput) => {
    return postWithFallback('/accounts-receivable/post-receipt', '/v1/accounting/ar/post-receipt', data)
  },

  getReceivableInvoices: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return getWithFallback('/accounts-receivable/invoices', '/v1/accounting/ar/invoices', params)
  },

  getAgingReport: async () => {
    return getWithFallback('/accounts-receivable/aging-report', '/v1/accounting/ar/aging-report')
  },
}

/**
 * Bank Reconciliation Service
 */
export const bankReconciliationService = {
  getStatements: async () => {
    return apiClient.get('/bank-reconciliation/statements')
  },

  importStatement: async (data: {
    bankAccountName: string
    bankAccountNumber: string
    statementDate: string
    openingBalance: number
    closingBalance: number
    fiscalPeriodId?: string
    transactions: {
      transactionDate: string
      description: string
      reference?: string
      amount: number
      isDebit: boolean
    }[]
  }) => {
    return apiClient.post('/bank-reconciliation/statements', data)
  },

  getStatement: async (id: string) => {
    return apiClient.get(`/bank-reconciliation/statements/${id}`)
  },

  getUnmatchedTransactions: async (statementId: string) => {
    return apiClient.get(`/bank-reconciliation/statements/${statementId}/unmatched-transactions`)
  },

  getUnmatchedGlLines: async (periodId?: string) => {
    return apiClient.get('/bank-reconciliation/unmatched-gl-lines', {
      params: periodId ? { periodId } : undefined,
    })
  },

  matchTransaction: async (data: { bankTransactionId: string; journalEntryLineId: string }) => {
    return apiClient.post('/bank-reconciliation/match', data)
  },

  unmatchTransaction: async (data: { bankTransactionId: string }) => {
    return apiClient.post('/bank-reconciliation/unmatch', data)
  },

  getDifference: async (statementId: string) => {
    return apiClient.get(`/bank-reconciliation/statements/${statementId}/difference`)
  },

  finalizeStatement: async (data: { reconciliationId: string; forceFinalize?: boolean; notes?: string }) => {
    return apiClient.post('/bank-reconciliation/finalize', data)
  },

  getHistory: async () => {
    return apiClient.get('/bank-reconciliation/history')
  },
}

/**
 * Financial Reports Service
 */
export const reportsService = {
  listTemplates: async () => {
    return apiClient.get<{ items: ReportTemplateDto[] }>('/reports/report-templates')
  },

  createTemplate: async (payload: { name: string; type: string; visibility: TemplateVisibility }) => {
    return apiClient.post<ReportTemplateDto>('/reports/report-templates', payload)
  },

  deleteTemplate: async (id: string) => {
    return apiClient.delete(`/reports/report-templates/${id}`)
  },

  listSchedules: async () => {
    return apiClient.get<{ items: ReportScheduleDto[] }>('/reports/report-schedules')
  },

  createSchedule: async (payload: { label: string; type: string; cadence: ScheduleCadence; target: ScheduleTarget; active: boolean }) => {
    return apiClient.post<ReportScheduleDto>('/reports/report-schedules', payload)
  },

  updateSchedule: async (id: string, payload: { label: string; type: string; cadence: ScheduleCadence; target: ScheduleTarget; active: boolean }) => {
    return apiClient.put<ReportScheduleDto>(`/reports/report-schedules/${id}`, payload)
  },

  runScheduleNow: async (id: string) => {
    return apiClient.post<{ queuedAt: string }>(`/reports/report-schedules/${id}/run-now`)
  },

  getIncomeStatement: async (params: { startDate: string; endDate: string }) => {
    return apiClient.get('/reports/income-statement', {
      params: {
        from: params.startDate,
        to: params.endDate,
      },
    })
  },

  getBalanceSheet: async (params: { asOfDate: string }) => {
    return apiClient.get('/reports/balance-sheet', {
      params: {
        asOf: params.asOfDate,
      },
    })
  },

  getCashFlow: async (params: { startDate: string; endDate: string }) => {
    return apiClient.get('/reports/cash-flow', {
      params: {
        from: params.startDate,
        to: params.endDate,
      },
    })
  },

  getAgingAp: async (params: { asOfDate: string }) => {
    return apiClient.get('/reports/aging-ap', {
      params: {
        asOf: params.asOfDate,
      },
    })
  },

  getAgingAr: async (params: { asOfDate: string }) => {
    return apiClient.get('/reports/aging-ar', {
      params: {
        asOf: params.asOfDate,
      },
    })
  },

  getDepartmentBudget: async (params?: { departmentId?: string; periodId?: string }) => {
    return apiClient.get('/reports/department-budget', { params })
  },

  exportReport: async (type: string, format: 'excel' | 'pdf', params: Record<string, string>) => {
    const normalizedParams =
      params.asOfDate
        ? { asOf: params.asOfDate }
        : {
            from: params.startDate,
            to: params.endDate,
          }

    return apiClient.get(`/reports/export/${type}`, {
      params: { format, ...normalizedParams },
      responseType: 'blob',
    })
  },

  getAuditActivities: async () => {
    return apiClient.get('/dashboard/audit-activities')
  },
}
