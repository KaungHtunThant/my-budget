/**
 * Manual-rate rules: which held currencies still need a rate, how a typed rate is read, and what
 * an amount typed in one currency becomes in the currency a record has to store.
 *
 * The app never fetches rates, so every question here is entirely local — and each was previously
 * answered in more than one place with slightly different arithmetic.
 */

import type { CurrencyCode } from '@/domain/currency'
import { convert, isValidRate } from '@/domain/fx'
import { type Money, parseMoney } from '@/domain/money'
import type { EnteredFx, Settings, Wallet } from '@/domain/types'

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

// ---------------------------------------------------------------------------
// Cross-currency amount entry
// ---------------------------------------------------------------------------

/**
 * One amount as the user has it in a form, plus the currency the record must end up in.
 *
 * Text rather than `Money`, for the same reason `TransactionDraft` is: parsing is where the bugs
 * live — a comma decimal mark, a half-typed rate, a currency changed after the rate was entered —
 * and text-in / record-out makes each of those a plain unit test.
 */
export interface AmountEntry {
  amountText: string
  /** Currency the amount was typed in. */
  entryCurrency: CurrencyCode
  /**
   * Currency the record stores: the wallet's for a transaction or a recurring rule, base for a
   * budget limit. A record is never stored in the currency it happened to be typed in.
   */
  targetCurrency: CurrencyCode
  /** The rate as typed. Ignored when the two currencies match. */
  rateText: string
}

export interface ResolvedEntry {
  /** The amount as typed, in the currency it was typed in. */
  entered: Money
  /** The amount in `targetCurrency`, or null when a required rate is missing or unusable. */
  amount: Money | null
  /** The conversion to freeze onto the record. Null when nothing crossed currencies. */
  fx: EnteredFx | null
  /** False only when a rate is required and the typed one cannot be used. */
  rateOk: boolean
}

/** Whether this entry crosses currencies, and so needs a rate from the user. */
export function entryNeedsRate(entry: AmountEntry): boolean {
  return entry.entryCurrency !== entry.targetCurrency
}

/**
 * Resolve an entry into the amount to store and the snapshot to store beside it.
 *
 * Null only when the amount text cannot be parsed at all; a missing rate returns a resolution
 * with `amount: null` and `rateOk: false` instead, so a form can keep showing what was typed
 * rather than blanking while the user reaches for the rate field.
 */
export function resolveEntry(entry: AmountEntry): ResolvedEntry | null {
  const entered = parseMoney(entry.amountText, entry.entryCurrency)
  if (entered === null) return null

  if (!entryNeedsRate(entry)) return { entered, amount: entered, fx: null, rateOk: true }

  const rate = parseRate(entry.rateText)
  if (rate === null) return { entered, amount: null, fx: null, rateOk: false }

  return {
    entered,
    amount: convert(entered, entry.targetCurrency, rate),
    fx: { enteredAmount: entered, rate },
    rateOk: true,
  }
}

/**
 * Whether an entry is complete enough to store: a positive amount, and a usable rate if one is
 * needed. The positive check is `services/money`'s rule, applied after conversion has been shown
 * to be possible.
 */
export function entryIsComplete(entry: AmountEntry): boolean {
  const resolved = resolveEntry(entry)
  return resolved !== null && resolved.entered.minor > 0 && resolved.rateOk
}

/**
 * The rate field's text when an existing record is opened for editing.
 *
 * Verbatim from the snapshot — that is the whole point of freezing it. A record with no snapshot
 * did not cross currencies, so the field starts empty.
 */
export function rateTextOf(fx: EnteredFx | null | undefined): string {
  return fx ? String(fx.rate) : ''
}
