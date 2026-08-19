/**
 * Settings patches, built rather than written.
 *
 * Each function returns a `Partial<Settings>` for a caller to persist. That split matters: the
 * currency shortlist and the base-currency dedupe were previously spelled out in four places —
 * the store's `trackCurrency` and `completeOnboarding`, the settings screen's currency change,
 * and the currencies screen's add and remove — with the dedupe expression appearing verbatim
 * twice. One of those was always going to drift.
 *
 * `null` means "nothing to write", so a caller can skip a pointless repository round trip
 * instead of re-checking the condition itself.
 */

import type { CurrencyCode } from '@/domain/currency'
import type { Settings } from '@/domain/types'

/**
 * Add a currency to the shortlist the picker offers, if it is not already there.
 *
 * Called whenever a wallet appears in a currency the user has not used before, so the picker
 * stays in step with what they actually hold.
 */
export function withActiveCurrency(
  settings: Settings,
  code: CurrencyCode,
): Partial<Settings> | null {
  if (settings.activeCurrencies.includes(code)) return null
  return { activeCurrencies: [...settings.activeCurrencies, code] }
}

/**
 * Drop a currency from the shortlist, and its rate with it.
 *
 * Leaving the rate behind would resurrect it with a stale number if the currency were added
 * again later. Whether removal is *allowed* is a separate question — it depends on whether any
 * wallet still holds the currency, which is the calling screen's to check.
 */
export function withoutCurrency(settings: Settings, code: CurrencyCode): Partial<Settings> {
  const rates = { ...settings.rates }
  delete rates[code]
  return {
    activeCurrencies: settings.activeCurrencies.filter((c) => c !== code),
    rates,
  }
}

/**
 * Change the base currency, keeping it at the head of the shortlist.
 *
 * The new base must be in `activeCurrencies` — it is the one currency every screen renders — so
 * this dedupes rather than appending blindly.
 */
export function withBaseCurrency(settings: Settings, code: CurrencyCode): Partial<Settings> {
  return {
    baseCurrency: code,
    activeCurrencies: Array.from(new Set([code, ...settings.activeCurrencies])),
  }
}
