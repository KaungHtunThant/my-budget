/**
 * Restoring a backup: reading a file any version of the app wrote, and folding it into the data
 * already on the device.
 *
 * **Versioned restore.** Every file names the app version that wrote it (`appVersion`, from 2.0.0
 * on; older files are recognised by their schema). That version is checked first and picks the
 * reader from `RESTORERS` — one entry per file format the app has ever written, never edited, only
 * appended. The reader validates the shape its format must have, and the result is carried forward
 * one schema step at a time to the current format. So a backup made today still restores after
 * the next three format changes, and a backup from a newer app is refused instead of guessed at.
 *
 * Pure: text and records in, records out. The store does the reading of files and the writing.
 */

import type { Budget, Id } from '@/domain/types'

import { SCHEMA_VERSION } from './db'
import type { SeedData } from './fixtures'
import { type DataV1, dataV1ToV2 } from './migrations'
import { APP_VERSION, compareVersions, isNewerMajor } from './version'

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>

/** One file format: the first app version that wrote it, its schema, and what it must contain. */
export interface Restorer {
  /** First app version that wrote this format. */
  since: string
  schema: number
  /** Why `raw` is not a valid file of this format, or null when it is. */
  validate(raw: Raw): string | null
}

const COLLECTIONS = ['wallets', 'categories', 'transactions', 'budgets', 'rules', 'goals'] as const
export type Collection = (typeof COLLECTIONS)[number]

/** What every format so far has in common: settings and the six collections. */
function validateCommon(raw: Raw): string | null {
  const settings = raw.settings as Raw | undefined
  if (!settings || typeof settings !== 'object') return 'It has no settings.'
  if (typeof settings.baseCurrency !== 'string') return 'Its settings have no main currency.'
  if (!settings.budgetPeriod || typeof settings.budgetPeriod !== 'object') {
    return 'Its settings have no budget cycle.'
  }
  for (const name of COLLECTIONS) {
    if (!Array.isArray(raw[name])) return `It has no ${name} list.`
  }
  return null
}

/** Schema 1, written by 1.x: one budget per category, applying to every cycle. */
const readV1: Restorer = {
  since: '1.0.0',
  schema: 1,
  validate: validateCommon,
}

/** Schema 2, from 2.0.0: per-cycle budgets and the recurring-copy marker. */
const readV2: Restorer = {
  since: '2.0.0',
  schema: 2,
  validate(raw) {
    const common = validateCommon(raw)
    if (common) return common
    const budgets = raw.budgets as Raw[]
    if (budgets.some((b) => typeof b?.periodStart !== 'string')) {
      return 'A budget in it has no cycle.'
    }
    return null
  },
}

/** Every format the app has written, oldest first. Append a reader and a step; never edit one. */
export const RESTORERS: readonly Restorer[] = [readV1, readV2]

/** The step from schema `n` to `n + 1`, keyed by `n`. */
const FORWARD: Record<number, (data: Raw, today: string) => Raw> = {
  1: (data, today) => dataV1ToV2(data as unknown as SeedData & DataV1, today) as unknown as Raw,
}

/** App version assumed for a file that does not say: everything before 2.0.0 wrote schema 1. */
const LEGACY_VERSION = '1.0.0'

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export type RestoreResult =
  | {
      ok: true
      /** In the current format, ready to load. */
      data: SeedData
      /** The version that wrote the file, or null for one written before 2.0.0. */
      appVersion: string | null
      /** The file's own schema. */
      schemaVersion: number
      /** True when the file was an older format and has been carried forward to this one. */
      converted: boolean
      exportedAt: string | null
    }
  | { ok: false; reason: string }

const NOT_A_BACKUP = 'This isn’t a My Budget backup.'

/** Restore from a file's text. */
export function restoreBackup(text: string, today: string): RestoreResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: NOT_A_BACKUP }
  }
  return restoreParsed(raw, today)
}

/** Restore from an already-parsed file — the snapshot backstop arrives this way. */
export function restoreParsed(raw: unknown, today: string): RestoreResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: NOT_A_BACKUP }
  const file = raw as Raw

  // 1. Which app wrote it. A file without `appVersion` predates 2.0.0.
  const stated = typeof file.appVersion === 'string' ? file.appVersion : null
  const schemaVersion = file.schemaVersion
  if (stated === null && typeof schemaVersion !== 'number') return { ok: false, reason: NOT_A_BACKUP }
  const version = stated ?? LEGACY_VERSION

  // 2. A newer app's file is refused, not guessed at.
  if (isNewerMajor(version, APP_VERSION) || (typeof schemaVersion === 'number' && schemaVersion > SCHEMA_VERSION)) {
    return {
      ok: false,
      reason: `This backup was made by My Budget ${stated ?? 'a newer version'}. Update the app to restore it.`,
    }
  }

  // 3. The reader for that version: the latest format it could have written.
  const restorer = [...RESTORERS].reverse().find((r) => compareVersions(r.since, version) <= 0)
  if (!restorer) return { ok: false, reason: NOT_A_BACKUP }
  if (schemaVersion !== undefined && schemaVersion !== restorer.schema) {
    return { ok: false, reason: 'This backup is damaged: its version and its contents disagree.' }
  }
  const invalid = restorer.validate(file)
  if (invalid) return { ok: false, reason: `This backup can’t be read. ${invalid}` }

  // 4. Carried forward one schema at a time to the current format.
  let data: Raw = file
  for (let schema = restorer.schema; schema < SCHEMA_VERSION; schema++) {
    data = FORWARD[schema](data, today)
  }

  const { appVersion: _a, schemaVersion: _s, exportedAt, ...collections } = data
  return {
    ok: true,
    data: collections as unknown as SeedData,
    appVersion: stated,
    schemaVersion: restorer.schema,
    converted: restorer.schema < SCHEMA_VERSION,
    exportedAt: typeof exportedAt === 'string' ? exportedAt : null,
  }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export interface CollectionPlan {
  /** In the backup only. */
  added: number
  /** On both, the same. */
  identical: number
  /** On both, different: one side has to win. */
  conflicts: number
}

export type ImportPlan = Record<Collection, CollectionPlan> & { total: CollectionPlan }

type Keyed = { id: Id }

/** JSON with sorted keys, so two equal records compare equal whatever order their keys were in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Raw)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** A budget's identity beyond its id: one plan per category per cycle. */
const budgetKey = (b: Budget): string => `${b.categoryId}|${b.periodStart}`

/** The device record `incoming` would meet: same id, or for a budget, same category and cycle. */
function counterpart<T extends Keyed>(
  collection: Collection,
  incoming: T,
  byId: Map<Id, T>,
  byKey: Map<string, T>,
): T | undefined {
  return (
    byId.get(incoming.id) ??
    (collection === 'budgets' ? byKey.get(budgetKey(incoming as unknown as Budget)) : undefined)
  )
}

function indexes<T extends Keyed>(collection: Collection, records: readonly T[]) {
  const byId = new Map(records.map((r) => [r.id, r]))
  const byKey =
    collection === 'budgets'
      ? new Map(records.map((r) => [budgetKey(r as unknown as Budget), r]))
      : new Map<string, T>()
  return { byId, byKey }
}

/** Compare a record ignoring its id — a budget matched by category and cycle may differ only there. */
const sameContent = (a: Keyed, b: Keyed): boolean =>
  canonical({ ...a, id: null }) === canonical({ ...b, id: null })

/**
 * What importing `incoming` into `device` would do, counted per collection — the dry run shown
 * before anything is asked. Records only on the device are not counted: a merge keeps them.
 */
export function planImport(device: SeedData, incoming: SeedData): ImportPlan {
  const total: CollectionPlan = { added: 0, identical: 0, conflicts: 0 }
  const plan = { total } as ImportPlan
  for (const name of COLLECTIONS) {
    const counts: CollectionPlan = { added: 0, identical: 0, conflicts: 0 }
    const { byId, byKey } = indexes<Keyed>(name, device[name])
    for (const record of incoming[name] as Keyed[]) {
      const match = counterpart(name, record, byId, byKey)
      if (!match) counts.added++
      else if (sameContent(match, record)) counts.identical++
      else counts.conflicts++
    }
    plan[name] = counts
    total.added += counts.added
    total.identical += counts.identical
    total.conflicts += counts.conflicts
  }
  return plan
}

export type Winner = 'incoming' | 'device'

/**
 * The device's data with the backup folded in. Records on one side only are kept; where both have
 * one, `winner` decides — once, for the whole import, rather than record by record.
 *
 * Settings stay the device's, since they describe how this phone is set up, but gain any currency
 * and rate the backup knows and the device does not — or its foreign amounts could not be totalled.
 */
export function mergeBackup(device: SeedData, incoming: SeedData, winner: Winner): SeedData {
  const merged = { ...device } as SeedData
  for (const name of COLLECTIONS) {
    const { byId, byKey } = indexes<Keyed>(name, device[name])
    const result = new Map<Id, Keyed>((device[name] as Keyed[]).map((r) => [r.id, r]))
    for (const record of incoming[name] as Keyed[]) {
      const match = counterpart(name, record, byId, byKey)
      if (!match) result.set(record.id, record)
      else if (winner === 'incoming') {
        result.delete(match.id)
        result.set(record.id, record)
      }
    }
    ;(merged as unknown as Record<Collection, Keyed[]>)[name] = [...result.values()]
  }

  const mine = device.settings
  const theirs = incoming.settings
  merged.settings = {
    ...mine,
    activeCurrencies: [...new Set([...mine.activeCurrencies, ...theirs.activeCurrencies])],
    rates: { ...theirs.rates, ...mine.rates },
    budgetsRolledInto: later(mine.budgetsRolledInto, theirs.budgetsRolledInto),
  }
  return merged
}

function later(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return a > b ? a : b
}
