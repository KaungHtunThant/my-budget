/**
 * Characterisation tests for the store's derived surface.
 *
 * These exist in order to be reduced. The layering refactor moves every calculation below out
 * of the store into services and per-screen utils; these snapshots pin what each one produces
 * *today*, so that move can be proven behaviour-preserving rather than eyeballed. When the
 * derived members are gone — their assertions having moved to the service specs — what is left
 * here is the CRUD and lifecycle half, which is worth keeping permanently.
 *
 * The clock is frozen because the demo fixture dates every record relative to today: pay lands
 * on the most recent 25th, spending is N days ago, goals mature in N months. Without a fixed
 * date these snapshots would change daily. Only `Date` is faked — timers are left alone, since
 * faking them would interfere with the snapshot debounce if this suite ever runs against the
 * IndexedDB repository.
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
})

describe('settings projections', () => {
  it('exposes base currency, context and period config', () => {
    expect({
      base: store.base,
      ctx: store.ctx,
      periodConfig: store.periodConfig,
    }).toMatchInlineSnapshot(`
      {
        "base": "USD",
        "ctx": {
          "base": "USD",
          "rates": {
            "EUR": 1.08,
          },
        },
        "periodConfig": {
          "type": "calendar-month",
        },
      }
    `)
  })
})

describe('period', () => {
  it('resolves the current period', () => {
    expect({ ...store.period, isCurrentPeriod: store.isCurrentPeriod }).toMatchInlineSnapshot(`
      {
        "end": "2026-08-31",
        "isCurrentPeriod": true,
        "label": "August 2026",
        "start": "2026-08-01",
      }
    `)
  })

  it('shifts backwards and forwards, and returns to the current period', () => {
    store.goToPreviousPeriod()
    const previous = { ...store.period, isCurrentPeriod: store.isCurrentPeriod }

    store.goToNextPeriod()
    store.goToNextPeriod()
    const next = { ...store.period, isCurrentPeriod: store.isCurrentPeriod }

    store.goToCurrentPeriod()
    const back = { ...store.period, isCurrentPeriod: store.isCurrentPeriod }

    expect({ previous, next, back }).toMatchInlineSnapshot(`
      {
        "back": {
          "end": "2026-08-31",
          "isCurrentPeriod": true,
          "label": "August 2026",
          "start": "2026-08-01",
        },
        "next": {
          "end": "2026-09-30",
          "isCurrentPeriod": false,
          "label": "September 2026",
          "start": "2026-09-01",
        },
        "previous": {
          "end": "2026-07-31",
          "isCurrentPeriod": false,
          "label": "July 2026",
          "start": "2026-07-01",
        },
      }
    `)
  })

  it('filters transactions to the visible period', () => {
    expect({
      count: store.periodTransactions.length,
      ids: store.periodTransactions.map((t) => t.id),
    }).toMatchInlineSnapshot(`
      {
        "count": 16,
        "ids": [
          "txn_exp_1",
          "txn_exp_4",
          "txn_exp_9",
          "txn_exp_6",
          "txn_exp_2",
          "txn_exp_5",
          "txn_exp_12",
          "txn_exp_8",
          "txn_exp_7",
          "txn_exp_3",
          "txn_exp_0",
          "txn_goal_0",
          "txn_goal_3",
          "txn_exp_10",
          "txn_exp_11",
          "txn_fx_expense",
        ],
      }
    `)
  })

  it('follows the period switcher when filtering', () => {
    store.goToPreviousPeriod()
    expect(store.periodTransactions.map((t) => t.id)).toMatchInlineSnapshot(`
      [
        "txn_fx_transfer",
        "txn_sal_0",
        "txn_exp_19",
        "txn_exp_18",
        "txn_exp_13",
        "txn_exp_15",
        "txn_exp_17",
        "txn_exp_16",
        "txn_exp_14",
        "txn_goal_1",
        "txn_goal_4",
      ]
    `)
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
      expense: store.expenseCategories.map((c) => c.name),
    }).toMatchInlineSnapshot(`
      {
        "expense": [
          "Dining out",
          "Education",
          "Entertainment",
          "Groceries",
          "Health",
          "Other",
          "Rent",
          "Shopping",
          "Subscriptions",
          "Transport",
          "Utilities",
        ],
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

describe('rollups', () => {
  it('totals net worth across currencies', () => {
    expect({
      total: m(store.netWorth.total),
      missing: store.netWorth.missing,
    }).toMatchInlineSnapshot(`
      {
        "missing": [],
        "total": "1204482 USD",
      }
    `)
  })

  it('summarises the visible period', () => {
    expect({
      income: m(store.currentSummary.income),
      expense: m(store.currentSummary.expense),
      net: m(store.currentSummary.net),
    }).toMatchInlineSnapshot(`
      {
        "expense": "161903 USD",
        "income": "0 USD",
        "net": "-161903 USD",
      }
    `)
  })

  it('produces six trend points, oldest first', () => {
    expect(
      store.trend.map((t) => ({
        label: t.period.label,
        income: m(t.income),
        expense: m(t.expense),
        net: m(t.net),
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "expense": "0 USD",
          "income": "0 USD",
          "label": "March 2026",
          "net": "0 USD",
        },
        {
          "expense": "0 USD",
          "income": "0 USD",
          "label": "April 2026",
          "net": "0 USD",
        },
        {
          "expense": "0 USD",
          "income": "306600 USD",
          "label": "May 2026",
          "net": "306600 USD",
        },
        {
          "expense": "121725 USD",
          "income": "306600 USD",
          "label": "June 2026",
          "net": "184875 USD",
        },
        {
          "expense": "133890 USD",
          "income": "306600 USD",
          "label": "July 2026",
          "net": "172710 USD",
        },
        {
          "expense": "161903 USD",
          "income": "0 USD",
          "label": "August 2026",
          "net": "-161903 USD",
        },
      ]
    `)
  })

  it('breaks spending down by category', () => {
    expect({
      total: m(store.breakdown.total),
      missing: store.breakdown.missing,
      rows: store.breakdown.rows.map((r) => ({
        category: r.category.name,
        amount: m(r.amount),
        percentOfTotal: r.percentOfTotal,
        transactionCount: r.transactionCount,
      })),
    }).toMatchInlineSnapshot(`
      {
        "missing": [],
        "rows": [
          {
            "amount": "95000 USD",
            "category": "Rent",
            "percentOfTotal": 58.677109133246454,
            "transactionCount": 1,
          },
          {
            "amount": "19435 USD",
            "category": "Groceries",
            "percentOfTotal": 12.004101221101523,
            "transactionCount": 3,
          },
          {
            "amount": "18479 USD",
            "category": "Shopping",
            "percentOfTotal": 11.41362420708696,
            "transactionCount": 2,
          },
          {
            "amount": "9630 USD",
            "category": "Utilities",
            "percentOfTotal": 5.94800590477014,
            "transactionCount": 1,
          },
          {
            "amount": "6320 USD",
            "category": "Transport",
            "percentOfTotal": 3.9035718918117643,
            "transactionCount": 2,
          },
          {
            "amount": "5140 USD",
            "category": "Dining out",
            "percentOfTotal": 3.1747404309988076,
            "transactionCount": 2,
          },
          {
            "amount": "3500 USD",
            "category": "Health",
            "percentOfTotal": 2.1617882312248695,
            "transactionCount": 1,
          },
          {
            "amount": "2800 USD",
            "category": "Entertainment",
            "percentOfTotal": 1.7294305849798952,
            "transactionCount": 1,
          },
          {
            "amount": "1599 USD",
            "category": "Subscriptions",
            "percentOfTotal": 0.9876283947795902,
            "transactionCount": 1,
          },
        ],
        "total": "161903 USD",
      }
    `)
  })

  it('computes a status per budget', () => {
    expect(
      store.budgetStatusList.map((s) => ({
        category: s.category.name,
        limit: m(s.limit),
        spent: m(s.spent),
        remaining: m(s.remaining),
        carriedIn: m(s.carriedIn),
        percentUsed: s.percentUsed,
        overspent: s.overspent,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "carriedIn": "0 USD",
          "category": "Rent",
          "limit": "95000 USD",
          "overspent": false,
          "percentUsed": 100,
          "remaining": "0 USD",
          "spent": "95000 USD",
        },
        {
          "carriedIn": "30880 USD",
          "category": "Groceries",
          "limit": "70880 USD",
          "overspent": false,
          "percentUsed": 27.419582392776526,
          "remaining": "51445 USD",
          "spent": "19435 USD",
        },
        {
          "carriedIn": "0 USD",
          "category": "Dining out",
          "limit": "18000 USD",
          "overspent": false,
          "percentUsed": 28.555555555555557,
          "remaining": "12860 USD",
          "spent": "5140 USD",
        },
        {
          "carriedIn": "0 USD",
          "category": "Utilities",
          "limit": "15000 USD",
          "overspent": false,
          "percentUsed": 64.2,
          "remaining": "5370 USD",
          "spent": "9630 USD",
        },
        {
          "carriedIn": "0 USD",
          "category": "Shopping",
          "limit": "15000 USD",
          "overspent": true,
          "percentUsed": 123.19333333333333,
          "remaining": "-3479 USD",
          "spent": "18479 USD",
        },
        {
          "carriedIn": "3800 USD",
          "category": "Entertainment",
          "limit": "13800 USD",
          "overspent": false,
          "percentUsed": 20.28985507246377,
          "remaining": "11000 USD",
          "spent": "2800 USD",
        },
        {
          "carriedIn": "0 USD",
          "category": "Transport",
          "limit": "12000 USD",
          "overspent": false,
          "percentUsed": 52.666666666666664,
          "remaining": "5680 USD",
          "spent": "6320 USD",
        },
      ]
    `)
  })

  it('rolls budgets up into a header summary', () => {
    expect({
      budgeted: m(store.budgetSummary.budgeted),
      spent: m(store.budgetSummary.spent),
      remaining: m(store.budgetSummary.remaining),
      percentUsed: store.budgetSummary.percentUsed,
      overspentCount: store.budgetSummary.overspentCount,
    }).toMatchInlineSnapshot(`
      {
        "budgeted": "239680 USD",
        "overspentCount": 1,
        "percentUsed": 65.42222963951936,
        "remaining": "82876 USD",
        "spent": "156804 USD",
      }
    `)
  })

  it('computes a status per goal', () => {
    expect(
      store.goalStatusList.map((g) => ({
        name: g.goal.name,
        saved: m(g.saved),
        remaining: m(g.remaining),
        percentComplete: g.percentComplete,
        requiredPerPeriod: g.requiredPerPeriod ? m(g.requiredPerPeriod) : null,
        complete: g.complete,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "complete": false,
          "name": "Emergency fund",
          "percentComplete": 15,
          "remaining": "510000 USD",
          "requiredPerPeriod": "72858 USD",
          "saved": "90000 USD",
        },
        {
          "complete": false,
          "name": "New laptop",
          "percentComplete": 18.75,
          "remaining": "130000 USD",
          "requiredPerPeriod": "43334 USD",
          "saved": "30000 USD",
        },
      ]
    `)
  })

  it('lists the eight most recent transactions', () => {
    expect({
      count: store.recentTransactions.length,
      ids: store.recentTransactions.map((t) => t.id),
    }).toMatchInlineSnapshot(`
      {
        "count": 8,
        "ids": [
          "txn_exp_1",
          "txn_exp_4",
          "txn_exp_9",
          "txn_exp_6",
          "txn_exp_2",
          "txn_exp_5",
          "txn_exp_12",
          "txn_exp_8",
        ],
      }
    `)
  })
})

describe('missing rates', () => {
  it('reports nothing when every held currency already has a rate', () => {
    // The demo fixture ships a EUR rate, so the seeded baseline is deliberately empty.
    expect(store.missingRates).toMatchInlineSnapshot(`[]`)
  })

  it('reports a held currency once its rate is removed', async () => {
    await store.saveSettings({ rates: {} })
    expect({
      missingRates: store.missingRates,
      netWorthMissing: store.netWorth.missing,
      netWorth: m(store.netWorth.total),
    }).toMatchInlineSnapshot(`
      {
        "missingRates": [
          "EUR",
        ],
        "netWorth": "1084282 USD",
        "netWorthMissing": [
          "EUR",
        ],
      }
    `)
  })

  it('clears once the rate is set again', async () => {
    await store.saveSettings({ rates: {} })
    await store.setRate('EUR', 1.08)
    expect({
      missingRates: store.missingRates,
      rates: store.settings.rates,
      netWorth: m(store.netWorth.total),
    }).toMatchInlineSnapshot(`
      {
        "missingRates": [],
        "netWorth": "1204482 USD",
        "rates": {
          "EUR": 1.08,
        },
      }
    `)
  })

  it('treats a non-positive rate as missing', async () => {
    await store.setRate('EUR', 0)
    expect(store.missingRates).toMatchInlineSnapshot(`
      [
        "EUR",
      ]
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
      note: 'characterisation',
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

  it('records a goal contribution as a transfer into the goal wallet', async () => {
    const before = store.transactions.length

    await store.contributeToGoal('gol_laptop', 'wal_bank', { minor: 15000, currency: 'USD' })

    const created = store.transactions.find((t) => t.note === 'New laptop' && t.date === '2026-08-20')
    expect({
      added: store.transactions.length - before,
      type: created?.type,
      amount: created ? m(created.amount) : null,
      walletId: created?.walletId,
      toWalletId: created?.toWalletId,
      toAmount: created?.toAmount ? m(created.toAmount) : null,
      goalId: created?.goalId,
      categoryId: created?.categoryId,
    }).toMatchInlineSnapshot(`
      {
        "added": 1,
        "amount": "15000 USD",
        "categoryId": null,
        "goalId": "gol_laptop",
        "toAmount": "15000 USD",
        "toWalletId": "wal_savings",
        "type": "transfer",
        "walletId": "wal_bank",
      }
    `)
  })

  it('rejects a contribution to an unknown goal', async () => {
    await expect(
      store.contributeToGoal('gol_nope', 'wal_bank', { minor: 100, currency: 'USD' }),
    ).rejects.toThrow()
  })

  it('tracks a new wallet currency in the active list', async () => {
    await store.addWallet({
      name: 'Yen pocket',
      kind: 'cash',
      currency: 'JPY',
      openingBalance: { minor: 5000, currency: 'JPY' },
      icon: 'cash-outline',
      color: 'medium',
      archived: false,
    })

    expect({
      activeCurrencies: store.settings.activeCurrencies,
      missingRates: store.missingRates,
    }).toMatchInlineSnapshot(`
      {
        "activeCurrencies": [
          "USD",
          "EUR",
          "JPY",
        ],
        "missingRates": [
          "JPY",
        ],
      }
    `)
  })
})

describe('onboarding', () => {
  it('resets, applies the chosen base currency and dedupes the active list', async () => {
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
      period: empty.period,
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
        "period": {
          "end": "2026-08-24",
          "label": "25 Jul – 24 Aug 2026",
          "start": "2026-07-25",
        },
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
      transactions: empty.transactions.length > 0,
      budgets: empty.budgets.length,
      goals: empty.goals.length,
    }).toMatchInlineSnapshot(`
      {
        "budgets": 7,
        "goals": 2,
        "transactions": true,
        "wallets": 4,
      }
    `)
  })
})

describe('empty state', () => {
  it('derives safe values with no wallets or transactions', async () => {
    const empty = await createTestStore(false)

    expect({
      netWorth: m(empty.netWorth.total),
      missing: empty.netWorth.missing,
      summaryNet: m(empty.currentSummary.net),
      breakdownRows: empty.breakdown.rows.length,
      breakdownTotal: m(empty.breakdown.total),
      budgetStatusList: empty.budgetStatusList.length,
      budgetSummaryBudgeted: m(empty.budgetSummary.budgeted),
      goalStatusList: empty.goalStatusList.length,
      missingRates: empty.missingRates,
      recentTransactions: empty.recentTransactions.length,
      trendPoints: empty.trend.length,
    }).toMatchInlineSnapshot(`
      {
        "breakdownRows": 0,
        "breakdownTotal": "0 USD",
        "budgetStatusList": 0,
        "budgetSummaryBudgeted": "0 USD",
        "goalStatusList": 0,
        "missing": [],
        "missingRates": [],
        "netWorth": "0 USD",
        "recentTransactions": 0,
        "summaryNet": "0 USD",
        "trendPoints": 6,
      }
    `)
  })
})
