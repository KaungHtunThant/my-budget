/**
 * Display formatting. Kept separate from `money.ts` so arithmetic never depends on locale.
 */

import { type CurrencyCode, currency, decimalsOf } from './currency'
import { type Money, toFloat } from './money'

/**
 * Format money for display, e.g. "$1,234.56" or "¥1,234".
 *
 * Uses `Intl.NumberFormat` for digit grouping only — the currency style is applied
 * manually with our own symbol table, because Intl's symbol choice varies by locale and
 * would render the same wallet differently on different devices.
 */
export function formatMoney(
  m: Money,
  opts: { showSymbol?: boolean; showCode?: boolean; signed?: boolean } = {},
): string {
  const { showSymbol = true, showCode = false, signed = false } = opts
  const def = currency(m.currency)
  const decimals = def.decimals

  const grouped = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(toFloat(m)))

  const sign = m.minor < 0 ? '-' : signed && m.minor > 0 ? '+' : ''
  const symbol = showSymbol ? def.symbol : ''
  const code = showCode ? ` ${def.code}` : ''
  return `${sign}${symbol}${grouped}${code}`
}

/** Compact form for dense lists and chart labels, e.g. "$1.2k", "$3.4M". */
export function formatMoneyCompact(m: Money): string {
  const def = currency(m.currency)
  const value = Math.abs(toFloat(m))
  const sign = m.minor < 0 ? '-' : ''

  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]
  for (const [threshold, suffix] of units) {
    if (value >= threshold) {
      const scaled = value / threshold
      const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '')
      return `${sign}${def.symbol}${text}${suffix}`
    }
  }
  return formatMoney(m)
}

/** Placeholder for an amount input, e.g. "0.00" for USD or "0" for JPY. */
export function amountPlaceholder(code: CurrencyCode): string {
  const decimals = decimalsOf(code)
  return decimals === 0 ? '0' : `0.${'0'.repeat(decimals)}`
}

/**
 * Format an exchange rate. Rates span a huge range — 0.0004 USD per MMK, 4400 MMK per USD
 * — so significant digits matter more than fixed decimals here.
 */
export function formatRate(rate: number): string {
  if (rate === 0) return '0'
  const magnitude = Math.abs(rate)
  const decimals = magnitude >= 100 ? 2 : magnitude >= 1 ? 4 : 6
  return rate.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
}

/** "12 Aug 2026" — unambiguous and short enough for list rows. */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** "August 2026" — for period headers. */
export function formatMonthYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d)
}

/** Relative day label for recent activity: "Today", "Yesterday", else a short date. */
export function formatRelativeDate(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return formatDate(iso)
}
