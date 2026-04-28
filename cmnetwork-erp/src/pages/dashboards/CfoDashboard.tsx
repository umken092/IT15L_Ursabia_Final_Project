import { Button } from '@progress/kendo-react-buttons'
import {
  Chart,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartLegend,
  ChartSeries,
  ChartSeriesItem,
  ChartTitle,
} from '@progress/kendo-react-charts'
import { Badge } from '@progress/kendo-react-indicators'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { chartData, pendingApprovals } from '../../services/mockDashboardData'

export const CfoDashboard = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const currentRole = selectedRole || user?.role || 'cfo'

  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} – {roleLabels[currentRole]} Command Center
        </h1>
      </div>

      <div className="dashboard-grid cols-3">
        <DashboardCard title="Total Revenue (MTD)">
          <div className="kpi-with-arrow">
            <div>
              <div className="kpi-title">This Month</div>
              <div className="kpi-value">₱5.92M</div>
            </div>
            <span className="drill-arrow">→</span>
          </div>
          <p className="kpi-subtitle">+2.3% vs last month</p>
        </DashboardCard>

        <DashboardCard title="Total Expenses (MTD)">
          <div className="kpi-with-arrow">
            <div>
              <div className="kpi-title">This Month</div>
              <div className="kpi-value">₱4.07M</div>
            </div>
            <span className="drill-arrow">→</span>
          </div>
          <p className="kpi-subtitle">-1.2% vs last month</p>
        </DashboardCard>

        <DashboardCard title="Net Income">
          <div className="kpi-with-arrow">
            <div>
              <div className="kpi-title">This Month</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>₱1.85M</div>
            </div>
            <span className="drill-arrow">→</span>
          </div>
          <p className="kpi-subtitle">+5.7% vs last month</p>
        </DashboardCard>
      </div>

      <DashboardCard title="Approvals Inbox" subtitle={`${pendingApprovals.length} awaiting decision`}>
        <ul className="plain-list" style={{ marginBottom: '1rem' }}>
          {pendingApprovals.map((item) => (
            <li key={item.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Submitted by {item.owner}</div>
              <Badge themeColor="warning" style={{ width: 'fit-content', marginTop: '0.3rem', fontSize: '0.8rem' }}>
                {item.id}
              </Badge>
            </li>
          ))}
        </ul>
        <Button themeColor="primary" onClick={() => navigate('/module/approvals-inbox')}>
          Review All Approvals
        </Button>
      </DashboardCard>

      <DashboardCard title="Budget vs Actual - Company Level" subtitle="6-Month Performance">
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
