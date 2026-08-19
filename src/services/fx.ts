/**
 * Manual-rate rules: which held currencies still need a rate, and how a typed rate is read.
 *
 * The app never fetches rates, so both questions are entirely local — and both were previously
 * answered in more than one place with slightly different arithmetic.
 */

import type { CurrencyCode } from '@/domain/currency'
import { isValidRate } from '@/domain/fx'
import type { Settings, Wallet } from '@/domain/types'

/**
 * Currencies the user actually holds that have no usable rate against base.
 *
 * Deliberately *not* the same question as `combinedBalance().missing`, which reports the
 * currencies one particular total had to skip. This one drives the settings nudge, so it asks
 * about holdings rather than about a calculation — a wallet with no rate is worth flagging even
 * when nothing is currently summing it.
 *
 * Composes `isValidRate` rather than repeating `!(rate > 0)`, which makes it marginally
 * stricter: a non-finite rate now counts as missing. That state is unreachable through the UI,
 * since every write is already gated on `isValidRate`, and "missing" is the correct answer for
 * it in any case.
 */
export function currenciesNeedingRates(
  wallets: readonly Wallet[],
  settings: Settings,
): CurrencyCode[] {
  const held = new Set(wallets.map((w) => w.currency))
  held.delete(settings.baseCurrency)
  return [...held].filter((code) => {
    const rate = settings.rates[code]
    return rate === undefined || !isValidRate(rate)
  })
}

/**
 * Read a rate the user typed. Accepts a comma decimal mark, which is what a phone keyboard
 * offers in most of the world, and returns null for anything unusable rather than a NaN that
 * would propagate into stored money.
 */
export function parseRate(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text.replace(',', '.'))
  return isValidRate(value) ? value : null
}
