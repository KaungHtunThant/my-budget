/**
 * Goal contributions as records.
 *
 * A contribution is not its own entity — it is a transfer into the goal's wallet, tagged with
 * the goal so `goalStatus` can find it again. That invariant was buried inside a store action,
 * where it could not be tested without a repository; it is the whole reason goal progress adds
 * up, so it belongs somewhere assertable.
 */

import type { Money } from '@/domain/money'
import type { Id, NewTransaction, SavingsGoal } from '@/domain/types'

/**
 * The transfer that records money moving into a goal.
 *
 * `toAmount` equals `amount` because both wallets are the user's own and no conversion is
 * offered on this path — a cross-currency contribution would need a rate, which the
 * contribution form does not ask for.
 */
export function contributionTransaction(
  goal: SavingsGoal,
  fromWalletId: Id,
  amount: Money,
  today: string,
): NewTransaction {
  return {
    type: 'transfer',
    amount,
    fx: null,
    walletId: fromWalletId,
    toWalletId: goal.walletId,
    toAmount: amount,
    categoryId: null,
    date: today,
    note: goal.name,
    recurringRuleId: null,
    goalId: goal.id,
  }
}
