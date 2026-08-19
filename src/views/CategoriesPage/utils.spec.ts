import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import type { Category, CategoryKind, Transaction, TransactionType } from '@/domain/types'

import { canSaveCategory, categoryTotals, visibleCategories } from './utils'

const category = (id: string, kind: CategoryKind): Category => ({
  id,
  name: id,
  kind,
  parentId: null,
  icon: 'pricetag-outline',
  color: 'primary',
  archived: false,
})

const tx = (
  id: string,
  type: TransactionType,
  categoryId: string | null,
  minor: number,
  currency: CurrencyCode = 'USD',
): Transaction => ({
  id,
  type,
  amount: { minor, currency },
  fx: null,
  walletId: 'w',
  toWalletId: null,
  toAmount: null,
  categoryId,
  date: '2026-08-10',
  note: '',
  recurringRuleId: null,
  goalId: null,
  createdAt: '2026-08-10',
})

const CTX = { base: 'USD' as CurrencyCode, rates: { EUR: 1.1 } }

describe('visibleCategories', () => {
  it('shows only the tab’s kind', () => {
    const all = [category('rent', 'expense'), category('salary', 'income')]
    expect(visibleCategories(all, 'expense').map((c) => c.id)).toEqual(['rent'])
    expect(visibleCategories(all, 'income').map((c) => c.id)).toEqual(['salary'])
  })
})

describe('canSaveCategory', () => {
  it('needs a name', () => {
    expect(canSaveCategory('Rent')).toBe(true)
    expect(canSaveCategory('  ')).toBe(false)
  })
})

describe('categoryTotals', () => {
  it('totals expenses on the expense tab', () => {
    const categories = [category('rent', 'expense')]
    const transactions = [tx('a', 'expense', 'rent', 5000), tx('b', 'expense', 'rent', 2500)]
    expect(categoryTotals(transactions, categories, 'expense', CTX).get('rent')).toEqual({
      minor: 7500,
      currency: 'USD',
    })
  })

  it('totals INCOME on the income tab — the reason this is not spendByCategory', () => {
    // domain spendByCategory hard-wires expensesOnly. Routing this through it would leave every
    // row on the income tab reading zero.
    const categories = [category('salary', 'income')]
    const transactions = [tx('a', 'income', 'salary', 300000)]
    expect(categoryTotals(transactions, categories, 'income', CTX).get('salary')).toEqual({
      minor: 300000,
      currency: 'USD',
    })
  })

  it('ignores transactions of the other kind', () => {
    const categories = [category('rent', 'expense')]
    const transactions = [tx('a', 'expense', 'rent', 5000), tx('b', 'income', 'rent', 9999)]
    expect(categoryTotals(transactions, categories, 'expense', CTX).get('rent')).toEqual({
      minor: 5000,
      currency: 'USD',
    })
  })

  it('excludes transfers, which neither earn nor spend', () => {
    const categories = [category('rent', 'expense')]
    const transactions = [tx('a', 'transfer', 'rent', 5000)]
    expect(categoryTotals(transactions, categories, 'expense', CTX).get('rent')).toEqual({
      minor: 0,
      currency: 'USD',
    })
  })

  it('gives every visible category an entry, including one with nothing spent', () => {
    const categories = [category('rent', 'expense'), category('food', 'expense')]
    const totals = categoryTotals([tx('a', 'expense', 'rent', 100)], categories, 'expense', CTX)
    expect(totals.get('food')).toEqual({ minor: 0, currency: 'USD' })
    expect([...totals.keys()]).toEqual(['rent', 'food'])
  })

  it('converts a foreign amount into base', () => {
    const categories = [category('rent', 'expense')]
    const transactions = [tx('a', 'expense', 'rent', 10000, 'EUR')]
    expect(categoryTotals(transactions, categories, 'expense', CTX).get('rent')).toEqual({
      minor: 11000,
      currency: 'USD',
    })
  })

  it('drops an amount it cannot convert rather than counting it at face value', () => {
    const categories = [category('rent', 'expense')]
    const transactions = [tx('a', 'expense', 'rent', 5000), tx('b', 'expense', 'rent', 9999, 'GBP')]
    expect(categoryTotals(transactions, categories, 'expense', CTX).get('rent')).toEqual({
      minor: 5000,
      currency: 'USD',
    })
  })

  it('ignores uncategorised transactions', () => {
    const categories = [category('rent', 'expense')]
    expect(
      categoryTotals([tx('a', 'expense', null, 5000)], categories, 'expense', CTX).get('rent'),
    ).toEqual({ minor: 0, currency: 'USD' })
  })
})
