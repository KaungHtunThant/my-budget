import { describe, expect, it } from 'vitest'

import type { Budget, Category, CategoryKind } from '@/domain/types'
import type { AmountEntry } from '@/services/fx'

import { type BudgetDraft, availableCategories, buildBudget, canSaveBudget } from './utils'

const category = (id: string, kind: CategoryKind = 'expense'): Category => ({
  id,
  name: id,
  kind,
  parentId: null,
  icon: 'pricetag-outline',
  color: 'primary',
  archived: false,
})

const budget = (id: string, categoryId: string): Budget => ({
  id,
  categoryId,
  limit: { minor: 10000, currency: 'USD' },
  rollover: false,
  archived: false,
})

describe('availableCategories', () => {
  it('offers only categories without a budget', () => {
    const categories = [category('rent'), category('food')]
    const budgets = [budget('b1', 'rent')]
    expect(availableCategories(categories, budgets, null).map((c) => c.id)).toEqual(['food'])
  })

  it('keeps the category being edited, or its own select would show blank', () => {
    const categories = [category('rent'), category('food')]
    const budgets = [budget('b1', 'rent')]
    expect(availableCategories(categories, budgets, 'rent').map((c) => c.id)).toEqual([
      'rent',
      'food',
    ])
  })

  it('offers everything when no budgets exist', () => {
    const categories = [category('rent'), category('food')]
    expect(availableCategories(categories, [], null)).toHaveLength(2)
  })

  it('offers nothing once every category is budgeted', () => {
    const categories = [category('rent')]
    expect(availableCategories(categories, [budget('b1', 'rent')], null)).toEqual([])
  })
})

const entry = (overrides: Partial<AmountEntry> = {}): AmountEntry => ({
  amountText: '250',
  entryCurrency: 'USD',
  targetCurrency: 'USD',
  rateText: '',
  ...overrides,
})

const draft = (overrides: Partial<BudgetDraft> = {}): BudgetDraft => ({
  categoryId: 'rent',
  entry: entry(),
  rollover: false,
  ...overrides,
})

describe('canSaveBudget', () => {
  it('needs a category and a limit above zero', () => {
    expect(canSaveBudget(draft())).toBe(true)
  })

  it('refuses without a category', () => {
    expect(canSaveBudget(draft({ categoryId: null }))).toBe(false)
  })

  it('refuses a zero, negative or unparseable limit', () => {
    expect(canSaveBudget(draft({ entry: entry({ amountText: '0' }) }))).toBe(false)
    expect(canSaveBudget(draft({ entry: entry({ amountText: '-5' }) }))).toBe(false)
    expect(canSaveBudget(draft({ entry: entry({ amountText: '' }) }))).toBe(false)
    expect(canSaveBudget(draft({ entry: entry({ amountText: 'abc' }) }))).toBe(false)
  })

  it('needs a rate when the limit was typed in something other than base', () => {
    const crossing = entry({ entryCurrency: 'EUR', targetCurrency: 'USD' })
    expect(canSaveBudget(draft({ entry: crossing }))).toBe(false)
    expect(canSaveBudget(draft({ entry: { ...crossing, rateText: '1.08' } }))).toBe(true)
  })
})

describe('buildBudget', () => {
  it('stores a base-currency limit as typed, with no conversion recorded', () => {
    expect(buildBudget(draft())).toEqual({
      categoryId: 'rent',
      limit: { minor: 25000, currency: 'USD' },
      fx: null,
      rollover: false,
      archived: false,
    })
  })

  it('converts a foreign limit into base and freezes what was typed', () => {
    // Budgets are compared against spend already converted into base, so the limit has to be in
    // base too — but the form should still be able to reopen showing "250 EUR".
    const built = buildBudget(
      draft({ entry: entry({ entryCurrency: 'EUR', rateText: '1.08' }) }),
    )
    expect(built).toMatchObject({
      limit: { minor: 27000, currency: 'USD' },
      fx: { enteredAmount: { minor: 25000, currency: 'EUR' }, rate: 1.08 },
    })
  })

  it('carries the rollover flag through and never starts archived', () => {
    expect(buildBudget(draft({ rollover: true }))).toMatchObject({
      rollover: true,
      archived: false,
    })
  })

  it('refuses to build without the rate it needs, rather than guessing one', () => {
    expect(buildBudget(draft({ entry: entry({ entryCurrency: 'EUR' }) }))).toBeNull()
  })

  it('refuses an incomplete form', () => {
    expect(buildBudget(draft({ categoryId: null }))).toBeNull()
    expect(buildBudget(draft({ entry: entry({ amountText: '' }) }))).toBeNull()
  })
})
