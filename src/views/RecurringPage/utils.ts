/**
 * Recurring rules screen logic: the monthly commitment figure, and how a rule reads in words.
 *
 * The rule-to-transaction conversion is *not* here — it lives in `services/recurring`, because a
 * scheduler will eventually have to produce byte-identical transactions to this screen's
 * "add now" button.
 */

import type { BaseContext } from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import { totalInBase } from '@/domain/fx'
import { type Money, multiply } from '@/domain/money'
import { WEEKDAY_NAMES } from '@/domain/period'
import type {
  Id,
  NewRecurringRule,
  RecurrenceFrequency,
  RecurringRule,
  TransactionType,
  Wallet,
} from '@/domain/types'
import { type AmountEntry, entryIsComplete, resolveEntry } from '@/services/fx'

/** Weekly and fortnightly rules are anchored to a weekday; monthly and yearly to a date. */
export function usesWeekday(frequency: RecurrenceFrequency): boolean {
  return frequency === 'weekly' || frequency === 'fortnightly'
}

/**
 * How many times a year this frequency occurs, divided by twelve.
 *
 * Weekly is 52/12 rather than 4, because four weeks is not a month — the difference is a whole
 * extra payment a year, which is exactly the sort of thing a commitment figure exists to reveal.
 */
export function monthlyFactor(frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 52 / 12
    case 'fortnightly':
      return 26 / 12
    case 'yearly':
      return 1 / 12
    case 'monthly':
      return 1
  }
}

export interface MonthlyCommitment {
  income: Money
  expense: Money
  /**
   * Currencies left out of the figures for want of a rate. A rule is stored in its wallet's
   * currency, so a commitment total is a multi-currency sum like every other total in the app —
   * and, like every other total, it says what it had to skip instead of quietly understating.
   */
  missing: CurrencyCode[]
}

/**
 * Active rules as one monthly-equivalent figure per direction, in the base currency.
 *
 * Only active rules count — a paused rule is not a commitment. Amounts are built through
 * `domain/money`, which rejects a fractional minor value; the previous version assembled
 * `{ minor, currency }` by hand after its own rounding.
 *
 * Conversion uses the settings rate rather than a rule's own frozen `fx`: the snapshot records
 * what one entry cost at the time, while this figure answers "what am I committed to now", which
 * is a question about today's rate.
 */
export function monthlyCommitment(
  rules: readonly RecurringRule[],
  ctx: BaseContext,
): MonthlyCommitment {
  const perMonth = (rule: RecurringRule): Money =>
    multiply(rule.amount, monthlyFactor(rule.frequency))

  const forType = (type: TransactionType): { total: Money; missing: CurrencyCode[] } =>
    totalInBase(
      rules.filter((r) => r.active && r.type === type).map(perMonth),
      ctx.base,
      ctx.rates,
    )

  const income = forType('income')
  const expense = forType('expense')

  return {
    income: income.total,
    expense: expense.total,
    missing: [...new Set([...income.missing, ...expense.missing])],
  }
}

/**
 * A rule in words: when it happens, and out of which wallet.
 *
 * Written from the rule rather than the form so the list reads correctly for rules created on
 * another device or restored from a backup.
 */
export function describeRule(rule: RecurringRule, wallet: Wallet | undefined): string {
  const parts: string[] = []

  switch (rule.frequency) {
    case 'weekly':
      parts.push(`Every ${WEEKDAY_NAMES[rule.weekday ?? 1]}`)
      break
    case 'fortnightly':
      parts.push(`Every 2 weeks on ${WEEKDAY_NAMES[rule.weekday ?? 1]}`)
      break
    case 'monthly':
      parts.push(`Monthly on day ${rule.dayOfMonth ?? 1}`)
      break
    case 'yearly':
      parts.push(`Yearly on day ${rule.dayOfMonth ?? 1}`)
      break
  }

  if (wallet) parts.push(wallet.name)
  return parts.join(' · ')
}

export interface RuleDraft {
  name: string
  type: TransactionType
  /**
   * The amount as typed, with the wallet's currency as its target: a rule is stored in the
   * currency of the wallet it is paid from, because that is what the transactions it generates
   * must be. The form carries text rather than `Money` so the rate can still be half-typed.
   */
  entry: AmountEntry
  walletId: Id | null
  categoryId: Id | null
  frequency: RecurrenceFrequency
  dayOfMonth: number
  weekday: number
  active: boolean
  today: string
}

/** A rule needs a name, a wallet, an amount above zero, and a rate if it crosses currencies. */
export function canSaveRule(draft: RuleDraft): boolean {
  return draft.name.trim().length > 0 && draft.walletId !== null && entryIsComplete(draft.entry)
}

/**
 * The rule record to persist, or null when the form is not complete.
 *
 * `dayOfMonth` and `weekday` are mutually exclusive — whichever the frequency does not use is
 * nulled, so a rule switched from monthly to weekly cannot keep a stale day of month that a
 * scheduler would later read. A transfer carries no category.
 *
 * The amount is stored converted, with the conversion frozen beside it, exactly as a transaction
 * is: the rule then needs no rate at generation time, and every entry it produces reads the same
 * as the one the user typed.
 */
export function buildRule(draft: RuleDraft): NewRecurringRule | null {
  const resolved = resolveEntry(draft.entry)
  if (!canSaveRule(draft) || draft.walletId === null || resolved?.amount == null) return null

  const byWeekday = usesWeekday(draft.frequency)

  return {
    name: draft.name.trim(),
    type: draft.type,
    amount: resolved.amount,
    fx: resolved.fx,
    walletId: draft.walletId,
    toWalletId: null,
    categoryId: draft.type === 'transfer' ? null : draft.categoryId,
    frequency: draft.frequency,
    dayOfMonth: byWeekday ? null : draft.dayOfMonth,
    weekday: byWeekday ? draft.weekday : null,
    startDate: draft.today,
    endDate: null,
    lastRunDate: null,
    active: draft.active,
    note: '',
  }
}
