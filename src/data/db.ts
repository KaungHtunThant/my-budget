/**
 * The IndexedDB schema.
 *
 * One Dexie database, one table per collection, keyed by the opaque string ids `newId`
 * already produces. `Settings` is a singleton rather than a collection, so it lives in the
 * `meta` key-value table next to the schema version.
 *
 * Why IndexedDB rather than SQLite: nothing above the repository issues a query. The store
 * loads every collection at startup and every filter, rollup and report is a pure function
 * over arrays, so SQL's query planning and joins would go unused while its costs — plugin
 * init, a WASM browser fallback, hand-written migrations — would not. See
 * `docs/adr-001-document-store.md`.
 */

import Dexie, { type Table } from 'dexie'
import type {
  Budget,
  Category,
  Id,
  RecurringRule,
  SavingsGoal,
  Transaction,
  Wallet,
} from '@/domain/types'

/** Current on-disk shape. Bump with every schema change, and add a Dexie `upgrade()` hook. */
export const SCHEMA_VERSION = 1

export const DB_NAME = 'my-budget'

/** Rows of the `meta` table: singletons that do not deserve a collection of their own. */
export interface MetaRow {
  key: string
  value: unknown
}

export class BudgetDb extends Dexie {
  wallets!: Table<Wallet, Id>
  categories!: Table<Category, Id>
  transactions!: Table<Transaction, Id>
  budgets!: Table<Budget, Id>
  rules!: Table<RecurringRule, Id>
  goals!: Table<SavingsGoal, Id>
  meta!: Table<MetaRow, string>

  constructor(name: string = DB_NAME) {
    super(name)

    /*
     * `toWalletId` and `goalId` are indexed on purpose. IndexedDB leaves a record out of an
     * index when the key path resolves to null, and both are null on everything except
     * transfers and goal contributions respectively — so those indexes stay small and hold
     * exactly the rows their one query wants: the incoming leg of `walletBalance`, and the
     * contributions `deleteGoal` has to detach. Without them, each of those means scanning
     * every transaction.
     */
    this.version(1).stores({
      wallets: 'id',
      categories: 'id, kind',
      transactions: 'id, date, walletId, toWalletId, categoryId, goalId',
      budgets: 'id, categoryId',
      rules: 'id',
      goals: 'id',
      meta: 'key',
    })
  }
}

/** Settings key in the `meta` table. */
export const SETTINGS_KEY = 'settings'
/** Schema-version key in the `meta` table, so a stored database can identify itself. */
export const VERSION_KEY = 'schemaVersion'
