/**
 * Recurring budgets: which cycles still need their copies, and the copies themselves.
 *
 * Each cycle has its own budgets. One marked recurring is copied into the next cycle when that
 * cycle starts, so a plan the user keeps month after month is entered once. These build the
 * records; the store writes them (`rollRecurringBudgets`), in order, oldest cycle first.
 */

import { budgetsInPeriod } from '@/domain/budgeting'
import {
  type BudgetPeriodConfig,
  type Period,
  nextPeriod,
  periodFor,
  shiftPeriod,
} from '@/domain/period'
import type { Budget, NewBudget } from '@/domain/types'

/** More cycles than any real gap between launches — a guard against a corrupt marker, not a rule. */
export const MAX_ROLL_PERIODS = 500

/**
 * Every cycle that has started since `rolledInto`, up to and including the one holding `today`,
 * oldest first. Cycles that began while the app was closed are included, so each still gets its
 * copies and history stays continuous. Before any marker exists only the current cycle is due.
 */
export function periodsToRoll(
  rolledInto: string | null,
  today: string,
  config: BudgetPeriodConfig,
): Period[] {
  const current = periodFor(today, config)
  if (rolledInto === null) return [current]
  if (rolledInto >= current.start) return []

  const due: Period[] = []
  let period = nextPeriod(rolledInto, config)
  while (period.start <= current.start && due.length < MAX_ROLL_PERIODS) {
    due.push(period)
    period = nextPeriod(period.start, config)
  }
  return due
}

/**
 * The copies `period` is owed: one for each recurring budget in `previous` whose category has no
 * budget in `period` yet.
 *
 * Copying only from the immediately preceding cycle is the point. Deleting this cycle's budget, or
 * turning its "repeat" off, ends the chain; editing this cycle's limit carries into the next copy;
 * and a budget the user planned ahead by hand is never overwritten.
 */
export function recurringCopies(
  budgets: readonly Budget[],
  period: Period,
  previous: Period,
): NewBudget[] {
  const planned = new Set(budgetsInPeriod(budgets, period).map((b) => b.categoryId))
  return budgetsInPeriod(budgets, previous)
    .filter((b) => b.recurring && !b.archived && !planned.has(b.categoryId))
    .map((b) => ({
      categoryId: b.categoryId,
      periodStart: period.start,
      limit: b.limit,
      fx: b.fx ?? null,
      rollover: b.rollover,
      recurring: true,
      archived: false,
    }))
}

/**
 * Everything one roll writes: the copies for every due cycle, oldest first, and the new marker.
 * Null when no cycle is due.
 *
 * Cycles are worked through in order against a running list, so a copy made for June is what
 * July's copy is made from — exactly as if the app had been opened on the first of each month.
 */
export function recurringRoll(
  budgets: readonly Budget[],
  rolledInto: string | null,
  today: string,
  config: BudgetPeriodConfig,
): { copies: NewBudget[]; rolledInto: string } | null {
  const due = periodsToRoll(rolledInto, today, config)
  if (due.length === 0) return null

  const working: Budget[] = [...budgets]
  const copies: NewBudget[] = []
  for (const period of due) {
    const made = recurringCopies(working, period, shiftPeriod(period.start, config, -1))
    copies.push(...made)
    working.push(...made.map((b, i) => ({ ...b, id: `pending_${period.start}_${i}` })))
  }
  return { copies, rolledInto: due[due.length - 1].start }
}
