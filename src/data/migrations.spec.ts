import { describe, expect, it } from 'vitest'

import { type BaseContext, budgetStatuses } from '@/domain/budgeting'
import { fromMajor } from '@/domain/money'
import { periodFor, shiftPeriod } from '@/domain/period'
import type { Category, Transaction } from '@/domain/types'

import { type BudgetV1, budgetsToV2, dataV1ToV2, settingsToV2 } from './migrations'

const MONTH = { type: 'calendar-month' } as const
const TODAY = '2026-08-20'
const USD: BaseContext = { base: 'USD', rates: {} }

const food: Category = {
  id: 'cat_food',
  name: 'Food',
  kind: 'expense',
  parentId: null,
  icon: 'basket-outline',
  color: 'warning',
  archived: false,
}

const v1 = (overrides: Partial<BudgetV1> = {}): BudgetV1 => ({
  id: 'bdg_food',
  categoryId: food.id,
  limit: fromMajor(400, 'USD'),
  rollover: true,
  archived: false,
  ...overrides,
})

const spend = (major: number, date: string): Transaction => ({
  id: `txn_${date}`,
  type: 'expense',
  amount: fromMajor(major, 'USD'),
  fx: null,
  walletId: 'wal_1',
  toWalletId: null,
  toAmount: null,
  categoryId: food.id,
  date,
  note: '',
  recurringRuleId: null,
  goalId: null,
  createdAt: date,
})

describe('budgetsToV2', () => {
  it('copies each budget into every cycle from the earliest transaction to now', () => {
    const budgets = budgetsToV2([v1()], [spend(10, '2026-05-14')], MONTH, TODAY)
    expect(budgets.map((b) => b.periodStart)).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
    ])
    expect(budgets.every((b) => b.recurring)).toBe(true)
  })

  it('keeps the original id in the current cycle and gives history deterministic ids', () => {
    const budgets = budgetsToV2([v1()], [spend(10, '2026-07-03')], MONTH, TODAY)
    expect(budgets.map((b) => b.id)).toEqual(['bdg_food@2026-07-01', 'bdg_food'])
    expect(budgetsToV2([v1()], [spend(10, '2026-07-03')], MONTH, TODAY)).toEqual(budgets)
  })

  it('puts budgets in the current cycle alone when there is no history', () => {
    expect(budgetsToV2([v1()], [], MONTH, TODAY).map((b) => b.periodStart)).toEqual([
      '2026-08-01',
    ])
  })

  it('ignores transactions dated in the future', () => {
    const budgets = budgetsToV2([v1()], [spend(10, '2026-12-01')], MONTH, TODAY)
    expect(budgets.map((b) => b.periodStart)).toEqual(['2026-08-01'])
  })

  it('follows the configured cycle, weekly included', () => {
    const weekly = { type: 'weekly', startWeekday: 1 } as const
    const budgets = budgetsToV2([v1()], [spend(10, '2026-08-05')], weekly, TODAY)
    expect(budgets.map((b) => b.periodStart)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17'])
  })

  it('keeps every other field — limit, fx, rollover, archived — as it was', () => {
    const fx = { enteredAmount: fromMajor(370, 'EUR'), rate: 1.08 }
    const [budget] = budgetsToV2([v1({ fx, rollover: false, archived: true })], [], MONTH, TODAY)
    expect(budget).toMatchObject({ limit: fromMajor(400, 'USD'), fx, rollover: false, archived: true })
  })

  it('leaves every past cycle reading exactly as schema 1 showed it, rollovers included', () => {
    // Schema 1 applied one rolling 400 budget to every month. The equivalent v2 view of each
    // migrated month must show the same limit, spend and carry-in.
    const txs = [spend(250, '2026-05-10'), spend(450, '2026-06-10'), spend(100, '2026-07-10')]
    const migrated = budgetsToV2([v1()], txs, MONTH, TODAY)

    const shown = (period: ReturnType<typeof periodFor>) => {
      const [status] = budgetStatuses(migrated, [food], txs, period, MONTH, USD)
      return { limit: status.limit.minor, spent: status.spent.minor, carriedIn: status.carriedIn.minor }
    }
    const months = [-3, -2, -1, 0].map((offset) => shiftPeriod(TODAY, MONTH, offset))
    expect(months.map(shown)).toEqual([
      { limit: 40000, spent: 25000, carriedIn: 0 }, // May: nothing before history to carry
      { limit: 55000, spent: 45000, carriedIn: 15000 }, // June: May left 150
      { limit: 40000, spent: 10000, carriedIn: 0 }, // July: June overspent
      { limit: 70000, spent: 0, carriedIn: 30000 }, // August: July left 300
    ])
  })
})

describe('settingsToV2 / dataV1ToV2', () => {
  const settings = {
    baseCurrency: 'USD',
    activeCurrencies: ['USD'],
    rates: {},
    budgetPeriod: MONTH,
    theme: 'system',
    appLockEnabled: false,
    onboardingComplete: true,
  } as const

  it('marks the current cycle as already rolled, since migration just filled it', () => {
    expect(settingsToV2({ ...settings, activeCurrencies: ['USD'] }, TODAY).budgetsRolledInto).toBe(
      '2026-08-01',
    )
  })

  it('carries a whole data set forward and passes the rest through untouched', () => {
    const data = {
      settings: { ...settings, activeCurrencies: ['USD' as const] },
      transactions: [spend(10, '2026-07-03')],
      budgets: [v1()],
      wallets: [{ id: 'wal_1' }],
    }
    const upgraded = dataV1ToV2(data, TODAY)
    expect(upgraded.budgets).toHaveLength(2)
    expect(upgraded.settings.budgetsRolledInto).toBe('2026-08-01')
    expect(upgraded.wallets).toBe(data.wallets)
    expect(upgraded.transactions).toBe(data.transactions)
  })
})
