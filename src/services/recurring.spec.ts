import { describe, expect, it } from 'vitest'

import type { RecurringRule } from '@/domain/types'

import { transactionFromRule } from './recurring'

const rule: RecurringRule = {
  id: 'rec_rent',
  name: 'Rent',
  type: 'expense',
  amount: { minor: 95000, currency: 'USD' },
  walletId: 'wal_bank',
  toWalletId: null,
  categoryId: 'cat_seed_4',
  frequency: 'monthly',
  dayOfMonth: 1,
  weekday: null,
  startDate: '2026-02-01',
  endDate: null,
  lastRunDate: null,
  active: true,
  note: 'paid by standing order',
}

describe('transactionFromRule', () => {
  it('materialises the rule as a transaction on the given day', () => {
    expect(transactionFromRule(rule, '2026-08-20')).toEqual({
      type: 'expense',
      amount: { minor: 95000, currency: 'USD' },
      fx: null,
      walletId: 'wal_bank',
      toWalletId: null,
      toAmount: null,
      categoryId: 'cat_seed_4',
      date: '2026-08-20',
      note: 'Rent',
      recurringRuleId: 'rec_rent',
      goalId: null,
    })
  })

  it('links back to the rule, so history shows where the entry came from', () => {
    expect(transactionFromRule(rule, '2026-08-20').recurringRuleId).toBe('rec_rent')
  })

  it('notes the rule’s name, not the rule’s own note field', () => {
    // Current behaviour, preserved deliberately: the transaction reads "Rent" in history, and
    // the rule's note stays a memo about the rule itself rather than leaking onto every entry.
    expect(transactionFromRule(rule, '2026-08-20').note).toBe('Rent')
  })

  it('carries a transfer rule’s destination wallet through', () => {
    const transfer: RecurringRule = {
      ...rule,
      type: 'transfer',
      toWalletId: 'wal_savings',
      categoryId: null,
    }
    expect(transactionFromRule(transfer, '2026-08-20')).toMatchObject({
      type: 'transfer',
      toWalletId: 'wal_savings',
      categoryId: null,
    })
  })

  it('dates from the argument, not the clock — the scheduler will need a past date', () => {
    expect(transactionFromRule(rule, '2026-07-01').date).toBe('2026-07-01')
  })

  it('hands a foreign-currency rule its frozen conversion through', () => {
    // The generated entry then reads "500.00 USD at 4400" in history, exactly as the same bill
    // entered by hand would — which is the whole reason the snapshot is stored on the rule.
    const foreign: RecurringRule = {
      ...rule,
      amount: { minor: 220000000, currency: 'MMK' },
      fx: { enteredAmount: { minor: 50000, currency: 'USD' }, rate: 4400 },
    }
    expect(transactionFromRule(foreign, '2026-08-20')).toMatchObject({
      amount: { minor: 220000000, currency: 'MMK' },
      fx: { enteredAmount: { minor: 50000, currency: 'USD' }, rate: 4400 },
    })
  })

  it('reports no conversion for a rule written before the field existed', () => {
    // `fx` is optional on the record, and a transaction's is not — `undefined` must not leak.
    expect(transactionFromRule(rule, '2026-08-20').fx).toBeNull()
  })
})
