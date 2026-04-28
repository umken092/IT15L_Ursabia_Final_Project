import { Button } from '@progress/kendo-react-buttons'
import {
  Chart,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartSeries,
  ChartSeriesItem,
  ChartTitle,
} from '@progress/kendo-react-charts'
import { ProgressBar } from '@progress/kendo-react-progressbars'
import { Badge } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { chartData } from '../../services/mockDashboardData'

export const AccountantDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'accountant'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Pending Invoices">
          <div className="kpi-card">
            <div className="kpi-title">Awaiting Payment</div>
            <div className="kpi-value">18</div>
            <p className="kpi-subtitle">Worth PHP 1.24M</p>
            <Badge themeColor="warning" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Action Required
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Unreconciled Items">
          <div className="kpi-card">
            <div className="kpi-title">Pending Review</div>
            <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>9</div>
            <p className="kpi-subtitle">3 critical (&gt;30 days old)</p>
            <Badge themeColor="error" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
              Priority
            </Badge>
          </div>
        </DashboardCard>

        <DashboardCard title="Month-End Checklist">
          <div className="kpi-card">
            <div className="kpi-title">Completion Status</div>
            <ProgressBar value={68} style={{ marginBottom: '0.5rem' }} />
            <p className="kpi-subtitle">68% complete • 5 tasks remaining</p>
          </div>
        </DashboardCard>
      </div>

      <div className="quick-actions">
        <Button themeColor="primary">📝 New Journal Entry</Button>
        <Button themeColor="secondary">💳 Process Payments</Button>
        <Button>🏦 Bank Reconciliation</Button>
      </div>

      <DashboardCard title="Cash Position" subtitle="Last 6 months">
        <Chart>
          <ChartTitle text="Monthly Cash Trend" />
          <ChartCategoryAxis>
            <ChartCategoryAxisItem categories={chartData.months} />
          </ChartCategoryAxis>
          <ChartSeries>
            <ChartSeriesItem
              type="line"
              data={chartData.cashPosition}
              name="Cash"
              color="#1E3A5F"
            />
          </ChartSeries>
        </Chart>
      </DashboardCard>
    </section>
  )
}
