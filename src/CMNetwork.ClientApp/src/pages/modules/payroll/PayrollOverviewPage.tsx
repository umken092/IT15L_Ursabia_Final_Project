import type { PayPeriodDto, PayrollIntegrationCapabilitiesDto, PayrollRunDto } from './types'
import { formatCurrency, periodStatusLabel, runStatusLabel } from './types'

interface PayrollOverviewPageProps {
  periods: PayPeriodDto[]
  runs: PayrollRunDto[]
  capabilities: PayrollIntegrationCapabilitiesDto | null
}

export const PayrollOverviewPage = ({ periods, runs, capabilities }: PayrollOverviewPageProps) => {
  const openPeriods = periods.filter((period) => period.status !== 2).length
  const submittedRuns = runs.filter((run) => run.status === 2).length
  const postedRuns = runs.filter((run) => run.status === 6).length

  return (
    <article className="card">
      <header className="card-head">
        <h3 className="card-title">Payroll Overview</h3>
        <p className="card-subtitle">Live status from MonsterAsp payroll records</p>
      </header>

      <div className="card-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="card-subtitle" style={{ margin: 0 }}>Open Pay Periods</p>
          <p style={{ fontSize: '1.5rem', margin: '0.25rem 0 0 0' }}>{openPeriods}</p>
        </div>
        <div className="card">
          <p className="card-subtitle" style={{ margin: 0 }}>Submitted Runs</p>
          <p style={{ fontSize: '1.5rem', margin: '0.25rem 0 0 0' }}>{submittedRuns}</p>
        </div>
        <div className="card">
          <p className="card-subtitle" style={{ margin: 0 }}>Posted Runs</p>
          <p style={{ fontSize: '1.5rem', margin: '0.25rem 0 0 0' }}>{postedRuns}</p>
        </div>
      </div>

      <article className="card" style={{ marginBottom: '1rem' }}>
        <p className="card-subtitle" style={{ marginTop: 0 }}>
          Currency Scope: <strong>{capabilities?.currencyMode === 'PHP_ONLY' ? 'PHP only (MVP)' : capabilities?.currencyMode ?? 'PHP only (MVP)'}</strong>
        </p>
        <p className="card-subtitle" style={{ marginBottom: 0 }}>
          Future Integrations: Bank Export ({capabilities?.supportsBankFileExport ? 'Enabled' : 'Planned'}), BIR Export ({capabilities?.supportsBirExport ? 'Enabled' : 'Planned'}), Government Contribution Export ({capabilities?.supportsGovContributionExport ? 'Enabled' : 'Planned'}).
        </p>
      </article>

      <div style={{ overflowX: 'auto' }}>
        <table className="table-like" style={{ width: '100%', marginBottom: '0.75rem' }}>
          <thead>
            <tr>
              <th>Pay Period</th>
              <th>Status</th>
              <th>Cutoff</th>
              <th>Pay Date</th>
            </tr>
          </thead>
          <tbody>
            {periods.slice(0, 8).map((period) => (
              <tr key={period.id}>
                <td>{`${period.year}-${String(period.month).padStart(2, '0')}`}</td>
                <td>{periodStatusLabel(period.status)}</td>
                <td>{new Date(period.cutoffDate).toLocaleDateString()}</td>
                <td>{new Date(period.payDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table-like" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Run</th>
              <th>Pay Period</th>
              <th>Status</th>
              <th>Gross</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 8).map((run) => (
              <tr key={run.id}>
                <td>{run.id.slice(0, 8)}</td>
                <td>{run.payPeriodLabel}</td>
                <td>{runStatusLabel(run.status)}</td>
                <td>{formatCurrency(run.totalGrossPay)}</td>
                <td>{formatCurrency(run.totalNetPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
