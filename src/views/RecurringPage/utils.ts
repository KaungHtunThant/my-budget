/**
 * Recurring rules screen logic: the monthly commitment figure, and how a rule reads in words.
 *
 * The rule-to-transaction conversion is *not* here — it lives in `services/recurring`, because a
 * scheduler will eventually have to produce byte-identical transactions to this screen's
 * "add now" button.
 */

import type { CurrencyCode } from '@/domain/currency'
import { type Money, multiply, sum } from '@/domain/money'
import { WEEKDAY_NAMES } from '@/domain/period'
import type {
  Id,
  NewRecurringRule,
  RecurrenceFrequency,
  RecurringRule,
  TransactionType,
  Wallet,
} from '@/domain/types'
import { isPositiveAmount } from '@/services/money'

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
}

/**
 * Active rules as one monthly-equivalent figure per direction.
 *
 * Only active rules count — a paused rule is not a commitment. Amounts are built through
 * `domain/money`, which rejects a fractional minor value; the previous version assembled
 * `{ minor, currency }` by hand after its own rounding.
 */
export function monthlyCommitment(
  rules: readonly RecurringRule[],
  base: CurrencyCode,
): MonthlyCommitment {
  const perMonth = (rule: RecurringRule): Money =>
    multiply(rule.amount, monthlyFactor(rule.frequency))

  const forType = (type: TransactionType): Money =>
    sum(
      rules.filter((r) => r.active && r.type === type).map(perMonth),
      base,
    )

  return { income: forType('income'), expense: forType('expense') }
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

/** A rule needs a name, an amount above zero, and a wallet. */
export function canSaveRule(
  name: string,
  amountText: string,
  walletId: Id | null,
  base: CurrencyCode,
): boolean {
  return name.trim().length > 0 && isPositiveAmount(amountText, base) && walletId !== null
}

export interface RuleDraft {
  name: string
  type: TransactionType
  amount: Money
  walletId: Id
  categoryId: Id | null
  frequency: RecurrenceFrequency
  dayOfMonth: number
  weekday: number
  active: boolean
  today: string
}

/**
 * The rule record to persist.
 *
 * `dayOfMonth` and `weekday` are mutually exclusive — whichever the frequency does not use is
 * nulled, so a rule switched from monthly to weekly cannot keep a stale day of month that a
 * scheduler would later read. A transfer carries no category.
 */
export function buildRule(draft: RuleDraft): NewRecurringRule {
  const byWeekday = usesWeekday(draft.frequency)

  return {
    name: draft.name.trim(),
    type: draft.type,
    amount: draft.amount,
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
