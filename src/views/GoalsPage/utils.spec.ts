import { describe, expect, it } from 'vitest'

import type { GoalStatus, SavingsGoal, Wallet, WalletKind } from '@/domain/types'

import {
  activeGoals,
  canContribute,
  canSaveGoal,
  completedGoals,
  defaultContributionWallet,
  defaultGoalWallet,
} from './utils'

const wallet = (id: string, kind: WalletKind): Wallet => ({
  id,
  name: id,
  kind,
  currency: 'USD',
  openingBalance: { minor: 0, currency: 'USD' },
  icon: 'wallet-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
})

const goal = (walletId: string): SavingsGoal => ({
  id: 'g1',
  name: 'Emergency fund',
  target: { minor: 100000, currency: 'USD' },
  walletId,
  targetDate: null,
  icon: 'umbrella-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
})

const status = (id: string, complete: boolean): GoalStatus => ({
  goal: { ...goal('w1'), id },
  saved: { minor: 0, currency: 'USD' },
  remaining: { minor: 1000, currency: 'USD' },
  percentComplete: complete ? 100 : 0,
  requiredPerPeriod: null,
  complete,
})

describe('activeGoals / completedGoals', () => {
  const statuses = [status('a', false), status('b', true), status('c', false)]

  it('splits on completion', () => {
    expect(activeGoals(statuses).map((s) => s.goal.id)).toEqual(['a', 'c'])
    expect(completedGoals(statuses).map((s) => s.goal.id)).toEqual(['b'])
  })

  it('partitions without losing or duplicating anything', () => {
    expect(activeGoals(statuses).length + completedGoals(statuses).length).toBe(statuses.length)
  })
})

describe('canSaveGoal', () => {
  it('needs a name, a target above zero, and a wallet', () => {
    expect(canSaveGoal('Car', '5000', 'w1', 'USD')).toBe(true)
  })

  it('refuses each missing piece', () => {
    expect(canSaveGoal('  ', '5000', 'w1', 'USD')).toBe(false)
    expect(canSaveGoal('Car', '0', 'w1', 'USD')).toBe(false)
    expect(canSaveGoal('Car', '', 'w1', 'USD')).toBe(false)
    expect(canSaveGoal('Car', '5000', null, 'USD')).toBe(false)
  })
})

describe('canContribute', () => {
  it('needs an amount above zero and a source wallet', () => {
    expect(canContribute('50', 'w1', 'USD')).toBe(true)
    expect(canContribute('0', 'w1', 'USD')).toBe(false)
    expect(canContribute('50', null, 'USD')).toBe(false)
  })
})

describe('defaultGoalWallet', () => {
  it('prefers a savings wallet, which is what people open them for', () => {
    const wallets = [wallet('bank', 'bank'), wallet('pot', 'savings')]
    expect(defaultGoalWallet(wallets)).toBe('pot')
  })

  it('falls back to the first wallet so the form is never unanswerable', () => {
    expect(defaultGoalWallet([wallet('bank', 'bank'), wallet('cash', 'cash')])).toBe('bank')
  })

  it('is null when there are no wallets at all', () => {
    expect(defaultGoalWallet([])).toBeNull()
  })
})

describe('defaultContributionWallet', () => {
  it('avoids the goal’s own wallet, since a transfer to itself moves nothing', () => {
    const wallets = [wallet('pot', 'savings'), wallet('bank', 'bank')]
    expect(defaultContributionWallet(wallets, goal('pot'))).toBe('bank')
  })

  it('falls back to the only wallet rather than leaving the select empty', () => {
    // The form still refuses to save this — canContribute is not the guard being tested here.
    const wallets = [wallet('pot', 'savings')]
    expect(defaultContributionWallet(wallets, goal('pot'))).toBe('pot')
  })

  it('is null when there are no wallets', () => {
    expect(defaultContributionWallet([], goal('pot'))).toBeNull()
  })
})
