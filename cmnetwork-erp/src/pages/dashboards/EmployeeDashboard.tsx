import { Button } from '@progress/kendo-react-buttons'
import { Badge } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'

export const EmployeeDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'employee'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Latest Payslip">
          <div className="kpi-card">
            <div className="kpi-title">March 2026 Payroll</div>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Posted on April 26, 2026</p>
            <div className="kpi-value">PHP 48,250</div>
            <p className="kpi-subtitle">Net pay • Download available</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Expense Claims">
          <div className="kpi-card">
            <div className="kpi-title">Status Summary</div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>2</div>
            <p className="kpi-subtitle">Pending approval</p>
            <Badge themeColor="warning" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Action Needed
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Leave Balance">
          <div className="kpi-card">
            <div className="kpi-title">Fiscal Year 2026</div>
            <div className="kpi-value">8.5</div>
            <p className="kpi-subtitle">Days available • 1.5 pending</p>
            <Badge themeColor="success" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              On Track
            </Badge>
          </div>
        </DashboardCard>
      </div>

      <div className="quick-actions">
        <Button themeColor="primary" size="large">💼 Submit Expense Claim</Button>
        <Button>📥 Download Payslips</Button>
        <Button>🗓️ Request Leave</Button>
      </div>
    </section>
  )
}
