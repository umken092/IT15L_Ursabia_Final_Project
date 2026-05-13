import { Button } from '@progress/kendo-react-buttons'
import type { PayPeriodDto } from './types'
import { periodStatusLabel } from './types'

interface CreatePeriodState {
  year: number
  month: number
  frequency: number
  cutoffDate: string
  payDate: string
}

interface PayPeriodManagementPageProps {
  periods: PayPeriodDto[]
  createPeriod: CreatePeriodState
  loading: boolean
  onCreatePeriodChange: (field: keyof CreatePeriodState, value: number | string) => void
  onCreatePeriod: () => Promise<void>
  onSelectPeriod: (id: string) => void
  selectedPeriodId: string
}

export const PayPeriodManagementPage = ({
  periods,
  createPeriod,
  loading,
  onCreatePeriodChange,
  onCreatePeriod,
  onSelectPeriod,
  selectedPeriodId,
}: PayPeriodManagementPageProps) => {
  return (
    <article className="card">
      <header className="card-head">
        <h3 className="card-title">Pay Period Management</h3>
        <p className="card-subtitle">Create and select payroll cutoffs from live data</p>
      </header>

      <div style={{ display: 'grid', gap: '0.65rem', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <input type="number" value={createPeriod.year} onChange={(e) => onCreatePeriodChange('year', Number(e.target.value))} />
        <input type="number" min={1} max={12} value={createPeriod.month} onChange={(e) => onCreatePeriodChange('month', Number(e.target.value))} />
        <select value={createPeriod.frequency} onChange={(e) => onCreatePeriodChange('frequency', Number(e.target.value))}>
          <option value={1}>Monthly</option>
          <option value={2}>SemiMonthly</option>
        </select>
        <input type="date" value={createPeriod.cutoffDate} onChange={(e) => onCreatePeriodChange('cutoffDate', e.target.value)} />
        <input type="date" value={createPeriod.payDate} onChange={(e) => onCreatePeriodChange('payDate', e.target.value)} />
      </div>

      <div style={{ marginTop: '0.65rem' }}>
        <Button onClick={() => void onCreatePeriod()} disabled={loading}>Create Pay Period</Button>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table className="table-like" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Period</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Cutoff</th>
              <th>Pay Date</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr
                key={period.id}
                onClick={() => onSelectPeriod(period.id)}
                style={{ cursor: 'pointer', background: selectedPeriodId === period.id ? '#eff6ff' : undefined }}
              >
                <td>{`${period.year}-${String(period.month).padStart(2, '0')}`}</td>
                <td>{period.frequency === 2 ? 'SemiMonthly' : 'Monthly'}</td>
                <td>{periodStatusLabel(period.status)}</td>
                <td>{new Date(period.cutoffDate).toLocaleDateString()}</td>
                <td>{new Date(period.payDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
