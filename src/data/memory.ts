/**
 * In-memory repository — the prototype's data layer.
 *
 * This exists so every screen can be built and judged against realistic data before any
 * database work begins. It implements the full `Repository` contract, so Stage 2 replaces
 * this file with a SQLite-backed class and nothing above it changes.
 *
 * Deliberate limitation: nothing survives a reload. That is the point of the prototype
 * stage — persistence is Stage 2 (D0–D2), and pretending to persist here would hide the
 * design questions the real database has to answer.
 */

import {
  type Budget,
  type Category,
  type CategoryKind,
  type Id,
  type NewBudget,
  type NewCategory,
  type NewRecurringRule,
  type NewSavingsGoal,
  type NewTransaction,
  type NewWallet,
  type RecurringRule,
  type Repository,
  type SavingsGoal,
  type Settings,
  type Transaction,
  type TransactionQuery,
  type Wallet,
} from '@/domain/types'
import type { CurrencyCode } from '@/domain/currency'
import { type Money, money } from '@/domain/money'
import { deepClone as clone } from './clone'
import { buildSeed, type SeedData } from './fixtures'
import { newId, nowIso } from './id'

export class MemoryRepository implements Repository {
  private settings!: Settings
  private wallets: Wallet[] = []
  private categories: Category[] = []
  private transactions: Transaction[] = []
  private budgets: Budget[] = []
  private rules: RecurringRule[] = []
  private goals: SavingsGoal[] = []

  /**
   * @param seeded When true, load demo data so screens have something to show. Tests pass
   *   false to start from a clean, predictable store.
   */
  constructor(private readonly seeded = false) {}

  async init(): Promise<void> {
    this.load(buildSeed({ withDemoData: this.seeded }))
  }

  async reset(options: { withDemoData?: boolean; baseCurrency?: CurrencyCode } = {}): Promise<void> {
    this.load(
      buildSeed({
        withDemoData: options.withDemoData ?? this.seeded,
        baseCurrency: options.baseCurrency ?? this.settings?.baseCurrency,
      }),
    )
  }

  private load(seed: SeedData): void {
    this.settings = clone(seed.settings)
    this.wallets = clone(seed.wallets)
    this.categories = clone(seed.categories)
    this.transactions = clone(seed.transactions)
    this.budgets = clone(seed.budgets)
    this.rules = clone(seed.rules)
    this.goals = clone(seed.goals)
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    return clone(this.settings)
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    this.settings = clone(settings)
    return clone(this.settings)
  }

  // -------------------------------------------------------------------------
  // Wallets
  // -------------------------------------------------------------------------

  async listWallets(includeArchived = false): Promise<Wallet[]> {
    return clone(
      this.wallets
        .filter((w) => includeArchived || !w.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  async getWallet(id: Id): Promise<Wallet | null> {
    const found = this.wallets.find((w) => w.id === id)
    return found ? clone(found) : null
  }

  async createWallet(wallet: NewWallet): Promise<Wallet> {
    const created: Wallet = { ...clone(wallet), id: newId('wal'), createdAt: nowIso() }
    this.wallets.push(created)
    return clone(created)
  }

  async updateWallet(wallet: Wallet): Promise<Wallet> {
    this.wallets = this.wallets.map((w) => (w.id === wallet.id ? clone(wallet) : w))
    return clone(wallet)
  }

  async deleteWallet(id: Id): Promise<void> {
    this.wallets = this.wallets.filter((w) => w.id !== id)
    // Transactions referencing a deleted wallet would be unreadable, so they go too.
    this.transactions = this.transactions.filter((t) => t.walletId !== id && t.toWalletId !== id)
  }

  async walletBalance(id: Id): Promise<Money> {
    const wallet = this.wallets.find((w) => w.id === id)
    if (!wallet) throw new Error(`Unknown wallet: ${id}`)

    let total = wallet.openingBalance.minor
    for (const tx of this.transactions) {
      if (tx.walletId === id) {
        if (tx.type === 'income') total += tx.amount.minor
        else total -= tx.amount.minor // expense, or the outgoing leg of a transfer
      }
      if (tx.type === 'transfer' && tx.toWalletId === id) {
        // Credit the destination with its own converted amount on cross-currency moves.
        total += (tx.toAmount ?? tx.amount).minor
      }
    }
    return money(total, wallet.currency)
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async listCategories(kind?: CategoryKind, includeArchived = false): Promise<Category[]> {
    return clone(
      this.categories
        .filter((c) => (kind ? c.kind === kind : true))
        .filter((c) => includeArchived || !c.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  async getCategory(id: Id): Promise<Category | null> {
    const found = this.categories.find((c) => c.id === id)
    return found ? clone(found) : null
  }

  async createCategory(category: NewCategory): Promise<Category> {
    const created: Category = { ...clone(category), id: newId('cat') }
    this.categories.push(created)
    return clone(created)
  }

  async updateCategory(category: Category): Promise<Category> {
    this.categories = this.categories.map((c) => (c.id === category.id ? clone(category) : c))
    return clone(category)
  }

  async deleteCategory(id: Id): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id)
    // Keep the transactions but detach them, so spend history is never silently deleted.
    this.transactions = this.transactions.map((t) =>
      t.categoryId === id ? { ...t, categoryId: null } : t,
    )
    this.budgets = this.budgets.filter((b) => b.categoryId !== id)
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  async listTransactions(query: TransactionQuery = {}): Promise<Transaction[]> {
    const search = query.search?.trim().toLowerCase()
    let result = this.transactions.filter((t) => {
      if (query.from && t.date < query.from) return false
      if (query.to && t.date > query.to) return false
      if (query.type && t.type !== query.type) return false
      if (query.categoryId && t.categoryId !== query.categoryId) return false
      if (query.walletId && t.walletId !== query.walletId && t.toWalletId !== query.walletId) {
        return false
      }
      if (search && !t.note.toLowerCase().includes(search)) return false
      return true
    })

    // Newest first; createdAt breaks ties so same-day entries keep a stable order.
    result = result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    if (query.limit !== undefined) result = result.slice(0, query.limit)
    return clone(result)
  }

  async getTransaction(id: Id): Promise<Transaction | null> {
    const found = this.transactions.find((t) => t.id === id)
    return found ? clone(found) : null
  }

  async createTransaction(tx: NewTransaction): Promise<Transaction> {
    const created: Transaction = { ...clone(tx), id: newId('txn'), createdAt: nowIso() }
    this.transactions.push(created)
    return clone(created)
  }

  async updateTransaction(tx: Transaction): Promise<Transaction> {
    this.transactions = this.transactions.map((t) => (t.id === tx.id ? clone(tx) : t))
    return clone(tx)
  }

  async deleteTransaction(id: Id): Promise<void> {
    this.transactions = this.transactions.filter((t) => t.id !== id)
  }

  // -------------------------------------------------------------------------
  // Budgets
  // -------------------------------------------------------------------------

  async listBudgets(includeArchived = false): Promise<Budget[]> {
    return clone(this.budgets.filter((b) => includeArchived || !b.archived))
  }

  async createBudget(budget: NewBudget): Promise<Budget> {
    const created: Budget = { ...clone(budget), id: newId('bdg') }
    this.budgets.push(created)
    return clone(created)
  }

  async updateBudget(budget: Budget): Promise<Budget> {
    this.budgets = this.budgets.map((b) => (b.id === budget.id ? clone(budget) : b))
    return clone(budget)
  }

  async deleteBudget(id: Id): Promise<void> {
    this.budgets = this.budgets.filter((b) => b.id !== id)
  }

  // -------------------------------------------------------------------------
  // Recurring rules
  // -------------------------------------------------------------------------

  async listRecurringRules(activeOnly = false): Promise<RecurringRule[]> {
    return clone(this.rules.filter((r) => (activeOnly ? r.active : true)))
  }

  async createRecurringRule(rule: NewRecurringRule): Promise<RecurringRule> {
    const created: RecurringRule = { ...clone(rule), id: newId('rec') }
    this.rules.push(created)
    return clone(created)
  }

  async updateRecurringRule(rule: RecurringRule): Promise<RecurringRule> {
    this.rules = this.rules.map((r) => (r.id === rule.id ? clone(rule) : r))
    return clone(rule)
  }

  async deleteRecurringRule(id: Id): Promise<void> {
    this.rules = this.rules.filter((r) => r.id !== id)
  }

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  async listGoals(includeArchived = false): Promise<SavingsGoal[]> {
    return clone(this.goals.filter((g) => includeArchived || !g.archived))
  }

  async getGoal(id: Id): Promise<SavingsGoal | null> {
    const found = this.goals.find((g) => g.id === id)
    return found ? clone(found) : null
  }

  async createGoal(goal: NewSavingsGoal): Promise<SavingsGoal> {
    const created: SavingsGoal = { ...clone(goal), id: newId('gol'), createdAt: nowIso() }
    this.goals.push(created)
    return clone(created)
  }

  async updateGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    this.goals = this.goals.map((g) => (g.id === goal.id ? clone(goal) : g))
    return clone(goal)
  }

  async deleteGoal(id: Id): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== id)
    this.transactions = this.transactions.map((t) => (t.goalId === id ? { ...t, goalId: null } : t))
  }
}
