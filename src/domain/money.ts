/**
 * Money as integer minor units.
 *
 * A `Money` value never holds a floating-point amount. `minor` is a whole number of the
 * currency's smallest unit: 1234 USD-minor is $12.34, 1234 JPY-minor is ¥1234, and
 * 1234 KWD-minor is 1.234 KWD. Every arithmetic helper here stays in integer space, so
 * the classic `0.1 + 0.2 !== 0.3` class of bug cannot occur on stored balances.
 *
 * Floats appear in exactly two places, both at the boundary: parsing text the user typed,
 * and applying an exchange rate. Both round explicitly and immediately back to integers.
 */

import { type CurrencyCode, decimalsOf } from './currency'

export interface Money {
  /** Whole number of minor units. Negative means a debit. */
  readonly minor: number
  readonly currency: CurrencyCode
}

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minor)) {
    throw new Error(`Money.minor must be an integer, got ${minor} (${currency})`)
  }
  return { minor, currency }
}

export function zero(currency: CurrencyCode): Money {
  return { minor: 0, currency }
}

export function isZero(m: Money): boolean {
  return m.minor === 0
}

export function isNegative(m: Money): boolean {
  return m.minor < 0
}

/** Guard against silently combining different currencies. */
function assertSameCurrency(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot ${op} ${a.currency} and ${b.currency} directly — convert with an explicit rate first`,
    )
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'add')
  return { minor: a.minor + b.minor, currency: a.currency }
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'subtract')
  return { minor: a.minor - b.minor, currency: a.currency }
}

export function negate(m: Money): Money {
  return { minor: -m.minor, currency: m.currency }
}

export function abs(m: Money): Money {
  return { minor: Math.abs(m.minor), currency: m.currency }
}

/** Sum a list. `currency` is required so an empty list still has a known currency. */
export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  let total = 0
  for (const m of items) {
    if (m.currency !== currency) {
      throw new Error(`Cannot sum ${m.currency} into a ${currency} total without conversion`)
    }
    total += m.minor
  }
  return { minor: total, currency }
}

/** Multiply by a plain number (e.g. 3 payments), rounding half-up to whole minor units. */
export function multiply(m: Money, factor: number): Money {
  return { minor: Math.round(m.minor * factor), currency: m.currency }
}

/** Apply a percentage, e.g. `percentOf(total, 30)` for 30% of a figure. */
export function percentOf(m: Money, percent: number): Money {
  return { minor: Math.round((m.minor * percent) / 100), currency: m.currency }
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b, 'compare')
  return a.minor - b.minor
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor
}

/**
 * Split an amount into `parts` as evenly as possible without losing or inventing minor
 * units. The remainder is distributed one unit at a time across the leading parts, so
 * splitting 100 by 3 gives [34, 33, 33] and the parts always sum back to the original.
 */
export function splitEvenly(m: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`Cannot split into ${parts} parts`)
  }
  const base = Math.trunc(m.minor / parts)
  let remainder = m.minor - base * parts
  const step = remainder >= 0 ? 1 : -1

  const out: Money[] = []
  for (let i = 0; i < parts; i++) {
    let share = base
    if (remainder !== 0) {
      share += step
      remainder -= step
    }
    out.push({ minor: share, currency: m.currency })
  }
  return out
}

/** Ratio of `part` to `whole` as a number in [0, ∞), or 0 when `whole` is zero. */
export function ratio(part: Money, whole: Money): number {
  assertSameCurrency(part, whole, 'compare')
  if (whole.minor === 0) return 0
  return part.minor / whole.minor
}

/** Percentage of `whole` represented by `part`, clamped to [0, 100] for progress bars. */
export function percentComplete(part: Money, whole: Money): number {
  const r = ratio(part, whole) * 100
  return Math.max(0, Math.min(100, r))
}

// ---------------------------------------------------------------------------
// Boundary conversions: text <-> Money
// ---------------------------------------------------------------------------

/**
 * Parse user-entered text into `Money`. Accepts an optional leading sign, digit-group
 * separators (spaces, commas, apostrophes) and either `.` or `,` as the decimal mark.
 * Returns null for anything unparseable so callers can show a validation message.
 *
 * Extra decimal places beyond the currency's precision are rounded, not truncated:
 * "1.005" in USD becomes 101 minor units, matching what the user would expect to see.
 */
export function parseMoney(input: string, currency: CurrencyCode): Money | null {
  const raw = input.trim()
  if (!raw) return null

  const negative = /^[-(]/.test(raw)
  // Keep digits and separators; drop currency symbols, spaces and brackets.
  const cleaned = raw.replace(/[^\d.,']/g, '')
  if (!cleaned) return null

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  const decimalMarkAt = Math.max(lastDot, lastComma)

  let intPart: string
  let fracPart = ''
  if (decimalMarkAt >= 0) {
    // A trailing separator group of exactly 3 digits is a thousands group, not decimals.
    const tail = cleaned.slice(decimalMarkAt + 1)
    if (tail.length === 3 && lastDot >= 0 && lastComma >= 0) {
      intPart = cleaned.replace(/[.,']/g, '')
    } else {
      intPart = cleaned.slice(0, decimalMarkAt).replace(/[.,']/g, '')
      fracPart = tail.replace(/[^\d]/g, '')
    }
  } else {
    intPart = cleaned.replace(/[.,']/g, '')
  }

  if (!intPart && !fracPart) return null

  // Scale in digit space, not by multiplying a float: `1.005 * 100` is 100.4999… in
  // IEEE-754 and would round down to 1.00, losing a cent on exactly the kind of input a
  // user is most likely to type.
  const decimals = decimalsOf(currency)
  const scale = 10 ** decimals
  const whole = Number(intPart || '0')
  if (!Number.isSafeInteger(whole)) return null

  let fracValue = 0
  let carry = 0
  if (fracPart.length <= decimals) {
    fracValue = decimals === 0 ? 0 : Number(fracPart.padEnd(decimals, '0') || '0')
  } else {
    const kept = fracPart.slice(0, decimals)
    fracValue = decimals === 0 ? 0 : Number(kept)
    // Round half-up on the first dropped digit.
    if (Number(fracPart[decimals]) >= 5) {
      fracValue += 1
      if (fracValue >= scale) {
        fracValue = 0
        carry = 1
      }
    }
  }

  const minor = (whole + carry) * scale + fracValue
  if (!Number.isSafeInteger(minor)) return null

  return { minor: negative ? -minor : minor, currency }
}

/** Plain numeric string with the currency's precision, e.g. "12.34". No symbol, no grouping. */
export function toDecimalString(m: Money): string {
  const decimals = decimalsOf(m.currency)
  const sign = m.minor < 0 ? '-' : ''
  const absMinor = Math.abs(m.minor)
  if (decimals === 0) return `${sign}${absMinor}`

  const scale = 10 ** decimals
  const whole = Math.trunc(absMinor / scale)
  const frac = String(absMinor % scale).padStart(decimals, '0')
  return `${sign}${whole}.${frac}`
}

/** The amount as a float. For display and charting only — never for storage or arithmetic. */
export function toFloat(m: Money): number {
  return m.minor / 10 ** decimalsOf(m.currency)
}

/** Build `Money` from a major-unit number, e.g. `fromMajor(12.34, 'USD')`. */
export function fromMajor(amount: number, currency: CurrencyCode): Money {
  return { minor: Math.round(amount * 10 ** decimalsOf(currency)), currency }
}
