/**
 * Budgets screen logic: which categories can still take a budget, and the form's rules.
 */

import type { BaseContext } from '@/domain/budgeting'
import { budgetStatuses, budgetTotals } from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import type { BudgetPeriodConfig, Period } from '@/domain/period'
import { isPositiveAmount } from '@/services/money'
import { currentPace } from '@/services/period'
import type { Budget, BudgetStatus, Category, Id, Transaction } from '@/domain/types'

/**
 * Expense categories that do not have a budget yet.
 *
 * The category currently being edited is kept in the list, or its own select would show blank
 * while editing it.
 */
export function availableCategories(
  categories: readonly Category[],
  budgets: readonly Budget[],
  editingCategoryId: Id | null,
): Category[] {
  const used = new Set(budgets.map((b) => b.categoryId))
  return categories.filter((c) => !used.has(c.id) || c.id === editingCategoryId)
}

/** A budget needs a category and a limit above zero. */
export function canSaveBudget(
  categoryId: Id | null,
  limitText: string,
  base: CurrencyCode,
): boolean {
  return categoryId !== null && isPositiveAmount(limitText, base)
}

export interface BudgetsInput {
  budgets: readonly Budget[]
  categories: readonly Category[]
  transactions: readonly Transaction[]
  base: CurrencyCode
  ctx: BaseContext
  period: Period
  periodConfig: BudgetPeriodConfig
  periodOffset: number
  today: string
}

export interface BudgetsView {
  statuses: BudgetStatus[]
  summary: ReturnType<typeof budgetTotals>
  /** Null off the current cycle, where a pace marker would be a lie. */
  pace: number | null
}

export function budgetsView(input: BudgetsInput): BudgetsView {
  const statuses = budgetStatuses(
    input.budgets,
    input.categories,
    input.transactions,
    input.period,
    input.periodConfig,
    input.ctx,
  )

  return {
    statuses,
    summary: budgetTotals(statuses, input.base),
    pace: currentPace(input.period, input.periodOffset, input.today),
  }
}
