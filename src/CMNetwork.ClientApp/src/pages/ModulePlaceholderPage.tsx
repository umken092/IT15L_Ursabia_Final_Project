import { useEffect, useState, type ReactElement } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import { useNavigate, useParams } from 'react-router-dom'
import { RoleGuard, moduleRoleMap } from '../components/RoleGuard'
import { useAuthStore } from '../store/authStore'
import { useDisplayCurrency } from '../store/currencyStore'
import { roleDashboardPath, roleLabels } from '../types/auth'
import { dashboardService, type MetricDto } from '../services/dashboardService'
import { AccountantOperationsModule } from './modules/AccountantOperationsModule'
import { APInvoicesModule } from './modules/APInvoicesModule'
import { ARInvoicesModule } from './modules/ARInvoicesModule'
import { AdminReportsModule } from './modules/AdminReportsModule'
import { AuditorModulesModule, type AuditorModuleKey } from './modules/AuditorModulesModule'
import { AuthorizedViewerModule, type AvModuleKey } from './modules/AuthorizedViewerModule'
import { BankDirectoryModule } from './modules/BankDirectoryModule'
import { EmployeeWorkspaceModule } from './modules/EmployeeWorkspaceModule'
import { ExtendedRoleOperationsModule } from './modules/ExtendedRoleOperationsModule'
import { FacultyAdminModule, type FacultyAdminModuleKey } from './modules/FacultyAdminModule'
import { FinancialReportsModule } from './modules/FinancialReportsModule'
import { FiscalPeriodsModule } from './modules/FiscalPeriodsModule'
import { IntegrationSettingsModule } from './modules/IntegrationSettingsModule'
import { JobQueueModule } from './modules/JobQueueModule'
import { PayrollOperationsModule } from './modules/PayrollOperationsModule'
import { RolesPermissionsModule } from './modules/RolesPermissionsModule'
import { SecurityPolicyModule } from './modules/SecurityPolicyModule'
import { SystemHealthModule } from './modules/SystemHealthModule'
import { SystemSettingsModule } from './modules/SystemSettingsModule'
import { UserManagementModule } from './modules/UserManagementModule'

const labelize = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const SIMPLE_MODULE_MAP: Partial<Record<string, () => ReactElement>> = {
  'user-management': () => <UserManagementModule />,
  'roles-permissions': () => <RolesPermissionsModule />,
  'job-queue': () => <JobQueueModule />,
  'fiscal-periods': () => <FiscalPeriodsModule />,
  'integration-settings': () => <IntegrationSettingsModule />,
  'security-policy': () => <SecurityPolicyModule />,
  'system-health': () => <SystemHealthModule />,
  'admin-reports': () => <AdminReportsModule />,
  'system-settings': () => <SystemSettingsModule />,
  'bank-directory': () => <BankDirectoryModule />,
  'accounts-payable': () => <APInvoicesModule />,
  'accounts-receivable': () => <ARInvoicesModule />,
}

function renderSpecialModule(moduleKey: string): ReactElement | null {
  const simpleRender = SIMPLE_MODULE_MAP[moduleKey]
  if (simpleRender) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}>{simpleRender()}</RoleGuard>
  }

  if (moduleKey === 'general-ledger' || moduleKey === 'bank-reconciliation') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AccountantOperationsModule moduleKey={moduleKey} /></RoleGuard>
  }

  if (moduleKey === 'payroll') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><PayrollOperationsModule /></RoleGuard>
  }

  if (moduleKey === 'financial-reports' || moduleKey === 'reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><FinancialReportsModule /></RoleGuard>
  }

  if (moduleKey === 'expense-claims' || moduleKey === 'payslips' || moduleKey === 'profile') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><EmployeeWorkspaceModule moduleKey={moduleKey} /></RoleGuard>
  }

  if (moduleKey === 'executive-summary' || moduleKey === 'av-reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AuthorizedViewerModule moduleKey={moduleKey as AvModuleKey} /></RoleGuard>
  }

  if (
    moduleKey === 'sod-report' || moduleKey === 'user-activity-timeline'
    || moduleKey === 'general-ledger-inquiry' || moduleKey === 'trial-balance'
    || moduleKey === 'vendor-master' || moduleKey === 'customer-master'
    || moduleKey === 'balance-sheet' || moduleKey === 'income-statement'
    || moduleKey === 'ap-aging' || moduleKey === 'ar-aging' || moduleKey === 'evidence-archive'
  ) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><AuditorModulesModule moduleKey={moduleKey as AuditorModuleKey} /></RoleGuard>
  }

  if (moduleKey === 'dept-reports' || moduleKey === 'fa-approvals' || moduleKey === 'fa-reports') {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><FacultyAdminModule moduleKey={moduleKey as FacultyAdminModuleKey} /></RoleGuard>
  }

  if (
    moduleKey === 'department-report' || moduleKey === 'approvals'
    || moduleKey === 'audit-logs' || moduleKey === 'approvals-inbox' || moduleKey === 'budget-control'
  ) {
    return <RoleGuard allowedRoles={moduleRoleMap[moduleKey]}><ExtendedRoleOperationsModule moduleKey={moduleKey} /></RoleGuard>
  }

  return null
}

export const ModulePlaceholderPage = () => {
  useDisplayCurrency()

  const navigate = useNavigate()
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const user = useAuthStore((state) => state.user)
  const activeRole = selectedRole ?? user?.role ?? null
  const [metrics, setMetrics] = useState<MetricDto[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError] = useState('')

  useEffect(() => {
    if (!activeRole) {
      setMetrics([])
      setMetricsError('')
      return
    }

    let isMounted = true
    setLoadingMetrics(true)
    setMetricsError('')

    void dashboardService
      .getMetrics(activeRole)
      .then((result) => {
        if (!isMounted) return
        setMetrics(result.metrics ?? [])
      })
      .catch(() => {
        if (!isMounted) return
        setMetrics([])
        setMetricsError('Unable to load live metrics for this module right now.')
      })
      .finally(() => {
        if (!isMounted) return
        setLoadingMetrics(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeRole])

  if (moduleKey) {
    const special = renderSpecialModule(moduleKey)
    if (special) return special
  }

  const readableLabel = moduleKey ? labelize(moduleKey) : 'Module'
  const allowedRoles = moduleKey ? moduleRoleMap[moduleKey] : undefined

  if (!moduleKey || !allowedRoles) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{readableLabel}</CardTitle>
        </CardHeader>
        <CardBody>
          <p>This module is not recognized in the current CMNetwork configuration.</p>
          <Button themeColor="primary" onClick={() => navigate('/')}>Return Home</Button>
        </CardBody>
      </Card>
    )
  }

  const canView = !activeRole || allowedRoles.includes(activeRole)
  if (!canView) {
    const allowedRoleLabels = allowedRoles.map((role) => roleLabels[role]).join(', ')

    return (
      <Card>
        <CardHeader>
          <CardTitle>{readableLabel}</CardTitle>
        </CardHeader>
        <CardBody>
          <p>
            This module is available to {allowedRoleLabels}. Switch to one of those roles to continue.
          </p>
          <div className="quick-actions">
            <Button themeColor="primary" onClick={() => navigate(roleDashboardPath(allowedRoles[0]))}>
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate('/')}>Return Home</Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <section className="page-fade-in">
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface)',
          padding: '1.25rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <p style={{ margin: '0 0 0.35rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
          {activeRole ? `${roleLabels[activeRole]} workspace` : 'Module workspace'}
        </p>
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>{readableLabel}</h1>
        <p style={{ margin: 0, color: 'var(--text)', maxWidth: '72ch' }}>
          This route is configured for live backend data only. Static placeholder module cards are removed.
        </p>
      </div>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Live Data View</CardTitle>
        </CardHeader>
        <CardBody>
          {loadingMetrics && (
            <p className="card-subtitle" style={{ margin: 0 }}>Loading live metrics...</p>
          )}

          {!loadingMetrics && metricsError && (
            <p className="card-subtitle" style={{ margin: 0 }}>{metricsError}</p>
          )}

          {!loadingMetrics && !metricsError && metrics.length === 0 && (
            <p className="card-subtitle" style={{ margin: 0 }}>
              No live metrics are available for this role and module yet.
            </p>
          )}

          {!loadingMetrics && !metricsError && metrics.length > 0 && (
            <div className="dashboard-grid cols-3" style={{ marginTop: '0.25rem' }}>
              {metrics.slice(0, 6).map((metric) => (
                <div key={`${metric.title}-${metric.value}`} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.25rem', color: 'var(--muted)', fontSize: '0.8rem' }}>{metric.title}</p>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{metric.value}</div>
                  {metric.subtitle && <p className="card-subtitle" style={{ margin: '0.3rem 0 0' }}>{metric.subtitle}</p>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  )
}
