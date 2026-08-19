/**
 * Reports screen logic: chart geometry and the summary figures beneath it.
 *
 * All of this is presentation shaped by arithmetic — SVG stroke lengths, CSS widths, "averages
 * over the cycles that had activity". None of it is a rule another screen would want, which is
 * why it lives here rather than in a service. The one genuinely shared piece, scaling a trend
 * series against its peak, comes from `services/budgeting.trendBars`.
 */

import {
  type BaseContext,
  type CategoryBreakdownRow,
  type PeriodSummary,
  periodSummary,
  spendByCategory,
} from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import { type Money, money, subtract } from '@/domain/money'
import type { BudgetPeriodConfig, Period } from '@/domain/period'
import type { Category, Transaction } from '@/domain/types'
import { type TrendBar, trendBars, trendSeries } from '@/services/budgeting'

/** Radius of the donut in the SVG's own 120x120 coordinate space. */
const DONUT_RADIUS = 52
/** Beyond eight slices the ring is unreadable, and the list below carries the rest. */
const DONUT_SLICES = 8

export interface DonutSegment {
  color: string
  /** SVG `stroke-dasharray`: the drawn arc, then the gap that completes the circle. */
  dash: string
  /** SVG `stroke-dashoffset`. Negative, because the arcs advance clockwise. */
  offset: number
  name: string
}

/**
 * The ring, as stroke dashes on one circle.
 *
 * Each slice is drawn as a dash long enough to cover its share of the circumference, pushed
 * round by the total length of everything before it. Returns nothing at all when there is no
 * spending — a ring of zero-length arcs would still paint the track and imply data.
 */
export function donutSegments(
  rows: readonly CategoryBreakdownRow[],
  total: Money,
): DonutSegment[] {
  if (total.minor === 0) return []

  const circumference = 2 * Math.PI * DONUT_RADIUS
  let offset = 0

  return rows.slice(0, DONUT_SLICES).map((row) => {
    const length = (row.amount.minor / total.minor) * circumference
    const segment: DonutSegment = {
      color: `var(--ion-color-${row.category.color})`,
      dash: `${length} ${circumference - length}`,
      offset: -offset,
      name: row.category.name,
    }
    offset += length
    return segment
  })
}

export interface TrendRow extends TrendBar {
  incomeWidth: string
  expenseWidth: string
}

/** The shared trend bars, with this screen's horizontal CSS units applied. */
export function trendRows(bars: readonly TrendBar[]): TrendRow[] {
  return bars.map((bar) => ({
    ...bar,
    incomeWidth: `${bar.incomePercent}%`,
    expenseWidth: `${bar.expensePercent}%`,
  }))
}

export interface TrendAverages {
  income: Money
  expense: Money
  saved: Money
  /** How many cycles the averages are over — zero when nothing has happened yet. */
  periods: number
}

/**
 * Means across the cycles that actually have activity.
 *
 * Dividing by all six would halve every figure on a three-month-old install, which reads as a
 * drop in spending rather than a shorter history. `periods` is reported so the screen can say
 * what the average is over.
 */
export function trendAverages(
  series: readonly PeriodSummary[],
  base: CurrencyCode,
): TrendAverages {
  const active = series.filter((t) => t.income.minor !== 0 || t.expense.minor !== 0)
  const divisor = Math.max(1, active.length)
  const income = active.reduce((total, t) => total + t.income.minor, 0)
  const expense = active.reduce((total, t) => total + t.expense.minor, 0)

  return {
    income: money(Math.round(income / divisor), base),
    expense: money(Math.round(expense / divisor), base),
    saved: money(Math.round((income - expense) / divisor), base),
    periods: active.length,
  }
}

/**
 * Share of income kept, as a percentage — or null when there was no income to keep any of.
 *
 * Null rather than zero: a cycle with no income has no savings rate, and showing 0% would read
 * as "saved nothing" instead of "not applicable".
 */
export function savingsRate(summary: PeriodSummary): number | null {
  if (summary.income.minor <= 0) return null
  return (subtract(summary.income, summary.expense).minor / summary.income.minor) * 100
}

export interface ReportsInput {
  transactions: readonly Transaction[]
  categories: readonly Category[]
  base: CurrencyCode
  ctx: BaseContext
  period: Period
  periodConfig: BudgetPeriodConfig
  today: string
}

export interface ReportsView {
  summary: PeriodSummary
  breakdown: ReturnType<typeof spendByCategory>
  donut: DonutSegment[]
  rows: TrendRow[]
  averages: TrendAverages
  savingsRate: number | null
}

/**
 * Everything the screen renders, in one pass.
 *
 * Bundled rather than exported as separate computeds because this screen has no UI state at
 * all — every value below depends on the same inputs, so there is nothing for finer-grained
 * caching to save.
 */
export function reportsView(input: ReportsInput): ReportsView {
  const summary = periodSummary(input.transactions, input.period, input.ctx)
  const breakdown = spendByCategory(
    input.transactions,
    input.categories,
    input.period,
    input.ctx,
  )
  const series = trendSeries(input.transactions, input.today, input.periodConfig, input.ctx)

  return {
    summary,
    breakdown,
    donut: donutSegments(breakdown.rows, breakdown.total),
    rows: trendRows(trendBars(series)),
    averages: trendAverages(series, input.base),
    savingsRate: savingsRate(summary),
  }
}
