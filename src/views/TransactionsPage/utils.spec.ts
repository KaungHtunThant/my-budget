import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import type { Category, Id, Transaction } from '@/domain/types'

import {
  type TransactionFilters,
  activeFilterCount,
  applyFilters,
  dayGroups,
} from './utils'

const PERIOD = { start: '2026-08-01', end: '2026-08-31', label: 'August 2026' }
const CTX = { base: 'USD' as CurrencyCode, rates: { EUR: 1.1 } }

const CATEGORIES = new Map<Id, Category>([
  [
    'cat_food',
    {
      id: 'cat_food',
      name: 'Groceries',
      kind: 'expense',
      parentId: null,
      icon: 'basket-outline',
      color: 'warning',
      archived: false,
    },
  ],
])

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't',
  type: 'expense',
  amount: { minor: 1000, currency: 'USD' },
  fx: null,
  walletId: 'w1',
  toWalletId: null,
  toAmount: null,
  categoryId: null,
  date: '2026-08-10',
  note: '',
  recurringRuleId: null,
  goalId: null,
  createdAt: '2026-08-10',
  ...overrides,
})

const filters = (overrides: Partial<TransactionFilters> = {}): TransactionFilters => ({
  search: '',
  type: 'all',
  walletId: 'all',
  categoryId: 'all',
  periodOnly: true,
  ...overrides,
})

describe('applyFilters', () => {
  it('limits to the cycle by default', () => {
    const list = [tx({ id: 'in', date: '2026-08-10' }), tx({ id: 'out', date: '2026-07-10' })]
    expect(applyFilters(list, PERIOD, filters(), CATEGORIES).map((t) => t.id)).toEqual(['in'])
  })

  it('shows everything when periodOnly is off', () => {
    const list = [tx({ id: 'in', date: '2026-08-10' }), tx({ id: 'out', date: '2026-07-10' })]
    const result = applyFilters(list, PERIOD, filters({ periodOnly: false }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['in', 'out'])
  })

  it('filters by type', () => {
    const list = [tx({ id: 'e', type: 'expense' }), tx({ id: 'i', type: 'income' })]
    const result = applyFilters(list, PERIOD, filters({ type: 'income' }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['i'])
  })

  it('matches a wallet on either side of a transfer', () => {
    // A transfer belongs to both of its wallets, so filtering by the destination must find it.
    const list = [
      tx({ id: 'from', walletId: 'w1', toWalletId: 'w2', type: 'transfer' }),
      tx({ id: 'other', walletId: 'w3' }),
    ]
    const byDestination = applyFilters(list, PERIOD, filters({ walletId: 'w2' }), CATEGORIES)
    const bySource = applyFilters(list, PERIOD, filters({ walletId: 'w1' }), CATEGORIES)
    expect(byDestination.map((t) => t.id)).toEqual(['from'])
    expect(bySource.map((t) => t.id)).toEqual(['from'])
  })

  it('filters by category', () => {
    const list = [tx({ id: 'a', categoryId: 'cat_food' }), tx({ id: 'b', categoryId: 'cat_rent' })]
    const result = applyFilters(list, PERIOD, filters({ categoryId: 'cat_food' }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('searches the note', () => {
    const list = [tx({ id: 'a', note: 'Weekly shop' }), tx({ id: 'b', note: 'Petrol' })]
    const result = applyFilters(list, PERIOD, filters({ search: 'shop' }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('searches the resolved category name too', () => {
    // "groceries" is as likely to be the category as the note, so both are searched.
    const list = [tx({ id: 'a', categoryId: 'cat_food', note: '' }), tx({ id: 'b', note: '' })]
    const result = applyFilters(list, PERIOD, filters({ search: 'grocer' }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('ignores case and surrounding space in the search term', () => {
    const list = [tx({ id: 'a', note: 'Weekly Shop' })]
    const result = applyFilters(list, PERIOD, filters({ search: '  sHoP ' }), CATEGORIES)
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('combines filters', () => {
    const list = [
      tx({ id: 'a', type: 'expense', walletId: 'w1', note: 'shop' }),
      tx({ id: 'b', type: 'expense', walletId: 'w2', note: 'shop' }),
      tx({ id: 'c', type: 'income', walletId: 'w1', note: 'shop' }),
    ]
    const result = applyFilters(
      list,
      PERIOD,
      filters({ type: 'expense', walletId: 'w1', search: 'shop' }),
      CATEGORIES,
    )
    expect(result.map((t) => t.id)).toEqual(['a'])
  })
})

describe('activeFilterCount', () => {
  it('is zero at defaults', () => {
    expect(activeFilterCount(filters())).toBe(0)
  })

  it('counts each narrowing filter', () => {
    expect(activeFilterCount(filters({ type: 'expense' }))).toBe(1)
    expect(activeFilterCount(filters({ type: 'expense', walletId: 'w1' }))).toBe(2)
    expect(activeFilterCount(filters({ type: 'expense', walletId: 'w1', categoryId: 'c' }))).toBe(3)
  })

  it('counts periodOnly when it is off, since showing everything is the departure', () => {
    expect(activeFilterCount(filters({ periodOnly: false }))).toBe(1)
  })

  it('does not count the search term, which has its own visible box', () => {
    expect(activeFilterCount(filters({ search: 'shop' }))).toBe(0)
  })
})

describe('dayGroups', () => {
  it('groups by date, keeping each day’s transactions together', () => {
    const list = [
      tx({ id: 'a', date: '2026-08-10' }),
      tx({ id: 'b', date: '2026-08-09' }),
      tx({ id: 'c', date: '2026-08-10' }),
    ]
    const groups = dayGroups(list, CTX)
    expect(groups.map((g) => [g.date, g.items.map((t) => t.id)])).toEqual([
      ['2026-08-10', ['a', 'c']],
      ['2026-08-09', ['b']],
    ])
  })

  it('nets income against spending for the day', () => {
    const list = [
      tx({ type: 'income', amount: { minor: 10000, currency: 'USD' } }),
      tx({ type: 'expense', amount: { minor: 2500, currency: 'USD' } }),
    ]
    expect(dayGroups(list, CTX)[0].net).toEqual({ minor: 7500, currency: 'USD' })
  })

  it('leaves transfers out — they move money rather than earning or spending it', () => {
    const list = [
      tx({ type: 'transfer', amount: { minor: 50000, currency: 'USD' }, toWalletId: 'w2' }),
    ]
    expect(dayGroups(list, CTX)[0].net).toEqual({ minor: 0, currency: 'USD' })
  })

  it('converts a foreign amount into base', () => {
    const list = [tx({ type: 'expense', amount: { minor: 10000, currency: 'EUR' } })]
    expect(dayGroups(list, CTX)[0].net).toEqual({ minor: -11000, currency: 'USD' })
  })

  it('omits an amount it cannot convert instead of counting it at face value', () => {
    const list = [
      tx({ id: 'a', type: 'expense', amount: { minor: 1000, currency: 'USD' } }),
      tx({ id: 'b', type: 'expense', amount: { minor: 9999, currency: 'GBP' } }),
    ]
    expect(dayGroups(list, CTX)[0].net).toEqual({ minor: -1000, currency: 'USD' })
  })

  it('has nothing to group with no transactions', () => {
    expect(dayGroups([], CTX)).toEqual([])
  })
})
