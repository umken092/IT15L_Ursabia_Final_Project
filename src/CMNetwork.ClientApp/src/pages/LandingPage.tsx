import { Button } from '@progress/kendo-react-buttons'
import { Navigate, useNavigate } from 'react-router-dom'
import { roleDashboardPath } from '../types/auth'
import { useAuthStore } from '../store/authStore'

const featureCards = [
  {
    id: 'lag',
    icon: 'grid',
    title: 'Eliminate Reconciliation Lag',
    description:
      'Auto-match entries and surface variances before period close with AI-assisted exception queues that learn from every adjustment.',
    linkText: 'View architecture',
    large: true,
  },
  {
    id: 'compliance',
    icon: 'shield',
    title: 'Automate Global Compliance',
    description: 'Continuously align controls with IFRS, SOX, and jurisdiction-specific policy packs.',
  },
  {
    id: 'analytics',
    icon: 'pulse',
    title: 'Real-time Strategic Analytics',
    description: 'Deliver board-level forecasting from live ledgers, cash movement, and cost-center performance.',
  },
  {
    id: 'currency',
    icon: 'globe',
    title: 'Master Global Currency Flows',
    description: 'Consolidate entities with policy-safe FX logic and near-instant exposure insights.',
    tags: ['USD', 'EUR', 'GBP', 'JPY'],
  },
]

const solutionModules = [
  { icon: '📊', title: 'General Ledger', desc: 'Unified chart of accounts with automated journal posting.', tag: 'Finance' },
  { icon: '💼', title: 'Accounts Payable', desc: 'Vendor invoice intake, approvals, and payment runs.', tag: 'AP' },
  { icon: '🧾', title: 'Accounts Receivable', desc: 'Customer billing, collections, and aging intelligence.', tag: 'AR' },
  { icon: '📈', title: 'Financial Reporting', desc: 'Income statements, balance sheets, and cash-flow drilldowns.', tag: 'Reports' },
  { icon: '🛡️', title: 'Audit & Compliance', desc: 'Immutable audit trail, role policies, and SOC-ready controls.', tag: 'Governance' },
]

const trustLogos = ['Apex Dynamics', 'Meridian Financial', 'Northline Capital', 'Orion Logistics', 'VastGrid Energy', 'Helio Bank', 'Atlas Trade']

const footerColumns = [
  { heading: 'Product', links: ['Modules', 'Integrations', 'Roadmap', 'Changelog'] },
  { heading: 'Company', links: ['About', 'Customers', 'Careers', 'Contact'] },
  { heading: 'Legal', links: ['Terms', 'Privacy', 'Data Processing', 'Trust Center'] },
]

const IconTile = ({ type }: { type: 'grid' | 'shield' | 'pulse' | 'globe' }) => {
  if (type === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5 6v6c0 4.7 2.8 8.8 7 10 4.2-1.2 7-5.3 7-10V6l-7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m9.2 12 1.9 1.9 3.7-3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'pulse') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 13h4l2.2-4 3.2 8 2.5-6H21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'globe') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 3.5h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 13v7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const HeroDashboard = () => (
  <div className="hero-visual" aria-hidden="true">
    <div className="hv-toolbar">
      <div className="hv-dots">
        <i />
        <i />
        <i />
      </div>
      <div className="hv-search">cmnetwork.app / dashboard</div>
    </div>

    <div className="hv-grid">
      <div className="hv-card">
        <div className="hv-label">Cash Position</div>
        <div className="hv-value">$4.82M</div>
        <div className="hv-delta">▲ 12.4% vs last quarter</div>
      </div>
      <div className="hv-card">
        <div className="hv-label">Forecast Confidence</div>
        <div className="hv-value">97.4%</div>
        <div className="hv-delta">▲ 2.1 pts week-over-week</div>
      </div>
      <div className="hv-card hv-card-wide">
        <div>
          <div className="hv-label">Operating Cash Flow</div>
          <svg className="hv-chart" viewBox="0 0 320 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hv-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 60 L40 50 L80 55 L120 38 L160 42 L200 28 L240 32 L280 18 L320 22 L320 80 L0 80 Z"
              fill="url(#hv-area)"
            />
            <path
              d="M0 60 L40 50 L80 55 L120 38 L160 42 L200 28 L240 32 L280 18 L320 22"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="hv-legend">
          <div><i style={{ background: '#60a5fa' }} />Inflow</div>
          <div><i style={{ background: '#06b6d4' }} />Outflow</div>
          <div><i style={{ background: '#22c55e' }} />Net</div>
        </div>
      </div>
    </div>

    <div className="hv-statusbar">
      <span>Period: April 2026</span>
      <span className="hv-status-pill" data-tooltip="All CMNetwork ERP services are operating normally. No incidents reported.">All systems normal</span>
    </div>

    <div className="hv-floating">
      <div className="hv-f-title">Reconciliation closed</div>
      <div className="hv-f-value">418 entries matched</div>
      <div className="hv-f-foot">▲ 0 exceptions remaining</div>
    </div>
  </div>
)

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
            <p>Institutional Finance Cloud</p>
          </div>
        </div>

        <nav className="landing-nav-actions">
          <a href="#features">Platform</a>
          <a href="#solutions">Solutions</a>
          <a href="#trusted">Customers</a>
          <a href="#infrastructure">Trust</a>
          <button type="button" className="nav-login-link" onClick={() => navigate('/login')}>
            Sign in
          </button>
          <button type="button" className="nav-cta-link" onClick={() => navigate('/login')}>
            Request demo
          </button>
        </nav>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="kicker-dot" />
            New · AI-assisted close engine
          </span>
          <h1>
            The financial command layer for{' '}
            <span className="gradient-text">modern enterprises</span>
          </h1>
          <p className="hero-sub">
            One unified ERP platform for close, compliance, treasury, and strategic forecasting —
            built for multi-entity scale and executive accountability.
          </p>
          <div className="hero-cta-row">
            <Button themeColor="primary" size="large" onClick={() => navigate('/login')}>
              Request demo
            </Button>
            <Button fillMode="outline" size="large" onClick={() => navigate('/login')}>
              Explore platform
            </Button>
          </div>
          <div className="hero-trust-line">
            <div className="hero-avatars">
              <span>JD</span>
              <span>MR</span>
              <span>KP</span>
              <span>+</span>
            </div>
            <span>Trusted by 1,200+ finance teams worldwide</span>
          </div>
        </div>

        <HeroDashboard />
      </section>

      <section className="logo-strip">
        <div className="logo-strip-label">Trusted by industry leaders</div>
        <div className="logo-strip-track">
          {trustLogos.slice(0, 5).map((name) => (
            <div key={name} className="logo-chip">{name}</div>
          ))}
        </div>
      </section>

      <section id="features" className="landing-section features-section">
        <div className="section-head">
          <span className="section-eyebrow">Platform</span>
          <h2>Elevate every layer of your financial operations</h2>
          <p>Precision workflows designed for multi-entity scale and executive accountability.</p>
        </div>
        <div className="feature-grid">
          {featureCards.map((card) => (
            <article key={card.id} className={`feature-glass-card ${card.large ? 'feature-large' : ''}`}>
              <div className="feature-top-row">
                <div className="feature-icon-shell">
                  <IconTile type={card.icon as 'grid' | 'shield' | 'pulse' | 'globe'} />
                </div>
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {card.linkText && <a href="#infrastructure">{card.linkText}</a>}
              {card.tags && (
                <div className="currency-tags" aria-label="Supported currencies">
                  {card.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="solutions" className="landing-section solutions-section">
        <div className="section-head">
          <span className="section-eyebrow">Solutions</span>
          <h2>One platform. Every finance workflow.</h2>
          <p>Modular suites for every team — unified by a single source of truth.</p>
        </div>
        {solutionModules.map((mod) => (
          <article key={mod.title} className="solution-card">
            <div className="sol-icon">{mod.icon}</div>
            <div className="sol-body">
              <strong>{mod.title}</strong>
              <span>{mod.desc}</span>
            </div>
            <span className="sol-tag">{mod.tag}</span>
          </article>
        ))}
      </section>

      <section id="trusted" className="landing-section trust-section">
        <div className="section-head">
          <span className="section-eyebrow">Customers</span>
          <h2>Powering finance teams at industry leaders</h2>
        </div>
        <div className="logo-marquee-wrap">
          <button type="button" className="marquee-arrow" aria-label="Previous logos">‹</button>
          <div className="logo-marquee-track">
            {[...trustLogos, ...trustLogos].map((name, index) => (
              <div key={`${name}-${index}`} className="logo-chip">{name}</div>
            ))}
          </div>
          <button type="button" className="marquee-arrow" aria-label="Next logos">›</button>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="testimonial-card">
          <div className="quote-mark">“</div>
          <blockquote>
            CMNetwork compressed our month-end close from 11 days to 3. Our auditors now have
            real-time visibility, and our CFO finally trusts every number on the deck.
          </blockquote>
          <div className="author">
            <strong>Patricia Alvarez</strong>
            <span>VP Finance, Meridian Financial</span>
          </div>
        </div>
      </section>

      <section id="infrastructure" className="landing-section">
        <div className="infra-section">
          <div className="infra-visual" aria-hidden="true">
            <div className="map-dot dot-1" />
            <div className="map-dot dot-2" />
            <div className="map-dot dot-3" />
            <div className="map-dot dot-4" />
            <div className="map-dot dot-5" />
            <div className="map-line line-1" />
            <div className="map-line line-2" />
            <div className="map-line line-3" />
            <span className="map-label">Global Financial Mission Control</span>
          </div>
          <div className="infra-copy">
            <span className="hero-kicker">
              <span className="kicker-dot" />
              Trust & Infrastructure
            </span>
            <h2>Institutional-grade infrastructure</h2>
            <p>
              Operate with audited resilience, transparent governance controls, and real-time
              systems telemetry across every subsidiary.
            </p>
            <div className="metric-grid">
              <div>
                <strong>99.99%</strong>
                <span>Uptime SLA</span>
              </div>
              <div>
                <strong>$500B+</strong>
                <span>Managed annually</span>
              </div>
              <div>
                <strong>70+</strong>
                <span>Regulatory regions</span>
              </div>
              <div>
                <strong>&lt; 90s</strong>
                <span>Global consolidation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="final-cta">
          <span className="section-eyebrow">Get started</span>
          <h2>Ready to standardize your operations?</h2>
          <p>Unify finance, strengthen controls, and accelerate executive decision velocity.</p>
          <Button themeColor="primary" size="large" onClick={() => navigate('/login')}>
            Request demo
          </Button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand">
          <img src="/CMN.png" alt="CMNetwork logo" className="brand-logo" />
          <div>
            <strong>CMNetwork</strong>
            <p>Institutional finance platform built for high-trust operations.</p>
          </div>
        </div>
        {footerColumns.map((column) => (
          <div key={column.heading}>
            <h4>{column.heading}</h4>
            {column.links.map((link) => (
              <button key={link} type="button" className="footer-link-button">
                {link}
              </button>
            ))}
          </div>
        ))}
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CMNetwork, Inc. All rights reserved.</span>
          <span>SOC 2 Type II · ISO 27001 · GDPR</span>
        </div>
      </footer>
    </div>
  )
}
