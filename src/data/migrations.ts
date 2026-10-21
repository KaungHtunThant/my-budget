/**
 * Forward transforms between on-disk formats, one per schema bump.
 *
 * Pure: records in, records out. The same function serves every path old data can arrive by —
 * the Dexie `upgrade()` of a live database, a rebuild from an old snapshot file, and a backup
 * file imported by hand — so they cannot drift apart.
 */

import { type BudgetPeriodConfig, nextPeriod, periodFor } from '@/domain/period'
import type { Budget, Settings } from '@/domain/types'

// ---------------------------------------------------------------------------
// Schema 1 → 2: budgets become per cycle
// ---------------------------------------------------------------------------

/** A budget as schema 1 stored it: one limit per category, applying to every cycle. */
export type BudgetV1 = Omit<Budget, 'periodStart' | 'recurring'>

/** Settings as schema 1 stored them, before the recurring-copy marker existed. */
export type SettingsV1 = Omit<Settings, 'budgetsRolledInto'>

/**
 * Give every schema-1 budget its own copy in each cycle it used to apply to.
 *
 * Under schema 1 one budget covered every cycle, so the faithful translation is a copy per cycle
 * from the one holding the earliest transaction through the current one — every past month then
 * reads exactly as it did, rollovers included, since each copy's predecessor has the same limit.
 * Every copy is recurring, which is what a schema-1 budget effectively was.
 *
 * The current cycle's copy keeps the original id; earlier ones get `${id}@${periodStart}`, which
 * is deterministic so a migration run twice over the same input produces the same records.
 */
export function budgetsToV2(
  budgets: readonly BudgetV1[],
  transactions: readonly { date: string }[],
  config: BudgetPeriodConfig,
  today: string,
): Budget[] {
  const current = periodFor(today, config)
  let earliest: string | null = null
  for (const tx of transactions) {
    if (earliest === null || tx.date < earliest) earliest = tx.date
  }

  const periods = []
  let period = earliest !== null && earliest < current.start ? periodFor(earliest, config) : current
  while (period.start <= current.start) {
    periods.push(period)
    period = nextPeriod(period.start, config)
  }

  return periods.flatMap((p) =>
    budgets.map((b) => ({
      ...b,
      id: p.start === current.start ? b.id : `${b.id}@${p.start}`,
      periodStart: p.start,
      recurring: true,
    })),
  )
}

/**
 * Schema-1 settings, with the recurring-copy marker set to the current cycle: `budgetsToV2` has
 * just written that cycle's copies, so there is nothing left to roll into it.
 */
export function settingsToV2(settings: SettingsV1, today: string): Settings {
  return { ...settings, budgetsRolledInto: periodFor(today, settings.budgetPeriod).start }
}

/** The collections a format change touches, as schema 1 had them. */
export interface DataV1 {
  settings: SettingsV1
  transactions: readonly { date: string }[]
  budgets: readonly BudgetV1[]
}

/** A whole schema-1 data set, carried to schema 2. Everything not named here passes through. */
export function dataV1ToV2<T extends DataV1>(
  data: T,
  today: string,
): Omit<T, 'settings' | 'budgets'> & { settings: Settings; budgets: Budget[] } {
  return {
    ...data,
    settings: settingsToV2(data.settings, today),
    budgets: budgetsToV2(data.budgets, data.transactions, data.settings.budgetPeriod, today),
  }
}
