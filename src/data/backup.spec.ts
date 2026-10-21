import { describe, expect, it } from 'vitest'

import { fromMajor } from '@/domain/money'
import type { Budget, Wallet } from '@/domain/types'

import { RESTORERS, mergeBackup, planImport, restoreBackup } from './backup'
import { SCHEMA_VERSION } from './db'
import { type SeedData, buildSeed } from './fixtures'
import { buildSnapshot } from './snapshot'
import { APP_VERSION, compareVersions } from './version'

const TODAY = '2026-08-20'

/** A small, real data set: seeded settings and categories plus one wallet and one budget. */
function data(overrides: Partial<SeedData> = {}): SeedData {
  const seed = buildSeed({})
  return {
    ...seed,
    settings: { ...seed.settings, onboardingComplete: true, budgetsRolledInto: '2026-08-01' },
    wallets: [wallet()],
    budgets: [budget()],
    ...overrides,
  }
}

const wallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: 'wal_1',
  name: 'Cash',
  kind: 'cash',
  currency: 'USD',
  openingBalance: fromMajor(100, 'USD'),
  icon: 'cash-outline',
  color: 'success',
  archived: false,
  createdAt: '2026-08-01',
  ...overrides,
})

const budget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'bdg_1',
  categoryId: 'cat_seed_5',
  periodStart: '2026-08-01',
  limit: fromMajor(400, 'USD'),
  rollover: false,
  recurring: true,
  archived: false,
  ...overrides,
})

/** A file exactly as this build would write it. */
const fileOf = (d: SeedData, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...buildSnapshot(d, '2026-08-20T10:00:00.000Z'), ...extra })

/** A file exactly as a 1.x build wrote it: no app version, schema 1, one budget for every cycle. */
function fileV1(): string {
  const { settings, ...rest } = data()
  const { budgetsRolledInto: _dropped, ...settingsV1 } = settings
  return JSON.stringify({
    ...rest,
    settings: settingsV1,
    schemaVersion: 1,
    exportedAt: '2026-08-11T09:00:00.000Z',
    budgets: [{ id: 'bdg_old', categoryId: 'cat_seed_5', limit: fromMajor(300, 'USD'), rollover: true, archived: false }],
  })
}

describe('restoreBackup: versions', () => {
  it('reads a file from this version as it is', () => {
    const result = restoreBackup(fileOf(data()), TODAY)
    expect(result).toMatchObject({ ok: true, appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION })
    if (result.ok) expect(result.data).toEqual(data())
  })

  it('reads a 1.x file — no app version, schema 1 — and backfills its budgets', () => {
    const result = restoreBackup(fileV1(), TODAY)
    expect(result).toMatchObject({ ok: true, appVersion: null, schemaVersion: 1, converted: true })
    if (!result.ok) return
    expect(result.data.budgets.map((b) => `${b.id} ${b.periodStart} ${b.recurring}`)).toEqual([
      'bdg_old 2026-08-01 true',
    ])
    expect(result.data.settings.budgetsRolledInto).toBe('2026-08-01')
    expect(result.exportedAt).toBe('2026-08-11T09:00:00.000Z')
  })

  it('refuses a file from a newer major version and says what to do', () => {
    const result = restoreBackup(fileOf(data(), { appVersion: '3.0.0' }), TODAY)
    expect(result).toEqual({
      ok: false,
      reason: 'This backup was made by My Budget 3.0.0. Update the app to restore it.',
    })
  })

  it('accepts a newer minor version of the same major whose format it knows', () => {
    const [major] = APP_VERSION.split('.')
    const result = restoreBackup(fileOf(data(), { appVersion: `${major}.9.0` }), TODAY)
    expect(result.ok).toBe(true)
  })

  it('refuses a newer minor version whose format it does not know', () => {
    const [major] = APP_VERSION.split('.')
    const file = fileOf(data(), { appVersion: `${major}.9.0`, schemaVersion: SCHEMA_VERSION + 1 })
    expect(restoreBackup(file, TODAY)).toMatchObject({ ok: false })
  })

  it('refuses a file whose stated version and format disagree', () => {
    const file = fileOf(data(), { appVersion: '1.1.0' })
    expect(restoreBackup(file, TODAY)).toEqual({
      ok: false,
      reason: 'This backup is damaged: its version and its contents disagree.',
    })
  })

  it('has a reader for the current format, written by a version no newer than this one', () => {
    // A schema bump without a new RESTORERS entry fails here, not on a user's phone.
    const latest = RESTORERS[RESTORERS.length - 1]
    expect(latest.schema).toBe(SCHEMA_VERSION)
    expect(compareVersions(latest.since, APP_VERSION)).toBeLessThanOrEqual(0)
    expect(RESTORERS.map((r) => r.schema)).toEqual(RESTORERS.map((_, i) => i + 1))
  })
})

describe('restoreBackup: contents', () => {
  it('says plainly when a file is not JSON, or not ours', () => {
    expect(restoreBackup('not json', TODAY)).toEqual({ ok: false, reason: 'This isn’t a My Budget backup.' })
    expect(restoreBackup('{"hello":"world"}', TODAY)).toMatchObject({ ok: false })
    expect(restoreBackup('[1,2]', TODAY)).toMatchObject({ ok: false })
  })

  it('names what is missing for the file’s format', () => {
    const { goals: _g, ...noGoals } = JSON.parse(fileOf(data()))
    expect(restoreBackup(JSON.stringify(noGoals), TODAY)).toEqual({
      ok: false,
      reason: 'This backup can’t be read. It has no goals list.',
    })
  })

  it('rejects a current-format budget with no cycle', () => {
    const file = JSON.parse(fileOf(data()))
    delete file.budgets[0].periodStart
    expect(restoreBackup(JSON.stringify(file), TODAY)).toMatchObject({ ok: false })
  })
})

describe('planImport', () => {
  it('counts what is new, what is already here and what differs', () => {
    const device = data()
    const incoming = data({
      wallets: [wallet({ name: 'Cash (renamed)' }), wallet({ id: 'wal_2', name: 'Bank' })],
    })
    const plan = planImport(device, incoming)
    expect(plan.wallets).toEqual({ added: 1, identical: 0, conflicts: 1 })
    expect(plan.budgets).toEqual({ added: 0, identical: 1, conflicts: 0 })
    expect(plan.total.conflicts).toBe(1)
  })

  it('treats records as equal whatever order their keys are in', () => {
    const reordered = Object.fromEntries(Object.entries(wallet()).reverse()) as unknown as Wallet
    expect(planImport(data(), data({ wallets: [reordered] })).wallets.identical).toBe(1)
  })

  it('matches budgets by category and cycle too, so one plan never becomes two', () => {
    const sameCycle = budget({ id: 'bdg_other_device', limit: fromMajor(500, 'USD') })
    expect(planImport(data(), data({ budgets: [sameCycle] })).budgets).toEqual({
      added: 0,
      identical: 0,
      conflicts: 1,
    })
  })
})

describe('mergeBackup', () => {
  const device = data({ wallets: [wallet(), wallet({ id: 'wal_phone', name: 'Phone only' })] })
  const incoming = data({
    wallets: [wallet({ name: 'Cash (backup)' }), wallet({ id: 'wal_file', name: 'File only' })],
    budgets: [budget({ id: 'bdg_file', limit: fromMajor(500, 'USD') })],
  })

  it('keeps records from both sides, and the backup’s version of conflicts when it wins', () => {
    const merged = mergeBackup(device, incoming, 'incoming')
    expect(merged.wallets.map((w) => w.name).sort()).toEqual(['Cash (backup)', 'File only', 'Phone only'])
    expect(merged.budgets.map((b) => b.id)).toEqual(['bdg_file'])
  })

  it('keeps the phone’s version of conflicts when it wins', () => {
    const merged = mergeBackup(device, incoming, 'device')
    expect(merged.wallets.map((w) => w.name).sort()).toEqual(['Cash', 'File only', 'Phone only'])
    expect(merged.budgets.map((b) => b.id)).toEqual(['bdg_1'])
  })

  it('keeps the phone’s settings but learns the backup’s currencies and rates', () => {
    const theirs = data({
      settings: {
        ...data().settings,
        theme: 'dark',
        activeCurrencies: ['USD', 'EUR'],
        rates: { EUR: 1.08 },
        budgetsRolledInto: '2026-09-01',
      },
    })
    const mine = data({ settings: { ...data().settings, rates: { GBP: 1.27 } } })
    const merged = mergeBackup(mine, theirs, 'incoming')
    expect(merged.settings.theme).toBe(mine.settings.theme)
    expect(merged.settings.activeCurrencies).toEqual(['USD', 'EUR'])
    expect(merged.settings.rates).toEqual({ EUR: 1.08, GBP: 1.27 })
    expect(merged.settings.budgetsRolledInto).toBe('2026-09-01')
  })

  it('round-trips: a file of the device, restored and merged, changes nothing', () => {
    const restored = restoreBackup(fileOf(device), TODAY)
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(planImport(device, restored.data).total).toMatchObject({ added: 0, conflicts: 0 })
    expect(mergeBackup(device, restored.data, 'incoming')).toEqual(device)
  })
})
