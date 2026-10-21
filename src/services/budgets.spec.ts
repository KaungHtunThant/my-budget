import { describe, expect, it } from 'vitest'

import { fromMajor } from '@/domain/money'
import { periodFor } from '@/domain/period'
import type { Budget } from '@/domain/types'

import { MAX_ROLL_PERIODS, periodsToRoll, recurringCopies, recurringRoll } from './budgets'

const MONTH = { type: 'calendar-month' } as const
const JULY = periodFor('2026-07-15', MONTH)
const AUGUST = periodFor('2026-08-15', MONTH)

const budget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'bdg_1',
  categoryId: 'groceries',
  periodStart: '2026-07-01',
  limit: fromMajor(400, 'USD'),
  rollover: true,
  recurring: true,
  archived: false,
  ...overrides,
})

describe('periodsToRoll', () => {
  it('is only the current cycle before anything has been rolled', () => {
    expect(periodsToRoll(null, '2026-08-11', MONTH).map((p) => p.start)).toEqual(['2026-08-01'])
  })

  it('is nothing once the current cycle has had its copies', () => {
    expect(periodsToRoll('2026-08-01', '2026-08-11', MONTH)).toEqual([])
  })

  it('is the next cycle the day it starts', () => {
    expect(periodsToRoll('2026-07-01', '2026-08-01', MONTH).map((p) => p.start)).toEqual([
      '2026-08-01',
    ])
  })

  it('includes every cycle that started while the app was closed, oldest first', () => {
    expect(periodsToRoll('2026-05-01', '2026-08-11', MONTH).map((p) => p.start)).toEqual([
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
    ])
  })

  it('works on weekly cycles', () => {
    const weekly = { type: 'weekly', startWeekday: 1 } as const
    // Mondays: 3 and 10 August 2026.
    expect(periodsToRoll('2026-07-27', '2026-08-11', weekly).map((p) => p.start)).toEqual([
      '2026-08-03',
      '2026-08-10',
    ])
  })

  it('stops at the cap rather than looping on a corrupt marker', () => {
    expect(periodsToRoll('1900-01-01', '2026-08-11', MONTH)).toHaveLength(MAX_ROLL_PERIODS)
  })
})

describe('recurringCopies', () => {
  it('copies a recurring budget into the next cycle, limit and rollover included', () => {
    const fx = { enteredAmount: fromMajor(370, 'EUR'), rate: 1.08 }
    expect(recurringCopies([budget({ fx })], AUGUST, JULY)).toEqual([
      {
        categoryId: 'groceries',
        periodStart: '2026-08-01',
        limit: fromMajor(400, 'USD'),
        fx,
        rollover: true,
        recurring: true,
        archived: false,
      },
    ])
  })

  it('leaves a one-off budget behind', () => {
    expect(recurringCopies([budget({ recurring: false })], AUGUST, JULY)).toEqual([])
  })

  it('never overwrites a budget already planned for the cycle', () => {
    const planned = budget({ id: 'bdg_2', periodStart: '2026-08-01', limit: fromMajor(300, 'USD') })
    expect(recurringCopies([budget(), planned], AUGUST, JULY)).toEqual([])
  })

  it('copies from the previous cycle only, so deleting a copy ends the chain', () => {
    // June had the recurring budget; July's copy was deleted. August is owed nothing.
    const june = budget({ periodStart: '2026-06-01' })
    expect(recurringCopies([june], AUGUST, JULY)).toEqual([])
  })

  it('carries the latest edit forward', () => {
    const edited = budget({ limit: fromMajor(450, 'USD') })
    expect(recurringCopies([edited], AUGUST, JULY)[0].limit).toEqual(fromMajor(450, 'USD'))
  })

  it('writes a null fx for a schema-1 record that lacks the key', () => {
    const legacy = budget()
    delete legacy.fx
    expect(recurringCopies([legacy], AUGUST, JULY)[0].fx).toBeNull()
  })

  it('skips archived budgets', () => {
    expect(recurringCopies([budget({ archived: true })], AUGUST, JULY)).toEqual([])
  })
})

describe('recurringRoll', () => {
  it('is null when the current cycle already has its copies', () => {
    expect(recurringRoll([budget()], '2026-08-01', '2026-08-11', MONTH)).toBeNull()
  })

  it('chains through every missed cycle, each copy made from the one before', () => {
    const roll = recurringRoll([budget({ periodStart: '2026-05-01' })], '2026-05-01', '2026-08-11', MONTH)
    expect(roll!.copies.map((c) => c.periodStart)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
    expect(roll!.rolledInto).toBe('2026-08-01')
  })

  it('still moves the marker when there is nothing to copy, so a later deletion sticks', () => {
    expect(recurringRoll([], '2026-07-01', '2026-08-11', MONTH)).toEqual({
      copies: [],
      rolledInto: '2026-08-01',
    })
  })
})
