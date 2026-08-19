/**
 * Budgets screen logic: which categories can still take a budget, and the form's rules.
 */

import type { BaseContext } from '@/domain/budgeting'
import { budgetStatuses, budgetTotals } from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import type { BudgetPeriodConfig, Period } from '@/domain/period'
import { type AmountEntry, entryIsComplete, resolveEntry } from '@/services/fx'
import { currentPace } from '@/services/period'
import type { Budget, BudgetStatus, Category, Id, NewBudget, Transaction } from '@/domain/types'

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

export interface BudgetDraft {
  categoryId: Id | null
  /**
   * The limit as typed, with base as its target. A budget has no wallet, so base is what it is
   * measured against: `domain/budgeting` converts each transaction into base before comparing it
   * to the limit, and a limit in some other currency would be comparing two different things.
   */
  entry: AmountEntry
  rollover: boolean
}

/**
 * A budget needs a category, a limit above zero, and a rate when the limit was typed in something
 * other than base.
 */
export function canSaveBudget(draft: BudgetDraft): boolean {
  return draft.categoryId !== null && entryIsComplete(draft.entry)
}

/**
 * The budget record to persist, or null when the form is not complete.
 *
 * The limit is stored converted into base, with the conversion frozen beside it. Storing the
 * foreign amount instead would push a rate lookup into every rollup that reads a limit; keeping
 * the snapshot is what lets the form reopen showing what the user actually typed.
 */
export function buildBudget(draft: BudgetDraft): NewBudget | null {
  const resolved = resolveEntry(draft.entry)
  if (!canSaveBudget(draft) || draft.categoryId === null || resolved?.amount == null) return null

  return {
    categoryId: draft.categoryId,
    limit: resolved.amount,
    fx: resolved.fx,
    rollover: draft.rollover,
    archived: false,
  }
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
