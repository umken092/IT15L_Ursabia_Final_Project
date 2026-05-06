import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
  flag: string
}

// Curated common currencies (auto-conversion supported for any code returned by the rates API)
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', flag: '🇲🇽' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼' },
]

// Conservative offline fallback rates (USD = 1). Real values fetched from API on first load.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.93, GBP: 0.79, PHP: 57.5, JPY: 156, CNY: 7.25, KRW: 1380,
  AUD: 1.52, CAD: 1.37, CHF: 0.9, SGD: 1.35, HKD: 7.81, INR: 83.4, IDR: 16100,
  MYR: 4.72, THB: 36.5, VND: 25400, AED: 3.67, SAR: 3.75, BRL: 5.05,
  MXN: 17.1, ZAR: 18.6, NZD: 1.66, SEK: 10.6, NOK: 10.7, DKK: 6.93,
  TRY: 32.4, RUB: 92, PLN: 4.0, TWD: 32.4,
}

const RATES_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface CurrencyState {
  code: string
  rates: Record<string, number> // rates relative to USD (1 USD = rates[code])
  ratesUpdatedAt: number
  ratesLoading: boolean
  setCode: (code: string) => void
  loadRates: (force?: boolean) => Promise<void>
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      code: 'USD',
      rates: FALLBACK_RATES,
      ratesUpdatedAt: 0,
      ratesLoading: false,
      setCode: (code) => set({ code }),
      loadRates: async (force = false) => {
        const state = get()
        const fresh = Date.now() - state.ratesUpdatedAt < RATES_TTL_MS
        if (!force && fresh && Object.keys(state.rates).length > 5) return
        if (state.ratesLoading) return
        set({ ratesLoading: true })
        try {
          const res = await fetch('https://open.er-api.com/v6/latest/USD')
          if (!res.ok) throw new Error(`status ${res.status}`)
          const json = await res.json() as { result?: string; rates?: Record<string, number> }
          if (json?.result === 'success' && json.rates) {
            set({
              rates: { ...FALLBACK_RATES, ...json.rates, USD: 1 },
              ratesUpdatedAt: Date.now(),
              ratesLoading: false,
            })
            return
          }
          throw new Error('rate provider returned no data')
        } catch {
          // Keep existing rates / fallback; just clear loading flag.
          set({ ratesLoading: false })
        }
      },
    }),
    {
      name: 'cmn-currency',
      partialize: (s) => ({ code: s.code, rates: s.rates, ratesUpdatedAt: s.ratesUpdatedAt }),
    },
  ),
)

/**
 * Convert an amount from a source currency into the user's selected display currency
 * using the latest cached rates (USD-pivoted).
 */
export const convertAmount = (amount: number, source: string, target: string): number => {
  if (!Number.isFinite(amount)) return 0
  if (source === target) return amount
  const { rates } = useCurrencyStore.getState()
  const sourceRate = rates[source] ?? FALLBACK_RATES[source] ?? 1
  const targetRate = rates[target] ?? FALLBACK_RATES[target] ?? 1
  if (sourceRate === 0) return amount
  const amountInUsd = amount / sourceRate
  return amountInUsd * targetRate
}

/**
 * Format a numeric amount in the source currency, automatically converting and
 * displaying it in the user's selected currency. Reads live state from the store
 * so calls outside React still pick the active currency.
 */
export const formatMoney = (
  amount: number,
  sourceCurrency: string = 'USD',
  options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string => {
  const { code } = useCurrencyStore.getState()
  const converted = convertAmount(amount, sourceCurrency, code)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
    }).format(converted)
  } catch {
    return `${code} ${converted.toFixed(options.maximumFractionDigits ?? 2)}`
  }
}

/** Hook variant: subscribes to the active code so consumers re-render on change. */
export const useDisplayCurrency = () => useCurrencyStore((s) => s.code)

/** Map of currency-symbol prefix -> ISO code, for string detection. */
const SYMBOL_TO_CODE: Record<string, string> = {
  '₱': 'PHP', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
  '₩': 'KRW', '₹': 'INR', '₫': 'VND', '₺': 'TRY', '₽': 'RUB',
}

/**
 * Reformat any currency-bearing text (e.g. backend-formatted strings like
 * "PHP 138,987.52", "$1.2M", "₱42,500", "PHP 1.85M") into the active display
 * currency. Numeric magnitude suffixes K/M/B are preserved.
 *
 * If no currency token is detected, the original text is returned untouched.
 */
export const convertCurrencyText = (
  text: string | undefined | null,
  fallbackSource: string = 'PHP',
): string => {
  if (!text) return text ?? ''
  // Match optional leading sign + ISO code or symbol + optional inner sign + number with optional K/M/B suffix.
  const re = /([+-]?)\s*(?:(PHP|USD|EUR|GBP|JPY|CNY|KRW|AUD|CAD|CHF|SGD|HKD|INR|IDR|MYR|THB|VND|AED|SAR|BRL|MXN|ZAR|NZD|SEK|NOK|DKK|TRY|RUB|PLN|TWD)\s*|([₱$€£¥₩₹₫₺₽]))\s*([+-]?)\s*([\d,]+(?:\.\d+)?)\s*([KMB])?/gi
  let matched = false
  const out = text.replace(re, (_match, sign1: string, codeTok: string, symTok: string, sign2: string, num: string, suffix: string) => {
    matched = true
    const source = (codeTok ? codeTok.toUpperCase() : SYMBOL_TO_CODE[symTok] ?? fallbackSource)
    const raw = parseFloat(num.replace(/,/g, ''))
    if (!Number.isFinite(raw)) return _match
    const mult = suffix ? (suffix.toUpperCase() === 'K' ? 1e3 : suffix.toUpperCase() === 'M' ? 1e6 : 1e9) : 1
    const negative = sign1 === '-' || sign2 === '-'
    const signed = (negative ? -1 : 1) * raw * mult
    if (suffix) {
      // Preserve K/M/B suffix style, converted into the display currency.
      const { code } = useCurrencyStore.getState()
      const conv = convertAmount(signed, source, code)
      const abs = Math.abs(conv)
      const u = suffix.toUpperCase()
      const div = u === 'K' ? 1e3 : u === 'M' ? 1e6 : 1e9
      const symbol = (CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol) ?? code + ' '
      return `${conv < 0 ? '-' : ''}${symbol}${(abs / div).toFixed(2).replace(/\.00$/, '')}${u}`
    }
    return formatMoney(signed, source)
  })
  return matched ? out : text
}

/** Compact axis-tick formatter that respects the active display currency. */
export const formatCurrencyCompact = (value: number, sourceCurrency: string = 'PHP'): string => {
  const { code } = useCurrencyStore.getState()
  const conv = convertAmount(value, sourceCurrency, code)
  const abs = Math.abs(conv)
  const symbol = (CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol) ?? `${code} `
  const sign = conv < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${symbol}${abs.toFixed(0)}`
}
