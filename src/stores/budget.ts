/**
 * Application store.
 *
 * Holds the loaded records and exposes derived views the screens read. All persistence goes
 * through the `Repository` interface, which is why swapping the in-memory implementation for
 * the persistent one touched a single line in `./repository.ts` and nothing here.
 *
 * Note the load pattern: every collection is read in full on `reload()`, and every mutation
 * calls it again. That is what the screens were built on, and it is fine at the volumes
 * measured so far — the repository's indexes are there for when it stops being.
 *
 * Loading strategy is deliberately blunt for the prototype: mutations reload the affected
 * collections rather than patching local arrays. With a real database and realistic data
 * volumes that becomes targeted refreshes, but correctness first — a prototype that shows
 * stale numbers teaches the wrong thing about the design.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { CurrencyCode } from '@/domain/currency'
import { type Money, zero } from '@/domain/money'
import { type BudgetPeriodConfig, DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import { withActiveCurrency, withBaseCurrency } from '@/services/settings'
import type {
  Budget,
  Category,
  Id,
  NewBudget,
  NewCategory,
  NewRecurringRule,
  NewSavingsGoal,
  NewTransaction,
  NewWallet,
  RecurringRule,
  SavingsGoal,
  Settings,
  Transaction,
  Wallet,
} from '@/domain/types'
import { getRepository } from './repository'

export const useBudgetStore = defineStore('budget', () => {
  const repo = getRepository()

  // --- raw state -----------------------------------------------------------
  const ready = ref(false)
  const loading = ref(false)
  const settings = ref<Settings>({
    baseCurrency: 'USD',
    activeCurrencies: ['USD'],
    rates: {},
    budgetPeriod: DEFAULT_PERIOD_CONFIG,
    theme: 'system',
    appLockEnabled: false,
    onboardingComplete: false,
  })
  const wallets = ref<Wallet[]>([])
  const balances = ref<Record<Id, Money>>({})
  const categories = ref<Category[]>([])
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])
  const rules = ref<RecurringRule[]>([])
  const goals = ref<SavingsGoal[]>([])

  /** Offset in periods from the current one; the period switcher drives this. */
  const periodOffset = ref(0)

  // --- derived -------------------------------------------------------------

  const base = computed<CurrencyCode>(() => settings.value.baseCurrency)
  const periodConfig = computed<BudgetPeriodConfig>(() => settings.value.budgetPeriod)

  const isCurrentPeriod = computed(() => periodOffset.value === 0)

  const categoriesById = computed(() => new Map(categories.value.map((c) => [c.id, c])))
  const walletsById = computed(() => new Map(wallets.value.map((w) => [w.id, w])))
  const goalsById = computed(() => new Map(goals.value.map((g) => [g.id, g])))

  const expenseCategories = computed(() => categories.value.filter((c) => c.kind === 'expense'))
  const incomeCategories = computed(() => categories.value.filter((c) => c.kind === 'income'))

  // --- loading -------------------------------------------------------------

  async function init(): Promise<void> {
    if (ready.value) return
    await repo.init()
    await reload()
    ready.value = true
  }

  async function reload(): Promise<void> {
    loading.value = true
    try {
      settings.value = await repo.getSettings()
      const [w, c, t, b, r, g] = await Promise.all([
        repo.listWallets(),
        repo.listCategories(),
        repo.listTransactions(),
        repo.listBudgets(),
        repo.listRecurringRules(),
        repo.listGoals(),
      ])
      wallets.value = w
      categories.value = c
      transactions.value = t
      budgets.value = b
      rules.value = r
      goals.value = g
      await refreshBalances()
    } finally {
      loading.value = false
    }
  }

  async function refreshBalances(): Promise<void> {
    const entries = await Promise.all(
      wallets.value.map(async (w) => [w.id, await repo.walletBalance(w.id)] as const),
    )
    balances.value = Object.fromEntries(entries)
  }

  /**
   * Push any owed durability snapshot out now. Called when the app is backgrounded, since
   * Android may not run our code again before killing the process.
   */
  async function flushSnapshot(): Promise<void> {
    await repo.saveSnapshot?.()
  }

  // --- settings ------------------------------------------------------------

  async function saveSettings(patch: Partial<Settings>): Promise<void> {
    settings.value = await repo.saveSettings({ ...settings.value, ...patch })
  }

  /**
   * First-run setup. The base currency is chosen here and drives every amount in the app,
   * so demo data can only be generated once it is known.
   */
  async function completeOnboarding(input: {
    baseCurrency: CurrencyCode
    budgetPeriod: BudgetPeriodConfig
    withDemoData: boolean
  }): Promise<void> {
    await repo.reset({ withDemoData: input.withDemoData, baseCurrency: input.baseCurrency })
    await reload()
    await saveSettings({
      ...withBaseCurrency(settings.value, input.baseCurrency),
      budgetPeriod: input.budgetPeriod,
      onboardingComplete: true,
    })
    await reload()
  }

  async function resetApp(withDemoData: boolean): Promise<void> {
    await repo.reset({ withDemoData, baseCurrency: base.value })
    await reload()
  }

  async function setRate(code: CurrencyCode, rate: number): Promise<void> {
    await saveSettings({ rates: { ...settings.value.rates, [code]: rate } })
  }

  // --- period navigation ---------------------------------------------------

  function goToPreviousPeriod(): void {
    periodOffset.value -= 1
  }

  function goToNextPeriod(): void {
    periodOffset.value += 1
  }

  function goToCurrentPeriod(): void {
    periodOffset.value = 0
  }

  // --- wallets -------------------------------------------------------------

  async function addWallet(wallet: NewWallet): Promise<Wallet> {
    const created = await repo.createWallet(wallet)
    await trackCurrency(created.currency)
    await reload()
    return created
  }

  async function editWallet(wallet: Wallet): Promise<void> {
    await repo.updateWallet(wallet)
    await trackCurrency(wallet.currency)
    await reload()
  }

  async function removeWallet(id: Id): Promise<void> {
    await repo.deleteWallet(id)
    await reload()
  }

  function balanceOf(id: Id): Money {
    const wallet = walletsById.value.get(id)
    return balances.value[id] ?? zero(wallet?.currency ?? base.value)
  }

  /** Keep the currency picker's shortlist in step with what the user actually holds. */
  async function trackCurrency(code: CurrencyCode): Promise<void> {
    const patch = withActiveCurrency(settings.value, code)
    if (patch) await saveSettings(patch)
  }

  // --- categories ----------------------------------------------------------

  async function addCategory(category: NewCategory): Promise<Category> {
    const created = await repo.createCategory(category)
    await reload()
    return created
  }

  async function editCategory(category: Category): Promise<void> {
    await repo.updateCategory(category)
    await reload()
  }

  async function removeCategory(id: Id): Promise<void> {
    await repo.deleteCategory(id)
    await reload()
  }

  // --- transactions --------------------------------------------------------

  async function addTransaction(tx: NewTransaction): Promise<Transaction> {
    const created = await repo.createTransaction(tx)
    await reload()
    return created
  }

  async function editTransaction(tx: Transaction): Promise<void> {
    await repo.updateTransaction(tx)
    await reload()
  }

  async function removeTransaction(id: Id): Promise<void> {
    await repo.deleteTransaction(id)
    await reload()
  }

  // --- budgets -------------------------------------------------------------

  async function addBudget(budget: NewBudget): Promise<void> {
    await repo.createBudget(budget)
    await reload()
  }

  async function editBudget(budget: Budget): Promise<void> {
    await repo.updateBudget(budget)
    await reload()
  }

  async function removeBudget(id: Id): Promise<void> {
    await repo.deleteBudget(id)
    await reload()
  }

  // --- recurring -----------------------------------------------------------

  async function addRule(rule: NewRecurringRule): Promise<void> {
    await repo.createRecurringRule(rule)
    await reload()
  }

  async function editRule(rule: RecurringRule): Promise<void> {
    await repo.updateRecurringRule(rule)
    await reload()
  }

  async function removeRule(id: Id): Promise<void> {
    await repo.deleteRecurringRule(id)
    await reload()
  }

  // --- goals ---------------------------------------------------------------

  async function addGoal(goal: NewSavingsGoal): Promise<void> {
    await repo.createGoal(goal)
    await reload()
  }

  async function editGoal(goal: SavingsGoal): Promise<void> {
    await repo.updateGoal(goal)
    await reload()
  }

  async function removeGoal(id: Id): Promise<void> {
    await repo.deleteGoal(id)
    await reload()
  }

  return {
    // state
    ready,
    loading,
    settings,
    wallets,
    balances,
    categories,
    transactions,
    budgets,
    rules,
    goals,
    periodOffset,

    // derived
    base,
    periodConfig,
    isCurrentPeriod,
    categoriesById,
    walletsById,
    goalsById,
    expenseCategories,
    incomeCategories,

    // actions
    init,
    reload,
    flushSnapshot,
    saveSettings,
    completeOnboarding,
    resetApp,
    setRate,
    goToPreviousPeriod,
    goToNextPeriod,
    goToCurrentPeriod,
    addWallet,
    editWallet,
    removeWallet,
    balanceOf,
    addCategory,
    editCategory,
    removeCategory,
    addTransaction,
    editTransaction,
    removeTransaction,
    addBudget,
    editBudget,
    removeBudget,
    addRule,
    editRule,
    removeRule,
    addGoal,
    editGoal,
    removeGoal,
  }
})
