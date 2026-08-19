/**
 * Dashboard logic: the handful of figures the home screen leads with.
 *
 * Mostly selection policy rather than arithmetic — how many budgets fit above the fold, which
 * goals are worth showing, how far back the sparkline goes. The arithmetic itself comes from
 * `src/domain`, and the trend scaling from `services/budgeting`.
 */

import {
  type BaseContext,
  type PeriodSummary,
  budgetStatuses,
  budgetTotals,
  combinedBalance,
  goalStatuses,
  periodSummary,
} from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import { type Money, zero } from '@/domain/money'
import { type BudgetPeriodConfig, type Period, daysRemaining } from '@/domain/period'
import type {
  Budget,
  BudgetStatus,
  Category,
  GoalStatus,
  Id,
  SavingsGoal,
  Transaction,
  Wallet,
} from '@/domain/types'
import { type TrendBar, trendBars, trendSeries } from '@/services/budgeting'
import { currentPace } from '@/services/period'

/** As many budgets as fit above the fold; the rest are one tap away on Budgets. */
const TOP_BUDGETS = 4
/** Two goals is enough to show momentum without pushing recent activity off screen. */
const TOP_GOALS = 2
/** Recent activity is a glance, not a history — Activity is the full list. */
const RECENT_TRANSACTIONS = 8

export interface TrendColumn extends TrendBar {
  incomeHeight: string
  expenseHeight: string
}

/** The shared trend bars, with this screen's vertical CSS units applied. */
export function trendColumns(bars: readonly TrendBar[]): TrendColumn[] {
  return bars.map((bar) => ({
    ...bar,
    incomeHeight: `${bar.incomePercent}%`,
    expenseHeight: `${bar.expensePercent}%`,
  }))
}

/**
 * The newest few transactions.
 *
 * Sorts rather than trusting the order the repository happened to return. The two orderings are
 * identical today — the repository sorts by date then `createdAt`, both descending — but relying
 * on that made a display policy depend on an undocumented guarantee two layers away.
 */
export function recentTransactions(
  transactions: readonly Transaction[],
  limit: number = RECENT_TRANSACTIONS,
): Transaction[] {
  return [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/** Goals still being saved towards, newest progress first as the domain ordered them. */
export function visibleGoals(statuses: readonly GoalStatus[]): GoalStatus[] {
  return statuses.filter((status) => !status.goal.archived).slice(0, TOP_GOALS)
}

/**
 * Every wallet balance converted into base, with any unconvertible currency reported.
 *
 * A wallet with no cached balance contributes zero *in its own currency*, so it cannot silently
 * become a base-currency zero and skew the total.
 */
export function netWorth(
  wallets: readonly Wallet[],
  balances: Readonly<Record<Id, Money>>,
  ctx: BaseContext,
): ReturnType<typeof combinedBalance> {
  return combinedBalance(
    wallets.map((w) => balances[w.id] ?? zero(w.currency)),
    ctx,
  )
}

export interface HomeInput {
  wallets: readonly Wallet[]
  balances: Readonly<Record<Id, Money>>
  transactions: readonly Transaction[]
  categories: readonly Category[]
  budgets: readonly Budget[]
  goals: readonly SavingsGoal[]
  base: CurrencyCode
  ctx: BaseContext
  period: Period
  periodConfig: BudgetPeriodConfig
  periodOffset: number
  today: string
}

export interface HomeView {
  netWorth: ReturnType<typeof combinedBalance>
  summary: PeriodSummary
  budgetSummary: ReturnType<typeof budgetTotals>
  topBudgets: BudgetStatus[]
  topGoals: GoalStatus[]
  columns: TrendColumn[]
  /** Null off the current cycle, where a pace marker would be a lie. */
  pace: number | null
  daysLeft: number
  recent: Transaction[]
}

export function homeView(input: HomeInput): HomeView {
  const statuses = budgetStatuses(
    input.budgets,
    input.categories,
    input.transactions,
    input.period,
    input.periodConfig,
    input.ctx,
  )
  const series = trendSeries(input.transactions, input.today, input.periodConfig, input.ctx)

  return {
    netWorth: netWorth(input.wallets, input.balances, input.ctx),
    summary: periodSummary(input.transactions, input.period, input.ctx),
    budgetSummary: budgetTotals(statuses, input.base),
    topBudgets: statuses.slice(0, TOP_BUDGETS),
    topGoals: visibleGoals(
      goalStatuses(input.goals, input.transactions, input.ctx, input.today, input.periodConfig),
    ),
    columns: trendColumns(trendBars(series)),
    pace: currentPace(input.period, input.periodOffset, input.today),
    daysLeft: daysRemaining(input.period, input.today),
    recent: recentTransactions(input.transactions),
  }
}
