/**
 * Budget periods.
 *
 * The period is a user setting rather than a fixed calendar month, because a salary that
 * lands on the 25th makes a 25th-to-24th cycle the one that actually matters. All four
 * shapes below produce a half-open [start, end] range of ISO dates that budget and report
 * queries filter on.
 *
 * Dates are ISO "YYYY-MM-DD" strings throughout. They sort lexicographically, survive
 * serialization unchanged, and carry no timezone — a transaction dated the 3rd is the 3rd
 * regardless of where the phone is.
 */

export type BudgetPeriodType = 'calendar-month' | 'anchored-month' | 'weekly' | 'fortnightly'

export interface BudgetPeriodConfig {
  readonly type: BudgetPeriodType
  /**
   * For `anchored-month`: the day the cycle starts, 1–28. Capped at 28 so every month
   * has the day — a 31st anchor would silently shift in February.
   */
  readonly anchorDay?: number
  /** For `weekly`: 0 = Sunday … 6 = Saturday. */
  readonly startWeekday?: number
  /** For `fortnightly`: any ISO date the cycle is known to have started on. */
  readonly anchorDate?: string
}

export interface Period {
  /** First date included, ISO. */
  readonly start: string
  /** Last date included, ISO — inclusive, so queries use `date >= start && date <= end`. */
  readonly end: string
  /** Human label, e.g. "August 2026" or "25 Jul – 24 Aug". */
  readonly label: string
}

export const DEFAULT_PERIOD_CONFIG: BudgetPeriodConfig = { type: 'calendar-month' }

const MS_PER_DAY = 86_400_000

export function todayIso(): string {
  return toIso(new Date())
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse an ISO date into a local-midnight Date, avoiding UTC-shift surprises. */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(fromIso(iso).getTime() + days * MS_PER_DAY))
}

export function addMonths(iso: string, months: number): string {
  const d = fromIso(iso)
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  // Clamp for short months: 31 Jan + 1 month is 28/29 Feb, not 2/3 Mar.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDay))
  return toIso(d)
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((fromIso(toIsoDate).getTime() - fromIso(fromIsoDate).getTime()) / MS_PER_DAY)
}

export function isWithin(iso: string, period: Period): boolean {
  return iso >= period.start && iso <= period.end
}

/** The period containing `date` under the given configuration. */
export function periodFor(date: string, config: BudgetPeriodConfig): Period {
  switch (config.type) {
    case 'calendar-month':
      return calendarMonthPeriod(date)
    case 'anchored-month':
      return anchoredMonthPeriod(date, clampAnchorDay(config.anchorDay ?? 1))
    case 'weekly':
      return weeklyPeriod(date, config.startWeekday ?? 1)
    case 'fortnightly':
      return fortnightlyPeriod(date, config.anchorDate ?? date)
  }
}

export function currentPeriod(config: BudgetPeriodConfig): Period {
  return periodFor(todayIso(), config)
}

/** Step `offset` periods forward (positive) or back (negative) from the one holding `date`. */
export function shiftPeriod(date: string, config: BudgetPeriodConfig, offset: number): Period {
  const base = periodFor(date, config)
  if (offset === 0) return base

  switch (config.type) {
    case 'calendar-month':
    case 'anchored-month':
      return periodFor(addMonths(base.start, offset), config)
    case 'weekly':
      return periodFor(addDays(base.start, offset * 7), config)
    case 'fortnightly':
      return periodFor(addDays(base.start, offset * 14), config)
  }
}

export function nextPeriod(date: string, config: BudgetPeriodConfig): Period {
  return shiftPeriod(date, config, 1)
}

export function previousPeriod(date: string, config: BudgetPeriodConfig): Period {
  return shiftPeriod(date, config, -1)
}

/** How far through the period `date` sits, 0–1. Drives the "pace" indicator on budgets. */
export function periodProgress(period: Period, date: string): number {
  const total = daysBetween(period.start, period.end) + 1
  if (total <= 0) return 0
  const elapsed = daysBetween(period.start, date) + 1
  return Math.max(0, Math.min(1, elapsed / total))
}

export function daysRemaining(period: Period, date: string): number {
  return Math.max(0, daysBetween(date, period.end))
}

/** Short description of a configuration, for the settings row. */
export function describePeriodConfig(config: BudgetPeriodConfig): string {
  switch (config.type) {
    case 'calendar-month':
      return 'Calendar month (1st to end of month)'
    case 'anchored-month': {
      const day = clampAnchorDay(config.anchorDay ?? 1)
      return `Monthly, starting on day ${day}`
    }
    case 'weekly':
      return `Weekly, starting ${WEEKDAY_NAMES[config.startWeekday ?? 1]}`
    case 'fortnightly':
      return `Every 2 weeks from ${config.anchorDate ?? 'today'}`
  }
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function clampAnchorDay(day: number): number {
  return Math.max(1, Math.min(28, Math.trunc(day)))
}

function calendarMonthPeriod(date: string): Period {
  const d = fromIso(date)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: toIso(start),
    end: toIso(end),
    label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(start),
  }
}

function anchoredMonthPeriod(date: string, anchorDay: number): Period {
  const d = fromIso(date)
  // If we are before the anchor this month, the cycle began last month.
  const startMonthOffset = d.getDate() >= anchorDay ? 0 : -1
  const start = new Date(d.getFullYear(), d.getMonth() + startMonthOffset, anchorDay)
  const end = new Date(d.getFullYear(), d.getMonth() + startMonthOffset + 1, anchorDay - 1)
  return { start: toIso(start), end: toIso(end), label: rangeLabel(toIso(start), toIso(end)) }
}

function weeklyPeriod(date: string, startWeekday: number): Period {
  const d = fromIso(date)
  const diff = (d.getDay() - startWeekday + 7) % 7
  const start = addDays(date, -diff)
  const end = addDays(start, 6)
  return { start, end, label: rangeLabel(start, end) }
}

function fortnightlyPeriod(date: string, anchorDate: string): Period {
  const offset = daysBetween(anchorDate, date)
  // Floor division so dates before the anchor still land on a cycle boundary.
  const cycles = Math.floor(offset / 14)
  const start = addDays(anchorDate, cycles * 14)
  const end = addDays(start, 13)
  return { start, end, label: rangeLabel(start, end) }
}

function rangeLabel(start: string, end: string): string {
  const s = fromIso(start)
  const e = fromIso(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const startFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startFmt.format(s)} – ${endFmt.format(e)}`
}
