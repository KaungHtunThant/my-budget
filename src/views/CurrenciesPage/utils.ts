/**
 * Currencies screen logic: which currencies need a rate, and the rate editor's drafts.
 *
 * Rates are edited as free text per currency, so a half-typed "1." never reaches settings. The
 * parsing itself belongs to `services/fx.parseRate`, which the transaction modal shares.
 */

import type { CurrencyCode } from '@/domain/currency'
import { formatMoney } from '@/domain/format'
import { convert } from '@/domain/fx'
import { fromMajor } from '@/domain/money'
import type { Settings, Wallet } from '@/domain/types'
import { parseRate } from '@/services/fx'

/** The sample used in the "100 X = Y" preview; a round number makes the rate readable. */
const PREVIEW_AMOUNT = 100

/** Active currencies other than base — the ones that can have a rate at all. */
export function otherCurrencies(settings: Settings): CurrencyCode[] {
  return settings.activeCurrencies.filter((code) => code !== settings.baseCurrency)
}

/** Currencies a wallet actually holds. These are the ones a rate is genuinely needed for. */
export function currenciesInUse(wallets: readonly Wallet[]): Set<CurrencyCode> {
  return new Set(wallets.map((w) => w.currency))
}

/**
 * Removal is refused while a wallet still holds the currency.
 *
 * Dropping it would leave that wallet's balance unconvertible and its rate gone, so every
 * combined total would silently start excluding it.
 */
export function canRemoveCurrency(
  code: CurrencyCode,
  inUse: ReadonlySet<CurrencyCode>,
): boolean {
  return !inUse.has(code)
}

/**
 * Editable text for each currency's rate.
 *
 * A currency with no rate yet gets an empty string rather than "0" or "undefined", so the field
 * reads as unset instead of as a rate of zero.
 */
export function rateDrafts(
  codes: readonly CurrencyCode[],
  rates: Settings['rates'],
): Record<string, string> {
  const drafts: Record<string, string> = {}
  for (const code of codes) {
    const rate = rates[code]
    drafts[code] = rate === undefined ? '' : String(rate)
  }
  return drafts
}

/**
 * "100 EUR = 108.00 USD" for the rate as currently typed, or null while it is unusable.
 *
 * Shown live so a mistyped rate is obvious before it is saved — an order-of-magnitude error is
 * hard to spot in the number itself and glaring in the converted amount.
 */
export function ratePreview(
  code: CurrencyCode,
  base: CurrencyCode,
  rateText: string,
): string | null {
  const rate = parseRate(rateText)
  if (rate === null) return null

  const sample = fromMajor(PREVIEW_AMOUNT, code)
  return `${formatMoney(sample)} = ${formatMoney(convert(sample, base, rate))}`
}
