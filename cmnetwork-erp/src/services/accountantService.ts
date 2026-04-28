import { apiClient } from './apiClient'
import type {
  CreateJournalInput,
  MonthEndCloseInput,
  ApproveInvoicesInput,
  ThreeWayMatchInput,
  SupplierViewInput,
  SendRemindersInput,
  PostReceiptInput,
  ManualMatchInput,
  FinalizeStatementInput,
} from '../schemas/accountantSchemas'

/**
 * General Ledger Service
 */
export const generalLedgerService = {
  createJournal: async (data: CreateJournalInput) => {
    // Validate debit/credit balance in request
    if (data.debit !== data.credit) {
      throw new Error('Journal entry must be balanced (debit = credit)')
    }
    return apiClient.post('/v1/accounting/journals', data)
  },

  monthEndClose: async (data: MonthEndCloseInput) => {
    return apiClient.post('/v1/accounting/month-end-close', data)
  },

  exportLedgerActivity: async (params: {
    fromDate: string
    toDate: string
    format: 'csv' | 'excel'
  }) => {
    return apiClient.get('/v1/accounting/ledger/export', { params })
  },

  getJournalEntries: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/accounting/journals', { params })
  },

  monthEndChecklist: async (fiscalYear: number, month: number) => {
    return apiClient.get(`/v1/accounting/month-end-checklist/${fiscalYear}/${month}`)
  },
}

/**
 * Accounts Payable Service
 */
export const accountsPayableService = {
  approveInvoices: async (data: ApproveInvoicesInput) => {
    return apiClient.post('/v1/accounting/ap/approve-invoices', data)
  },

  threeWayMatch: async (data: ThreeWayMatchInput) => {
    return apiClient.post('/v1/accounting/ap/three-way-match', data)
  },

  getSupplierView: async (data: SupplierViewInput) => {
    return apiClient.get('/v1/accounting/ap/supplier-view', { params: data })
  },

  getPayableInvoices: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/accounting/ap/invoices', { params })
  },
}

/**
 * Accounts Receivable Service
 */
export const accountsReceivableService = {
  sendReminders: async (data: SendRemindersInput) => {
    return apiClient.post('/v1/accounting/ar/send-reminders', data)
  },

  postReceipt: async (data: PostReceiptInput) => {
    return apiClient.post('/v1/accounting/ar/post-receipt', data)
  },

  getReceivableInvoices: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/accounting/ar/invoices', { params })
  },

  getAgingReport: async () => {
    return apiClient.get('/v1/accounting/ar/aging-report')
  },
}

/**
 * Bank Reconciliation Service
 */
export const bankReconciliationService = {
  automatch: async (params: { statementId: string }) => {
    return apiClient.post('/v1/accounting/bank/automatch', params)
  },

  getExceptions: async (params: {
    skip: number
    take: number
    statementId: string
  }) => {
    return apiClient.get('/v1/accounting/bank/exceptions', { params })
  },

  manualMatch: async (data: ManualMatchInput) => {
    return apiClient.post('/v1/accounting/bank/manual-match', data)
  },

  finalizeStatement: async (data: FinalizeStatementInput) => {
    return apiClient.post('/v1/accounting/bank/finalize-statement', data)
  },

  getBankStatements: async (params: {
    skip: number
    take: number
    sort?: string
  }) => {
    return apiClient.get('/v1/accounting/bank/statements', { params })
  },
}
