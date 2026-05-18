import { useState, useEffect, useCallback } from 'react'
import { loanReviewService, type LoanInterestTier, type UpsertTierRequest } from '../../services/loanReviewService'
import { useNotificationStore } from '../../store/notificationStore'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: 'var(--primary)',
  cardBg: 'var(--card-bg)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  shadow: 'var(--shadow)',
  surface: 'var(--surface-container, #f8f9fa)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#ca8a04',
} as const

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const PRESET_TERMS = [1, 3, 6, 12, 18, 24, 36, 48, 60]

// ─── Tier Form Modal ──────────────────────────────────────────────────────────
interface TierFormProps {
  existing?: LoanInterestTier
  onClose: () => void
  onSuccess: () => void
}

const TierFormModal = ({ existing, onClose, onSuccess }: TierFormProps) => {
  const pushToast = useNotificationStore((s) => s.push)
  const [termMonths, setTermMonths] = useState(String(existing?.termMonths ?? ''))
  const [annualRate, setAnnualRate] = useState(String(existing?.annualInterestRate ?? ''))
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const term = Number(termMonths)
    const rate = Number(annualRate)
    if (!term || term <= 0) { pushToast('warning', 'Term months must be greater than zero.'); return }
    if (isNaN(rate) || rate < 0) { pushToast('warning', 'Interest rate cannot be negative.'); return }

    setSubmitting(true)
    const payload: UpsertTierRequest = { termMonths: term, annualInterestRate: rate, isActive }
    try {
      if (existing) {
        await loanReviewService.updateTier(existing.id, payload)
        pushToast('success', 'Tier updated successfully.')
      } else {
        await loanReviewService.createTier(payload)
        pushToast('success', 'Tier created successfully.')
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save tier.'
      pushToast('error', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: C.cardBg, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 420, padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
            {existing ? 'Edit Interest Tier' : 'Add Interest Tier'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>
            Term (Months) <span style={{ color: C.danger }}>*</span>
          </label>
          {existing ? (
            <input
              type="number"
              value={termMonths}
              readOnly
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, fontSize: 13, boxSizing: 'border-box' }}
            />
          ) : (
            <select
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13 }}
            >
              <option value="">— Select term —</option>
              {PRESET_TERMS.map((t) => (
                <option key={t} value={t}>{t} month{t !== 1 ? 's' : ''}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>
            Annual Interest Rate (%) <span style={{ color: C.danger }}>*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            placeholder="e.g. 10.5"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.cardBg, color: C.text, fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="tier-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="tier-active" style={{ fontSize: 13, color: C.text, cursor: 'pointer' }}>Active (visible to customers)</label>
        </div>

        {annualRate && termMonths && !isNaN(Number(annualRate)) && !isNaN(Number(termMonths)) && Number(termMonths) > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
            Preview: ₱100,000 at {annualRate}% p.a. for {termMonths} months ={' '}
            <strong>
              ₱{(() => {
                const p = 100000, n = Number(termMonths), r = Number(annualRate) / 100 / 12
                if (r === 0) return (p / n).toFixed(2)
                return ((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)).toFixed(2)
              })()} / month
            </strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Saving…' : existing ? 'Update Tier' : 'Create Tier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tier Row ─────────────────────────────────────────────────────────────────
interface TierRowProps {
  tier: LoanInterestTier
  onEdit: () => void
  onDeactivate: () => void
  onActivate: () => void
  deactivating: boolean
}

const TierRow = ({ tier, onEdit, onDeactivate, onActivate, deactivating }: TierRowProps) => (
  <div style={{
    background: C.cardBg,
    border: `1px solid ${C.border}`,
    borderLeft: `4px solid ${tier.isActive ? C.success : C.muted}`,
    borderRadius: 10, padding: '14px 18px', marginBottom: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    opacity: tier.isActive ? 1 : 0.65,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ minWidth: 90 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{tier.termMonths}</span>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>months</span>
      </div>
      <div>
        <span style={{ fontSize: 20, fontWeight: 800, color: tier.isActive ? C.primary : C.muted }}>{tier.annualInterestRate}%</span>
        <span style={{ fontSize: 11, color: C.muted, display: 'block' }}>per annum</span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: C.muted }}>Updated {fmtDate(tier.updatedAtUtc ?? tier.createdAtUtc)}</span>
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
        background: tier.isActive ? '#f0fdf4' : '#f3f4f6',
        color: tier.isActive ? C.success : C.muted,
      }}>
        {tier.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={onEdit}
        style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
      >
        Edit
      </button>
      {tier.isActive ? (
        <button
          onClick={onDeactivate}
          disabled={deactivating}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: C.danger, color: '#fff', fontSize: 12, cursor: deactivating ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: deactivating ? 0.7 : 1 }}
        >
          {deactivating ? '…' : 'Deactivate'}
        </button>
      ) : (
        <button
          onClick={onActivate}
          disabled={deactivating}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: C.success, color: '#fff', fontSize: 12, cursor: deactivating ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: deactivating ? 0.7 : 1 }}
        >
          {deactivating ? '…' : 'Reactivate'}
        </button>
      )}
    </div>
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────
const LoanTierManagementPage: React.FC = () => {
  const pushToast = useNotificationStore((s) => s.push)
  const [tiers, setTiers] = useState<LoanInterestTier[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalTier, setModalTier] = useState<LoanInterestTier | 'new' | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await loanReviewService.getLoanTiers(showInactive)
      setTiers(res)
    } catch {
      pushToast('error', 'Failed to load interest tiers.')
    } finally {
      setLoading(false)
    }
  }, [showInactive, pushToast])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (tier: LoanInterestTier) => {
    setTogglingId(tier.id)
    try {
      if (tier.isActive) {
        await loanReviewService.deleteTier(tier.id)
        pushToast('success', `${tier.termMonths}-month tier deactivated.`)
      } else {
        await loanReviewService.updateTier(tier.id, {
          termMonths: tier.termMonths,
          annualInterestRate: tier.annualInterestRate,
          isActive: true,
        })
        pushToast('success', `${tier.termMonths}-month tier reactivated.`)
      }
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Operation failed.'
      pushToast('error', msg)
    } finally {
      setTogglingId(null)
    }
  }

  const activeTiers = tiers.filter((t) => t.isActive)
  const inactiveTiers = tiers.filter((t) => !t.isActive)

  return (
    <div className="loan-module-page">
      <div className="loan-module-header">
        <div>
          <h1 className="loan-module-title">Loan Interest Tiers</h1>
          <p className="loan-module-subtitle">Define enterprise loan pricing by term with controlled activation states and immediate policy effect on new applications.</p>
        </div>
        <button
          onClick={() => setModalTier('new')}
          style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          + Add Tier
        </button>
      </div>

      <div className="loan-module-kpis">
        {[
          { label: 'Active Tiers', value: activeTiers.length, color: C.success },
          { label: 'Inactive Tiers', value: inactiveTiers.length, color: C.muted },
          { label: 'Lowest Rate', value: activeTiers.length ? `${Math.min(...activeTiers.map((t) => t.annualInterestRate))}%` : '—', color: C.primary },
          { label: 'Highest Rate', value: activeTiers.length ? `${Math.max(...activeTiers.map((t) => t.annualInterestRate))}%` : '—', color: C.warning },
        ].map((s) => (
          <div key={s.label} className="loan-module-kpi">
            <span className="loan-module-kpi-label">{s.label}</span>
            <p className="loan-module-kpi-value" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="loan-module-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive tiers
        </label>
      </div>

      {loading ? (
        <div className="loan-module-state">Loading...</div>
      ) : tiers.length === 0 ? (
        <div className="loan-module-state">
          <p style={{ fontSize: 14 }}>No interest tiers configured.</p>
          <button onClick={() => setModalTier('new')} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
            Create First Tier
          </button>
        </div>
      ) : (
        <>
          {activeTiers.length > 0 && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</p>
              {activeTiers.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  onEdit={() => setModalTier(tier)}
                  onDeactivate={() => handleToggleActive(tier)}
                  onActivate={() => handleToggleActive(tier)}
                  deactivating={togglingId === tier.id}
                />
              ))}
            </>
          )}
          {showInactive && inactiveTiers.length > 0 && (
            <>
              <p style={{ margin: '18px 0 10px', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inactive</p>
              {inactiveTiers.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  onEdit={() => setModalTier(tier)}
                  onDeactivate={() => handleToggleActive(tier)}
                  onActivate={() => handleToggleActive(tier)}
                  deactivating={togglingId === tier.id}
                />
              ))}
            </>
          )}
        </>
      )}
      </div>

      {modalTier !== null && (
        <TierFormModal
          existing={modalTier === 'new' ? undefined : modalTier}
          onClose={() => setModalTier(null)}
          onSuccess={() => { setModalTier(null); load() }}
        />
      )}
    </div>
  )
}

export default LoanTierManagementPage
