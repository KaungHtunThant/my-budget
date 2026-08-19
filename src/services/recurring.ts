/**
 * Recurring rules as records.
 *
 * Today the only caller is the "add now" button, a manual stand-in for scheduled generation.
 * When generation arrives it must produce byte-identical transactions to the manual path —
 * otherwise a bill added by hand and the same bill added by the scheduler would differ — which
 * is why this is a service with one consumer rather than screen logic.
 */

import type { NewTransaction, RecurringRule } from '@/domain/types'

/**
 * Materialise a rule as a transaction on `today`.
 *
 * The rule's id is kept on the transaction so the history can show where it came from, and so a
 * future scheduler can tell whether it has already run for a period.
 */
export function transactionFromRule(rule: RecurringRule, today: string): NewTransaction {
  return {
    type: rule.type,
    amount: rule.amount,
    fx: null,
    walletId: rule.walletId,
    toWalletId: rule.toWalletId,
    toAmount: null,
    categoryId: rule.categoryId,
    date: today,
    note: rule.name,
    recurringRuleId: rule.id,
    goalId: null,
  }
}
