import { describe, expect, it } from 'vitest'

import type { SavingsGoal } from '@/domain/types'

import { contributionTransaction } from './goals'

const goal: SavingsGoal = {
  id: 'gol_laptop',
  name: 'New laptop',
  target: { minor: 160000, currency: 'USD' },
  walletId: 'wal_savings',
  targetDate: '2026-12-01',
  icon: 'laptop-outline',
  color: 'tertiary',
  archived: false,
  createdAt: '2026-06-01',
}

describe('contributionTransaction', () => {
  const amount = { minor: 15000, currency: 'USD' as const }

  it('records a contribution as a transfer into the goal’s wallet', () => {
    expect(contributionTransaction(goal, 'wal_bank', amount, '2026-08-20')).toEqual({
      type: 'transfer',
      amount,
      fx: null,
      walletId: 'wal_bank',
      toWalletId: 'wal_savings',
      toAmount: amount,
      categoryId: null,
      date: '2026-08-20',
      note: 'New laptop',
      recurringRuleId: null,
      goalId: 'gol_laptop',
    })
  })

  it('tags the goal, which is how progress finds the money again', () => {
    // `goalStatus` sums transactions carrying this id. Without the tag a contribution would
    // move money and count for nothing.
    const tx = contributionTransaction(goal, 'wal_bank', amount, '2026-08-20')
    expect(tx.goalId).toBe('gol_laptop')
  })

  it('carries no category, because a transfer neither earns nor spends', () => {
    expect(contributionTransaction(goal, 'wal_bank', amount, '2026-08-20').categoryId).toBeNull()
  })

  it('credits the destination with the same amount — this path offers no conversion', () => {
    const tx = contributionTransaction(goal, 'wal_bank', amount, '2026-08-20')
    expect(tx.toAmount).toEqual(tx.amount)
    expect(tx.fx).toBeNull()
  })

  it('dates the contribution from the argument, not the clock', () => {
    expect(contributionTransaction(goal, 'wal_bank', amount, '2020-01-01').date).toBe('2020-01-01')
  })
})
