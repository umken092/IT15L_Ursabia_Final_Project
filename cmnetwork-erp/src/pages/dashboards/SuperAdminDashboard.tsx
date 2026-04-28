import { Button } from '@progress/kendo-react-buttons'
import { Badge } from '@progress/kendo-react-indicators'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'

export const SuperAdminDashboard = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'super-admin'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Server Status">
          <div className="kpi-card">
            <div className="kpi-title">System Health</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>✓ Healthy</div>
            <p className="kpi-subtitle">All API services responding normally.</p>
            <Badge themeColor="success" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Active
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Active Users">
          <div className="kpi-card">
            <div className="kpi-title">Currently Online</div>
            <div className="kpi-value">248</div>
            <p className="kpi-subtitle">12 users currently online | 9 today</p>
            <Badge themeColor="primary" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              12 Active
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Last Backup">
          <div className="kpi-card">
            <div className="kpi-title">Daily Backup</div>
            <div className="kpi-value">02:00 AM</div>
            <p className="kpi-subtitle">Most recent backup completed successfully.</p>
            <Badge themeColor="success" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Successful
            </Badge>
          </div>
        </DashboardCard>
      </div>

      <div className="quick-actions">
        <Button themeColor="primary" onClick={() => navigate('/module/user-management')}>
          Add New User
        </Button>
        <Button onClick={() => navigate('/module/system-settings')}>
          Configure Fiscal Year
        </Button>
        <Button themeColor="primary" onClick={() => navigate('/module/user-management')}>
          Manage Users
        </Button>
        <Button themeColor="secondary" onClick={() => navigate('/module/system-settings')}>
          Security Policy
        </Button>
        <Button onClick={() => navigate('/module/system-settings')}>
          Backup & Restore
        </Button>
        <Button onClick={() => navigate('/module/system-settings')}>
          View Integrations
        </Button>
        <Button onClick={() => navigate('/module/system-settings')}>Audit Logs</Button>
      </div>
    </section>
  )
}
