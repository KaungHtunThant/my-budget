/**
 * The conversion context every rollup needs, and the trend series two screens share.
 *
 * Deliberately thin: where a screen needs one of `src/domain/budgeting`'s rollups with no extra
 * argument threading — `periodSummary`, `spendByCategory`, `budgetStatuses`, `goalStatuses` — it
 * calls domain directly. A service whose body is a single forwarding call is noise.
 */

import {
  type BaseContext,
  type BaseTotal,
  type PeriodSummary,
  combinedBalance,
  periodTrend,
} from '@/domain/budgeting'
import { type Money, toFloat, zero } from '@/domain/money'
import type { BudgetPeriodConfig } from '@/domain/period'
import type { Id, Settings, Transaction, Wallet } from '@/domain/types'

/** The `{ base, rates }` pair threaded through every conversion in the domain layer. */
export function baseContext(settings: Settings): BaseContext {
  return { base: settings.baseCurrency, rates: settings.rates }
}

/**
 * Every wallet balance converted into base, with any unconvertible currency reported.
 *
 * Shared by Home and Wallets. The argument threading is the reason it is here rather than a
 * direct `combinedBalance` call at each site: the balances arrive as a keyed cache and have to
 * be zipped against the wallet list, and a wallet with no cached balance must contribute zero
 * *in its own currency* — a base-currency zero would make a rate-less wallet look convertible
 * and quietly count it.
 */
export function netWorth(
  wallets: readonly Wallet[],
  balances: Readonly<Record<Id, Money>>,
  ctx: BaseContext,
): BaseTotal {
  return combinedBalance(
    wallets.map((w) => balances[w.id] ?? zero(w.currency)),
    ctx,
  )
}

/**
 * How many cycles the trend covers. Was a bare `6` in the store and again in two view headings,
 * so a change meant finding three of them.
 */
export const TREND_PERIODS = 6

export function trendSeries(
  transactions: readonly Transaction[],
  today: string,
  config: BudgetPeriodConfig,
  ctx: BaseContext,
  count: number = TREND_PERIODS,
): PeriodSummary[] {
  return periodTrend(transactions, today, config, ctx, count)
}

/** One bar pair in the trend chart, scaled against the tallest value on show. */
export interface TrendBar {
  label: string
  /** Three-character form for a cramped axis — "Aug" out of "August 2026". */
  short: string
  income: Money
  expense: Money
  net: Money
  /** 0–100. Home reads these as heights, Reports as widths. */
  incomePercent: number
  expensePercent: number
}

/**
 * Scale a trend series for display.
 *
 * Home and Reports each computed the peak with a character-identical expression and derived the
 * same three-character label, differing only in which CSS dimension they applied it to. Percent
 * is returned as a number rather than a `'42%'` string precisely so both can: the unit belongs
 * to the template, not to the calculation.
 *
 * The floor of 1 matters — with no activity at all every value is zero, and dividing by the
 * peak would otherwise produce NaN widths.
 */
export function trendBars(series: readonly PeriodSummary[]): TrendBar[] {
  const peak = Math.max(1, ...series.flatMap((t) => [toFloat(t.income), toFloat(t.expense)]))
  return series.map((t) => ({
    label: t.period.label,
    short: t.period.label.split(' ')[0].slice(0, 3),
    income: t.income,
    expense: t.expense,
    net: t.net,
    incomePercent: (toFloat(t.income) / peak) * 100,
    expensePercent: (toFloat(t.expense) / peak) * 100,
  }))
}
