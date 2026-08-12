import { describe, expect, it } from 'vitest'
import {
  type BaseContext,
  budgetStatus,
  budgetTotals,
  goalStatus,
  periodSummary,
  spendByCategory,
  toBase,
} from './budgeting'
import { fromMajor } from './money'
import { periodFor } from './period'
import type { Budget, Category, SavingsGoal, Transaction } from './types'

const USD: BaseContext = { base: 'USD', rates: { EUR: 1.08 } }
const MONTH = { type: 'calendar-month' } as const
const AUGUST = periodFor('2026-08-11', MONTH)

const groceries: Category = {
  id: 'cat_groceries',
  name: 'Groceries',
  kind: 'expense',
  parentId: null,
  icon: 'basket-outline',
  color: 'warning',
  archived: false,
}

const dining: Category = { ...groceries, id: 'cat_dining', name: 'Dining out' }

function expense(amount: number, date: string, categoryId: string, currency = 'USD'): Transaction {
  return {
    id: `txn_${date}_${amount}_${categoryId}`,
    type: 'expense',
    amount: fromMajor(amount, currency as 'USD'),
    fx: null,
    walletId: 'wal_1',
    toWalletId: null,
    toAmount: null,
    categoryId,
    date,
    note: '',
    recurringRuleId: null,
    goalId: null,
    createdAt: date,
  }
}

function income(amount: number, date: string): Transaction {
  return { ...expense(amount, date, 'cat_salary'), id: `inc_${date}`, type: 'income' }
}

describe('toBase', () => {
  it('passes base-currency amounts through', () => {
    expect(toBase(fromMajor(10, 'USD'), USD)).toEqual(fromMajor(10, 'USD'))
  })

  it('converts with a known rate', () => {
    expect(toBase(fromMajor(50, 'EUR'), USD)).toEqual(fromMajor(54, 'USD'))
  })

  it('returns null when no rate is available, rather than guessing', () => {
    expect(toBase(fromMajor(50, 'CHF'), USD)).toBeNull()
  })
})

describe('budgetStatus', () => {
  const budget: Budget = {
    id: 'bdg_1',
    categoryId: groceries.id,
    limit: fromMajor(400, 'USD'),
    rollover: false,
    archived: false,
  }

  it('counts only expenses in the period and category', () => {
    const txs = [
      expense(100, '2026-08-05', groceries.id),
      expense(50, '2026-08-20', groceries.id),
      expense(999, '2026-07-30', groceries.id), // previous period
      expense(999, '2026-08-06', dining.id), // other category
    ]
    const status = budgetStatus(budget, groceries, txs, AUGUST, MONTH, USD)
    expect(status.spent).toEqual(fromMajor(150, 'USD'))
    expect(status.remaining).toEqual(fromMajor(250, 'USD'))
    expect(status.percentUsed).toBeCloseTo(37.5)
    expect(status.overspent).toBe(false)
  })

  it('flags overspend', () => {
    const status = budgetStatus(
      budget,
      groceries,
      [expense(450, '2026-08-05', groceries.id)],
      AUGUST,
      MONTH,
      USD,
    )
    expect(status.overspent).toBe(true)
    expect(status.remaining.minor).toBe(fromMajor(-50, 'USD').minor)
  })

  it('converts foreign-currency spend into the base currency', () => {
    const status = budgetStatus(
      budget,
      groceries,
      [expense(50, '2026-08-05', groceries.id, 'EUR')],
      AUGUST,
      MONTH,
      USD,
    )
    expect(status.spent).toEqual(fromMajor(54, 'USD'))
  })

  it('carries unspent room forward when rollover is on', () => {
    const rolling: Budget = { ...budget, rollover: true }
    // Spent 300 of 400 in July, leaving 100 to carry into August.
    const txs = [expense(300, '2026-07-10', groceries.id), expense(50, '2026-08-05', groceries.id)]
    const status = budgetStatus(rolling, groceries, txs, AUGUST, MONTH, USD)
    expect(status.carriedIn).toEqual(fromMajor(100, 'USD'))
    expect(status.limit).toEqual(fromMajor(500, 'USD'))
    expect(status.remaining).toEqual(fromMajor(450, 'USD'))
  })

  it('carries nothing forward from an overspent period', () => {
    const rolling: Budget = { ...budget, rollover: true }
    const status = budgetStatus(
      rolling,
      groceries,
      [expense(500, '2026-07-10', groceries.id)],
      AUGUST,
      MONTH,
      USD,
    )
    expect(status.carriedIn.minor).toBe(0)
  })

  it('does not compound carry-in across several quiet periods', () => {
    const rolling: Budget = { ...budget, rollover: true }
    // History goes back to May with nothing spent on groceries until August. Only the
    // single preceding period may carry, so the limit is 400 + 400, never 400 × months.
    const txs = [
      expense(20, '2026-05-04', dining.id),
      expense(50, '2026-08-05', groceries.id),
    ]
    const status = budgetStatus(rolling, groceries, txs, AUGUST, MONTH, USD)
    expect(status.carriedIn).toEqual(fromMajor(400, 'USD'))
    expect(status.limit).toEqual(fromMajor(800, 'USD'))
  })

  it('carries nothing from a period that predates all history', () => {
    const rolling: Budget = { ...budget, rollover: true }
    // The only history is in August, so July was not an "unspent" period — it was empty.
    const status = budgetStatus(
      rolling,
      groceries,
      [expense(50, '2026-08-05', groceries.id)],
      AUGUST,
      MONTH,
      USD,
    )
    expect(status.carriedIn.minor).toBe(0)
    expect(status.limit).toEqual(fromMajor(400, 'USD'))
  })

  it('ignores carry-in entirely when rollover is off', () => {
    const status = budgetStatus(
      budget,
      groceries,
      [expense(10, '2026-07-10', groceries.id)],
      AUGUST,
      MONTH,
      USD,
    )
    expect(status.carriedIn.minor).toBe(0)
    expect(status.limit).toEqual(fromMajor(400, 'USD'))
  })
})

describe('budgetTotals', () => {
  it('aggregates limits, spend and overspend count', () => {
    const budgets: Budget[] = [
      { id: 'b1', categoryId: groceries.id, limit: fromMajor(400, 'USD'), rollover: false, archived: false },
      { id: 'b2', categoryId: dining.id, limit: fromMajor(100, 'USD'), rollover: false, archived: false },
    ]
    const txs = [expense(150, '2026-08-05', groceries.id), expense(120, '2026-08-06', dining.id)]
    const statuses = budgets.map((b, i) =>
      budgetStatus(b, i === 0 ? groceries : dining, txs, AUGUST, MONTH, USD),
    )
    const totals = budgetTotals(statuses, 'USD')
    expect(totals.budgeted).toEqual(fromMajor(500, 'USD'))
    expect(totals.spent).toEqual(fromMajor(270, 'USD'))
    expect(totals.overspentCount).toBe(1)
  })
})

describe('goalStatus', () => {
  const goal: SavingsGoal = {
    id: 'gol_1',
    name: 'Emergency fund',
    target: fromMajor(6000, 'USD'),
    walletId: 'wal_savings',
    targetDate: '2027-02-11',
    icon: 'umbrella-outline',
    color: 'primary',
    archived: false,
    createdAt: '2026-01-01',
  }

  function contribution(amount: number, date: string): Transaction {
    return {
      ...expense(amount, date, 'x'),
      id: `c_${date}`,
      type: 'transfer',
      categoryId: null,
      toWalletId: 'wal_savings',
      toAmount: fromMajor(amount, 'USD'),
      goalId: goal.id,
    }
  }

  it('sums tagged contributions and reports progress', () => {
    const status = goalStatus(
      goal,
      [contribution(300, '2026-06-25'), contribution(300, '2026-07-25')],
      USD,
      '2026-08-11',
      MONTH,
    )
    expect(status.saved).toEqual(fromMajor(600, 'USD'))
    expect(status.remaining).toEqual(fromMajor(5400, 'USD'))
    expect(status.percentComplete).toBeCloseTo(10)
    expect(status.complete).toBe(false)
  })

  it('ignores transactions not tagged with the goal', () => {
    const status = goalStatus(goal, [expense(500, '2026-08-01', 'cat_x')], USD, '2026-08-11', MONTH)
    expect(status.saved.minor).toBe(0)
  })

  it('derives the contribution needed per period to hit the target date', () => {
    const status = goalStatus(goal, [contribution(600, '2026-07-25')], USD, '2026-08-11', MONTH)
    // 5400 remaining over the whole periods before 2027-02-11.
    expect(status.requiredPerPeriod).not.toBeNull()
    expect(status.requiredPerPeriod!.minor).toBeGreaterThan(0)
  })

  it('reports completion once the target is reached', () => {
    const status = goalStatus(goal, [contribution(6500, '2026-07-25')], USD, '2026-08-11', MONTH)
    expect(status.complete).toBe(true)
    expect(status.remaining.minor).toBe(0)
    expect(status.percentComplete).toBe(100)
  })
})

describe('reports', () => {
  it('breaks spend down by category, largest first', () => {
    const txs = [
      expense(100, '2026-08-02', groceries.id),
      expense(50, '2026-08-03', groceries.id),
      expense(200, '2026-08-04', dining.id),
    ]
    const result = spendByCategory(txs, [groceries, dining], AUGUST, USD)
    expect(result.total).toEqual(fromMajor(350, 'USD'))
    expect(result.rows[0].category.name).toBe('Dining out')
    expect(result.rows[0].percentOfTotal).toBeCloseTo((200 / 350) * 100)
    expect(result.rows[1].transactionCount).toBe(2)
  })

  it('groups spend with no category under Uncategorised', () => {
    const orphan = { ...expense(25, '2026-08-02', groceries.id), categoryId: null }
    const result = spendByCategory([orphan], [groceries], AUGUST, USD)
    expect(result.rows[0].category.name).toBe('Uncategorised')
  })

  it('reports income against spend, excluding transfers', () => {
    const transfer: Transaction = {
      ...expense(500, '2026-08-05', groceries.id),
      id: 'tr',
      type: 'transfer',
      categoryId: null,
      toWalletId: 'wal_2',
      toAmount: fromMajor(500, 'USD'),
    }
    const summary = periodSummary(
      [income(3000, '2026-08-25'), expense(1200, '2026-08-05', groceries.id), transfer],
      AUGUST,
      USD,
    )
    expect(summary.income).toEqual(fromMajor(3000, 'USD'))
    expect(summary.expense).toEqual(fromMajor(1200, 'USD'))
    expect(summary.net).toEqual(fromMajor(1800, 'USD'))
  })
})
