/**
 * Category rules shared by the Categories screen and the quick "New category" sheet that opens
 * from any category picker: what a new category looks like by default, when it can be saved, the
 * record it becomes, and whether one by that name already exists.
 */

import type { Category, CategoryKind, NewCategory } from '@/domain/types'

export interface CategoryAppearance {
  icon: string
  color: string
}

/** Where a new category starts before the user picks an icon and colour. */
export function defaultAppearance(kind: CategoryKind): CategoryAppearance {
  return kind === 'income'
    ? { icon: 'trending-up-outline', color: 'success' }
    : { icon: 'pricetag-outline', color: 'primary' }
}

/** A category needs a name; the icon and colour both have defaults. */
export function canSaveCategory(name: string): boolean {
  return name.trim().length > 0
}

/** The record a new category is stored as. */
export function buildCategory(
  input: { name: string; kind: CategoryKind } & CategoryAppearance,
): NewCategory {
  return {
    name: input.name.trim(),
    kind: input.kind,
    parentId: null,
    icon: input.icon,
    color: input.color,
    archived: false,
  }
}

/**
 * An existing category of `kind` with this name, ignoring case and surrounding space. Creating
 * from a picker selects it instead of making a second "Groceries" the lists cannot tell apart.
 */
export function matchingCategory(
  categories: readonly Category[],
  name: string,
  kind: CategoryKind,
): Category | undefined {
  const wanted = name.trim().toLocaleLowerCase()
  if (!wanted) return undefined
  return categories.find(
    (c) => c.kind === kind && !c.archived && c.name.trim().toLocaleLowerCase() === wanted,
  )
}

/**
 * The value of the "New category…" entry at the end of every category picker. Never stored: a
 * picker that sees it opens the quick-create sheet and puts its previous choice back if the sheet
 * is closed without creating anything.
 */
export const NEW_CATEGORY_CHOICE = '__new_category__'
