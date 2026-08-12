/**
 * The repository contract, asserted identically against both implementations.
 *
 * `MemoryRepository` is the reference: it is what every screen was built and reviewed against
 * in Stage 1. If `IndexedDbRepository` satisfies the same assertions, swapping one for the
 * other cannot change what the app shows — which is the whole safety argument for the
 * cut-over in `src/stores/repository.ts`.
 *
 * A behaviour worth stating because it is easy to lose: several views render collections in
 * whatever order the repository returned, so ordering is asserted here, not left to chance.
 */

import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { fromMajor } from '@/domain/money'
import type {
  NewTransaction,
  NewWallet,
  Repository,
  Transaction,
  Wallet,
} from '@/domain/types'
import { IndexedDbRepository } from './indexeddb'
import { MemoryRepository } from './memory'

let dbCounter = 0

interface Impl {
  name: string
  make: () => Repository
  teardown: (repo: Repository) => Promise<void>
}

const IMPLS: Impl[] = [
  {
    name: 'MemoryRepository',
    make: () => new MemoryRepository(),
    teardown: async () => {},
  },
  {
    name: 'IndexedDbRepository',
    // A fresh database per case, so nothing leaks between tests. Snapshots are off: they get
    // their own test rather than firing a file write behind every assertion here.
    make: () => new IndexedDbRepository({ name: `contract-${dbCounter++}`, snapshots: false }),
    teardown: async (repo) => {
      await (repo as IndexedDbRepository).destroy()
    },
  },
]

const wallet = (over: Partial<NewWallet> = {}): NewWallet => ({
  name: 'Bank',
  kind: 'bank',
  currency: 'USD',
  openingBalance: fromMajor(100, 'USD'),
  icon: 'business-outline',
  color: 'primary',
  archived: false,
  ...over,
})

const tx = (over: Partial<NewTransaction> = {}): NewTransaction => ({
  type: 'expense',
  amount: fromMajor(10, 'USD'),
  fx: null,
  walletId: 'wal_missing',
  toWalletId: null,
  toAmount: null,
  categoryId: null,
  date: '2026-08-01',
  note: '',
  recurringRuleId: null,
  goalId: null,
  ...over,
})

for (const impl of IMPLS) {
  describe(impl.name, () => {
    /** Every case gets a fresh, initialised repository and tears it down afterwards. */
    async function withRepo(body: (repo: Repository) => Promise<void>): Promise<void> {
      const repo = impl.make()
      await repo.init()
      try {
        await body(repo)
      } finally {
        await impl.teardown(repo)
      }
    }

    it('starts with default categories, no wallets and a base currency', async () => {
      await withRepo(async (repo) => {
        expect(await repo.listWallets()).toEqual([])
        expect(await repo.listTransactions()).toEqual([])
        const categories = await repo.listCategories()
        expect(categories.length).toBeGreaterThan(0)
        expect((await repo.getSettings()).baseCurrency).toBe('USD')
      })
    })

    it('round-trips settings', async () => {
      await withRepo(async (repo) => {
        const before = await repo.getSettings()
        await repo.saveSettings({ ...before, baseCurrency: 'JPY', onboardingComplete: true })
        const after = await repo.getSettings()
        expect(after.baseCurrency).toBe('JPY')
        expect(after.onboardingComplete).toBe(true)
      })
    })

    it('creates, updates and deletes a wallet', async () => {
      await withRepo(async (repo) => {
        const created = await repo.createWallet(wallet({ name: 'Cash' }))
        expect(created.id).toBeTruthy()
        expect(created.createdAt).toBeTruthy()
        expect(await repo.getWallet(created.id)).toEqual(created)

        await repo.updateWallet({ ...created, name: 'Petty cash' })
        expect((await repo.getWallet(created.id))?.name).toBe('Petty cash')

        await repo.deleteWallet(created.id)
        expect(await repo.getWallet(created.id)).toBeNull()
      })
    })

    it('lists wallets by name and hides archived ones unless asked', async () => {
      await withRepo(async (repo) => {
        await repo.createWallet(wallet({ name: 'Zebra' }))
        await repo.createWallet(wallet({ name: 'Apple' }))
        await repo.createWallet(wallet({ name: 'Hidden', archived: true }))

        expect((await repo.listWallets()).map((w) => w.name)).toEqual(['Apple', 'Zebra'])
        expect((await repo.listWallets(true)).map((w) => w.name)).toEqual([
          'Apple',
          'Hidden',
          'Zebra',
        ])
      })
    })

    it('balances a wallet from its opening balance, income and expenses', async () => {
      await withRepo(async (repo) => {
        const w = await repo.createWallet(wallet({ openingBalance: fromMajor(100, 'USD') }))
        await repo.createTransaction(tx({ walletId: w.id, type: 'income', amount: fromMajor(50, 'USD') }))
        await repo.createTransaction(tx({ walletId: w.id, type: 'expense', amount: fromMajor(20, 'USD') }))

        expect(await repo.walletBalance(w.id)).toEqual(fromMajor(130, 'USD'))
      })
    })

    it('credits a cross-currency transfer with the destination amount', async () => {
      await withRepo(async (repo) => {
        const from = await repo.createWallet(wallet({ name: 'USD', openingBalance: fromMajor(500, 'USD') }))
        const to = await repo.createWallet(
          wallet({ name: 'EUR', currency: 'EUR', openingBalance: fromMajor(0, 'EUR') }),
        )
        await repo.createTransaction(
          tx({
            type: 'transfer',
            walletId: from.id,
            toWalletId: to.id,
            amount: fromMajor(100, 'USD'),
            toAmount: fromMajor(92, 'EUR'),
          }),
        )

        expect(await repo.walletBalance(from.id)).toEqual(fromMajor(400, 'USD'))
        expect(await repo.walletBalance(to.id)).toEqual(fromMajor(92, 'EUR'))
      })
    })

    it('rejects balancing an unknown wallet', async () => {
      await withRepo(async (repo) => {
        await expect(repo.walletBalance('wal_nope')).rejects.toThrow(/unknown wallet/i)
      })
    })

    it('deletes the transactions of a deleted wallet, on either leg', async () => {
      await withRepo(async (repo) => {
        const a = await repo.createWallet(wallet({ name: 'A' }))
        const b = await repo.createWallet(wallet({ name: 'B' }))
        await repo.createTransaction(tx({ walletId: a.id }))
        await repo.createTransaction(tx({ type: 'transfer', walletId: b.id, toWalletId: a.id }))
        await repo.createTransaction(tx({ walletId: b.id }))

        await repo.deleteWallet(a.id)

        const left = await repo.listTransactions()
        expect(left).toHaveLength(1)
        expect(left[0].walletId).toBe(b.id)
      })
    })

    it('filters categories by kind and sorts them by name', async () => {
      await withRepo(async (repo) => {
        const income = await repo.listCategories('income')
        const expense = await repo.listCategories('expense')
        expect(income.every((c) => c.kind === 'income')).toBe(true)
        expect(expense.every((c) => c.kind === 'expense')).toBe(true)
        expect(income.map((c) => c.name)).toEqual([...income.map((c) => c.name)].sort((a, b) => a.localeCompare(b)))
      })
    })

    it('detaches transactions and removes budgets when a category goes', async () => {
      await withRepo(async (repo) => {
        const category = (await repo.listCategories('expense'))[0]
        const w = await repo.createWallet(wallet())
        const spent = await repo.createTransaction(tx({ walletId: w.id, categoryId: category.id }))
        await repo.createBudget({
          categoryId: category.id,
          limit: fromMajor(100, 'USD'),
          rollover: false,
          archived: false,
        })

        await repo.deleteCategory(category.id)

        expect(await repo.getCategory(category.id)).toBeNull()
        // The spend is kept, but no longer points at a category that does not exist.
        expect((await repo.getTransaction(spent.id))?.categoryId).toBeNull()
        expect(await repo.listBudgets()).toEqual([])
      })
    })

    it('returns transactions newest first, breaking ties on createdAt', async () => {
      await withRepo(async (repo) => {
        const w = await repo.createWallet(wallet())
        const older = await repo.createTransaction(tx({ walletId: w.id, date: '2026-07-01' }))
        const sameDayFirst = await repo.createTransaction(tx({ walletId: w.id, date: '2026-08-01' }))
        const sameDayLater = await repo.createTransaction(tx({ walletId: w.id, date: '2026-08-01' }))

        // Pin createdAt explicitly: two rows written in the same millisecond would otherwise
        // make the tie-break untestable.
        await repo.updateTransaction({ ...sameDayFirst, createdAt: '2026-08-01T09:00:00.000Z' } as Transaction)
        await repo.updateTransaction({ ...sameDayLater, createdAt: '2026-08-01T17:00:00.000Z' } as Transaction)

        expect((await repo.listTransactions()).map((t) => t.id)).toEqual([
          sameDayLater.id,
          sameDayFirst.id,
          older.id,
        ])
      })
    })

    it('applies every documented transaction filter', async () => {
      await withRepo(async (repo) => {
        const a = await repo.createWallet(wallet({ name: 'A' }))
        const b = await repo.createWallet(wallet({ name: 'B' }))
        const category = (await repo.listCategories('expense'))[0]

        const jan = await repo.createTransaction(tx({ walletId: a.id, date: '2026-01-15', note: 'Coffee beans' }))
        const jun = await repo.createTransaction(
          tx({ walletId: a.id, date: '2026-06-15', type: 'income', amount: fromMajor(5, 'USD'), categoryId: category.id }),
        )
        const dec = await repo.createTransaction(
          tx({ walletId: b.id, toWalletId: a.id, type: 'transfer', date: '2026-12-15' }),
        )

        const ids = async (q: Parameters<Repository['listTransactions']>[0]) =>
          (await repo.listTransactions(q)).map((t) => t.id)

        expect(await ids({ from: '2026-06-01' })).toEqual([dec.id, jun.id])
        expect(await ids({ to: '2026-06-30' })).toEqual([jun.id, jan.id])
        expect(await ids({ from: '2026-06-01', to: '2026-06-30' })).toEqual([jun.id])
        expect(await ids({ type: 'income' })).toEqual([jun.id])
        expect(await ids({ categoryId: category.id })).toEqual([jun.id])
        // walletId matches either leg, so the transfer into A counts as A's.
        expect(await ids({ walletId: a.id })).toEqual([dec.id, jun.id, jan.id])
        expect(await ids({ search: 'COFFEE' })).toEqual([jan.id])
        expect(await ids({ limit: 2 })).toEqual([dec.id, jun.id])
      })
    })

    it('creates, updates and deletes budgets, rules and goals', async () => {
      await withRepo(async (repo) => {
        const category = (await repo.listCategories('expense'))[0]
        const w = await repo.createWallet(wallet())

        const budget = await repo.createBudget({
          categoryId: category.id,
          limit: fromMajor(100, 'USD'),
          rollover: false,
          archived: false,
        })
        await repo.updateBudget({ ...budget, limit: fromMajor(250, 'USD') })
        expect((await repo.listBudgets())[0].limit).toEqual(fromMajor(250, 'USD'))

        const rule = await repo.createRecurringRule({
          name: 'Rent',
          type: 'expense',
          amount: fromMajor(900, 'USD'),
          walletId: w.id,
          toWalletId: null,
          categoryId: category.id,
          frequency: 'monthly',
          dayOfMonth: 1,
          weekday: null,
          startDate: '2026-01-01',
          endDate: null,
          lastRunDate: null,
          active: true,
          note: '',
        })
        await repo.updateRecurringRule({ ...rule, active: false })
        expect(await repo.listRecurringRules(true)).toEqual([])
        expect(await repo.listRecurringRules()).toHaveLength(1)

        const goal = await repo.createGoal({
          name: 'Laptop',
          target: fromMajor(1000, 'USD'),
          walletId: w.id,
          targetDate: null,
          icon: 'laptop-outline',
          color: 'primary',
          archived: false,
        })
        expect(await repo.getGoal(goal.id)).toEqual(goal)

        await repo.deleteBudget(budget.id)
        await repo.deleteRecurringRule(rule.id)
        await repo.deleteGoal(goal.id)
        expect(await repo.listBudgets()).toEqual([])
        expect(await repo.listRecurringRules()).toEqual([])
        expect(await repo.listGoals()).toEqual([])
      })
    })

    it('sorts rules and goals by name', async () => {
      await withRepo(async (repo) => {
        const w = await repo.createWallet(wallet())
        for (const name of ['Zebra', 'Apple']) {
          await repo.createGoal({
            name,
            target: fromMajor(10, 'USD'),
            walletId: w.id,
            targetDate: null,
            icon: 'trophy-outline',
            color: 'primary',
            archived: false,
          })
        }
        expect((await repo.listGoals()).map((g) => g.name)).toEqual(['Apple', 'Zebra'])
      })
    })

    it('keeps a goal contribution but detaches it when the goal goes', async () => {
      await withRepo(async (repo) => {
        const w = await repo.createWallet(wallet())
        const goal = await repo.createGoal({
          name: 'Fund',
          target: fromMajor(500, 'USD'),
          walletId: w.id,
          targetDate: null,
          icon: 'umbrella-outline',
          color: 'primary',
          archived: false,
        })
        const contribution = await repo.createTransaction(tx({ walletId: w.id, goalId: goal.id }))

        await repo.deleteGoal(goal.id)

        expect((await repo.getTransaction(contribution.id))?.goalId).toBeNull()
      })
    })

    it('reset wipes user data and can load demo data in a chosen currency', async () => {
      await withRepo(async (repo) => {
        await repo.createWallet(wallet({ name: 'Doomed' }))

        await repo.reset({ withDemoData: false, baseCurrency: 'EUR' })
        expect(await repo.listWallets()).toEqual([])
        expect((await repo.getSettings()).baseCurrency).toBe('EUR')

        await repo.reset({ withDemoData: true, baseCurrency: 'EUR' })
        expect((await repo.listWallets()).length).toBeGreaterThan(0)
        expect((await repo.listTransactions()).length).toBeGreaterThan(0)
        expect((await repo.getSettings()).baseCurrency).toBe('EUR')
      })
    })

    it('accepts a Vue reactive record without a clone error', async () => {
      await withRepo(async (repo) => {
        const w = await repo.createWallet(wallet())
        // Records reach the repository straight from component state, so they arrive wrapped
        // in a reactive Proxy. IndexedDB's structured clone rejects proxies outright, which
        // is why every write path calls deepClone first.
        const proxied = reactive(tx({ walletId: w.id, note: 'From a proxy' }))
        const created = await repo.createTransaction(proxied)

        expect((await repo.getTransaction(created.id))?.note).toBe('From a proxy')

        const proxiedWallet = reactive({ ...w, name: 'Renamed via proxy' }) as Wallet
        await repo.updateWallet(proxiedWallet)
        expect((await repo.getWallet(w.id))?.name).toBe('Renamed via proxy')
      })
    })
  })
}

describe('IndexedDbRepository persistence', () => {
  it('survives closing and reopening the database', async () => {
    const name = `persist-${dbCounter++}`

    const first = new IndexedDbRepository({ name, snapshots: false })
    await first.init()
    const created = await first.createWallet(wallet({ name: 'Survivor' }))
    await first.createTransaction(tx({ walletId: created.id, note: 'Still here' }))
    await first.saveSettings({ ...(await first.getSettings()), onboardingComplete: true })
    first.close()

    // A new instance against the same database is what a fresh app launch looks like.
    const second = new IndexedDbRepository({ name, snapshots: false })
    await second.init()
    try {
      expect((await second.listWallets()).map((w) => w.name)).toEqual(['Survivor'])
      expect((await second.listTransactions()).map((t) => t.note)).toEqual(['Still here'])
      expect((await second.getSettings()).onboardingComplete).toBe(true)
      // init() must not re-seed over data that is already there.
      expect(await second.listWallets()).toHaveLength(1)
    } finally {
      await second.destroy()
    }
  })
})
