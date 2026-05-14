import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../../services/apiClient'
import { useAuthStore } from '../../../store/authStore'
import { useNotificationStore } from '../../../store/notificationStore'
import type { PayPeriodDto, PayrollIntegrationCapabilitiesDto, PayrollRunDto } from './types'
import { formatCurrency, periodStatusLabel, runStatusLabel } from './types'

interface TaxTableRow {
  id: string
  type: number
  year: number
  minIncome: number
  maxIncome: number | null
  rate: number
  description: string
}

const TAX_TYPE_LABELS: Record<number, string> = { 1: 'TRAIN', 2: 'SSS', 3: 'PhilHealth', 4: 'Pag-IBIG' }
const TAX_TYPES = [
  { value: 1, label: 'TRAIN (Income Tax)' },
  { value: 2, label: 'SSS' },
  { value: 3, label: 'PhilHealth' },
  { value: 4, label: 'Pag-IBIG' },
]

const TRAIN_DEFAULTS = [
  { min: 0, max: 20833, rate: 0, desc: 'TRAIN: ₱0 – ₱20,833/mo (tax-exempt)' },
  { min: 20833.01, max: 33333, rate: 0.15, desc: 'TRAIN: ₱20,833 – ₱33,333/mo (15%)' },
  { min: 33333.01, max: 66667, rate: 0.20, desc: 'TRAIN: ₱33,333 – ₱66,667/mo (20%)' },
  { min: 66667.01, max: 166667, rate: 0.25, desc: 'TRAIN: ₱66,667 – ₱166,667/mo (25%)' },
  { min: 166667.01, max: null, rate: 0.35, desc: 'TRAIN: Over ₱166,667/mo (35%)' },
]

interface PayrollOverviewPageProps {
  periods: PayPeriodDto[]
  runs: PayrollRunDto[]
  capabilities: PayrollIntegrationCapabilitiesDto | null
}

export const PayrollOverviewPage = ({ periods, runs, capabilities }: PayrollOverviewPageProps) => {
  const selectedRole = useAuthStore((s) => s.selectedRole)
  const pushToast = useNotificationStore((s) => s.push)
  const canViewTax = selectedRole === 'super-admin' || selectedRole === 'accountant' || selectedRole === 'cfo'
  const canCreateTax = selectedRole === 'super-admin'

  const [taxTables, setTaxTables] = useState<TaxTableRow[]>([])
  const [taxLoading, setTaxLoading] = useState(false)
  const [showTaxForm, setShowTaxForm] = useState(false)
  const [savingTax, setSavingTax] = useState(false)
  const [taxForm, setTaxForm] = useState({ type: 1, year: new Date().getFullYear(), minIncome: 0, maxIncome: '', rate: 0, description: '' })

  const loadTaxTables = useCallback(async () => {
    setTaxLoading(true)
    try {
      const res = await apiClient.get<TaxTableRow[]>('/payroll/tax-tables')
      setTaxTables(res.data)
    } catch {
      // silent – not critical
    } finally {
      setTaxLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canViewTax) void loadTaxTables()
  }, [canViewTax, loadTaxTables])

  const handleSeedTrain = async () => {
    const year = new Date().getFullYear()
    setSavingTax(true)
    try {
      for (const b of TRAIN_DEFAULTS) {
        await apiClient.post('/payroll/tax-tables', {
          type: 1, year,
          minIncome: b.min,
          maxIncome: b.max,
          rate: b.rate,
          description: b.desc,
          effectiveFrom: `${year}-01-01`,
          effectiveTo: `${year}-12-31`,
        })
      }
      // SSS, PhilHealth, Pag-IBIG flat rates
      for (const contrib of [
        { type: 2, rate: 0.045, desc: `SSS employee share ${year} (4.5%)` },
        { type: 3, rate: 0.025, desc: `PhilHealth employee share ${year} (2.5%)` },
        { type: 4, rate: 0.02,  desc: `Pag-IBIG employee share ${year} (2%)` },
      ]) {
        await apiClient.post('/payroll/tax-tables', {
          type: contrib.type, year,
          minIncome: 0, maxIncome: null,
          rate: contrib.rate,
          description: contrib.desc,
          effectiveFrom: `${year}-01-01`,
          effectiveTo: `${year}-12-31`,
        })
      }
      pushToast('success', `Seeded all tax tables for ${year}. Try Calculate again.`)
      await loadTaxTables()
    } catch {
      pushToast('error', 'Failed to seed some tax tables. Check if they already exist for this year.')
    } finally {
      setSavingTax(false)
    }
  }

  const handleCreateTaxTable = async () => {
    setSavingTax(true)
    try {
      await apiClient.post('/payroll/tax-tables', {
        type: taxForm.type,
        year: taxForm.year,
        minIncome: taxForm.minIncome,
        maxIncome: taxForm.maxIncome === '' ? null : Number(taxForm.maxIncome),
        rate: taxForm.rate,
        description: taxForm.description,
        effectiveFrom: `${taxForm.year}-01-01`,
        effectiveTo: `${taxForm.year}-12-31`,
      })
      pushToast('success', 'Tax table entry created.')
      setShowTaxForm(false)
      setTaxForm({ type: 1, year: new Date().getFullYear(), minIncome: 0, maxIncome: '', rate: 0, description: '' })
      await loadTaxTables()
    } catch {
      pushToast('error', 'Failed to create tax table entry.')
    } finally {
      setSavingTax(false)
    }
  }

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

      {canViewTax && (
        <article className="card" style={{ marginTop: '1.25rem' }}>
          <header className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Tax Tables</h3>
              <p className="card-subtitle" style={{ margin: '0.25rem 0 0' }}>TRAIN, SSS, PhilHealth, Pag-IBIG brackets used during Calculate</p>
            </div>
            {canCreateTax && (
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => void handleSeedTrain()}
                  disabled={savingTax}
                  style={{ padding: '0.4rem 0.9rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  {savingTax ? 'Seeding…' : `Seed All (${new Date().getFullYear()})`}
                </button>
                <button
                  onClick={() => setShowTaxForm((v) => !v)}
                  style={{ padding: '0.4rem 0.9rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  {showTaxForm ? 'Cancel' : '+ Add Entry'}
                </button>
              </div>
            )}
          </header>

          {canCreateTax && showTaxForm && (
            <div style={{ padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem', margin: '0.75rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Type</label>
                <select value={taxForm.type} onChange={(e) => setTaxForm((f) => ({ ...f, type: Number(e.target.value) }))} style={{ width: '100%', height: '2rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}>
                  {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Year</label>
                <input type="number" value={taxForm.year} onChange={(e) => setTaxForm((f) => ({ ...f, year: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Min Income (₱)</label>
                <input type="number" value={taxForm.minIncome} onChange={(e) => setTaxForm((f) => ({ ...f, minIncome: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Max Income (₱, blank = no cap)</label>
                <input type="number" value={taxForm.maxIncome} onChange={(e) => setTaxForm((f) => ({ ...f, maxIncome: e.target.value }))} placeholder="No cap" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Rate (0.15 = 15%)</label>
                <input type="number" step="0.001" value={taxForm.rate} onChange={(e) => setTaxForm((f) => ({ ...f, rate: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Description</label>
                <input type="text" value={taxForm.description} onChange={(e) => setTaxForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. TRAIN bracket 1" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button onClick={() => void handleCreateTaxTable()} disabled={savingTax} style={{ padding: '0.4rem 1rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  {savingTax ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table className="table-like" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Year</th>
                  <th style={{ textAlign: 'right' }}>Min Income</th>
                  <th style={{ textAlign: 'right' }}>Max Income</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {taxLoading && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>Loading…</td></tr>
                )}
                {!taxLoading && taxTables.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#dc2626', padding: '1rem' }}>No tax tables found. Click "Seed All" to create the default TRAIN/SSS/PhilHealth/Pag-IBIG brackets.</td></tr>
                )}
                {taxTables.map((row) => (
                  <tr key={row.id}>
                    <td><span style={{ fontWeight: 600, color: '#0f766e' }}>{TAX_TYPE_LABELS[row.type] ?? row.type}</span></td>
                    <td>{row.year}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.minIncome)}</td>
                    <td style={{ textAlign: 'right' }}>{row.maxIncome != null ? formatCurrency(row.maxIncome) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{(row.rate * 100).toFixed(2)}%</td>
                    <td style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </article>
  )
}
