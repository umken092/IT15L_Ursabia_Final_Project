import { apiClient } from './apiClient'

export interface BankDirectoryItem {
  id: string
  name: string
  country: string
  branchName?: string | null
  accountNumberPattern: string
  accountNumberSample: string
  isActive: boolean
  listedAtUtc: string
  listedBy: string
  removedAtUtc?: string | null
  removedBy?: string | null
}

export interface BankDirectoryListResponse {
  items: BankDirectoryItem[]
  total: number
  page: number
  pageSize: number
}

export const bankDirectoryService = {
  getActiveBanks: async () => {
    return apiClient.get<BankDirectoryListResponse>('/banks')
  },

  getAllBanks: async (params?: {
    includeInactive?: boolean
    search?: string
    status?: 'all' | 'active' | 'removed'
    page?: number
    pageSize?: number
  }) => {
    return apiClient.get<BankDirectoryListResponse>('/banks', { params: { includeInactive: true, ...params } })
  },

  createBank: async (payload: {
    name: string
    country: string
    branchName?: string
    accountNumberPattern: string
    accountNumberSample: string
  }) => {
    return apiClient.post('/banks', payload)
  },

  updateBank: async (id: string, payload: {
    name: string
    country: string
    branchName?: string
    accountNumberPattern: string
    accountNumberSample: string
  }) => {
    return apiClient.put(`/banks/${id}`, payload)
  },

  removeBank: async (id: string) => {
    return apiClient.delete(`/banks/${id}`)
  },

  restoreBank: async (id: string) => {
    return apiClient.post(`/banks/${id}/restore`)
  },
}
