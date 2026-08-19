/**
 * How one transaction reads in a list.
 *
 * These take *resolved* entities rather than ids, so they can be tested with plain objects and
 * never need the store. The component looks the entities up and passes them in.
 *
 * The icon deliberately stays in the component. Its two fallbacks — the transfer arrows and the
 * uncategorised arrow — are ionicons imported directly rather than names in the icon registry, so
 * resolving it here would mean either importing SVG assets into a logic module or routing an
 * unregistered name through `iconFor`, which would quietly render a price tag instead.
 */

import { formatRelativeDate } from '@/domain/format'
import { type Money, negate } from '@/domain/money'
import type { Category, SavingsGoal, Transaction, Wallet } from '@/domain/types'

/** The records a row's transaction points at, already looked up. */
export interface RowEntities {
  category?: Category
  wallet?: Wallet
  toWallet?: Wallet
  goal?: SavingsGoal
}

/**
 * The row's headline.
 *
 * A transfer is named by where the money went — or by the goal, when it is a contribution, since
 * "Emergency fund" says more than "Main Bank → Savings". Everything else is named by its
 * category, falling back to a word rather than an empty row.
 */
export function rowTitle(tx: Transaction, entities: RowEntities): string {
  if (tx.type === 'transfer') {
    if (entities.goal) return entities.goal.name
    return `${entities.wallet?.name ?? '—'} → ${entities.toWallet?.name ?? '—'}`
  }
  return entities.category?.name ?? 'Uncategorised'
}

/**
 * The supporting line: when, from where, and any note.
 *
 * The wallet is omitted on transfers because the title already names both ends. Parts are joined
 * only when present, so a row never shows a stray separator.
 */
export function rowSubtitle(
  tx: Transaction,
  entities: RowEntities,
  today: string,
  showDate = true,
): string {
  const parts: string[] = []
  if (showDate) parts.push(formatRelativeDate(tx.date, today))
  if (tx.type !== 'transfer' && entities.wallet) parts.push(entities.wallet.name)
  if (tx.note) parts.push(tx.note)
  return parts.join(' · ')
}

/**
 * The row's accent colour.
 *
 * Income is always green regardless of category, because direction matters more than
 * classification at a glance.
 */
export function rowColor(tx: Transaction, entities: RowEntities): string {
  if (tx.type === 'transfer') return entities.goal?.color ?? 'medium'
  if (tx.type === 'income') return 'success'
  return entities.category?.color ?? 'medium'
}

/**
 * The amount as the row should read it.
 *
 * Expenses are stored positive — `type` carries the direction — so they are negated for display
 * only. Nothing here changes what is stored.
 */
export function displayAmount(tx: Transaction): Money {
  return tx.type === 'expense' ? negate(tx.amount) : tx.amount
}
