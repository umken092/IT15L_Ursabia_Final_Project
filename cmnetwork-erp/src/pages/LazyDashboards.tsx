import { lazy, Suspense } from 'react'
import { Loader } from '@progress/kendo-react-indicators'

const SuperAdminDashboard = lazy(
  () =>
    import('./dashboards/SuperAdminDashboard').then((m) => ({
      default: m.SuperAdminDashboard,
    })),
)

const AccountantDashboard = lazy(
  () =>
    import('./dashboards/AccountantDashboard').then((m) => ({
      default: m.AccountantDashboard,
    })),
)

const FacultyAdminDashboard = lazy(
  () =>
    import('./dashboards/FacultyAdminDashboard').then((m) => ({
      default: m.FacultyAdminDashboard,
    })),
)

const EmployeeDashboard = lazy(
  () =>
    import('./dashboards/EmployeeDashboard').then((m) => ({
      default: m.EmployeeDashboard,
    })),
)

const AuthorizedViewerDashboard = lazy(
  () =>
    import('./dashboards/AuthorizedViewerDashboard').then((m) => ({
      default: m.AuthorizedViewerDashboard,
    })),
)

const AuditorDashboard = lazy(
  () =>
    import('./dashboards/AuditorDashboard').then((m) => ({
      default: m.AuditorDashboard,
    })),
)

const CfoDashboard = lazy(
  () =>
    import('./dashboards/CfoDashboard').then((m) => ({
      default: m.CfoDashboard,
    })),
)

const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <Loader type="infinite-spinner" />
      <p style={{ marginTop: '1rem' }}>Loading dashboard...</p>
    </div>
  </div>
)

export const LazyDashboards = {
  SuperAdminDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <SuperAdminDashboard />
    </Suspense>
  ),
  AccountantDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <AccountantDashboard />
    </Suspense>
  ),
  FacultyAdminDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <FacultyAdminDashboard />
    </Suspense>
  ),
  EmployeeDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <EmployeeDashboard />
    </Suspense>
  ),
  AuthorizedViewerDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <AuthorizedViewerDashboard />
    </Suspense>
  ),
  AuditorDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <AuditorDashboard />
    </Suspense>
  ),
  CfoDashboard: () => (
    <Suspense fallback={<LoadingFallback />}>
      <CfoDashboard />
    </Suspense>
  ),
}
