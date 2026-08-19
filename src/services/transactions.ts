/**
 * Transaction entry: when a rate is needed, what the amounts resolve to, and the record written.
 *
 * This is the app's most consequential rule set — it decides what money is stored — and it lived
 * in a 250-line modal script where none of it could be tested without mounting Vue and a store.
 *
 * The draft carries **raw text**, not parsed `Money`. That is deliberate: parsing is where the
 * bugs are (comma decimal marks, half-typed rates, a currency changed after a rate was entered),
 * so text-in / record-out makes those cases plain unit tests.
 */

import type { CurrencyCode } from '@/domain/currency'
import { convert, impliedRate } from '@/domain/fx'
import { type Money, parseMoney } from '@/domain/money'
import type {
  Id,
  NewTransaction,
  Transaction,
  TransactionFx,
  TransactionType,
  Wallet,
} from '@/domain/types'

import { parseRate } from './fx'

/** The entry form's state, exactly as the user has it. */
export interface TransactionDraft {
  type: TransactionType
  /** Base currency, used only as the fallback when no wallet is chosen yet. */
  base: CurrencyCode
  walletId: Id | null
  toWalletId: Id | null
  categoryId: Id | null
  amountText: string
  entryCurrency: CurrencyCode
  rateText: string
  date: string
  note: string
  recurringRuleId: Id | null
  goalId: Id | null
}

/**
 * Everything the form needs to preview, in one pass.
 *
 * Returns `amount`/`toAmount` as nullable rather than refusing outright, so a half-typed rate
 * still shows the entered amount instead of blanking the form.
 */
export interface ResolvedDraft {
  /** The amount as typed, in the currency it was typed in. */
  entered: Money
  /** What lands in the source wallet, after any conversion. */
  amount: Money | null
  /** What arrives in the destination wallet. Transfers only. */
  toAmount: Money | null
  /** The frozen conversion record, kept on non-transfer entries that needed a rate. */
  fx: TransactionFx | null
  /** False when a rate is required and the typed one is unusable. */
  rateOk: boolean
}

const walletOf = (wallets: readonly Wallet[], id: Id | null): Wallet | undefined =>
  id === null ? undefined : wallets.find((w) => w.id === id)

/** The currency the source wallet holds, falling back to base before one is chosen. */
export function walletCurrency(draft: TransactionDraft, wallets: readonly Wallet[]): CurrencyCode {
  return walletOf(wallets, draft.walletId)?.currency ?? draft.base
}

/** The currency a typed rate is expressed *from*. */
export function rateFrom(draft: TransactionDraft, wallets: readonly Wallet[]): CurrencyCode {
  return draft.type === 'transfer' ? walletCurrency(draft, wallets) : draft.entryCurrency
}

/** The currency a typed rate is expressed *to*. */
export function rateTo(draft: TransactionDraft, wallets: readonly Wallet[]): CurrencyCode {
  if (draft.type !== 'transfer') return walletCurrency(draft, wallets)
  return walletOf(wallets, draft.toWalletId)?.currency ?? draft.base
}

/**
 * Whether this entry needs an exchange rate.
 *
 * Two different questions behind one answer: on income and expense, whether the amount was
 * entered in a currency the wallet does not hold; on a transfer, whether the two wallets differ.
 * A transfer needs both wallets chosen before the question can be answered at all.
 */
export function needsRate(draft: TransactionDraft, wallets: readonly Wallet[]): boolean {
  if (draft.type === 'transfer') {
    const from = walletOf(wallets, draft.walletId)
    const to = walletOf(wallets, draft.toWalletId)
    return Boolean(from && to && from.currency !== to.currency)
  }
  return draft.entryCurrency !== walletCurrency(draft, wallets)
}

/**
 * Resolve the draft's amounts. Null only when the amount text cannot be parsed at all.
 *
 * A transfer's `amount` is always the entered value: it leaves the source wallet in that
 * wallet's own currency, and the rate applies to what *arrives*. On income and expense it is the
 * reverse — the entered value may be in a foreign currency and the wallet stores the conversion.
 */
export function resolveDraft(
  draft: TransactionDraft,
  wallets: readonly Wallet[],
): ResolvedDraft | null {
  const enteredIn = draft.type === 'transfer' ? walletCurrency(draft, wallets) : draft.entryCurrency
  const entered = parseMoney(draft.amountText, enteredIn)
  if (entered === null) return null

  const needs = needsRate(draft, wallets)
  const rate = parseRate(draft.rateText)
  const rateOk = !needs || rate !== null

  if (draft.type === 'transfer') {
    const toAmount = !needs
      ? entered
      : rate === null
        ? null
        : convert(entered, rateTo(draft, wallets), rate)
    return { entered, amount: entered, toAmount, fx: null, rateOk }
  }

  if (!needs) return { entered, amount: entered, toAmount: null, fx: null, rateOk }
  if (rate === null) return { entered, amount: null, toAmount: null, fx: null, rateOk }

  return {
    entered,
    amount: convert(entered, walletCurrency(draft, wallets), rate),
    toAmount: null,
    fx: { enteredAmount: entered, rate },
    rateOk,
  }
}

/** Whether the form is complete enough to save. */
export function canSaveDraft(draft: TransactionDraft, wallets: readonly Wallet[]): boolean {
  const resolved = resolveDraft(draft, wallets)
  return (
    draft.walletId !== null &&
    resolved !== null &&
    resolved.entered.minor > 0 &&
    (draft.type !== 'transfer' || draft.toWalletId !== null) &&
    resolved.rateOk
  )
}

/**
 * The record to persist, or null if the draft is not saveable.
 *
 * Note which fields are nulled by type: a transfer has no category, and everything else has no
 * destination wallet. Storing both would let a later edit produce a record that is a transfer in
 * one field and an expense in another.
 */
export function buildTransaction(
  draft: TransactionDraft,
  wallets: readonly Wallet[],
): NewTransaction | null {
  const resolved = resolveDraft(draft, wallets)
  if (resolved === null || resolved.amount === null || !resolved.rateOk) return null
  if (draft.walletId === null) return null

  return {
    type: draft.type,
    amount: resolved.amount,
    fx: resolved.fx,
    walletId: draft.walletId,
    toWalletId: draft.type === 'transfer' ? draft.toWalletId : null,
    toAmount: draft.type === 'transfer' ? resolved.toAmount : null,
    categoryId: draft.type === 'transfer' ? null : draft.categoryId,
    date: draft.date.slice(0, 10),
    note: draft.note.trim(),
    recurringRuleId: draft.recurringRuleId,
    goalId: draft.goalId,
  }
}

/**
 * The rate to show when an existing transaction is opened for editing.
 *
 * An entry that stored an `fx` snapshot carries its rate verbatim — that is the whole point of
 * freezing it. A cross-currency transfer stores no snapshot, so the rate has to be recovered
 * from the two amounts, which is what `domain/fx.impliedRate` is for: it divides out each
 * currency's decimal places before dividing the amounts.
 *
 * Doing that division on raw minor units instead — as this did until it was fixed — is wrong
 * whenever the two currencies have different precisions. A 100.00 USD to 15,000 JPY transfer came
 * back as 1.5 rather than 150, and because this value populates the rate field when editing,
 * saving that form again wrote an amount 100x off.
 */
export function rateTextFor(tx: Transaction): string {
  if (tx.fx) return String(tx.fx.rate)
  if (tx.type === 'transfer' && tx.toAmount && tx.toAmount.currency !== tx.amount.currency) {
    return String(impliedRate(tx.amount, tx.toAmount))
  }
  return ''
}
