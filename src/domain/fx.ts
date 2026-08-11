/**
 * Manual foreign-exchange conversion.
 *
 * The app never fetches rates. When an amount crosses currencies the user types the rate
 * they actually got, and the result is frozen onto the record as a `FxSnapshot`. Later
 * rate changes therefore never rewrite history — a transfer made at 4400 MMK/USD still
 * reads 4400 next year.
 *
 * Rate convention, used everywhere without exception:
 *   1 unit of `from` = `rate` units of `to`
 * So converting 100 USD to MMK at rate 4400 yields 440,000 MMK.
 */

import type { CurrencyCode } from './currency'
import { decimalsOf } from './currency'
import { type Money, money } from './money'

export interface FxSnapshot {
  /** The amount as originally entered, in its own currency. */
  readonly original: Money
  /** The converted amount actually applied. */
  readonly converted: Money
  /** Rate used, expressed as `1 original.currency = rate converted.currency`. */
  readonly rate: number
}

export class InvalidRateError extends Error {
  constructor(rate: number) {
    super(`Exchange rate must be a positive finite number, got ${rate}`)
    this.name = 'InvalidRateError'
  }
}

export function isValidRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0
}

/**
 * Convert `amount` into `to` at the given rate, rounding to `to`'s precision.
 *
 * Same-currency conversion is allowed and returns the amount untouched, so callers can
 * apply this unconditionally without branching on whether currencies differ.
 */
export function convert(amount: Money, to: CurrencyCode, rate: number): Money {
  if (amount.currency === to) return amount
  if (!isValidRate(rate)) throw new InvalidRateError(rate)

  const fromDecimals = decimalsOf(amount.currency)
  const toDecimals = decimalsOf(to)

  // Rate applies to major units, so rescale across differing precisions.
  const scaled = (amount.minor * rate * 10 ** toDecimals) / 10 ** fromDecimals
  return money(Math.round(scaled), to)
}

/** Convert and keep the audit trail in one step. */
export function convertWithSnapshot(amount: Money, to: CurrencyCode, rate: number): FxSnapshot {
  return { original: amount, converted: convert(amount, to, rate), rate }
}

/** No-op snapshot for same-currency amounts, so records have a uniform shape. */
export function identitySnapshot(amount: Money): FxSnapshot {
  return { original: amount, converted: amount, rate: 1 }
}

/** The inverse rate, for showing "or 0.000227 USD per MMK" beside the user's input. */
export function inverseRate(rate: number): number {
  if (!isValidRate(rate)) throw new InvalidRateError(rate)
  return 1 / rate
}

/**
 * Derive the rate implied by a pair of amounts. Used when the user prefers to enter
 * "I paid 100 USD and received 440,000 MMK" rather than typing a rate directly.
 */
export function impliedRate(from: Money, to: Money): number {
  if (from.minor === 0) throw new InvalidRateError(0)
  const fromMajor = from.minor / 10 ** decimalsOf(from.currency)
  const toMajor = to.minor / 10 ** decimalsOf(to.currency)
  return toMajor / fromMajor
}

/**
 * Convert a list of mixed-currency amounts into one base-currency total.
 *
 * `rates` maps a currency code to its rate against base. Any currency without a rate is
 * skipped and reported in `missing`, so the UI can show "3 wallets not included — set a
 * rate for CHF" instead of silently understating a total.
 */
export function totalInBase(
  amounts: readonly Money[],
  base: CurrencyCode,
  rates: Readonly<Partial<Record<CurrencyCode, number>>>,
): { total: Money; missing: CurrencyCode[] } {
  let totalMinor = 0
  const missing = new Set<CurrencyCode>()

  for (const amount of amounts) {
    if (amount.currency === base) {
      totalMinor += amount.minor
      continue
    }
    const rate = rates[amount.currency]
    if (rate === undefined || !isValidRate(rate)) {
      missing.add(amount.currency)
      continue
    }
    totalMinor += convert(amount, base, rate).minor
  }

  return { total: money(totalMinor, base), missing: [...missing] }
}
