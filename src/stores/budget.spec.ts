/**
 * Store tests: loading, lookups and writes.
 *
 * This began life as a characterisation suite pinning every derived value the store exposed, so
 * the layering refactor could be proven behaviour-preserving rather than eyeballed. Those
 * assertions have done their job and now live beside the services and screen utils that took the
 * calculations over. What remains is the store's permanent surface — the collections it loads, the
 * projections of them it offers, and the writes it performs — worth keeping tested for its own sake.
 *
 * The clock is frozen because the demo fixture dates every record relative to today. Only `Date`
 * is faked; timers are left alone.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Money } from '@/domain/money'
import { createTestStore } from '@/test/pinia'

/** Compact, readable snapshot form — `{ minor, currency }` objects bloat every snapshot. */
const m = (value: Money): string => `${value.minor} ${value.currency}`

type Store = Awaited<ReturnType<typeof createTestStore>>

let store: Store

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-20T12:00:00'))
  store = await createTestStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loading', () => {
  it('loads every collection from the repository', () => {
    expect({
      ready: store.ready,
      loading: store.loading,
      wallets: store.wallets.length,
      categories: store.categories.length,
      transactions: store.transactions.length,
      budgets: store.budgets.length,
      rules: store.rules.length,
      goals: store.goals.length,
    }).toMatchInlineSnapshot(`
      {
        "budgets": 7,
        "categories": 15,
        "goals": 2,
        "loading": false,
        "ready": true,
        "rules": 3,
        "transactions": 35,
        "wallets": 4,
      }
    `)
  })

  it('populates a balance for every wallet', () => {
    expect(store.wallets.map((w) => [w.name, m(store.balances[w.id])])).toMatchInlineSnapshot(`
      [
        [
          "Cash",
          "17141 USD",
        ],
        [
          "EUR Account",
          "111296 EUR",
        ],
        [
          "Main Bank",
          "527141 USD",
        ],
        [
          "Savings",
          "540000 USD",
        ],
      ]
    `)
  })

  it('is idempotent, so the router guard can call it on every navigation', async () => {
    const before = store.transactions.length
    await store.init()
    expect(store.transactions.length).toBe(before)
  })
})

describe('settings projections', () => {
  it('exposes the base currency and the cycle config as plain reads', () => {
    expect({ base: store.base, periodConfig: store.periodConfig }).toMatchInlineSnapshot(`
      {
        "base": "USD",
        "periodConfig": {
          "type": "calendar-month",
        },
      }
    `)
  })
})

describe('period selection', () => {
  it('holds the raw offset and reports whether it is the current cycle', () => {
    expect({ offset: store.periodOffset, isCurrent: store.isCurrentPeriod }).toEqual({
      offset: 0,
      isCurrent: true,
    })
  })

  it('steps the offset and returns to zero', () => {
    store.goToPreviousPeriod()
    expect({ offset: store.periodOffset, isCurrent: store.isCurrentPeriod }).toEqual({
      offset: -1,
      isCurrent: false,
    })

    store.goToNextPeriod()
    store.goToNextPeriod()
    expect(store.periodOffset).toBe(1)

    store.goToCurrentPeriod()
    expect({ offset: store.periodOffset, isCurrent: store.isCurrentPeriod }).toEqual({
      offset: 0,
      isCurrent: true,
    })
  })
})

describe('lookups', () => {
  it('indexes entities by id', () => {
    expect({
      categories: store.categoriesById.size,
      wallets: store.walletsById.size,
      goals: store.goalsById.size,
      sampleCategory: store.categoriesById.get('cat_seed_0')?.name,
      sampleWallet: store.walletsById.get('wal_bank')?.name,
      sampleGoal: store.goalsById.get('gol_emergency')?.name,
    }).toMatchInlineSnapshot(`
      {
        "categories": 15,
        "goals": 2,
        "sampleCategory": "Salary",
        "sampleGoal": "Emergency fund",
        "sampleWallet": "Main Bank",
        "wallets": 4,
      }
    `)
  })

  it('splits categories by kind', () => {
    expect({
      income: store.incomeCategories.map((c) => c.name),
      expense: store.expenseCategories.length,
    }).toMatchInlineSnapshot(`
      {
        "expense": 11,
        "income": [
          "Freelance",
          "Gifts",
          "Interest",
          "Salary",
        ],
      }
    `)
  })

  it('resolves a wallet balance, falling back to zero for an unknown id', () => {
    expect({
      known: m(store.balanceOf('wal_bank')),
      unknown: m(store.balanceOf('wal_does_not_exist')),
    }).toMatchInlineSnapshot(`
      {
        "known": "527141 USD",
        "unknown": "0 USD",
      }
    `)
  })
})

describe('writes', () => {
  it('refreshes balances after adding a transaction', async () => {
    const before = m(store.balanceOf('wal_cash'))

    await store.addTransaction({
      type: 'expense',
      amount: { minor: 2500, currency: 'USD' },
      fx: null,
      walletId: 'wal_cash',
      toWalletId: null,
      toAmount: null,
      categoryId: 'cat_seed_5',
      date: '2026-08-20',
      note: 'store spec',
      recurringRuleId: null,
      goalId: null,
    })

    expect({
      before,
      after: m(store.balanceOf('wal_cash')),
      transactionCount: store.transactions.length,
    }).toMatchInlineSnapshot(`
      {
        "after": "14641 USD",
        "before": "17141 USD",
        "transactionCount": 36,
      }
    `)
  })

  it('reloads after editing and deleting', async () => {
    const created = await store.addTransaction({
      type: 'income',
      amount: { minor: 5000, currency: 'USD' },
      fx: null,
      walletId: 'wal_bank',
      toWalletId: null,
      toAmount: null,
      categoryId: 'cat_seed_0',
      date: '2026-08-20',
      note: 'first',
      recurringRuleId: null,
      goalId: null,
    })

    await store.editTransaction({ ...created, note: 'edited' })
    expect(store.transactions.find((t) => t.id === created.id)?.note).toBe('edited')

    await store.removeTransaction(created.id)
    expect(store.transactions.find((t) => t.id === created.id)).toBeUndefined()
  })

  it('tracks a new wallet currency in the picker shortlist', async () => {
    await store.addWallet({
      name: 'Yen pocket',
      kind: 'cash',
      currency: 'JPY',
      openingBalance: { minor: 5000, currency: 'JPY' },
      icon: 'cash-outline',
      color: 'medium',
      archived: false,
    })

    expect(store.settings.activeCurrencies).toEqual(['USD', 'EUR', 'JPY'])
  })

  it('does not duplicate a currency already on the shortlist', async () => {
    await store.addWallet({
      name: 'Second EUR',
      kind: 'bank',
      currency: 'EUR',
      openingBalance: { minor: 0, currency: 'EUR' },
      icon: 'cash-outline',
      color: 'medium',
      archived: false,
    })

    expect(store.settings.activeCurrencies).toEqual(['USD', 'EUR'])
  })

  it('merges a settings patch rather than replacing settings', async () => {
    await store.saveSettings({ theme: 'dark' })
    expect({ theme: store.settings.theme, base: store.settings.baseCurrency }).toEqual({
      theme: 'dark',
      base: 'USD',
    })
  })

  it('sets a rate without disturbing the others', async () => {
    await store.setRate('JPY', 150)
    expect(store.settings.rates).toEqual({ EUR: 1.08, JPY: 150 })
  })
})

describe('onboarding', () => {
  it('resets, applies the chosen base currency and dedupes the shortlist', async () => {
    const empty = await createTestStore(false)

    await empty.completeOnboarding({
      baseCurrency: 'EUR',
      budgetPeriod: { type: 'anchored-month', anchorDay: 25 },
      withDemoData: false,
    })

    expect({
      base: empty.base,
      activeCurrencies: empty.settings.activeCurrencies,
      budgetPeriod: empty.settings.budgetPeriod,
      onboardingComplete: empty.settings.onboardingComplete,
      wallets: empty.wallets.length,
      categories: empty.categories.length,
    }).toMatchInlineSnapshot(`
      {
        "activeCurrencies": [
          "EUR",
        ],
        "base": "EUR",
        "budgetPeriod": {
          "anchorDay": 25,
          "type": "anchored-month",
        },
        "categories": 15,
        "onboardingComplete": true,
        "wallets": 0,
      }
    `)
  })

  it('loads demo data when asked', async () => {
    const empty = await createTestStore(false)

    await empty.completeOnboarding({
      baseCurrency: 'USD',
      budgetPeriod: { type: 'calendar-month' },
      withDemoData: true,
    })

    expect({
      wallets: empty.wallets.length,
      hasTransactions: empty.transactions.length > 0,
      budgets: empty.budgets.length,
      goals: empty.goals.length,
    }).toMatchInlineSnapshot(`
      {
        "budgets": 7,
        "goals": 2,
        "hasTransactions": true,
        "wallets": 4,
      }
    `)
  })

  it('resetApp keeps the current base currency', async () => {
    await store.resetApp(false)
    expect({ base: store.base, wallets: store.wallets.length }).toEqual({
      base: 'USD',
      wallets: 0,
    })
  })
})

describe('empty state', () => {
  it('loads default categories and nothing else', async () => {
    const empty = await createTestStore(false)

    expect({
      wallets: empty.wallets.length,
      transactions: empty.transactions.length,
      budgets: empty.budgets.length,
      goals: empty.goals.length,
      categories: empty.categories.length,
      balanceOfUnknown: m(empty.balanceOf('nope')),
    }).toMatchInlineSnapshot(`
      {
        "balanceOfUnknown": "0 USD",
        "budgets": 0,
        "categories": 15,
        "goals": 0,
        "transactions": 0,
        "wallets": 0,
      }
    `)
  })
})

describe('snapshot flush', () => {
  it('is safe on a repository with nothing to flush', async () => {
    // MemoryRepository has no saveSnapshot; callers treat its absence as success.
    await expect(store.flushSnapshot()).resolves.toBeUndefined()
  })
})
