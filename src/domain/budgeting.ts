/**
 * Derived money logic: budget rollups, goal progress, report aggregation.
 *
 * Nothing here reads or writes storage — these are pure functions over records the
 * repository returned. That kept them trivially unit-testable with no database present, and
 * meant not one of them changed when persistence arrived.
 *
 * Multi-currency note: budgets, goals and reports are all expressed in the base currency.
 * A transaction in a foreign-currency wallet needs a rate to be counted. Rather than
 * silently dropping or misreporting it, every aggregate returns the set of currencies it
 * could not convert, so the UI can say what is missing.
 */

import type { CurrencyCode } from './currency'
import { type Money, add, money, percentComplete, subtract, sum, zero } from './money'
import { convert, isValidRate } from './fx'
import {
  type BudgetPeriodConfig,
  type Period,
  daysBetween,
  isWithin,
  periodFor,
  shiftPeriod,
} from './period'
import type {
  Budget,
  BudgetStatus,
  Category,
  GoalStatus,
  Id,
  SavingsGoal,
  Transaction,
} from './types'

export type Rates = Readonly<Partial<Record<CurrencyCode, number>>>

export interface BaseContext {
  readonly base: CurrencyCode
  readonly rates: Rates
}

/** Convert into base, or return null when no usable rate exists. */
export function toBase(amount: Money, ctx: BaseContext): Money | null {
  if (amount.currency === ctx.base) return amount
  const rate = ctx.rates[amount.currency]
  if (rate === undefined || !isValidRate(rate)) return null
  return convert(amount, ctx.base, rate)
}

export interface BaseTotal {
  readonly total: Money
  /** Currencies skipped for want of a rate. Empty in the common single-currency case. */
  readonly missing: CurrencyCode[]
}

function totalise(amounts: readonly Money[], ctx: BaseContext): BaseTotal {
  let minor = 0
  const missing = new Set<CurrencyCode>()
  for (const amount of amounts) {
    const converted = toBase(amount, ctx)
    if (converted === null) missing.add(amount.currency)
    else minor += converted.minor
  }
  return { total: money(minor, ctx.base), missing: [...missing] }
}

// ---------------------------------------------------------------------------
// Transaction filtering helpers
// ---------------------------------------------------------------------------

export function inPeriod(transactions: readonly Transaction[], period: Period): Transaction[] {
  return transactions.filter((t) => isWithin(t.date, period))
}

/**
 * Expenses only. Transfers are excluded on purpose: moving money between your own wallets
 * is not spending, and counting it would double-count every savings contribution.
 */
export function expensesOnly(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'expense')
}

export function incomeOnly(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'income')
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

/**
 * The budgets that plan `period`, at most one per category.
 *
 * A budget belongs to the cycle containing its `periodStart` rather than the one starting exactly
 * on it, so changing the cycle setting re-homes old budgets instead of hiding them. That is also
 * the only way two budgets for one category can meet in one cycle; the later-starting one is the
 * newer plan and wins.
 */
export function budgetsInPeriod(budgets: readonly Budget[], period: Period): Budget[] {
  const byCategory = new Map<Id, Budget>()
  for (const budget of budgets) {
    if (!isWithin(budget.periodStart, period)) continue
    const held = byCategory.get(budget.categoryId)
    if (!held || budget.periodStart > held.periodStart) byCategory.set(budget.categoryId, budget)
  }
  return [...byCategory.values()]
}

/**
 * Status of one budget for its period.
 *
 * When `rollover` is on, the unspent room of `previous` — the same category's budget in the
 * immediately preceding cycle — is carried in. No previous budget means nothing to carry: each
 * cycle has its own plan, and a cycle without one had no room to leave unspent.
 *
 * The carry deliberately does not compound across many periods: a £400 grocery budget with two
 * quiet months would otherwise present a £1,200 limit, which reads as a bug rather than a feature
 * and makes the remaining figure meaningless. It is the previous budget's own limit that counts,
 * never its own carry-in.
 */
export function budgetStatus(
  budget: Budget,
  previous: Budget | undefined,
  category: Category,
  transactions: readonly Transaction[],
  period: Period,
  config: BudgetPeriodConfig,
  ctx: BaseContext,
): BudgetStatus {
  const spentResult = spentOnCategory(transactions, budget.categoryId, period, ctx)
  const carriedIn =
    budget.rollover && previous
      ? carryInFor(previous, transactions, period, config, ctx)
      : zero(ctx.base)

  const limit = add(budget.limit, carriedIn)
  const remaining = subtract(limit, spentResult.total)

  return {
    budget,
    category,
    limit,
    spent: spentResult.total,
    remaining,
    carriedIn,
    percentUsed: limit.minor === 0 ? 0 : (spentResult.total.minor / limit.minor) * 100,
    overspent: remaining.minor < 0,
  }
}

function spentOnCategory(
  transactions: readonly Transaction[],
  categoryId: Id,
  period: Period,
  ctx: BaseContext,
): BaseTotal {
  const amounts = expensesOnly(inPeriod(transactions, period))
    .filter((t) => t.categoryId === categoryId)
    .map((t) => t.amount)
  return totalise(amounts, ctx)
}

/** What `previous` — last cycle's budget — left unspent, to carry into `period`. */
function carryInFor(
  previous: Budget,
  transactions: readonly Transaction[],
  period: Period,
  config: BudgetPeriodConfig,
  ctx: BaseContext,
): Money {
  const previousPeriod = shiftPeriod(period.start, config, -1)

  // A period entirely before any recorded history is not "unspent" — there was simply
  // nothing there yet. Carrying its full limit would invent budget out of nothing.
  const earliest = earliestDate(transactions)
  if (earliest === null || previousPeriod.end < earliest) return zero(ctx.base)

  const spent = spentOnCategory(transactions, previous.categoryId, previousPeriod, ctx).total
  const leftover = previous.limit.minor - spent.minor
  return money(Math.max(0, leftover), ctx.base)
}

function earliestDate(transactions: readonly Transaction[]): string | null {
  let earliest: string | null = null
  for (const tx of transactions) {
    if (earliest === null || tx.date < earliest) earliest = tx.date
  }
  return earliest
}

/**
 * Statuses for the budgets that plan `period`, largest limit first. Takes every budget and does
 * the selecting itself, since rollover needs the previous cycle's budgets as well.
 */
export function budgetStatuses(
  budgets: readonly Budget[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
  period: Period,
  config: BudgetPeriodConfig,
  ctx: BaseContext,
): BudgetStatus[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const previousPeriod = shiftPeriod(period.start, config, -1)
  const previousByCategory = new Map(
    budgetsInPeriod(budgets, previousPeriod).map((b) => [b.categoryId, b]),
  )
  return budgetsInPeriod(budgets, period)
    .map((b) => {
      const category = byId.get(b.categoryId)
      if (!category) return null
      const previous = previousByCategory.get(b.categoryId)
      return budgetStatus(b, previous, category, transactions, period, config, ctx)
    })
    .filter((s): s is BudgetStatus => s !== null)
    .sort((a, b) => b.limit.minor - a.limit.minor)
}

/** Totals across all budgets, for the header of the budgets screen. */
export function budgetTotals(statuses: readonly BudgetStatus[], base: CurrencyCode) {
  const budgeted = sum(statuses.map((s) => s.limit), base)
  const spent = sum(statuses.map((s) => s.spent), base)
  return {
    budgeted,
    spent,
    remaining: subtract(budgeted, spent),
    percentUsed: budgeted.minor === 0 ? 0 : (spent.minor / budgeted.minor) * 100,
    overspentCount: statuses.filter((s) => s.overspent).length,
  }
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

/**
 * Progress for one goal. Saved is the sum of transactions tagged with the goal, so a
 * contribution counts once whether it was entered by hand or produced by a payday split.
 */
export function goalStatus(
  goal: SavingsGoal,
  transactions: readonly Transaction[],
  ctx: BaseContext,
  today: string,
  config: BudgetPeriodConfig,
): GoalStatus {
  const contributions = transactions
    .filter((t) => t.goalId === goal.id)
    .map((t) => t.toAmount ?? t.amount)
  const saved = totalise(contributions, ctx).total

  const targetInBase = toBase(goal.target, ctx) ?? goal.target
  const remaining = subtract(targetInBase, saved)
  const complete = remaining.minor <= 0

  let requiredPerPeriod: Money | null = null
  if (goal.targetDate && !complete) {
    const periodsLeft = periodsBetween(today, goal.targetDate, config)
    requiredPerPeriod =
      periodsLeft > 0 ? money(Math.ceil(remaining.minor / periodsLeft), ctx.base) : remaining
  }

  return {
    goal,
    saved,
    remaining: complete ? zero(ctx.base) : remaining,
    percentComplete: percentComplete(saved, targetInBase),
    requiredPerPeriod,
    complete,
  }
}

export function goalStatuses(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[],
  ctx: BaseContext,
  today: string,
  config: BudgetPeriodConfig,
): GoalStatus[] {
  return goals.map((g) => goalStatus(g, transactions, ctx, today, config))
}

/** How many whole budget periods fit between two dates. At least 0. */
export function periodsBetween(from: string, to: string, config: BudgetPeriodConfig): number {
  if (to <= from) return 0
  const period = periodFor(from, config)
  const lengthDays = daysBetween(period.start, period.end) + 1
  return Math.max(0, Math.floor(daysBetween(from, to) / lengthDays))
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface CategoryBreakdownRow {
  readonly category: Category
  readonly amount: Money
  readonly percentOfTotal: number
  readonly transactionCount: number
}

/** Spend per category for a period, largest first. Uncategorised spend is grouped last. */
export function spendByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  period: Period,
  ctx: BaseContext,
): { rows: CategoryBreakdownRow[]; total: Money; missing: CurrencyCode[] } {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const buckets = new Map<Id, { amounts: Money[]; count: number }>()
  const missing = new Set<CurrencyCode>()

  for (const tx of expensesOnly(inPeriod(transactions, period))) {
    const key = tx.categoryId ?? '__uncategorised__'
    const bucket = buckets.get(key) ?? { amounts: [], count: 0 }
    const converted = toBase(tx.amount, ctx)
    if (converted === null) missing.add(tx.amount.currency)
    else bucket.amounts.push(converted)
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const totals = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    amount: sum(bucket.amounts, ctx.base),
    count: bucket.count,
  }))
  const grandTotal = sum(totals.map((t) => t.amount), ctx.base)

  const rows = totals
    .map(({ key, amount, count }) => {
      const category =
        byId.get(key) ??
        ({
          id: '__uncategorised__',
          name: 'Uncategorised',
          kind: 'expense',
          parentId: null,
          icon: 'help-circle-outline',
          color: 'medium',
          archived: false,
        } as Category)
      return {
        category,
        amount,
        percentOfTotal: grandTotal.minor === 0 ? 0 : (amount.minor / grandTotal.minor) * 100,
        transactionCount: count,
      }
    })
    .sort((a, b) => b.amount.minor - a.amount.minor)

  return { rows, total: grandTotal, missing: [...missing] }
}

export interface PeriodSummary {
  readonly period: Period
  readonly income: Money
  readonly expense: Money
  readonly net: Money
}

/** Income vs spend for one period. */
export function periodSummary(
  transactions: readonly Transaction[],
  period: Period,
  ctx: BaseContext,
): PeriodSummary {
  const scoped = inPeriod(transactions, period)
  const income = totalise(incomeOnly(scoped).map((t) => t.amount), ctx).total
  const expense = totalise(expensesOnly(scoped).map((t) => t.amount), ctx).total
  return { period, income, expense, net: subtract(income, expense) }
}

/** The last `count` periods ending with the one containing `date`, oldest first. */
export function periodTrend(
  transactions: readonly Transaction[],
  date: string,
  config: BudgetPeriodConfig,
  ctx: BaseContext,
  count = 6,
): PeriodSummary[] {
  const out: PeriodSummary[] = []
  for (let back = count - 1; back >= 0; back--) {
    out.push(periodSummary(transactions, shiftPeriod(date, config, -back), ctx))
  }
  return out
}

/** Combined balance across wallets, plus any currency that could not be converted. */
export function combinedBalance(balances: readonly Money[], ctx: BaseContext): BaseTotal {
  return totalise(balances, ctx)
}
