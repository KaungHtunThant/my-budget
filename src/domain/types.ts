/**
 * Domain entities.
 *
 * These are the real shapes, written during the prototype stage on purpose: the mock
 * repository and the eventual SQLite repository both store exactly this, so the Stage 2
 * cut-over is a swap of implementation rather than a reshaping of data.
 *
 * Conventions:
 *  - `id` is an opaque string. The mock generates them; SQLite will keep the same contract.
 *  - Dates are ISO "YYYY-MM-DD" strings; timestamps are ISO 8601 with time.
 *  - Amounts are always `Money` (integer minor units + currency), never bare numbers.
 */

import type { CurrencyCode } from './currency'
import type { Money } from './money'
import type { BudgetPeriodConfig } from './period'

export type Id = string

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

export type WalletKind = 'cash' | 'bank' | 'savings' | 'card' | 'other'

export interface Wallet {
  readonly id: Id
  name: string
  kind: WalletKind
  /** A wallet holds exactly one currency and is never silently converted. */
  currency: CurrencyCode
  /** Balance when the wallet was added, so history need not start at zero. */
  openingBalance: Money
  /** Ionicons name for the list row. */
  icon: string
  /** CSS colour token for the accent dot. */
  color: string
  archived: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryKind = 'income' | 'expense'

export interface Category {
  readonly id: Id
  name: string
  kind: CategoryKind
  /** Parent category id, or null for a top-level category. */
  parentId: Id | null
  icon: string
  color: string
  archived: boolean
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionType = 'income' | 'expense' | 'transfer'

/**
 * Recorded conversion detail, present only when the entered currency differs from the
 * wallet's. `rate` means: 1 unit of `enteredAmount.currency` = `rate` units of the
 * wallet's currency. Frozen at entry time and never recomputed.
 */
export interface TransactionFx {
  readonly enteredAmount: Money
  readonly rate: number
}

export interface Transaction {
  readonly id: Id
  type: TransactionType
  /** Amount in the wallet's own currency. Always positive; `type` carries the direction. */
  amount: Money
  /** Set when the user entered a foreign-currency amount and supplied a rate. */
  fx: TransactionFx | null
  /** Source wallet for expense/transfer, destination wallet for income. */
  walletId: Id
  /** Destination wallet, transfers only. */
  toWalletId: Id | null
  /**
   * Amount credited to `toWalletId`. Differs from `amount` on a cross-currency transfer,
   * where the user supplied the rate between the two wallets.
   */
  toAmount: Money | null
  /** Null for transfers, which move money rather than earning or spending it. */
  categoryId: Id | null
  date: string
  note: string
  /** Set when generated from a recurring rule, so it can be traced back. */
  recurringRuleId: Id | null
  /** Set when this transaction is a contribution to a savings goal. */
  goalId: Id | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface Budget {
  readonly id: Id
  categoryId: Id
  /** Limit per period, in the base currency. */
  limit: Money
  /** Carry unspent room into the next period. */
  rollover: boolean
  archived: boolean
}

/** Derived, never stored: a budget with its spend for one period. */
export interface BudgetStatus {
  readonly budget: Budget
  readonly category: Category
  readonly limit: Money
  readonly spent: Money
  readonly remaining: Money
  /** Unspent room carried in from previous periods, zero when rollover is off. */
  readonly carriedIn: Money
  readonly percentUsed: number
  readonly overspent: boolean
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

export type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly'

export interface RecurringRule {
  readonly id: Id
  name: string
  type: TransactionType
  amount: Money
  walletId: Id
  toWalletId: Id | null
  categoryId: Id | null
  frequency: RecurrenceFrequency
  /** Day of month for monthly/yearly, weekday 0–6 for weekly/fortnightly. */
  dayOfMonth: number | null
  weekday: number | null
  startDate: string
  endDate: string | null
  /** Last date a transaction was generated, so generation is idempotent. */
  lastRunDate: string | null
  active: boolean
  note: string
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export interface SavingsGoal {
  readonly id: Id
  name: string
  target: Money
  /** Wallet the goal's money accumulates in. */
  walletId: Id
  targetDate: string | null
  icon: string
  color: string
  archived: boolean
  createdAt: string
}

/** Derived: a goal with its progress. */
export interface GoalStatus {
  readonly goal: SavingsGoal
  readonly saved: Money
  readonly remaining: Money
  readonly percentComplete: number
  /** Contribution per period needed to hit `targetDate`, or null when there is no date. */
  readonly requiredPerPeriod: Money | null
  readonly complete: boolean
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Settings {
  /** Chosen once during first-run onboarding; changeable later. */
  baseCurrency: CurrencyCode
  /** Currencies the user has opted into, so pickers need not list all ~160 every time. */
  activeCurrencies: CurrencyCode[]
  /** Manual rate per currency against base, used for combined multi-currency totals. */
  rates: Partial<Record<CurrencyCode, number>>
  budgetPeriod: BudgetPeriodConfig
  theme: ThemePreference
  /** Reserved for the deferred biometric/PIN lock. Always false in the prototype. */
  appLockEnabled: boolean
  /** False until first-run onboarding completes. */
  onboardingComplete: boolean
}

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

/** Fields the caller supplies; ids and timestamps are assigned by the repository. */
export type NewWallet = Omit<Wallet, 'id' | 'createdAt'>
export type NewCategory = Omit<Category, 'id'>
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>
export type NewSavingsGoal = Omit<SavingsGoal, 'id' | 'createdAt'>
export type NewBudget = Omit<Budget, 'id'>
export type NewRecurringRule = Omit<RecurringRule, 'id'>

export interface TransactionQuery {
  from?: string
  to?: string
  walletId?: Id
  categoryId?: Id
  type?: TransactionType
  /** Case-insensitive match against the note. */
  search?: string
  limit?: number
}

/**
 * The single data-access contract.
 *
 * Views and stores depend on this interface only. `MemoryRepository` implements it for the
 * prototype; `SqliteRepository` will implement it in Stage 2 with no change above this line.
 * Everything is async so the SQLite implementation drops in without rewriting callers.
 */
export interface Repository {
  init(): Promise<void>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>

  listWallets(includeArchived?: boolean): Promise<Wallet[]>
  getWallet(id: Id): Promise<Wallet | null>
  createWallet(wallet: NewWallet): Promise<Wallet>
  updateWallet(wallet: Wallet): Promise<Wallet>
  deleteWallet(id: Id): Promise<void>
  /** Opening balance plus every transaction touching the wallet. */
  walletBalance(id: Id): Promise<Money>

  listCategories(kind?: CategoryKind, includeArchived?: boolean): Promise<Category[]>
  getCategory(id: Id): Promise<Category | null>
  createCategory(category: NewCategory): Promise<Category>
  updateCategory(category: Category): Promise<Category>
  deleteCategory(id: Id): Promise<void>

  listTransactions(query?: TransactionQuery): Promise<Transaction[]>
  getTransaction(id: Id): Promise<Transaction | null>
  createTransaction(tx: NewTransaction): Promise<Transaction>
  updateTransaction(tx: Transaction): Promise<Transaction>
  deleteTransaction(id: Id): Promise<void>

  listBudgets(includeArchived?: boolean): Promise<Budget[]>
  createBudget(budget: NewBudget): Promise<Budget>
  updateBudget(budget: Budget): Promise<Budget>
  deleteBudget(id: Id): Promise<void>

  listRecurringRules(activeOnly?: boolean): Promise<RecurringRule[]>
  createRecurringRule(rule: NewRecurringRule): Promise<RecurringRule>
  updateRecurringRule(rule: RecurringRule): Promise<RecurringRule>
  deleteRecurringRule(id: Id): Promise<void>

  listGoals(includeArchived?: boolean): Promise<SavingsGoal[]>
  getGoal(id: Id): Promise<SavingsGoal | null>
  createGoal(goal: NewSavingsGoal): Promise<SavingsGoal>
  updateGoal(goal: SavingsGoal): Promise<SavingsGoal>
  deleteGoal(id: Id): Promise<void>

  /**
   * Wipe everything and start again, optionally loading demo data in the chosen base
   * currency. Used by first-run onboarding and by the "reset app" settings action.
   * A prototype affordance that becomes a dev-only tool in Stage 2.
   */
  reset(options?: { withDemoData?: boolean; baseCurrency?: CurrencyCode }): Promise<void>
}
