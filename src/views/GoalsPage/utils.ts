/**
 * Goals screen logic: the two lists, the two forms, and which wallet each defaults to.
 *
 * The default-wallet rules are the interesting part. They are guesses, but good ones — and
 * getting them wrong means the user silently saves into, or out of, the wrong account.
 */

import type { CurrencyCode } from '@/domain/currency'
import type { GoalStatus, Id, SavingsGoal, Wallet } from '@/domain/types'
import { isPositiveAmount } from '@/services/money'

/** Goals still being saved towards. */
export function activeGoals(statuses: readonly GoalStatus[]): GoalStatus[] {
  return statuses.filter((s) => !s.complete)
}

/** Goals that have reached their target, listed separately so they read as achievements. */
export function completedGoals(statuses: readonly GoalStatus[]): GoalStatus[] {
  return statuses.filter((s) => s.complete)
}

/** A goal needs a name, a target above zero, and somewhere to keep the money. */
export function canSaveGoal(
  name: string,
  targetText: string,
  walletId: Id | null,
  base: CurrencyCode,
): boolean {
  return name.trim().length > 0 && isPositiveAmount(targetText, base) && walletId !== null
}

/** A contribution needs an amount above zero and a wallet to take it from. */
export function canContribute(
  amountText: string,
  fromWalletId: Id | null,
  base: CurrencyCode,
): boolean {
  return isPositiveAmount(amountText, base) && fromWalletId !== null
}

/**
 * Where a new goal should keep its money.
 *
 * A savings wallet if there is one, since that is what people open them for; otherwise the first
 * wallet, so the form is never unanswerable.
 */
export function defaultGoalWallet(wallets: readonly Wallet[]): Id | null {
  return wallets.find((w) => w.kind === 'savings')?.id ?? wallets[0]?.id ?? null
}

/**
 * Where a contribution should come from.
 *
 * Any wallet other than the goal's own, because a transfer from an account to itself moves
 * nothing. Falls back to the first wallet when that is the only one there is — the form still
 * refuses to save it, but the select is not left empty.
 */
export function defaultContributionWallet(
  wallets: readonly Wallet[],
  goal: SavingsGoal,
): Id | null {
  return wallets.find((w) => w.id !== goal.walletId)?.id ?? wallets[0]?.id ?? null
}
