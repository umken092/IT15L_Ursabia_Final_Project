import { Button } from '@progress/kendo-react-buttons'
import { ProgressBar } from '@progress/kendo-react-progressbars'
import { Badge } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { pendingApprovals } from '../../services/mockDashboardData'

export const FacultyAdminDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'faculty-admin'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-2">
        <DashboardCard title="Department Budget">
          <div className="kpi-card">
            <div className="kpi-title">Fiscal Year 2026</div>
            <ProgressBar value={74} style={{ marginBottom: '0.75rem' }} />
            <p className="kpi-subtitle">Spent: 74% • Available: 26%</p>
            <Badge themeColor="warning" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Watch Spending
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Pending Approvals" subtitle={`${pendingApprovals.length} awaiting action`}>
          <ul className="plain-list">
            {pendingApprovals.map((item) => (
              <li key={item.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.id}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>By: {item.owner}</div>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <div className="quick-actions">
        <Button themeColor="primary">📊 Department Report</Button>
        <Button themeColor="secondary">✅ Review Approvals</Button>
      </div>
    </section>
  )
}
