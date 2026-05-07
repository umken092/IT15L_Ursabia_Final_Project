import { apiClient } from './apiClient'
import type { Role } from '../types/auth'
import type { AxiosError } from 'axios'

export type AdminUserStatus = 'active' | 'inactive' | 'pending'
export type IntegrationStatus = 'active' | 'inactive' | 'error'
export type AdminJobType = 'recurring' | 'scheduled' | 'ad-hoc'
export type AdminJobStatus = 'running' | 'scheduled' | 'succeeded' | 'failed' | 'recurring'

export interface SmtpSettings {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
  security: 'none' | 'ssl' | 'starttls'
}

export interface PayMongoSettings {
  publicKey: string
  secretKey: string
  mode: 'test' | 'live'
}

export interface AdminUser {
  id: string
  email: string
  fullName: string
  department: string
  role: Role
  status: AdminUserStatus
  joinDate: string
}

export interface CreateAdminUserRequest {
  firstName: string
  middleName: string
  lastName: string
  birthdate: string
  gender: string
  age: number
  address: string
  tinNumber: string
  sssNumber: string
  role: Role
  department: string | null
  generatedEmail: string
  generatedPassword: string
}

export interface UpdateAdminUserRequest {
  firstName: string
  middleName: string
  lastName: string
  department: string | null
  role: Role
  status: AdminUserStatus
}

export interface ResetAdminUserPasswordRequest {
  newPassword: string
}

export interface SecurityPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  value: string
}

export type MfaLevel = 'none' | 'high-privilege' | 'all'
export type IpMode = 'disabled' | 'allowlist'

export interface SecurityPolicySettings {
  password: {
    minLength: number
    maxLength: number
    blockedTerms: string
    forbidUserContext: boolean
    forbidCompanyName: boolean
    expireOnlyOnCompromise: boolean
    allowUnicode: boolean
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSymbols: boolean
    preventReuse: number
  }
  lockout: {
    maxFailedAttempts: number
    lockoutDurationMinutes: number
    resetCounterAfterMinutes: number
  }
  session: {
    idleTimeoutMinutes: number
    absoluteTimeoutHours: number
    singleSessionPerUser: boolean
  }
  mfa: {
    level: MfaLevel
  }
  ip: {
    mode: IpMode
    allowedRanges: string
  }
}

const DEFAULT_SECURITY_POLICY_SETTINGS: SecurityPolicySettings = {
  password: {
    minLength: 12,
    maxLength: 128,
    blockedTerms: ['password', '123456', '12345678', 'qwerty', 'admin', 'administrator', 'welcome', 'letmein', 'abc123'].join('\n'),
    forbidUserContext: true,
    forbidCompanyName: true,
    expireOnlyOnCompromise: true,
    allowUnicode: true,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSymbols: false,
    preventReuse: 0,
  },
  lockout: {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    resetCounterAfterMinutes: 30,
  },
  session: {
    idleTimeoutMinutes: 30,
    absoluteTimeoutHours: 8,
    singleSessionPerUser: false,
  },
  mfa: {
    level: 'high-privilege',
  },
  ip: {
    mode: 'disabled',
    allowedRanges: '',
  },
}

const normalizeSecurityPolicySettings = (
  settings: Partial<SecurityPolicySettings> | null | undefined,
): SecurityPolicySettings => ({
  password: {
    ...DEFAULT_SECURITY_POLICY_SETTINGS.password,
    ...settings?.password,
    blockedTerms: settings?.password?.blockedTerms ?? DEFAULT_SECURITY_POLICY_SETTINGS.password.blockedTerms,
    minLength: settings?.password?.minLength ?? DEFAULT_SECURITY_POLICY_SETTINGS.password.minLength,
    maxLength: settings?.password?.maxLength ?? DEFAULT_SECURITY_POLICY_SETTINGS.password.maxLength,
  },
  lockout: {
    ...DEFAULT_SECURITY_POLICY_SETTINGS.lockout,
    ...settings?.lockout,
  },
  session: {
    ...DEFAULT_SECURITY_POLICY_SETTINGS.session,
    ...settings?.session,
  },
  mfa: {
    ...DEFAULT_SECURITY_POLICY_SETTINGS.mfa,
    ...settings?.mfa,
  },
  ip: {
    ...DEFAULT_SECURITY_POLICY_SETTINGS.ip,
    ...settings?.ip,
  },
})

export interface IntegrationSetting {
  id: string
  name: string
  status: IntegrationStatus
  endpoint: string
  lastSync: string
}

export interface BackupRecord {
  id: string
  timestamp: string
  status: string
  size: string
  duration: string
}

export interface AdminUsersQueryParams {
  search?: string
  role?: Role
  department?: string
  page: number
  pageSize: number
}

export interface PagedAdminUsersResponse {
  items: AdminUser[]
  totalCount: number
  page: number
  pageSize: number
}

export interface AuditActivity {
  action: string
  entity: string
  user: string
  timestamp: string
}

export interface AdminHealthCheck {
  name: string
  status: 'ok' | 'error'
  latencyMs: number
  message: string
}

export interface AdminApiStat {
  label: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'neutral'
}

export interface AdminRequestLog {
  id?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  status: number
  durationMs: number
  timestamp: string
}

export interface AdminSystemHealth {
  checks: AdminHealthCheck[]
  stats: AdminApiStat[]
  recentRequests: AdminRequestLog[]
}

export interface AdminUsageRow {
  user: string
  role: string
  logins: number
  topModule: string
  lastLogin: string
}

export interface AdminModuleUsage {
  module: string
  sessions: number
  pct: number
}

export interface AdminPeakHour {
  hour: string
  requests: number
}

export interface AdminLicenseUser {
  name: string
  role: string
  status: AdminUserStatus
  lastSeen: string
}

export interface AdminReports {
  usageRows: AdminUsageRow[]
  moduleUsage: AdminModuleUsage[]
  peakHours: AdminPeakHour[]
  licenseLimit: number
  licenseUsers: AdminLicenseUser[]
}

export type AdminReportExportFormat = 'csv' | 'xlsx' | 'pdf'

export interface AdminReportExportFile {
  blob: Blob
  filename: string
}

export interface AdminJob {
  id: string
  name: string
  type: AdminJobType
  status: AdminJobStatus
  lastRun: string
  nextRun?: string
  duration?: string
  error?: string
  cron?: string
}

export const adminService = {
  async getUsers(): Promise<AdminUser[]> {
    const response = await apiClient.get<AdminUser[]>('/admin/users')
    return response.data
  },

  async getUsersPaged(params: AdminUsersQueryParams): Promise<PagedAdminUsersResponse> {
    try {
      const response = await apiClient.get<PagedAdminUsersResponse>('/admin/users/query', {
        params,
      })
      return response.data
    } catch (error) {
      const statusCode = (error as AxiosError)?.response?.status
      if (statusCode !== 404) {
        throw error
      }

      // Backward-compatible fallback for APIs that only expose /admin/users.
      const users = await adminService.getUsers()
      const normalizedSearch = params.search?.trim().toLowerCase() ?? ''

      const filtered = users.filter((user) => {
        const searchMatches =
          normalizedSearch.length === 0
          || user.fullName.toLowerCase().includes(normalizedSearch)
          || user.email.toLowerCase().includes(normalizedSearch)

        const roleMatches = !params.role || user.role === params.role
        const departmentMatches =
          !params.department || user.department.toLowerCase() === params.department.toLowerCase()

        return searchMatches && roleMatches && departmentMatches
      })

      const totalCount = filtered.length
      const startIndex = (params.page - 1) * params.pageSize
      const items = filtered.slice(startIndex, startIndex + params.pageSize)

      return {
        items,
        totalCount,
        page: params.page,
        pageSize: params.pageSize,
      }
    }
  },

  async createUser(payload: CreateAdminUserRequest): Promise<void> {
    await apiClient.post('/admin/users', payload)
  },

  async updateUser(userId: string, payload: UpdateAdminUserRequest): Promise<void> {
    await apiClient.put(`/admin/users/${userId}`, payload)
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`)
  },

  async resetUserPassword(userId: string, payload: ResetAdminUserPasswordRequest): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/password`, payload)
  },

  async unlockUser(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/unlock`)
  },

  async getSecurityPolicies(): Promise<SecurityPolicy[]> {
    const response = await apiClient.get<SecurityPolicy[]>('/admin/security-policies')
    return response.data
  },

  async toggleSecurityPolicy(policyId: string): Promise<void> {
    await apiClient.put(`/admin/security-policies/${policyId}/toggle`)
  },

  async getSecurityPolicySettings(): Promise<SecurityPolicySettings> {
    const response = await apiClient.get<SecurityPolicySettings>('/admin/security-policy')
    return normalizeSecurityPolicySettings(response.data)
  },

  async updateSecurityPolicySettings(payload: SecurityPolicySettings): Promise<SecurityPolicySettings> {
    const response = await apiClient.put<SecurityPolicySettings>('/admin/security-policy', payload)
    return normalizeSecurityPolicySettings(response.data)
  },

  async getIntegrations(): Promise<IntegrationSetting[]> {
    const response = await apiClient.get<IntegrationSetting[]>('/admin/integrations')
    return response.data
  },

  async getBackups(): Promise<BackupRecord[]> {
    const response = await apiClient.get<BackupRecord[]>('/admin/backups')
    return response.data
  },

  async runBackup(): Promise<void> {
    await apiClient.post('/admin/backups/run')
  },

  async restoreLatestBackup(): Promise<void> {
    await apiClient.post('/admin/backups/restore')
  },

  async getAuditActivities(): Promise<AuditActivity[]> {
    const response = await apiClient.get<AuditActivity[]>('/admin/audit-activities')
    return response.data
  },

  async getSystemHealth(): Promise<AdminSystemHealth> {
    const response = await apiClient.get<AdminSystemHealth>('/admin/system-health')
    return response.data
  },

  async getSystemReports(): Promise<AdminReports> {
    const response = await apiClient.get<AdminReports>('/admin/system-reports')
    return response.data
  },

  async exportSystemReports(format: AdminReportExportFormat): Promise<AdminReportExportFile> {
    const response = await apiClient.get<Blob>('/admin/system-reports/export', {
      params: { format },
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] ?? ''
    const filenameMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
    const fallbackName = `system-usage-report.${format}`
    return {
      blob: response.data,
      filename: filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1].replaceAll('"', '')) : fallbackName,
    }
  },

  async getJobs(): Promise<AdminJob[]> {
    const response = await apiClient.get<AdminJob[]>('/admin/jobs')
    return response.data
  },

  async triggerJob(jobId: string): Promise<void> {
    await apiClient.post(`/admin/jobs/${encodeURIComponent(jobId)}/trigger`)
  },

  async retryJob(jobId: string): Promise<void> {
    await apiClient.post(`/admin/jobs/${encodeURIComponent(jobId)}/retry`)
  },

  async deleteJob(jobId: string): Promise<void> {
    await apiClient.delete(`/admin/jobs/${encodeURIComponent(jobId)}`)
  },

  // ── SMTP Settings ───────────────────────────────────────────────────────

  async getSmtpSettings(): Promise<SmtpSettings> {
    const response = await apiClient.get<SmtpSettings>('/admin/smtp-settings')
    return response.data
  },

  async updateSmtpSettings(payload: SmtpSettings): Promise<SmtpSettings> {
    const response = await apiClient.put<SmtpSettings>('/admin/smtp-settings', payload)
    return response.data
  },

  // ── PayMongo Settings ───────────────────────────────────────────────────

  async getPayMongoSettings(): Promise<PayMongoSettings> {
    const response = await apiClient.get<PayMongoSettings>('/admin/paymongo-settings')
    return response.data
  },

  async updatePayMongoSettings(payload: PayMongoSettings): Promise<PayMongoSettings> {
    const response = await apiClient.put<PayMongoSettings>('/admin/paymongo-settings', payload)
    return response.data
  },

  // ── Role Permissions ────────────────────────────────────────────────────

  async getRolePermissions(role: string): Promise<string[]> {
    const response = await apiClient.get<{ permissions: string[] }>(`/admin/roles/${encodeURIComponent(role)}/permissions`)
    return response.data.permissions ?? []
  },

  async updateRolePermissions(role: string, permissions: string[]): Promise<void> {
    await apiClient.put(`/admin/roles/${encodeURIComponent(role)}/permissions`, { permissions })
  },
}
