import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRENCY_OPTIONS, useCurrencyStore } from '../store/currencyStore'

export const CurrencyPicker = () => {
  const code = useCurrencyStore((s) => s.code)
  const setCode = useCurrencyStore((s) => s.setCode)
  const loadRates = useCurrencyStore((s) => s.loadRates)
  const ratesUpdatedAt = useCurrencyStore((s) => s.ratesUpdatedAt)
  const ratesLoading = useCurrencyStore((s) => s.ratesLoading)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const active = useMemo(
    () => CURRENCY_OPTIONS.find((o) => o.code === code) ?? CURRENCY_OPTIONS[0],
    [code],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CURRENCY_OPTIONS
    return CURRENCY_OPTIONS.filter(
      (o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q),
    )
  }, [query])

  const updatedLabel = ratesUpdatedAt
    ? new Date(ratesUpdatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : 'using fallback rates'

  return (
    <div ref={wrapRef} className="currency-picker-wrap">
      <button
        type="button"
        className="topbar-btn shell-btn currency-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        title={`Display currency: ${active.name}`}
        aria-expanded={open}
      >
        <span className="currency-picker-flag">{active.flag}</span>
        <span className="currency-picker-code">{active.code}</span>
        <span className="currency-picker-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="currency-picker-popover" role="dialog" aria-label="Select display currency">
          <div className="currency-picker-head">
            <div className="currency-picker-title">Display Currency</div>
            <div className="currency-picker-sub">All amounts auto-convert to this currency.</div>
          </div>
          <input
            type="search"
            className="currency-picker-search"
            placeholder="Search currency..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="currency-picker-list">
            {filtered.length === 0 && (
              <div className="currency-picker-empty">No matches.</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.code}
                type="button"
                className={`currency-picker-option ${opt.code === code ? 'is-active' : ''}`}
                onClick={() => {
                  setCode(opt.code)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="currency-picker-opt-flag">{opt.flag}</span>
                <span className="currency-picker-opt-code">{opt.code}</span>
                <span className="currency-picker-opt-name">{opt.name}</span>
                <span className="currency-picker-opt-sym">{opt.symbol}</span>
                {opt.code === code && <span className="currency-picker-opt-check" aria-hidden>✓</span>}
              </button>
            ))}
          </div>
          <div className="currency-picker-foot">
            <span>Rates: {updatedLabel}</span>
            <button
              type="button"
              className="currency-picker-refresh"
              disabled={ratesLoading}
              onClick={() => void loadRates(true)}
            >
              {ratesLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
