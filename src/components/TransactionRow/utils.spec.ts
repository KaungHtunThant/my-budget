import { describe, expect, it } from 'vitest'

import type { Category, SavingsGoal, Transaction, Wallet } from '@/domain/types'

import { type RowEntities, displayAmount, rowColor, rowSubtitle, rowTitle } from './utils'

const TODAY = '2026-08-20'

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't',
  type: 'expense',
  amount: { minor: 2500, currency: 'USD' },
  fx: null,
  walletId: 'w1',
  toWalletId: null,
  toAmount: null,
  categoryId: 'c1',
  date: TODAY,
  note: '',
  recurringRuleId: null,
  goalId: null,
  createdAt: TODAY,
  ...overrides,
})

const category: Category = {
  id: 'c1',
  name: 'Groceries',
  kind: 'expense',
  parentId: null,
  icon: 'basket-outline',
  color: 'warning',
  archived: false,
}

const wallet = (id: string, name: string): Wallet => ({
  id,
  name,
  kind: 'bank',
  currency: 'USD',
  openingBalance: { minor: 0, currency: 'USD' },
  icon: 'wallet-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
})

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Emergency fund',
  target: { minor: 100000, currency: 'USD' },
  walletId: 'w2',
  targetDate: null,
  icon: 'umbrella-outline',
  color: 'tertiary',
  archived: false,
  createdAt: '2026-01-01',
}

const entities = (overrides: RowEntities = {}): RowEntities => ({
  category,
  wallet: wallet('w1', 'Main Bank'),
  ...overrides,
})

describe('rowTitle', () => {
  it('names an expense by its category', () => {
    expect(rowTitle(tx(), entities())).toBe('Groceries')
  })

  it('falls back to a word rather than leaving the row blank', () => {
    expect(rowTitle(tx({ categoryId: null }), entities({ category: undefined }))).toBe(
      'Uncategorised',
    )
  })

  it('names a transfer by where the money went', () => {
    const transfer = tx({ type: 'transfer', toWalletId: 'w2' })
    const resolved = entities({ toWallet: wallet('w2', 'Savings') })
    expect(rowTitle(transfer, resolved)).toBe('Main Bank → Savings')
  })

  it('names a goal contribution by the goal, which says more than the two wallets', () => {
    const transfer = tx({ type: 'transfer', toWalletId: 'w2', goalId: 'g1' })
    const resolved = entities({ toWallet: wallet('w2', 'Savings'), goal })
    expect(rowTitle(transfer, resolved)).toBe('Emergency fund')
  })

  it('shows a dash for a wallet it cannot resolve', () => {
    const transfer = tx({ type: 'transfer', toWalletId: 'gone' })
    expect(rowTitle(transfer, { wallet: wallet('w1', 'Main Bank') })).toBe('Main Bank → —')
  })
})

describe('rowSubtitle', () => {
  it('leads with a relative date', () => {
    expect(rowSubtitle(tx(), entities(), TODAY)).toBe('Today · Main Bank')
  })

  it('omits the date when the list already groups by day', () => {
    expect(rowSubtitle(tx(), entities(), TODAY, false)).toBe('Main Bank')
  })

  it('appends the note', () => {
    expect(rowSubtitle(tx({ note: 'weekly shop' }), entities(), TODAY)).toBe(
      'Today · Main Bank · weekly shop',
    )
  })

  it('omits the wallet on a transfer, since the title already names both ends', () => {
    const transfer = tx({ type: 'transfer', toWalletId: 'w2' })
    const resolved = entities({ toWallet: wallet('w2', 'Savings') })
    expect(rowSubtitle(transfer, resolved, TODAY)).toBe('Today')
  })

  it('never leaves a stray separator when a part is missing', () => {
    expect(rowSubtitle(tx(), { category }, TODAY, false)).toBe('')
  })
})

describe('rowColor', () => {
  it('takes an expense’s colour from its category', () => {
    expect(rowColor(tx(), entities())).toBe('warning')
  })

  it('is always green for income, because direction beats classification at a glance', () => {
    expect(rowColor(tx({ type: 'income' }), entities())).toBe('success')
  })

  it('takes a contribution’s colour from the goal', () => {
    const transfer = tx({ type: 'transfer', goalId: 'g1' })
    expect(rowColor(transfer, entities({ goal }))).toBe('tertiary')
  })

  it('is neutral for a plain transfer', () => {
    expect(rowColor(tx({ type: 'transfer' }), entities())).toBe('medium')
  })

  it('is neutral when the category is gone', () => {
    expect(rowColor(tx(), entities({ category: undefined }))).toBe('medium')
  })
})

describe('displayAmount', () => {
  it('reads an expense as negative, though it is stored positive', () => {
    // The sign is a display convention; `type` is what actually carries direction.
    expect(displayAmount(tx({ type: 'expense' }))).toEqual({ minor: -2500, currency: 'USD' })
  })

  it('leaves income and transfers as stored', () => {
    expect(displayAmount(tx({ type: 'income' }))).toEqual({ minor: 2500, currency: 'USD' })
    expect(displayAmount(tx({ type: 'transfer' }))).toEqual({ minor: 2500, currency: 'USD' })
  })
})
