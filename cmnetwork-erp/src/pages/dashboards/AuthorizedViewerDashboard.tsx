import {
  Chart,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartLegend,
  ChartSeries,
  ChartSeriesItem,
  ChartTitle,
} from '@progress/kendo-react-charts'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { chartData } from '../../services/mockDashboardData'

export const AuthorizedViewerDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'authorized-viewer'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Total Revenue (MTD)">
          <div className="kpi-card">
            <div className="kpi-title">This Month</div>
            <div className="kpi-value">₱5.92M</div>
            <p className="kpi-subtitle">+2.3% vs last month</p>
          </div>
        </DashboardCard>
        <DashboardCard title="Total Expenses (MTD)">
          <div className="kpi-card">
            <div className="kpi-title">This Month</div>
            <div className="kpi-value">₱4.07M</div>
            <p className="kpi-subtitle">-1.2% vs last month</p>
          </div>
        </DashboardCard>
        <DashboardCard title="Net Income">
          <div className="kpi-card">
            <div className="kpi-title">This Month</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>₱1.85M</div>
            <p className="kpi-subtitle">+5.7% vs last month</p>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Budget vs Actual - Company Level" subtitle="6-Month Comparison">
        <Chart>
          <ChartTitle text="Budget vs Actual Spending" />
          <ChartLegend position="bottom" />
          <ChartCategoryAxis>
            <ChartCategoryAxisItem categories={chartData.months} />
          </ChartCategoryAxis>
          <ChartSeries>
            <ChartSeriesItem
              type="column"
              data={chartData.budgetVsActualBudget}
              name="Budget"
              color="#2E7D32"
            />
            <ChartSeriesItem
              type="column"
              data={chartData.budgetVsActualActual}
              name="Actual"
              color="#1E3A5F"
            />
          </ChartSeries>
        </Chart>
      </DashboardCard>
    </section>
  )
}
