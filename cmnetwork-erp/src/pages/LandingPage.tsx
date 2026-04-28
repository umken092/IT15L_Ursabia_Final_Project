import { Button } from '@progress/kendo-react-buttons'
import { Card } from '@progress/kendo-react-layout'
import { Navigate, useNavigate } from 'react-router-dom'
import { roleDashboardPath } from '../types/auth'
import { useAuthStore } from '../store/authStore'

const features = [
  {
    icon: '📊',
    title: 'General Ledger',
    description: 'Real-time journal entries and account balancing.',
  },
  {
    icon: '💰',
    title: 'AP / AR',
    description: 'Monitor receivables, payables, and due-date risks.',
  },
  {
    icon: '📈',
    title: 'Budgeting',
    description: 'Track planned vs. actual with role-ready visibility.',
  },
  {
    icon: '📋',
    title: 'Reporting',
    description: 'Generate executive-ready summaries and KPI views.',
  },
  {
    icon: '✅',
    title: 'Compliance',
    description: 'Support policy controls and audit readiness workflows.',
  },
]

export const LandingPage = () => {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (isAuthenticated && user) {
    return <Navigate to={roleDashboardPath(user.role)} replace />
  }

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="brand-block">
          <img src="/CMN.png" alt="CMNetwork logo" className="brand-logo" />
          <div>
            <strong>CMNetwork</strong>
            <p>Accounting ERP</p>
          </div>
        </div>

        <div className="landing-nav-actions">
          <a href="#features">Features</a>
          <Button themeColor="primary" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </header>

      <section className="hero-panel">
        <img src="/CMN.png" alt="CMNetwork logo" className="hero-logo" />
        <h1>CMNetwork Accounting ERP - Streamline Your Financial Operations</h1>
        <p>
          General Ledger, AP/AR, Budgeting, Reporting, and Compliance - all in
          one place.
        </p>
        <Button themeColor="primary" size="large" onClick={() => navigate('/login')}>
          Get Started
        </Button>
      </section>

      <section id="features" className="features-grid">
        {features.map((feature) => (
          <Card key={feature.title} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </Card>
        ))}
      </section>

      <footer style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
        <p>© 2026 CMNetwork. All rights reserved.</p>
      </footer>
    </div>
  )
}
