import { describe, expect, it } from 'vitest'

import type { RecurrenceFrequency, RecurringRule, TransactionType, Wallet } from '@/domain/types'

import {
  buildRule,
  canSaveRule,
  describeRule,
  monthlyCommitment,
  monthlyFactor,
  usesWeekday,
} from './utils'

const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  name: 'Rent',
  type: 'expense',
  amount: { minor: 95000, currency: 'USD' },
  walletId: 'w1',
  toWalletId: null,
  categoryId: 'c1',
  frequency: 'monthly',
  dayOfMonth: 1,
  weekday: null,
  startDate: '2026-01-01',
  endDate: null,
  lastRunDate: null,
  active: true,
  note: '',
  ...overrides,
})

const wallet: Wallet = {
  id: 'w1',
  name: 'Main Bank',
  kind: 'bank',
  currency: 'USD',
  openingBalance: { minor: 0, currency: 'USD' },
  icon: 'wallet-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
}

describe('usesWeekday', () => {
  it('is true for the weekday-anchored frequencies', () => {
    expect(usesWeekday('weekly')).toBe(true)
    expect(usesWeekday('fortnightly')).toBe(true)
  })

  it('is false for the date-anchored ones', () => {
    expect(usesWeekday('monthly')).toBe(false)
    expect(usesWeekday('yearly')).toBe(false)
  })
})

describe('monthlyFactor', () => {
  it('treats a week as 52/12 of a month, not a quarter of one', () => {
    // Four weeks is not a month; the difference is a whole extra payment a year, which is
    // exactly what a commitment figure exists to reveal.
    expect(monthlyFactor('weekly')).toBeCloseTo(4.3333, 4)
    expect(monthlyFactor('weekly')).not.toBe(4)
  })

  it('scales the other frequencies', () => {
    expect(monthlyFactor('fortnightly')).toBeCloseTo(2.1667, 4)
    expect(monthlyFactor('monthly')).toBe(1)
    expect(monthlyFactor('yearly')).toBeCloseTo(1 / 12, 6)
  })
})

describe('monthlyCommitment', () => {
  it('totals expenses and income separately', () => {
    const rules = [
      rule({ id: 'a', type: 'expense', amount: { minor: 95000, currency: 'USD' } }),
      rule({ id: 'b', type: 'income', amount: { minor: 300000, currency: 'USD' } }),
    ]
    expect(monthlyCommitment(rules, 'USD')).toEqual({
      expense: { minor: 95000, currency: 'USD' },
      income: { minor: 300000, currency: 'USD' },
    })
  })

  it('converts a weekly rule to its monthly equivalent', () => {
    const rules = [rule({ frequency: 'weekly', amount: { minor: 3000, currency: 'USD' } })]
    // 30.00 a week is 130.00 a month, not 120.00.
    expect(monthlyCommitment(rules, 'USD').expense).toEqual({ minor: 13000, currency: 'USD' })
  })

  it('spreads a yearly rule across twelve months', () => {
    const rules = [rule({ frequency: 'yearly', amount: { minor: 120000, currency: 'USD' } })]
    expect(monthlyCommitment(rules, 'USD').expense).toEqual({ minor: 10000, currency: 'USD' })
  })

  it('ignores paused rules, which are not commitments', () => {
    const rules = [rule({ id: 'a', active: false })]
    expect(monthlyCommitment(rules, 'USD').expense).toEqual({ minor: 0, currency: 'USD' })
  })

  it('ignores transfers, which commit nothing either way', () => {
    const rules = [rule({ id: 'a', type: 'transfer' })]
    expect(monthlyCommitment(rules, 'USD')).toEqual({
      expense: { minor: 0, currency: 'USD' },
      income: { minor: 0, currency: 'USD' },
    })
  })

  it('rounds to whole minor units, so the totals stay constructible', () => {
    const rules = [rule({ frequency: 'weekly', amount: { minor: 1, currency: 'USD' } })]
    expect(Number.isInteger(monthlyCommitment(rules, 'USD').expense.minor)).toBe(true)
  })

  it('is zero with no rules', () => {
    expect(monthlyCommitment([], 'USD')).toEqual({
      expense: { minor: 0, currency: 'USD' },
      income: { minor: 0, currency: 'USD' },
    })
  })
})

describe('describeRule', () => {
  it('names the weekday for a weekly rule', () => {
    expect(describeRule(rule({ frequency: 'weekly', weekday: 3 }), wallet)).toBe(
      'Every Wednesday · Main Bank',
    )
  })

  it('spells out a fortnightly rule', () => {
    expect(describeRule(rule({ frequency: 'fortnightly', weekday: 1 }), wallet)).toBe(
      'Every 2 weeks on Monday · Main Bank',
    )
  })

  it('names the day of month for monthly and yearly rules', () => {
    expect(describeRule(rule({ frequency: 'monthly', dayOfMonth: 25 }), wallet)).toBe(
      'Monthly on day 25 · Main Bank',
    )
    expect(describeRule(rule({ frequency: 'yearly', dayOfMonth: 5 }), wallet)).toBe(
      'Yearly on day 5 · Main Bank',
    )
  })

  it('defaults a missing anchor rather than printing undefined', () => {
    expect(describeRule(rule({ frequency: 'weekly', weekday: null }), wallet)).toBe(
      'Every Monday · Main Bank',
    )
    expect(describeRule(rule({ frequency: 'monthly', dayOfMonth: null }), wallet)).toBe(
      'Monthly on day 1 · Main Bank',
    )
  })

  it('omits an unresolvable wallet instead of leaving a separator', () => {
    expect(describeRule(rule(), undefined)).toBe('Monthly on day 1')
  })
})

describe('canSaveRule', () => {
  it('needs a name, an amount above zero and a wallet', () => {
    expect(canSaveRule('Rent', '950', 'w1', 'USD')).toBe(true)
    expect(canSaveRule('  ', '950', 'w1', 'USD')).toBe(false)
    expect(canSaveRule('Rent', '0', 'w1', 'USD')).toBe(false)
    expect(canSaveRule('Rent', '950', null, 'USD')).toBe(false)
  })
})

describe('buildRule', () => {
  const draft = {
    name: '  Rent  ',
    type: 'expense' as TransactionType,
    amount: { minor: 95000, currency: 'USD' as const },
    walletId: 'w1',
    categoryId: 'c1',
    frequency: 'monthly' as RecurrenceFrequency,
    dayOfMonth: 25,
    weekday: 3,
    active: true,
    today: '2026-08-20',
  }

  it('keeps the day of month for a monthly rule and nulls the weekday', () => {
    expect(buildRule(draft)).toMatchObject({ dayOfMonth: 25, weekday: null })
  })

  it('keeps the weekday for a weekly rule and nulls the day of month', () => {
    // Mutually exclusive on purpose: a rule switched from monthly to weekly must not keep a
    // stale day of month that a scheduler would later read.
    expect(buildRule({ ...draft, frequency: 'weekly' })).toMatchObject({
      dayOfMonth: null,
      weekday: 3,
    })
  })

  it('nulls the category on a transfer', () => {
    expect(buildRule({ ...draft, type: 'transfer' }).categoryId).toBeNull()
  })

  it('trims the name and starts the rule today', () => {
    expect(buildRule(draft)).toMatchObject({ name: 'Rent', startDate: '2026-08-20' })
  })

  it('leaves a new rule unrun, so a scheduler knows it still owes one', () => {
    expect(buildRule(draft).lastRunDate).toBeNull()
  })
})
