import { describe, expect, it } from 'vitest'

import type { GoalStatus, SavingsGoal, Transaction } from '@/domain/types'

import { recentTransactions, trendColumns, visibleGoals } from './utils'

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
