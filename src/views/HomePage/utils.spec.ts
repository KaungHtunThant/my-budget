import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import type { Money } from '@/domain/money'
import type { GoalStatus, Id, SavingsGoal, Transaction, Wallet } from '@/domain/types'

import { netWorth, recentTransactions, trendColumns, visibleGoals } from './utils'

const wallet = (id: string, currency: CurrencyCode): Wallet => ({
  id,
  name: id,
  kind: 'bank',
  currency,
  openingBalance: { minor: 0, currency },
  icon: 'wallet-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
})

const tx = (id: string, date: string, createdAt: string): Transaction => ({
  id,
  type: 'expense',
  amount: { minor: 100, currency: 'USD' },
  fx: null,
  walletId: 'w',
  toWalletId: null,
  toAmount: null,
  categoryId: null,
  date,
  note: '',
  recurringRuleId: null,
  goalId: null,
  createdAt,
})

const goal = (id: string, archived: boolean): SavingsGoal => ({
  id,
  name: id,
  target: { minor: 1000, currency: 'USD' },
  walletId: 'w',
  targetDate: null,
  icon: 'star-outline',
  color: 'primary',
  archived,
  createdAt: '2026-01-01',
})

const status = (id: string, archived = false): GoalStatus => ({
  goal: goal(id, archived),
  saved: { minor: 0, currency: 'USD' },
  remaining: { minor: 1000, currency: 'USD' },
  percentComplete: 0,
  requiredPerPeriod: null,
  complete: false,
})

describe('recentTransactions', () => {
  it('returns the newest first', () => {
    const list = [
      tx('a', '2026-08-01', 'x'),
      tx('b', '2026-08-20', 'x'),
      tx('c', '2026-08-10', 'x'),
    ]
    expect(recentTransactions(list).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks same-day ties on createdAt, matching what the repository does', () => {
    // Identical ordering to the repository's, so making the sort explicit changed nothing on
    // screen — it only removed a display policy's dependency on an undocumented guarantee.
    const list = [
      tx('early', '2026-08-20', '2026-08-20T09:00:00Z'),
      tx('late', '2026-08-20', '2026-08-20T17:00:00Z'),
    ]
    expect(recentTransactions(list).map((t) => t.id)).toEqual(['late', 'early'])
  })

  it('caps the list at eight', () => {
    const list = Array.from({ length: 20 }, (_, i) => tx(`t${i}`, '2026-08-20', `${i}`))
    expect(recentTransactions(list)).toHaveLength(8)
  })

  it('does not disturb the array it was given', () => {
    const list = [tx('a', '2026-08-01', 'x'), tx('b', '2026-08-20', 'x')]
    recentTransactions(list)
    expect(list.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('handles an empty list', () => {
    expect(recentTransactions([])).toEqual([])
  })
})

describe('visibleGoals', () => {
  it('hides archived goals', () => {
    expect(visibleGoals([status('a'), status('b', true)]).map((s) => s.goal.id)).toEqual(['a'])
  })

  it('shows at most two, to leave room for recent activity', () => {
    expect(visibleGoals([status('a'), status('b'), status('c')])).toHaveLength(2)
  })

  it('counts the cap after archived ones are dropped', () => {
    const statuses = [status('a', true), status('b'), status('c'), status('d')]
    expect(visibleGoals(statuses).map((s) => s.goal.id)).toEqual(['b', 'c'])
  })
})

describe('netWorth', () => {
  const balances: Record<Id, Money> = {
    usd: { minor: 10000, currency: 'USD' },
    eur: { minor: 5000, currency: 'EUR' },
  }

  it('converts every balance into base', () => {
    const result = netWorth([wallet('usd', 'USD'), wallet('eur', 'EUR')], balances, {
      base: 'USD',
      rates: { EUR: 1.1 },
    })
    expect(result.total).toEqual({ minor: 15500, currency: 'USD' })
    expect(result.missing).toEqual([])
  })

  it('reports a currency it could not convert instead of dropping it silently', () => {
    const result = netWorth([wallet('usd', 'USD'), wallet('eur', 'EUR')], balances, {
      base: 'USD',
      rates: {},
    })
    expect(result.total).toEqual({ minor: 10000, currency: 'USD' })
    expect(result.missing).toEqual(['EUR'])
  })

  it('substitutes zero in the wallet’s own currency when no balance is cached', () => {
    // The substitute keeps the wallet's currency, so a rate-less wallet is still reported as
    // unconvertible. A base-currency zero would have made it look convertible and counted.
    const result = netWorth([wallet('gbp', 'GBP')], {}, { base: 'USD', rates: {} })
    expect(result.total).toEqual({ minor: 0, currency: 'USD' })
    expect(result.missing).toEqual(['GBP'])
  })

  it('is zero with no wallets', () => {
    expect(netWorth([], {}, { base: 'USD', rates: {} }).total).toEqual({
      minor: 0,
      currency: 'USD',
    })
  })
})

describe('trendColumns', () => {
  it('turns the shared percentages into this screen’s CSS heights', () => {
    const bars = [
      {
        label: 'August 2026',
        short: 'Aug',
        income: { minor: 100, currency: 'USD' as const },
        expense: { minor: 50, currency: 'USD' as const },
        net: { minor: 50, currency: 'USD' as const },
        incomePercent: 100,
        expensePercent: 50,
      },
    ]
    expect(trendColumns(bars)[0]).toMatchObject({ incomeHeight: '100%', expenseHeight: '50%' })
  })
})
