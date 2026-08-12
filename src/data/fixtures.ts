/**
 * Demo data for the prototype.
 *
 * Everything is generated relative to today so the dashboard, budgets and reports always
 * have current-period content to show, whenever the prototype is opened. Amounts are
 * built with `fromMajor` against the chosen base currency, so the demo reads sensibly
 * whether the user picks USD, JPY or KWD.
 *
 * One wallet is deliberately in a foreign currency: the multi-currency behaviour is the
 * least obvious part of the design and needs to be visible on first launch, not hidden
 * behind a setup step.
 */

import { type CurrencyCode } from '@/domain/currency'
import { fromMajor, type Money } from '@/domain/money'
import { addDays, addMonths, DEFAULT_PERIOD_CONFIG, todayIso } from '@/domain/period'
import type {
  Budget,
  Category,
  RecurringRule,
  SavingsGoal,
  Settings,
  Transaction,
  Wallet,
} from '@/domain/types'

export interface SeedData {
  settings: Settings
  wallets: Wallet[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  rules: RecurringRule[]
  goals: SavingsGoal[]
}

export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'USD'

/** Categories every new install starts with, demo data or not. */
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salary', kind: 'income', parentId: null, icon: 'wallet-outline', color: 'success', archived: false },
  { name: 'Freelance', kind: 'income', parentId: null, icon: 'laptop-outline', color: 'success', archived: false },
  { name: 'Interest', kind: 'income', parentId: null, icon: 'trending-up-outline', color: 'success', archived: false },
  { name: 'Gifts', kind: 'income', parentId: null, icon: 'gift-outline', color: 'success', archived: false },
  { name: 'Rent', kind: 'expense', parentId: null, icon: 'home-outline', color: 'danger', archived: false },
  { name: 'Groceries', kind: 'expense', parentId: null, icon: 'basket-outline', color: 'warning', archived: false },
  { name: 'Transport', kind: 'expense', parentId: null, icon: 'bus-outline', color: 'tertiary', archived: false },
  { name: 'Dining out', kind: 'expense', parentId: null, icon: 'restaurant-outline', color: 'warning', archived: false },
  { name: 'Utilities', kind: 'expense', parentId: null, icon: 'flash-outline', color: 'primary', archived: false },
  { name: 'Health', kind: 'expense', parentId: null, icon: 'medkit-outline', color: 'danger', archived: false },
  { name: 'Entertainment', kind: 'expense', parentId: null, icon: 'film-outline', color: 'tertiary', archived: false },
  { name: 'Shopping', kind: 'expense', parentId: null, icon: 'bag-handle-outline', color: 'secondary', archived: false },
  { name: 'Education', kind: 'expense', parentId: null, icon: 'school-outline', color: 'primary', archived: false },
  { name: 'Subscriptions', kind: 'expense', parentId: null, icon: 'repeat-outline', color: 'secondary', archived: false },
  { name: 'Other', kind: 'expense', parentId: null, icon: 'ellipsis-horizontal-outline', color: 'medium', archived: false },
]

export function buildSeed(
  options: { withDemoData?: boolean; baseCurrency?: CurrencyCode } = {},
): SeedData {
  const base = options.baseCurrency ?? DEFAULT_BASE_CURRENCY
  const categories = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `cat_seed_${i}` }))

  const settings: Settings = {
    baseCurrency: base,
    activeCurrencies: [base],
    rates: {},
    budgetPeriod: DEFAULT_PERIOD_CONFIG,
    theme: 'system',
    appLockEnabled: false,
    onboardingComplete: false,
  }

  if (!options.withDemoData) {
    return {
      settings,
      categories,
      wallets: [],
      transactions: [],
      budgets: [],
      rules: [],
      goals: [],
    }
  }

  return buildDemo(base, categories, settings)
}

function buildDemo(base: CurrencyCode, categories: Category[], settings: Settings): SeedData {
  const today = todayIso()
  const m = (amount: number): Money => fromMajor(amount, base)
  const catId = (name: string): string => categories.find((c) => c.name === name)!.id

  // A second currency so the multi-currency paths are exercised on first launch.
  const foreign: CurrencyCode = base === 'EUR' ? 'USD' : 'EUR'
  const foreignRate = base === 'EUR' ? 0.92 : 1.08

  const wallets: Wallet[] = [
    {
      id: 'wal_bank',
      name: 'Main Bank',
      kind: 'bank',
      currency: base,
      openingBalance: m(1800),
      icon: 'business-outline',
      color: 'primary',
      archived: false,
      createdAt: addMonths(today, -6),
    },
    {
      id: 'wal_cash',
      name: 'Cash',
      kind: 'cash',
      currency: base,
      openingBalance: m(320),
      icon: 'cash-outline',
      color: 'success',
      archived: false,
      createdAt: addMonths(today, -6),
    },
    {
      id: 'wal_savings',
      name: 'Savings',
      kind: 'savings',
      currency: base,
      openingBalance: m(4200),
      icon: 'shield-checkmark-outline',
      color: 'tertiary',
      archived: false,
      createdAt: addMonths(today, -6),
    },
    {
      id: 'wal_foreign',
      name: `${foreign} Account`,
      kind: 'bank',
      currency: foreign,
      openingBalance: fromMajor(650, foreign),
      icon: 'globe-outline',
      color: 'secondary',
      archived: false,
      createdAt: addMonths(today, -4),
    },
  ]

  const goals: SavingsGoal[] = [
    {
      id: 'gol_emergency',
      name: 'Emergency fund',
      target: m(6000),
      walletId: 'wal_savings',
      targetDate: addMonths(today, 8),
      icon: 'umbrella-outline',
      color: 'primary',
      archived: false,
      createdAt: addMonths(today, -6),
    },
    {
      id: 'gol_laptop',
      name: 'New laptop',
      target: m(1600),
      walletId: 'wal_savings',
      targetDate: addMonths(today, 4),
      icon: 'laptop-outline',
      color: 'tertiary',
      archived: false,
      createdAt: addMonths(today, -2),
    },
  ]

  const budgets: Budget[] = [
    { id: 'bdg_rent', categoryId: catId('Rent'), limit: m(950), rollover: false, archived: false },
    { id: 'bdg_grocery', categoryId: catId('Groceries'), limit: m(400), rollover: true, archived: false },
    { id: 'bdg_transport', categoryId: catId('Transport'), limit: m(120), rollover: false, archived: false },
    { id: 'bdg_dining', categoryId: catId('Dining out'), limit: m(180), rollover: false, archived: false },
    { id: 'bdg_utilities', categoryId: catId('Utilities'), limit: m(150), rollover: false, archived: false },
    { id: 'bdg_fun', categoryId: catId('Entertainment'), limit: m(100), rollover: true, archived: false },
    { id: 'bdg_shopping', categoryId: catId('Shopping'), limit: m(150), rollover: false, archived: false },
  ]

  // Pay lands on the 25th. Anchor to the most recent 25th that has already happened, so the
  // demo never shows income dated in the future.
  const thisMonth25 = `${today.slice(0, 8)}25`
  const lastPayday = today >= thisMonth25 ? thisMonth25 : addMonths(thisMonth25, -1)
  const paydays = [0, 1, 2].map((monthsAgo) => addMonths(lastPayday, -monthsAgo))

  const rules: RecurringRule[] = [
    {
      id: 'rec_rent',
      name: 'Rent',
      type: 'expense',
      amount: m(950),
      walletId: 'wal_bank',
      toWalletId: null,
      categoryId: catId('Rent'),
      frequency: 'monthly',
      dayOfMonth: 1,
      weekday: null,
      startDate: addMonths(today, -6),
      endDate: null,
      lastRunDate: null,
      active: true,
      note: 'Apartment rent',
    },
    {
      id: 'rec_stream',
      name: 'Streaming subscription',
      type: 'expense',
      amount: m(15.99),
      walletId: 'wal_bank',
      toWalletId: null,
      categoryId: catId('Subscriptions'),
      frequency: 'monthly',
      dayOfMonth: 8,
      weekday: null,
      startDate: addMonths(today, -6),
      endDate: null,
      lastRunDate: null,
      active: true,
      note: '',
    },
    {
      id: 'rec_gym',
      name: 'Gym membership',
      type: 'expense',
      amount: m(35),
      walletId: 'wal_bank',
      toWalletId: null,
      categoryId: catId('Health'),
      frequency: 'monthly',
      dayOfMonth: 3,
      weekday: null,
      startDate: addMonths(today, -3),
      endDate: null,
      lastRunDate: null,
      active: true,
      note: '',
    },
  ]

  // Spending spread across this period and the previous two, so trends have shape.
  const spendPlan: [string, number, number, string][] = [
    // [category, amount, days ago, note]
    ['Rent', 950, 10, 'Monthly rent'],
    ['Groceries', 82.4, 1, 'Weekly shop'],
    ['Groceries', 64.15, 5, 'Supermarket'],
    ['Groceries', 47.8, 9, 'Corner shop'],
    ['Dining out', 38.5, 2, 'Dinner with friends'],
    ['Dining out', 12.9, 6, 'Lunch'],
    ['Transport', 45, 4, 'Monthly transit pass'],
    ['Transport', 18.2, 8, 'Taxi'],
    ['Utilities', 96.3, 7, 'Electricity'],
    ['Entertainment', 28, 3, 'Cinema'],
    ['Shopping', 119.99, 11, 'Running shoes'],
    ['Health', 35, 12, 'Gym'],
    ['Subscriptions', 15.99, 6, 'Streaming'],
    ['Groceries', 91.2, 34, 'Weekly shop'],
    ['Rent', 950, 40, 'Monthly rent'],
    ['Dining out', 56.7, 36, 'Restaurant'],
    ['Transport', 45, 38, 'Transit pass'],
    ['Utilities', 88.5, 37, 'Electricity'],
    ['Entertainment', 62, 33, 'Concert'],
    ['Shopping', 45.5, 31, 'Household'],
    ['Groceries', 78.6, 64, 'Weekly shop'],
    ['Rent', 950, 70, 'Monthly rent'],
    ['Dining out', 41.25, 66, 'Dinner'],
    ['Transport', 45, 68, 'Transit pass'],
    ['Utilities', 102.4, 67, 'Electricity'],
  ]

  const transactions: Transaction[] = []

  spendPlan.forEach(([category, amount, daysAgo, note], i) => {
    transactions.push({
      id: `txn_exp_${i}`,
      type: 'expense',
      amount: m(amount),
      fx: null,
      // Small amounts come out of cash, larger ones from the bank — otherwise the cash
      // wallet ends up paying the rent and shows an absurd negative balance.
      walletId: amount < 40 ? 'wal_cash' : 'wal_bank',
      toWalletId: null,
      toAmount: null,
      categoryId: catId(category),
      date: addDays(today, -daysAgo),
      note,
      recurringRuleId: null,
      goalId: null,
      createdAt: addDays(today, -daysAgo),
    })
  })

  // Monthly salary, recorded like any other income.
  paydays.forEach((date, i) => {
    transactions.push({
      id: `txn_sal_${i}`,
      type: 'income',
      amount: m(3066),
      fx: null,
      walletId: 'wal_bank',
      toWalletId: null,
      toAmount: null,
      categoryId: catId('Salary'),
      date,
      note: `Acme Corp — ${monthLabel(date)}`,
      recurringRuleId: null,
      goalId: null,
      createdAt: date,
    })
  })

  // A cross-currency expense: paid in the foreign currency from the base-currency wallet.
  transactions.push({
    id: 'txn_fx_expense',
    type: 'expense',
    amount: fromMajor(64.8, base),
    fx: { enteredAmount: fromMajor(60, foreign), rate: foreignRate },
    walletId: 'wal_bank',
    toWalletId: null,
    toAmount: null,
    categoryId: catId('Shopping'),
    date: addDays(today, -13),
    note: `Online order in ${foreign}`,
    recurringRuleId: null,
    goalId: null,
    createdAt: addDays(today, -13),
  })

  // A cross-currency transfer between wallets of different currencies.
  transactions.push({
    id: 'txn_fx_transfer',
    type: 'transfer',
    amount: fromMajor(500, base),
    fx: null,
    walletId: 'wal_bank',
    toWalletId: 'wal_foreign',
    toAmount: fromMajor(500 / foreignRate, foreign),
    categoryId: null,
    date: addDays(today, -20),
    note: `Top up ${foreign} account`,
    recurringRuleId: null,
    goalId: null,
    createdAt: addDays(today, -20),
  })

  // Goal contributions, recorded as transfers into the savings wallet.
  const contributions: [string, number, number][] = [
    ['gol_emergency', 300, 10],
    ['gol_emergency', 300, 40],
    ['gol_emergency', 300, 70],
    ['gol_laptop', 150, 10],
    ['gol_laptop', 150, 40],
  ]
  contributions.forEach(([goalId, amount, daysAgo], i) => {
    transactions.push({
      id: `txn_goal_${i}`,
      type: 'transfer',
      amount: m(amount),
      fx: null,
      walletId: 'wal_bank',
      toWalletId: 'wal_savings',
      toAmount: m(amount),
      categoryId: null,
      date: addDays(today, -daysAgo),
      note: goalId === 'gol_emergency' ? 'Emergency fund' : 'Laptop fund',
      recurringRuleId: null,
      goalId,
      createdAt: addDays(today, -daysAgo),
    })
  })

  return {
    settings: {
      ...settings,
      activeCurrencies: [base, foreign],
      rates: { [foreign]: foreignRate },
      onboardingComplete: true,
    },
    wallets,
    categories,
    transactions,
    budgets,
    rules,
    goals,
  }
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00`)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d)
}
