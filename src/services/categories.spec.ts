import { describe, expect, it } from 'vitest'

import type { Category, CategoryKind } from '@/domain/types'

import { buildCategory, canSaveCategory, defaultAppearance, matchingCategory } from './categories'

const category = (name: string, kind: CategoryKind = 'expense', archived = false): Category => ({
  id: `cat_${name}`,
  name,
  kind,
  parentId: null,
  icon: 'pricetag-outline',
  color: 'primary',
  archived,
})

describe('defaultAppearance', () => {
  it('starts income green with a rising line, and spending neutral with a tag', () => {
    expect(defaultAppearance('income')).toEqual({ icon: 'trending-up-outline', color: 'success' })
    expect(defaultAppearance('expense')).toEqual({ icon: 'pricetag-outline', color: 'primary' })
  })
})

describe('canSaveCategory', () => {
  it('needs a name', () => {
    expect(canSaveCategory('Rent')).toBe(true)
    expect(canSaveCategory('  ')).toBe(false)
  })
})

describe('buildCategory', () => {
  it('trims the name and starts top-level and unarchived', () => {
    expect(
      buildCategory({ name: '  Pets ', kind: 'expense', icon: 'paw-outline', color: 'warning' }),
    ).toEqual({
      name: 'Pets',
      kind: 'expense',
      parentId: null,
      icon: 'paw-outline',
      color: 'warning',
      archived: false,
    })
  })
})

describe('matchingCategory', () => {
  const categories = [category('Groceries'), category('Bonus', 'income'), category('Old', 'expense', true)]

  it('finds a same-kind category whatever the case or spacing', () => {
    expect(matchingCategory(categories, ' groceries ', 'expense')?.id).toBe('cat_Groceries')
  })

  it('ignores the other kind, archived categories and blank names', () => {
    expect(matchingCategory(categories, 'Bonus', 'expense')).toBeUndefined()
    expect(matchingCategory(categories, 'Old', 'expense')).toBeUndefined()
    expect(matchingCategory(categories, '  ', 'expense')).toBeUndefined()
  })
})
