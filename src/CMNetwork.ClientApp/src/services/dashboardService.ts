import { apiClient } from './apiClient'
import type { Role } from '../types/auth'

export interface MetricDto {
  title: string
  value: string
  subtitle?: string
  progressPercentage?: number
  trendDirection?: string
  trendValue?: string
}

export interface DashboardMetricsResponse {
  metrics: MetricDto[]
}

export interface ChartSeriesData {
  name: string
  values: number[]
}

export interface ChartDataPoint {
  label: string
  series: ChartSeriesData[]
}

export interface ChartDataResponse {
  data: ChartDataPoint[]
  type: string
}

export interface ApprovalDto {
  id: string
  title: string
  description: string
  status: string
  requestedBy: string
  requestedDate: string
  amount?: number
}

export interface ApprovalsResponse {
  approvals: ApprovalDto[]
}

export interface AuditActivityDto {
  id: string
  action: string
  user: string
  entity: string
  status: string
  timestamp: string
}

export interface AuditActivityResponse {
  activities: AuditActivityDto[]
}

export interface BudgetMonthPoint {
  label: string
  monthNumber: number
  actual: number
  projected: number
}

export interface BudgetControlResponse {
  year: number
  currency: string
  totalAllocated: number
  totalActual: number
  totalProjected: number
  remainingForecast: number
  allocatedDeltaPercent: number
  varianceRequestCount: number
  pendingRequestCount: number
  months: BudgetMonthPoint[]
}

export interface DepartmentBudgetItem {
  id: string
  code: string
  name: string
  budget: number
  actual: number
  remaining: number
  utilizationPct: number
}

export interface DepartmentBudgetResponse {
  items: DepartmentBudgetItem[]
  totalBudget: number
  totalActual: number
}

export const dashboardService = {
  getMetrics: async (role: Role): Promise<DashboardMetricsResponse> => {
    const { data } = await apiClient.get<DashboardMetricsResponse>(`/dashboard/${role}/metrics`)
    return data
  },

  getChartData: async (): Promise<ChartDataResponse> => {
    const { data } = await apiClient.get<ChartDataResponse>('/dashboard/charts')
    return data
  },

  getPendingApprovals: async (): Promise<ApprovalsResponse> => {
    const { data } = await apiClient.get<ApprovalsResponse>('/dashboard/approvals')
    return data
  },

  getAuditActivities: async (): Promise<AuditActivityResponse> => {
    const { data } = await apiClient.get<AuditActivityResponse>('/dashboard/audit-activities')
    return data
  },

  getBudgetControl: async (year?: number): Promise<BudgetControlResponse> => {
    const url = year ? `/dashboard/budget-control?year=${year}` : '/dashboard/budget-control'
    const { data } = await apiClient.get<BudgetControlResponse>(url)
    return data
  },

  getDepartmentBudget: async (): Promise<DepartmentBudgetResponse> => {
    const { data } = await apiClient.get<DepartmentBudgetResponse>('/reports/department-budget')
    return data
  },
}
