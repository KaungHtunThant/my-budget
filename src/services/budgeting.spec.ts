import { describe, expect, it } from 'vitest'

import type { PeriodSummary } from '@/domain/budgeting'
import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { Settings } from '@/domain/types'

import { TREND_PERIODS, baseContext, trendBars } from './budgeting'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  baseCurrency: 'USD',
  activeCurrencies: ['USD'],
  rates: { EUR: 1.08 },
  budgetPeriod: DEFAULT_PERIOD_CONFIG,
  theme: 'system',
  appLockEnabled: false,
  onboardingComplete: true,
  ...overrides,
})

const point = (label: string, income: number, expense: number): PeriodSummary => ({
  period: { start: '2026-08-01', end: '2026-08-31', label },
  income: { minor: income, currency: 'USD' },
  expense: { minor: expense, currency: 'USD' },
  net: { minor: income - expense, currency: 'USD' },
})

describe('baseContext', () => {
  it('projects the two fields every domain conversion needs', () => {
    expect(baseContext(settings())).toEqual({ base: 'USD', rates: { EUR: 1.08 } })
  })
})

describe('TREND_PERIODS', () => {
  it('is the one place the cycle count is written', () => {
    expect(TREND_PERIODS).toBe(6)
  })
})

describe('trendBars', () => {
  it('scales every bar against the tallest value on show', () => {
    const bars = trendBars([point('July 2026', 5000, 2500), point('August 2026', 10000, 0)])
    expect(bars.map((b) => [b.incomePercent, b.expensePercent])).toEqual([
      [50, 25],
      [100, 0],
    ])
  })

  it('scales against expense when expense is the peak', () => {
    const bars = trendBars([point('August 2026', 2000, 8000)])
    expect(bars[0].incomePercent).toBe(25)
    expect(bars[0].expensePercent).toBe(100)
  })

  it('shortens the label for a cramped axis', () => {
    const bars = trendBars([point('September 2026', 1, 0)])
    expect(bars[0]).toMatchObject({ label: 'September 2026', short: 'Sep' })
  })

  it('carries the amounts through untouched, so the caller formats them', () => {
    const bars = trendBars([point('August 2026', 10000, 4000)])
    expect(bars[0]).toMatchObject({
      income: { minor: 10000, currency: 'USD' },
      expense: { minor: 4000, currency: 'USD' },
      net: { minor: 6000, currency: 'USD' },
    })
  })

  it('returns percentages, not CSS — Home reads them as heights, Reports as widths', () => {
    const bars = trendBars([point('August 2026', 10000, 5000)])
    expect(typeof bars[0].incomePercent).toBe('number')
  })

  it('produces zeroes rather than NaN when there is no activity at all', () => {
    // Without the floor of 1 the peak would be 0 and every bar would divide by zero.
    const bars = trendBars([point('July 2026', 0, 0), point('August 2026', 0, 0)])
    expect(bars.map((b) => [b.incomePercent, b.expensePercent])).toEqual([
      [0, 0],
      [0, 0],
    ])
  })

  it('handles an empty series', () => {
    expect(trendBars([])).toEqual([])
  })
})
