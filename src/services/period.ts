/**
 * Which budget cycle is on screen, and how the settings form describes one.
 *
 * `today` is always an argument here, never read from the clock. That keeps every caller
 * testable without fake timers, and it is the reason the fortnightly anchor below is
 * reproducible.
 */

import {
  type BudgetPeriodConfig,
  type BudgetPeriodType,
  type Period,
  periodProgress,
  shiftPeriod,
} from '@/domain/period'
import type { Settings } from '@/domain/types'

/**
 * The period the switcher is pointing at.
 *
 * No special case for offset zero: `shiftPeriod` already returns `periodFor(today, config)`
 * when the offset is zero, which is exactly what `currentPeriod` computes. The store used to
 * branch between the two, and the branch was doing nothing.
 */
export function selectedPeriod(settings: Settings, periodOffset: number, today: string): Period {
  return shiftPeriod(today, settings.budgetPeriod, periodOffset)
}

/** The four cycle controls, as the settings and onboarding forms hold them. */
export interface PeriodConfigDraft {
  type: BudgetPeriodType
  anchorDay: number
  startWeekday: number
  today: string
}

/**
 * Build a cycle config from the form controls.
 *
 * Onboarding and Settings each carried an identical copy of this switch, and each followed it
 * with the same `periodFor(today, config)` preview. Two copies of a four-way branch is two
 * chances to add a fifth cycle shape to only one of them.
 */
export function periodConfigFrom(draft: PeriodConfigDraft): BudgetPeriodConfig {
  switch (draft.type) {
    case 'anchored-month':
      return { type: 'anchored-month', anchorDay: draft.anchorDay }
    case 'weekly':
      return { type: 'weekly', startWeekday: draft.startWeekday }
    case 'fortnightly':
      return { type: 'fortnightly', anchorDate: draft.today }
    case 'calendar-month':
      return { type: 'calendar-month' }
  }
}

/**
 * How far through the period we are, for the pace marker — or null when the marker would lie.
 *
 * Pace only means something for the current cycle: on a past or future one there is no "now"
 * inside the range. Home computed this unguarded and re-guarded in its template, Budgets
 * guarded inside the computed; the guard belongs with the calculation.
 */
export function currentPace(period: Period, periodOffset: number, today: string): number | null {
  return periodOffset === 0 ? periodProgress(period, today) : null
}
