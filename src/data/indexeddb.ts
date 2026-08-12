/**
 * IndexedDB repository — the persistent data layer.
 *
 * Replaces `MemoryRepository` as the app's store of record. `MemoryRepository` stays as the
 * in-memory double the contract tests run the same assertions against, which is what proves
 * this swap is behaviour-preserving.
 *
 * Two things to know before editing:
 *
 * 1. **Every write goes through `deepClone`.** IndexedDB serialises with the structured clone
 *    algorithm, and records arriving from the UI are Vue reactive proxies — handing one to
 *    `put()` throws `DataCloneError`. `src/data/clone.ts` exists for exactly this, and reading
 *    through a proxy is why it walks the structure by hand instead of calling `structuredClone`.
 *
 * 2. **Ordering is part of the contract.** Views render several collections in whatever order
 *    the repository returned, so `list*` sorts explicitly rather than leaning on primary-key
 *    order, which is arbitrary for uuid-shaped ids.
 */

import { type Money, money } from '@/domain/money'
import type { CurrencyCode } from '@/domain/currency'
import type {
  Budget,
  Category,
  CategoryKind,
  Id,
  NewBudget,
  NewCategory,
  NewRecurringRule,
  NewSavingsGoal,
  NewTransaction,
  NewWallet,
  RecurringRule,
  Repository,
  SavingsGoal,
  Settings,
  Transaction,
  TransactionQuery,
  Wallet,
} from '@/domain/types'
import { BudgetDb, DB_NAME, SCHEMA_VERSION, SETTINGS_KEY, VERSION_KEY } from './db'
import { deepClone as clone } from './clone'
import { buildSeed, type SeedData } from './fixtures'
import { newId, nowIso } from './id'
import {
  type Debounced,
  type Snapshot,
  buildSnapshot,
  debounceSnapshot,
  readSnapshot,
  writeSnapshot,
} from './snapshot'

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name)

export interface IndexedDbRepositoryOptions {
  /**
   * Load demo data when the database is empty on first open. Mirrors `MemoryRepository`, so
   * both implementations start from the same state in tests.
   */
  seeded?: boolean
  /** Database name. Overridden per test so cases cannot see each other's data. */
  name?: string
  /** Mirror every write to the snapshot file. Off in tests that are not about snapshots. */
  snapshots?: boolean
}

export class IndexedDbRepository implements Repository {
  readonly db: BudgetDb

  private readonly seeded: boolean
  private readonly snapshot: Debounced
  /** Set while restoring, so reading the file back does not immediately rewrite it. */
  private restoring = false

  constructor(options: IndexedDbRepositoryOptions = {}) {
    this.seeded = options.seeded ?? false
    this.db = new BudgetDb(options.name ?? DB_NAME)

    this.snapshot = debounceSnapshot(() => {
      void this.saveSnapshot()
    })

    /*
     * Every write to any table schedules a snapshot. Registered once, here, rather than at
     * each call site — Dexie fires these for put, bulkPut, delete, modify and clear alike,
     * so a method added later cannot forget to keep the file current.
     */
    if (options.snapshots ?? true) {
      for (const table of this.db.tables) {
        const onWrite = (): void => {
          if (!this.restoring) this.snapshot.schedule()
        }
        table.hook('creating', onWrite)
        table.hook('updating', onWrite)
        table.hook('deleting', onWrite)
      }
    }
  }

  async init(): Promise<void> {
    await this.db.open()
    if (await this.db.meta.get(SETTINGS_KEY)) return

    // The stores are empty. Before starting the user over from scratch, check whether a
    // snapshot outlived whatever cleared them.
    const restored = await readSnapshot()
    if (restored) {
      this.restoring = true
      try {
        await this.load(restored)
      } finally {
        this.restoring = false
      }
      return
    }

    await this.load(buildSeed({ withDemoData: this.seeded }))
  }

  /** Release the underlying connection, and any snapshot still owed. */
  close(): void {
    this.snapshot.flush()
    this.db.close()
  }

  /** Drop the database entirely. Test teardown only. */
  async destroy(): Promise<void> {
    this.snapshot.cancel()
    this.db.close()
    await this.db.delete()
  }

  /** Everything on disk, as one payload. Feeds the snapshot file and file export alike. */
  async exportSnapshot(): Promise<Snapshot> {
    const d = this.db
    // Deliberately unfiltered: a backup keeps archived records, which `list*` hides.
    const [wallets, categories, transactions, budgets, rules, goals] = await Promise.all([
      d.wallets.toArray(),
      d.categories.toArray(),
      d.transactions.toArray(),
      d.budgets.toArray(),
      d.rules.toArray(),
      d.goals.toArray(),
    ])
    const settings = await this.getSettings()
    return buildSnapshot(
      { settings, wallets, categories, transactions, budgets, rules, goals },
      nowIso(),
    )
  }

  /** Write the snapshot now, skipping the debounce. Used when the app goes to background. */
  async saveSnapshot(): Promise<boolean> {
    if (this.restoring) return false
    return writeSnapshot(await this.exportSnapshot())
  }

  /** Replace everything with `seed`, in one transaction so a failure cannot half-apply. */
  private async load(seed: SeedData): Promise<void> {
    const d = this.db
    await d.transaction(
      'rw',
      [d.wallets, d.categories, d.transactions, d.budgets, d.rules, d.goals, d.meta],
      async () => {
        await Promise.all([
          d.wallets.clear(),
          d.categories.clear(),
          d.transactions.clear(),
          d.budgets.clear(),
          d.rules.clear(),
          d.goals.clear(),
          d.meta.clear(),
        ])
        await Promise.all([
          d.wallets.bulkPut(clone(seed.wallets)),
          d.categories.bulkPut(clone(seed.categories)),
          d.transactions.bulkPut(clone(seed.transactions)),
          d.budgets.bulkPut(clone(seed.budgets)),
          d.rules.bulkPut(clone(seed.rules)),
          d.goals.bulkPut(clone(seed.goals)),
          d.meta.bulkPut([
            { key: SETTINGS_KEY, value: clone(seed.settings) },
            { key: VERSION_KEY, value: SCHEMA_VERSION },
          ]),
        ])
      },
    )
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    const row = await this.db.meta.get(SETTINGS_KEY)
    if (row) return clone(row.value as Settings)

    // Self-heal rather than throw: a missing settings row would otherwise leave the app with
    // no base currency, and every amount on screen depends on having one.
    const fallback = buildSeed({}).settings
    await this.db.meta.put({ key: SETTINGS_KEY, value: fallback })
    return clone(fallback)
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    const next = clone(settings)
    await this.db.meta.put({ key: SETTINGS_KEY, value: next })
    return clone(next)
  }

  // -------------------------------------------------------------------------
  // Wallets
  // -------------------------------------------------------------------------

  async listWallets(includeArchived = false): Promise<Wallet[]> {
    const all = await this.db.wallets.toArray()
    return all.filter((w) => includeArchived || !w.archived).sort(byName)
  }

  async getWallet(id: Id): Promise<Wallet | null> {
    return (await this.db.wallets.get(id)) ?? null
  }

  async createWallet(wallet: NewWallet): Promise<Wallet> {
    const created: Wallet = { ...clone(wallet), id: newId('wal'), createdAt: nowIso() }
    await this.db.wallets.put(created)
    return clone(created)
  }

  async updateWallet(wallet: Wallet): Promise<Wallet> {
    const next = clone(wallet)
    await this.db.wallets.put(next)
    return clone(next)
  }

  async deleteWallet(id: Id): Promise<void> {
    const d = this.db
    await d.transaction('rw', [d.wallets, d.transactions], async () => {
      await d.wallets.delete(id)
      // Transactions referencing a deleted wallet would be unreadable, so they go too.
      const orphaned = await d.transactions
        .filter((t) => t.walletId === id || t.toWalletId === id)
        .primaryKeys()
      await d.transactions.bulkDelete(orphaned)
    })
  }

  async walletBalance(id: Id): Promise<Money> {
    const wallet = await this.db.wallets.get(id)
    if (!wallet) throw new Error(`Unknown wallet: ${id}`)

    let total = wallet.openingBalance.minor

    await this.db.transactions
      .where('walletId')
      .equals(id)
      .each((tx) => {
        if (tx.type === 'income') total += tx.amount.minor
        else total -= tx.amount.minor // expense, or the outgoing leg of a transfer
      })

    // Only transfers carry a non-null toWalletId, and IndexedDB leaves null key paths out of
    // an index — so this walks transfers into the wallet and nothing else.
    await this.db.transactions
      .where('toWalletId')
      .equals(id)
      .each((tx) => {
        if (tx.type === 'transfer') {
          // Credit the destination with its own converted amount on cross-currency moves.
          total += (tx.toAmount ?? tx.amount).minor
        }
      })

    return money(total, wallet.currency)
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async listCategories(kind?: CategoryKind, includeArchived = false): Promise<Category[]> {
    const all = kind
      ? await this.db.categories.where('kind').equals(kind).toArray()
      : await this.db.categories.toArray()
    return all.filter((c) => includeArchived || !c.archived).sort(byName)
  }

  async getCategory(id: Id): Promise<Category | null> {
    return (await this.db.categories.get(id)) ?? null
  }

  async createCategory(category: NewCategory): Promise<Category> {
    const created: Category = { ...clone(category), id: newId('cat') }
    await this.db.categories.put(created)
    return clone(created)
  }

  async updateCategory(category: Category): Promise<Category> {
    const next = clone(category)
    await this.db.categories.put(next)
    return clone(next)
  }

  async deleteCategory(id: Id): Promise<void> {
    const d = this.db
    await d.transaction('rw', [d.categories, d.transactions, d.budgets], async () => {
      await d.categories.delete(id)
      // Keep the transactions but detach them, so spend history is never silently deleted.
      await d.transactions.where('categoryId').equals(id).modify({ categoryId: null })
      const dependent = await d.budgets.where('categoryId').equals(id).primaryKeys()
      await d.budgets.bulkDelete(dependent)
    })
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  async listTransactions(query: TransactionQuery = {}): Promise<Transaction[]> {
    // Narrow on the date index when a range is given — the one filter worth pushing down,
    // since it is how a single cycle would be fetched without loading all history.
    const base =
      query.from !== undefined || query.to !== undefined
        ? this.db.transactions
            .where('date')
            .between(query.from ?? '', query.to ?? '￿', true, true)
        : this.db.transactions

    const search = query.search?.trim().toLowerCase()
    const rows = (await base.toArray()).filter((t) => {
      if (query.type && t.type !== query.type) return false
      if (query.categoryId && t.categoryId !== query.categoryId) return false
      if (query.walletId && t.walletId !== query.walletId && t.toWalletId !== query.walletId) {
        return false
      }
      if (search && !t.note.toLowerCase().includes(search)) return false
      return true
    })

    // Newest first; createdAt breaks ties so same-day entries keep a stable order.
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    return query.limit !== undefined ? rows.slice(0, query.limit) : rows
  }

  async getTransaction(id: Id): Promise<Transaction | null> {
    return (await this.db.transactions.get(id)) ?? null
  }

  async createTransaction(tx: NewTransaction): Promise<Transaction> {
    const created: Transaction = { ...clone(tx), id: newId('txn'), createdAt: nowIso() }
    await this.db.transactions.put(created)
    return clone(created)
  }

  async updateTransaction(tx: Transaction): Promise<Transaction> {
    const next = clone(tx)
    await this.db.transactions.put(next)
    return clone(next)
  }

  async deleteTransaction(id: Id): Promise<void> {
    await this.db.transactions.delete(id)
  }

  // -------------------------------------------------------------------------
  // Budgets
  // -------------------------------------------------------------------------

  async listBudgets(includeArchived = false): Promise<Budget[]> {
    const all = await this.db.budgets.toArray()
    return all.filter((b) => includeArchived || !b.archived)
  }

  async createBudget(budget: NewBudget): Promise<Budget> {
    const created: Budget = { ...clone(budget), id: newId('bdg') }
    await this.db.budgets.put(created)
    return clone(created)
  }

  async updateBudget(budget: Budget): Promise<Budget> {
    const next = clone(budget)
    await this.db.budgets.put(next)
    return clone(next)
  }

  async deleteBudget(id: Id): Promise<void> {
    await this.db.budgets.delete(id)
  }

  // -------------------------------------------------------------------------
  // Recurring rules
  // -------------------------------------------------------------------------

  async listRecurringRules(activeOnly = false): Promise<RecurringRule[]> {
    const all = await this.db.rules.toArray()
    return all.filter((r) => (activeOnly ? r.active : true)).sort(byName)
  }

  async createRecurringRule(rule: NewRecurringRule): Promise<RecurringRule> {
    const created: RecurringRule = { ...clone(rule), id: newId('rec') }
    await this.db.rules.put(created)
    return clone(created)
  }

  async updateRecurringRule(rule: RecurringRule): Promise<RecurringRule> {
    const next = clone(rule)
    await this.db.rules.put(next)
    return clone(next)
  }

  async deleteRecurringRule(id: Id): Promise<void> {
    await this.db.rules.delete(id)
  }

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  async listGoals(includeArchived = false): Promise<SavingsGoal[]> {
    const all = await this.db.goals.toArray()
    return all.filter((g) => includeArchived || !g.archived).sort(byName)
  }

  async getGoal(id: Id): Promise<SavingsGoal | null> {
    return (await this.db.goals.get(id)) ?? null
  }

  async createGoal(goal: NewSavingsGoal): Promise<SavingsGoal> {
    const created: SavingsGoal = { ...clone(goal), id: newId('gol'), createdAt: nowIso() }
    await this.db.goals.put(created)
    return clone(created)
  }

  async updateGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    const next = clone(goal)
    await this.db.goals.put(next)
    return clone(next)
  }

  async deleteGoal(id: Id): Promise<void> {
    const d = this.db
    await d.transaction('rw', [d.goals, d.transactions], async () => {
      await d.goals.delete(id)
      await d.transactions.where('goalId').equals(id).modify({ goalId: null })
    })
  }

  async reset(
    options: { withDemoData?: boolean; baseCurrency?: CurrencyCode } = {},
  ): Promise<void> {
    const current = await this.db.meta.get(SETTINGS_KEY)
    const baseCurrency =
      options.baseCurrency ?? (current?.value as Settings | undefined)?.baseCurrency
    await this.load(
      buildSeed({ withDemoData: options.withDemoData ?? this.seeded, baseCurrency }),
    )
  }
}
