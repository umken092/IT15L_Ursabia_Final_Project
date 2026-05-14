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
  effectiveFrom: string
  effectiveTo: string | null
}

const TAX_TYPE_LABELS: Record<number, string> = { 1: 'TRAIN', 2: 'SSS', 3: 'PhilHealth', 4: 'Pag-IBIG' }
const TAX_TYPES = [
  { value: 1, label: 'TRAIN (Income Tax)' },
  { value: 2, label: 'SSS' },
  { value: 3, label: 'PhilHealth' },
  { value: 4, label: 'Pag-IBIG' },
]

const emptyForm = () => ({
  type: 1,
  year: new Date().getFullYear(),
  minIncome: 0,
  maxIncome: '',
  rate: 0,
  description: '',
  effectiveFrom: `${new Date().getFullYear()}-01-01`,
  effectiveTo: `${new Date().getFullYear()}-12-31`,
})

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRow, setEditingRow] = useState<TaxTableRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())

  const loadTaxTables = useCallback(async () => {
    setTaxLoading(true)
    try {
      const res = await apiClient.get<TaxTableRow[]>('/payroll/tax-tables')
      setTaxTables(res.data)
    } catch {
      // silent
    } finally {
      setTaxLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canViewTax) void loadTaxTables()
  }, [canViewTax, loadTaxTables])

  const handleAdd = async () => {
    setSaving(true)
    try {
      await apiClient.post('/payroll/tax-tables', {
        type: form.type,
        year: form.year,
        minIncome: form.minIncome,
        maxIncome: form.maxIncome === '' ? null : Number(form.maxIncome),
        rate: form.rate,
        description: form.description,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      })
      pushToast('success', 'Tax table entry created.')
      setShowAddForm(false)
      setForm(emptyForm())
      await loadTaxTables()
    } catch {
      pushToast('error', 'Failed to create entry.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row: TaxTableRow) => {
    setEditingRow(row)
    setForm({
      type: row.type,
      year: row.year,
      minIncome: row.minIncome,
      maxIncome: row.maxIncome == null ? '' : String(row.maxIncome),
      rate: row.rate,
      description: row.description,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo ?? '',
    })
    setShowAddForm(false)
  }

  const handleUpdate = async () => {
    if (!editingRow) return
    setSaving(true)
    try {
      await apiClient.put(`/payroll/tax-tables/${editingRow.id}`, {
        type: form.type,
        year: form.year,
        minIncome: form.minIncome,
        maxIncome: form.maxIncome === '' ? null : Number(form.maxIncome),
        rate: form.rate,
        description: form.description,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      })
      pushToast('success', 'Tax table entry updated.')
      setEditingRow(null)
      setForm(emptyForm())
      await loadTaxTables()
    } catch {
      pushToast('error', 'Failed to update entry.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tax table entry? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await apiClient.delete(`/payroll/tax-tables/${id}`)
      pushToast('success', 'Entry deleted.')
      setTaxTables((prev) => prev.filter((r) => r.id !== id))
    } catch {
      pushToast('error', 'Failed to delete entry.')
    } finally {
      setDeletingId(null)
    }
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setForm(emptyForm())
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
            {canCreateTax && !editingRow && (
              <button
                onClick={() => { setShowAddForm((v) => !v); setEditingRow(null) }}
                style={{ padding: '0.4rem 0.9rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}
              >
                {showAddForm ? 'Cancel' : '+ Add Entry'}
              </button>
            )}
          </header>

          {/* Add form */}
          {canCreateTax && showAddForm && !editingRow && (
            <div style={{ padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem', margin: '0.75rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value) }))} style={{ width: '100%', height: '2rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}>
                  {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Year</label>
                <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Min Income (₱)</label>
                <input type="number" value={form.minIncome} onChange={(e) => setForm((f) => ({ ...f, minIncome: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Max Income (₱, blank = no cap)</label>
                <input type="number" value={form.maxIncome} onChange={(e) => setForm((f) => ({ ...f, maxIncome: e.target.value }))} placeholder="No cap" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Rate (0.15 = 15%)</label>
                <input type="number" step="0.001" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. TRAIN bracket 1" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => void handleAdd()} disabled={saving} style={{ padding: '0.4rem 1rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  {saving ? 'Saving…' : 'Save Entry'}
                </button>
                <button onClick={() => { setShowAddForm(false); setForm(emptyForm()) }} style={{ padding: '0.4rem 0.75rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Edit form */}
          {canCreateTax && editingRow && (
            <div style={{ padding: '0.75rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.375rem', margin: '0.75rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div style={{ gridColumn: '1 / -1', fontWeight: 600, fontSize: '0.875rem', color: '#92400e' }}>Editing entry — make changes then save</div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value) }))} style={{ width: '100%', height: '2rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}>
                  {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Year</label>
                <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Min Income (₱)</label>
                <input type="number" value={form.minIncome} onChange={(e) => setForm((f) => ({ ...f, minIncome: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Max Income (₱, blank = no cap)</label>
                <input type="number" value={form.maxIncome} onChange={(e) => setForm((f) => ({ ...f, maxIncome: e.target.value }))} placeholder="No cap" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Rate (0.15 = 15%)</label>
                <input type="number" step="0.001" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => void handleUpdate()} disabled={saving} style={{ padding: '0.4rem 1rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  {saving ? 'Saving…' : 'Update Entry'}
                </button>
                <button onClick={cancelEdit} style={{ padding: '0.4rem 0.75rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
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
                  {canCreateTax && <th style={{ width: '1%' }}></th>}
                </tr>
              </thead>
              <tbody>
                {taxLoading && (
                  <tr><td colSpan={canCreateTax ? 7 : 6} style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>Loading…</td></tr>
                )}
                {!taxLoading && taxTables.length === 0 && (
                  <tr><td colSpan={canCreateTax ? 7 : 6} style={{ textAlign: 'center', color: '#dc2626', padding: '1rem' }}>No tax tables found. Use "+ Add Entry" to create brackets.</td></tr>
                )}
                {taxTables.map((row) => (
                  <tr key={row.id} style={editingRow?.id === row.id ? { background: '#fffbeb' } : undefined}>
                    <td><span style={{ fontWeight: 600, color: '#0f766e' }}>{TAX_TYPE_LABELS[row.type] ?? row.type}</span></td>
                    <td>{row.year}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.minIncome)}</td>
                    <td style={{ textAlign: 'right' }}>{row.maxIncome != null ? formatCurrency(row.maxIncome) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{(row.rate * 100).toFixed(2)}%</td>
                    <td style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{row.description}</td>
                    {canCreateTax && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleEdit(row)}
                          style={{ marginRight: '0.25rem', padding: '0.2rem 0.6rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                        >Edit</button>
                        <button
                          onClick={() => void handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          style={{ padding: '0.2rem 0.6rem', background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem' }}
                        >{deletingId === row.id ? '…' : 'Delete'}</button>
                      </td>
                    )}
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
