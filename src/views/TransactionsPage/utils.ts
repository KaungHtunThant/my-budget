/**
 * Activity screen logic: the filter set and the per-day grouping.
 *
 * Split from the screen's other derivation deliberately. The filters change on every keystroke
 * while the transaction list does not, so bundling them into one view model would re-group every
 * day in the list each time a character is typed into the search box.
 */

import { type BaseContext, inPeriod, periodSummary } from '@/domain/budgeting'
import type { Money } from '@/domain/money'
import type { Period } from '@/domain/period'
import type { Category, Id, Transaction, TransactionType } from '@/domain/types'

/** The screen's filter bar, as the user has it set. */
export interface TransactionFilters {
  search: string
  type: TransactionType | 'all'
  walletId: Id | 'all'
  categoryId: Id | 'all'
  /** When false the list shows every transaction rather than only the selected cycle. */
  periodOnly: boolean
}

/**
 * The rows to show.
 *
 * A wallet filter matches a transaction that either leaves *or* arrives at that wallet, so a
 * transfer shows up under both of its wallets rather than only the source. Free text searches the
 * note and the resolved category name together, because "groceries" is as likely to be the
 * category as the note.
 */
export function applyFilters(
  transactions: readonly Transaction[],
  period: Period,
  filters: TransactionFilters,
  categoriesById: ReadonlyMap<Id, Category>,
): Transaction[] {
  const term = filters.search.trim().toLowerCase()
  const source = filters.periodOnly ? inPeriod(transactions, period) : transactions

  return source.filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false

    if (
      filters.walletId !== 'all' &&
      t.walletId !== filters.walletId &&
      t.toWalletId !== filters.walletId
    ) {
      return false
    }

    if (filters.categoryId !== 'all' && t.categoryId !== filters.categoryId) return false

    if (term) {
      const category = t.categoryId ? (categoriesById.get(t.categoryId)?.name ?? '') : ''
      if (!`${t.note} ${category}`.toLowerCase().includes(term)) return false
    }

    return true
  })
}

/**
 * How many filters are narrowing the list, for the badge on the filter button.
 *
 * `periodOnly` counts when it is *off*, because showing everything is the departure from the
 * default rather than the restriction.
 */
export function activeFilterCount(filters: TransactionFilters): number {
  return (
    (filters.type !== 'all' ? 1 : 0) +
    (filters.walletId !== 'all' ? 1 : 0) +
    (filters.categoryId !== 'all' ? 1 : 0) +
    (filters.periodOnly ? 0 : 1)
  )
}

export interface DayGroup {
  date: string
  items: Transaction[]
  /** Income minus spending for the day, in base currency. */
  net: Money
}

/**
 * Transactions grouped by date, so the list reads as a diary rather than a flat feed.
 *
 * The daily net goes through `domain/budgeting.periodSummary` over a one-day range rather than
 * re-deriving the sign rules here: transfers contribute nothing because they move money instead
 * of earning or spending it, expenses subtract, and an amount with no usable rate is left out
 * instead of counted at face value. Those are the same three rules every other total obeys, and
 * they are worth having in one place even at the cost of a single-day `Period`.
 */
export function dayGroups(
  transactions: readonly Transaction[],
  ctx: BaseContext,
): DayGroup[] {
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const bucket = groups.get(tx.date) ?? []
    bucket.push(tx)
    groups.set(tx.date, bucket)
  }

  return [...groups.entries()].map(([date, items]) => ({
    date,
    items,
    net: periodSummary(items, { start: date, end: date, label: date }, ctx).net,
  }))
}
