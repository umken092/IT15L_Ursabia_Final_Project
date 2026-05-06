import { apiClient } from './apiClient'

/**
 * Auditor reports + evidence archive client.
 *
 * All endpoints are read-only or evidence-archive creation; the backend
 * enforces `auditor` / `super-admin` roles.
 */

export interface SodViolation {
  ruleCode: string
  ruleTitle: string
  description: string
  user: string
  userEmail: string | null
  sideACount: number
  sideBCount: number
  firstActivityUtc: string
  lastActivityUtc: string
  sampleSideA: SodSample[]
  sampleSideB: SodSample[]
}

export interface SodSample {
  id: string
  entityName: string
  action: string
  recordId: string | null
  createdUtc: string
}

export interface SodReport {
  from: string
  to: string
  ruleCount: number
  violationCount: number
  rules: { code: string; title: string; description: string }[]
  violations: SodViolation[]
}

export interface UserActivityItem {
  id: string
  createdUtc: string
  category: string
  entity: string
  action: string
  recordId: string | null
  performedBy: string
  userEmail: string | null
  ipAddress: string | null
}

export interface UserActivityResponse {
  from: string
  to: string
  user: string | null
  availableUsers: string[]
  items: UserActivityItem[]
}

export interface EntityHistoryItem {
  id: string
  createdUtc: string
  action: string
  category: string
  performedBy: string
  userEmail: string | null
  details: string | null
}

export interface EvidenceArchiveItem {
  id: string
  archiveNumber: string
  title: string
  description: string | null
  fileName: string
  fileSizeBytes: number
  checksum: string
  entryCount: number
  generatedBy: string
  generatedByEmail: string | null
  generatedUtc: string
}

export interface CreateArchiveResult {
  id: string
  archiveNumber: string
  checksum: string
  fileName: string
  fileSizeBytes: number
  entryCount: number
}

export interface VerifyArchiveResult {
  ok: boolean
  expected: string
  actual?: string
  reason?: string
  verifiedUtc?: string
}

export const auditorReportsService = {
  async sodReport(params: { from?: string; to?: string } = {}): Promise<SodReport> {
    const res = await apiClient.get<SodReport>('/auditor/sod-report', { params })
    return res.data
  },

  async userActivity(params: {
    user?: string
    from?: string
    to?: string
    take?: number
  } = {}): Promise<UserActivityResponse> {
    const res = await apiClient.get<UserActivityResponse>('/auditor/user-activity', { params })
    return res.data
  },

  async vendorHistory(id: string): Promise<{ items: EntityHistoryItem[] }> {
    const res = await apiClient.get<{ items: EntityHistoryItem[] }>(`/auditor/vendor-history/${id}`)
    return res.data
  },

  async customerHistory(id: string): Promise<{ items: EntityHistoryItem[] }> {
    const res = await apiClient.get<{ items: EntityHistoryItem[] }>(`/auditor/customer-history/${id}`)
    return res.data
  },
}

export const evidenceArchiveService = {
  async list(take = 100): Promise<{ items: EvidenceArchiveItem[] }> {
    const res = await apiClient.get<{ items: EvidenceArchiveItem[] }>('/auditor/evidence-archives', { params: { take } })
    return res.data
  },

  async create(input: {
    title: string
    description?: string
    auditLogIds: string[]
  }): Promise<CreateArchiveResult> {
    const res = await apiClient.post<CreateArchiveResult>('/auditor/evidence-archives', input)
    return res.data
  },

  downloadUrl(id: string): string {
    return `/api/auditor/evidence-archives/${id}/download`
  },

  async verify(id: string): Promise<VerifyArchiveResult> {
    const res = await apiClient.get<VerifyArchiveResult>(`/auditor/evidence-archives/${id}/verify`)
    return res.data
  },
}

/**
 * Thin wrappers around existing GL/Reports endpoints (auditor read-only).
 */
export const financialReadOnlyService = {
  async trialBalance(params: { asOfDate?: string } = {}) {
    const res = await apiClient.get('/general-ledger/trial-balance', { params })
    return res.data
  },

  async journals(params: { from?: string; to?: string; status?: string } = {}) {
    const res = await apiClient.get('/general-ledger/journals', { params })
    return res.data
  },

  async accounts() {
    const res = await apiClient.get('/general-ledger/accounts')
    return res.data
  },

  async balanceSheet(params: { asOfDate?: string } = {}) {
    const res = await apiClient.get('/reports/balance-sheet', { params })
    return res.data
  },

  async incomeStatement(params: { from?: string; to?: string } = {}) {
    const res = await apiClient.get('/reports/income-statement', { params })
    return res.data
  },

  async apAging(params: { asOfDate?: string } = {}) {
    const res = await apiClient.get('/reports/aging-ap', { params })
    return res.data
  },

  async arAging(params: { asOfDate?: string } = {}) {
    const res = await apiClient.get('/reports/aging-ar', { params })
    return res.data
  },

  async vendors() {
    const res = await apiClient.get('/vendors')
    return res.data
  },

  async customers() {
    const res = await apiClient.get('/customers')
    return res.data
  },
}
