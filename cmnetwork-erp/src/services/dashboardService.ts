import { apiClient } from './apiClient'
import { chartData, pendingApprovals, recentAuditActivities } from './mockDashboardData'
import type { Role } from '../types/auth'

interface DashboardMetrics {
  pending?: number
  unreconciled?: number
  progress?: number
  status?: string
  count?: number
  kpis?: {
    revenue: number
    expenses: number
    income: number
  }
  activities?: string[]
  approvals?: Array<{ id: string; title: string; owner: string }>
}

export const dashboardService = {
  getMetrics: async (role: Role): Promise<DashboardMetrics> => {
    try {
      const { data } = await apiClient.get<DashboardMetrics>(
        `/dashboard/${role}/metrics`,
      )
      return data
    } catch (error) {
      console.warn(
        `Failed to fetch ${role} dashboard metrics, using mock data`,
        error,
      )
      return getMockMetrics(role)
    }
  },

  getChartData: async () => {
    try {
      const { data } = await apiClient.get('/dashboard/charts')
      return data
    } catch {
      return chartData
    }
  },

  getPendingApprovals: async () => {
    try {
      const { data } = await apiClient.get('/dashboard/approvals')
      return data
    } catch {
      return pendingApprovals
    }
  },

  getAuditActivities: async () => {
    try {
      const { data } = await apiClient.get('/dashboard/audit-activities')
      return data
    } catch {
      return recentAuditActivities
    }
  },
}

function getMockMetrics(role: Role): DashboardMetrics {
  const mocksByRole: Record<Role, DashboardMetrics> = {
    'super-admin': {
      status: 'Healthy',
      count: 248,
    },
    accountant: {
      pending: 18,
      unreconciled: 9,
      progress: 68,
    },
    'faculty-admin': {
      progress: 74,
    },
    employee: {},
    'authorized-viewer': {
      kpis: { revenue: 5920000, expenses: 4070000, income: 1850000 },
    },
    auditor: {
      count: 3,
    },
    cfo: {
      kpis: { revenue: 5920000, expenses: 4070000, income: 1850000 },
    },
  }
  return mocksByRole[role] || {}
}
