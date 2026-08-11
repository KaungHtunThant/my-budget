/**
 * Application store.
 *
 * Holds the loaded records and exposes derived views the screens read. All persistence
 * goes through the `Repository` interface, so this file is unchanged when SQLite replaces
 * the in-memory implementation in Stage 2.
 *
 * Loading strategy is deliberately blunt for the prototype: mutations reload the affected
 * collections rather than patching local arrays. With a real database and realistic data
 * volumes that becomes targeted refreshes, but correctness first — a prototype that shows
 * stale numbers teaches the wrong thing about the design.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { CurrencyCode } from '@/domain/currency'
import { type Money, money, subtract, sum, zero } from '@/domain/money'
import {
  type BaseContext,
  budgetStatuses,
  budgetTotals,
  combinedBalance,
  goalStatuses,
  periodSummary,
  periodTrend,
  spendByCategory,
  toBase,
} from '@/domain/budgeting'
import {
  type BudgetPeriodConfig,
  type Period,
  DEFAULT_PERIOD_CONFIG,
  currentPeriod,
  shiftPeriod,
  todayIso,
} from '@/domain/period'
import type {
  Allocation,
  AllocationTemplate,
  Budget,
  Category,
  CategoryKind,
  Id,
  NewBudget,
  NewCategory,
  NewPayslip,
  NewRecurringRule,
  NewSavingsGoal,
  NewTransaction,
  NewWallet,
  Payslip,
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
  const payslips = ref<Payslip[]>([])
  const allocations = ref<Allocation[]>([])
  const templates = ref<AllocationTemplate[]>([])
  const budgets = ref<Budget[]>([])
  const rules = ref<RecurringRule[]>([])
  const goals = ref<SavingsGoal[]>([])

  /** Offset in periods from the current one; the period switcher drives this. */
  const periodOffset = ref(0)

  // --- derived -------------------------------------------------------------

  const base = computed<CurrencyCode>(() => settings.value.baseCurrency)
  const ctx = computed<BaseContext>(() => ({ base: base.value, rates: settings.value.rates }))
  const periodConfig = computed<BudgetPeriodConfig>(() => settings.value.budgetPeriod)

  const period = computed<Period>(() =>
    periodOffset.value === 0
      ? currentPeriod(periodConfig.value)
      : shiftPeriod(todayIso(), periodConfig.value, periodOffset.value),
  )

  const isCurrentPeriod = computed(() => periodOffset.value === 0)

  const categoriesById = computed(() => new Map(categories.value.map((c) => [c.id, c])))
  const walletsById = computed(() => new Map(wallets.value.map((w) => [w.id, w])))
  const goalsById = computed(() => new Map(goals.value.map((g) => [g.id, g])))

  const expenseCategories = computed(() => categories.value.filter((c) => c.kind === 'expense'))
  const incomeCategories = computed(() => categories.value.filter((c) => c.kind === 'income'))

  /** Every wallet balance converted into base, with any unconvertible currency reported. */
  const netWorth = computed(() =>
    combinedBalance(
      wallets.value.map((w) => balances.value[w.id] ?? zero(w.currency)),
      ctx.value,
    ),
  )

  const currentSummary = computed(() => periodSummary(transactions.value, period.value, ctx.value))

  const trend = computed(() => periodTrend(transactions.value, todayIso(), periodConfig.value, ctx.value, 6))

  const breakdown = computed(() =>
    spendByCategory(transactions.value, categories.value, period.value, ctx.value),
  )

  const budgetStatusList = computed(() =>
    budgetStatuses(
      budgets.value,
      categories.value,
      transactions.value,
      period.value,
      periodConfig.value,
      ctx.value,
    ),
  )

  const budgetSummary = computed(() => budgetTotals(budgetStatusList.value, base.value))

  const goalStatusList = computed(() =>
    goalStatuses(goals.value, transactions.value, ctx.value, todayIso(), periodConfig.value),
  )

  /**
   * Net pay this period minus everything already allocated to budgets and goals.
   * This is the number the payday flow is really about: what is still unassigned.
   */
  const unallocated = computed(() => {
    const paidThisPeriod = payslips.value.filter(
      (p) => p.date >= period.value.start && p.date <= period.value.end,
    )
    const netTotal = sum(
      paidThisPeriod.map((p) => toBase(p.net, ctx.value) ?? zero(base.value)),
      base.value,
    )
    const allocatedTotal = allocations.value
      .filter((a) => paidThisPeriod.some((p) => p.id === a.payslipId))
      .flatMap((a) => a.lines)
      .reduce((acc, line) => {
        if (line.mode === 'percent') {
          return acc + Math.round((netTotal.minor * (line.percent ?? 0)) / 100)
        }
        const fixed = line.fixedAmount ? toBase(line.fixedAmount, ctx.value) : null
        return acc + (fixed?.minor ?? 0)
      }, 0)
    return subtract(netTotal, money(allocatedTotal, base.value))
  })

  /** Currencies in use that have no rate against base — surfaced as a settings nudge. */
  const missingRates = computed<CurrencyCode[]>(() => {
    const used = new Set(wallets.value.map((w) => w.currency))
    used.delete(base.value)
    return [...used].filter((c) => {
      const rate = settings.value.rates[c]
      return rate === undefined || !(rate > 0)
    })
  })

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
      const [w, c, t, p, a, tpl, b, r, g] = await Promise.all([
        repo.listWallets(),
        repo.listCategories(),
        repo.listTransactions(),
        repo.listPayslips(),
        repo.listAllocations(),
        repo.listAllocationTemplates(),
        repo.listBudgets(),
        repo.listRecurringRules(),
        repo.listGoals(),
      ])
      wallets.value = w
      categories.value = c
      transactions.value = t
      payslips.value = p
      allocations.value = a
      templates.value = tpl
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
      baseCurrency: input.baseCurrency,
      budgetPeriod: input.budgetPeriod,
      onboardingComplete: true,
      activeCurrencies: Array.from(
        new Set([input.baseCurrency, ...settings.value.activeCurrencies]),
      ),
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
    if (settings.value.activeCurrencies.includes(code)) return
    await saveSettings({ activeCurrencies: [...settings.value.activeCurrencies, code] })
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

  function categoriesOf(kind: CategoryKind): Category[] {
    return categories.value.filter((c) => c.kind === kind)
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

  const periodTransactions = computed(() =>
    transactions.value.filter((t) => t.date >= period.value.start && t.date <= period.value.end),
  )

  const recentTransactions = computed(() => transactions.value.slice(0, 8))

  // --- payslips and allocation ---------------------------------------------

  async function addPayslip(payslip: NewPayslip, alsoRecordIncome: boolean): Promise<Payslip> {
    const created = await repo.createPayslip(payslip)
    if (alsoRecordIncome) {
      const salaryCategory =
        categories.value.find((c) => c.kind === 'income' && c.name === 'Salary') ??
        categories.value.find((c) => c.kind === 'income')
      await repo.createTransaction({
        type: 'income',
        amount: created.net,
        fx: null,
        walletId: created.walletId,
        toWalletId: null,
        toAmount: null,
        categoryId: salaryCategory?.id ?? null,
        date: created.date,
        note: `${created.employer} — ${created.periodLabel}`,
        recurringRuleId: null,
        payslipId: created.id,
        goalId: null,
      })
    }
    await reload()
    return created
  }

  async function removePayslip(id: Id): Promise<void> {
    await repo.deletePayslip(id)
    await reload()
  }

  async function saveAllocation(payslipId: Id, lines: Allocation['lines']): Promise<void> {
    const existing = allocations.value.filter((a) => a.payslipId === payslipId)
    for (const a of existing) await repo.deleteAllocation(a.id)
    await repo.createAllocation({ payslipId, lines })
    await reload()
  }

  async function addTemplate(name: string, lines: Allocation['lines']): Promise<void> {
    await repo.createAllocationTemplate({ name, lines })
    await reload()
  }

  async function removeTemplate(id: Id): Promise<void> {
    await repo.deleteAllocationTemplate(id)
    await reload()
  }

  function allocationFor(payslipId: Id): Allocation | null {
    return allocations.value.find((a) => a.payslipId === payslipId) ?? null
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

  /** Record a contribution as a transfer into the goal's wallet, tagged with the goal. */
  async function contributeToGoal(goalId: Id, fromWalletId: Id, amount: Money): Promise<void> {
    const goal = goalsById.value.get(goalId)
    if (!goal) throw new Error(`Unknown goal: ${goalId}`)
    await repo.createTransaction({
      type: 'transfer',
      amount,
      fx: null,
      walletId: fromWalletId,
      toWalletId: goal.walletId,
      toAmount: amount,
      categoryId: null,
      date: todayIso(),
      note: goal.name,
      recurringRuleId: null,
      payslipId: null,
      goalId,
    })
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
    payslips,
    allocations,
    templates,
    budgets,
    rules,
    goals,
    periodOffset,

    // derived
    base,
    ctx,
    periodConfig,
    period,
    isCurrentPeriod,
    categoriesById,
    walletsById,
    goalsById,
    expenseCategories,
    incomeCategories,
    netWorth,
    currentSummary,
    trend,
    breakdown,
    budgetStatusList,
    budgetSummary,
    goalStatusList,
    unallocated,
    missingRates,
    periodTransactions,
    recentTransactions,

    // actions
    init,
    reload,
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
    categoriesOf,
    addTransaction,
    editTransaction,
    removeTransaction,
    addPayslip,
    removePayslip,
    saveAllocation,
    addTemplate,
    removeTemplate,
    allocationFor,
    addBudget,
    editBudget,
    removeBudget,
    addRule,
    editRule,
    removeRule,
    addGoal,
    editGoal,
    removeGoal,
    contributeToGoal,
  }
})
