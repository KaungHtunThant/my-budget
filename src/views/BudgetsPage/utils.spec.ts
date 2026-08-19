import { describe, expect, it } from 'vitest'

import type { Budget, Category, CategoryKind } from '@/domain/types'

import { availableCategories, canSaveBudget } from './utils'

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

describe('canSaveBudget', () => {
  it('needs a category and a limit above zero', () => {
    expect(canSaveBudget('rent', '250', 'USD')).toBe(true)
  })

  it('refuses without a category', () => {
    expect(canSaveBudget(null, '250', 'USD')).toBe(false)
  })

  it('refuses a zero, negative or unparseable limit', () => {
    expect(canSaveBudget('rent', '0', 'USD')).toBe(false)
    expect(canSaveBudget('rent', '-5', 'USD')).toBe(false)
    expect(canSaveBudget('rent', '', 'USD')).toBe(false)
    expect(canSaveBudget('rent', 'abc', 'USD')).toBe(false)
  })
})
