import { Input } from '@progress/kendo-react-inputs'
import { Badge } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { recentAuditActivities } from '../../services/mockDashboardData'

export const AuditorDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'auditor'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <DashboardCard title="Anomaly Summary">
        <div className="kpi-card">
          <div className="kpi-title">High-Risk Transactions</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>3</div>
          <p className="kpi-subtitle">This month • Require investigation</p>
          <Badge themeColor="error" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
            ⚠️ Critical
          </Badge>
        </div>
      </DashboardCard>

      <DashboardCard title="Quick Audit Search">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Input placeholder="Search by transaction ID, user, or date" />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0' }}>
            💡 Tip: Use date range filter (e.g., "2026-04-01 to 2026-04-26")
          </p>
        </div>
      </DashboardCard>

      <DashboardCard title="Recent Audit Activities" subtitle="Last 10 changes">
        <ul className="plain-list">
          {recentAuditActivities.map((activity, idx) => (
            <li key={idx} style={{ padding: '0.75rem 0', borderBottom: idx < recentAuditActivities.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: '0.9rem' }}>🔍 {activity}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>Just now</div>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </section>
  )
}
