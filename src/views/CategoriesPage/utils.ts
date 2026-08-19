/**
 * Categories screen logic: the per-category figure beside each row.
 *
 * Only three derived values here, so the screen wires them as separate computeds rather than
 * building a view model — the tab changes far more often than the transaction list.
 */

import { type BaseContext, toBase } from '@/domain/budgeting'
import { type Money, sum } from '@/domain/money'
import type { Category, CategoryKind, Id, Transaction } from '@/domain/types'

/** The categories on the visible tab. */
export function visibleCategories(
  categories: readonly Category[],
  kind: CategoryKind,
): Category[] {
  return categories.filter((c) => c.kind === kind)
}

/** A category needs a name; the icon and colour both have defaults. */
export function canSaveCategory(name: string): boolean {
  return name.trim().length > 0
}

/**
 * This cycle's total per category, in base currency.
 *
 * **Parameterised by `kind` on purpose.** On the income tab this aggregates income, which is why
 * it is not `domain/budgeting.spendByCategory` — that function hard-wires `expensesOnly`, so
 * routing this through it would leave the income tab showing zeroes against every row.
 *
 * Amounts that cannot be converted are dropped rather than counted at face value, matching how
 * every other total in the app treats a missing rate.
 */
export function categoryTotals(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  kind: CategoryKind,
  ctx: BaseContext,
): Map<Id, Money> {
  const totals = new Map<Id, Money>()

  for (const category of categories) {
    const converted = transactions
      .filter((t) => t.categoryId === category.id && t.type === kind)
      .map((t) => toBase(t.amount, ctx))
      .filter((amount): amount is Money => amount !== null)

    totals.set(category.id, sum(converted, ctx.base))
  }

  return totals
}
