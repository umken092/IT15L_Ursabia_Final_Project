import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { useNotificationStore } from '../../store/notificationStore'
import { generalLedgerService } from '../../services/accountantService'

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodStatus = 'open' | 'closed' | 'future'

interface FiscalPeriod {
  id: string
  number: number
  name: string
  startDate: string
  endDate: string
  status: PeriodStatus
  isCurrent: boolean
}

interface FiscalYear {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'active' | 'closed'
  periods: FiscalPeriod[]
}

// ─── API types ────────────────────────────────────────────────────────────────

interface ApiFiscalPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  isClosed: boolean
  createdUtc: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const transformToFiscalYears = (apiPeriods: ApiFiscalPeriod[]): FiscalYear[] => {
  const now = new Date()

  // Periods spanning a whole year (Jan 1 → Dec 31) are fiscal-year headers
  const yearHeaders = apiPeriods.filter((p) => {
    const s = new Date(p.startDate)
    const e = new Date(p.endDate)
    return s.getMonth() === 0 && s.getDate() === 1 && e.getMonth() === 11 && e.getDate() >= 28
  })

  // Monthly periods: name matches YYYY-MM
  const monthlyPeriods = apiPeriods.filter((p) => /^\d{4}-\d{2}$/.test(p.name))

  // Group monthly periods by calendar year
  const byYear = new Map<number, ApiFiscalPeriod[]>()
  for (const p of monthlyPeriods) {
    const yr = new Date(p.startDate).getFullYear()
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push(p)
  }

  // Collect all years
  const years = new Set<number>()
  for (const p of yearHeaders) years.add(new Date(p.startDate).getFullYear())
  for (const y of byYear.keys()) years.add(y)

  return [...years]
    .sort((a, b) => b - a)
    .map((year) => {
      const header = yearHeaders.find((p) => new Date(p.startDate).getFullYear() === year)
      const months = (byYear.get(year) ?? []).sort((a, b) => a.startDate.localeCompare(b.startDate))
      const isClosed = header ? header.isClosed : months.length > 0 && months.every((p) => p.isClosed)

      const periods: FiscalPeriod[] = months.map((p) => {
        const start = new Date(p.startDate)
        const end = new Date(p.endDate)
        const isCurrent = start <= now && now <= end
        let status: PeriodStatus
        if (p.isClosed) {
          status = 'closed'
        } else if (isCurrent) {
          status = 'open'
        } else if (end < now) {
          status = 'open' // past but not explicitly closed
        } else {
          status = 'future'
        }
        return {
          id: p.id,
          number: start.getMonth() + 1,
          name: start.toLocaleString('default', { month: 'long' }),
          startDate: p.startDate,
          endDate: p.endDate,
          status,
          isCurrent,
        }
      })

      return {
        id: header ? header.id : `fy-${year}`,
        label: header ? (header.name.startsWith('FY') ? header.name : `FY ${year}`) : `FY ${year}`,
        startDate: header ? header.startDate : `${year}-01-01`,
        endDate: header ? header.endDate : `${year}-12-31`,
        status: isClosed ? ('closed' as const) : ('active' as const),
        periods,
      }
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusClass: Record<PeriodStatus, string> = {
  open: 'fp-s-open',
  closed: 'fp-s-closed',
  future: 'fp-s-future',
}

const statusLabel: Record<PeriodStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  future: 'Future',
}

const nextYearLabel = (years: FiscalYear[]) => {
  const labels = years.map((y) => y.label)
  const maxYear = labels.reduce((acc, l) => {
    const m = /(\d{4})/.exec(l)
    const y = m ? Number.parseInt(m[1], 10) : 0
    return Math.max(acc, y)
  }, 0)
  return `FY ${maxYear + 1}`
}

// Period status updater helpers (extracted to avoid deep nesting)
const updateSetCurrent =
  (yearId: string, periodId: string) =>
  (prev: FiscalYear[]): FiscalYear[] =>
    prev.map((y) => {
      if (y.id !== yearId) return y
      return { ...y, periods: y.periods.map((p) => ({ ...p, isCurrent: p.id === periodId })) }
    })

export const FiscalPeriodsModule = () => {
  const pushToast = useNotificationStore((state) => state.push)

  const [years, setYears] = useState<FiscalYear[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedYear, setExpandedYear] = useState<string | null>(null)

  // Create fiscal year dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newYearLabel, setNewYearLabel] = useState('')
  const [newYearStart, setNewYearStart] = useState('')
  const [newYearEnd, setNewYearEnd] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Load live data ─────────────────────────────────────────────────────

  const loadFiscalData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await generalLedgerService.getFiscalPeriods()
      const apiPeriods = (res.data ?? []) as ApiFiscalPeriod[]
      const transformed = transformToFiscalYears(apiPeriods)
      setYears(transformed)
      const first = transformed.find((y) => y.status === 'active') ?? transformed[0]
      if (first) setExpandedYear((prev) => prev ?? first.id)
    } catch {
      pushToast('error', 'Failed to load fiscal periods from the server.')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    void loadFiscalData()
  }, [loadFiscalData])

  // ── Derived ─────────────────────────────────────────────────────────────

  const activeYear = years.find((y) => y.status === 'active') ?? null
  const currentPeriod =
    activeYear?.periods.find((p) => p.isCurrent) ??
    activeYear?.periods.find((p) => p.status === 'open') ??
    null

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTogglePeriod = async (yearId: string, periodId: string) => {
    const year = years.find((y) => y.id === yearId)
    const period = year?.periods.find((p) => p.id === periodId)
    if (!period || period.status === 'future') return
    try {
      if (period.status === 'open') {
        await generalLedgerService.closeFiscalPeriod(periodId)
      } else {
        await generalLedgerService.reopenFiscalPeriod(periodId)
      }
      await loadFiscalData()
    } catch {
      pushToast('error', 'Failed to update period status.')
    }
  }

  const handleSetCurrent = (yearId: string, periodId: string) => {
    setYears(updateSetCurrent(yearId, periodId))
    pushToast('success', 'Current period updated.')
  }

  const handleCloseYear = async (yearId: string) => {
    const year = years.find((y) => y.id === yearId)
    if (!year) return
    try {
      const openPeriods = year.periods.filter((p) => p.status === 'open')
      await Promise.all(openPeriods.map((p) => generalLedgerService.closeFiscalPeriod(p.id)))
      await loadFiscalData()
      pushToast('success', 'Fiscal year closed.')
    } catch {
      pushToast('error', 'Failed to close fiscal year.')
    }
  }

  const handleCreateYear = async () => {
    if (!newYearLabel.trim() || !newYearStart || !newYearEnd) return
    setSaving(true)
    try {
      const label = newYearLabel.trim()
      const m = /(\d{4})/.exec(label)
      const yr = m ? Number.parseInt(m[1], 10) : new Date(newYearStart).getFullYear()
      for (let month = 1; month <= 12; month++) {
        const start = new Date(yr, month - 1, 1)
        const end = new Date(yr, month, 0)
        await generalLedgerService.createFiscalPeriod({
          name: `${yr}-${String(month).padStart(2, '0')}`,
          startDate: fmtDate(start),
          endDate: fmtDate(end),
        })
      }
      await loadFiscalData()
      setShowCreateDialog(false)
      setNewYearLabel('')
      setNewYearStart('')
      setNewYearEnd('')
      pushToast('success', `${label} created with 12 periods.`)
    } catch {
      pushToast('error', 'Failed to create fiscal year. Periods may already exist for this year.')
    } finally {
      setSaving(false)
    }
  }

  const openCreateDialog = () => {
    const suggested = nextYearLabel(years)
    setNewYearLabel(suggested)
    const m = /(\d{4})/.exec(suggested)
    const yr = m ? Number.parseInt(m[1], 10) : new Date().getFullYear() + 1
    setNewYearStart(`${yr}-01-01`)
    setNewYearEnd(`${yr}-12-31`)
    setShowCreateDialog(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fp-scene">
      {/* Page header */}
      <div className="fp-page-header">
        <div>
          <h1 className="fp-page-title">Fiscal Periods</h1>
          <p className="fp-page-sub">
            Manage fiscal years, open or close individual periods, and define the active period.
          </p>
        </div>
        <button className="fp-btn-primary" onClick={openCreateDialog}>
          + New Fiscal Year
        </button>
      </div>

      {/* Current period banner */}
      {currentPeriod && activeYear && (
        <div className="fp-current-banner">
          <span className="fp-banner-dot" />
          <span className="fp-banner-text">
            {'Current period: '}
            <strong>
              {currentPeriod.name}{' '}{activeYear.label}{' '}({currentPeriod.startDate}
              {' – '}
              {currentPeriod.endDate})
            </strong>
          </span>
        </div>
      )}

      {/* Fiscal years */}
      {years.map((year) => (
        <div key={year.id} className={`fp-card ${year.status === 'closed' ? 'fp-card-closed' : ''}`}>
          {/* Year header */}
          <div className="fp-year-header">
            <div className="fp-year-left">
              <button
                className="fp-expand-btn"
                aria-expanded={expandedYear === year.id}
                onClick={() => setExpandedYear((c) => (c === year.id ? null : year.id))}
              >
                <span className={`fp-chevron ${expandedYear === year.id ? 'fp-chevron-open' : ''}`}>
                  ›
                </span>
              </button>
              <div>
                <span className="fp-year-label">{year.label}</span>
                <span className="fp-year-range">
                  {year.startDate} – {year.endDate}
                </span>
              </div>
            </div>
            <div className="fp-year-right">
              <span className={`fp-year-badge ${year.status === 'active' ? 'fp-yb-active' : 'fp-yb-closed'}`}>
                {year.status === 'active' ? 'Active' : 'Closed'}
              </span>
              {year.status === 'active' && (
                <button
                  className="fp-btn-danger-sm"
                  onClick={() => void handleCloseYear(year.id)}
                >
                  Close Year
                </button>
              )}
            </div>
          </div>

          {/* Periods grid */}
          {expandedYear === year.id && (
            <div className="fp-periods-grid">
              {year.periods.map((period) => (
                <div
                  key={period.id}
                  className={`fp-period-card ${period.isCurrent ? 'fp-period-current' : ''} fp-period-${period.status}`}
                >
                  {period.isCurrent && <span className="fp-current-tag">Current</span>}
                  <div className="fp-period-header">
                    <span className="fp-period-number">P{period.number}</span>
                    <span className={`fp-period-badge ${statusClass[period.status]}`}>
                      {statusLabel[period.status]}
                    </span>
                  </div>
                  <div className="fp-period-name">{period.name}</div>
                  <div className="fp-period-range">
                    {period.startDate}
                    <br />
                    {period.endDate}
                  </div>
                  {year.status === 'active' && (
                    <div className="fp-period-actions">
                      {period.status !== 'future' && (
                        <button
                          className={`fp-period-btn ${period.status === 'open' ? 'fp-pbtn-close' : 'fp-pbtn-open'}`}
                          onClick={() => void handleTogglePeriod(year.id, period.id)}
                        >
                          {period.status === 'open' ? 'Close' : 'Open'}
                        </button>
                      )}
                      {period.status === 'open' && !period.isCurrent && (
                        <button
                          className="fp-period-btn fp-pbtn-set"
                          onClick={() => handleSetCurrent(year.id, period.id)}
                        >
                          Set Current
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Create Fiscal Year dialog */}
      {showCreateDialog && (
        <Dialog
          title="Create New Fiscal Year"
          onClose={() => !saving && setShowCreateDialog(false)}
          width={440}
        >
          <div className="fp-dialog-body">
            <label className="fp-label" htmlFor="fp-year-label">
              Label <span className="fp-required">*</span>
            </label>
            <input
              id="fp-year-label"
              className="fp-input"
              placeholder="e.g. FY 2027"
              value={newYearLabel}
              onChange={(e) => setNewYearLabel(e.target.value)}
              autoFocus
            />

            <div className="fp-date-row">
              <div className="fp-date-field">
                <label className="fp-label" htmlFor="fp-year-start">
                  Start Date <span className="fp-required">*</span>
                </label>
                <input
                  id="fp-year-start"
                  type="date"
                  className="fp-input"
                  value={newYearStart}
                  onChange={(e) => setNewYearStart(e.target.value)}
                />
              </div>
              <div className="fp-date-field">
                <label className="fp-label" htmlFor="fp-year-end">
                  End Date <span className="fp-required">*</span>
                </label>
                <input
                  id="fp-year-end"
                  type="date"
                  className="fp-input"
                  value={newYearEnd}
                  onChange={(e) => setNewYearEnd(e.target.value)}
                />
              </div>
            </div>

            <p className="fp-dialog-hint">
              12 monthly periods will be auto-generated. You can adjust them after creation.
            </p>
          </div>
          <DialogActionsBar>
            <button
              className="fp-btn-ghost"
              disabled={saving}
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </button>
            <button
              className="fp-btn-primary"
              disabled={saving || !newYearLabel.trim() || !newYearStart || !newYearEnd}
              onClick={() => {
                void handleCreateYear()
              }}
            >
              {saving ? 'Creating…' : 'Create Fiscal Year'}
            </button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
