import { describe, expect, it } from 'vitest'

import type { CategoryBreakdownRow, PeriodSummary } from '@/domain/budgeting'
import type { Category } from '@/domain/types'

import { donutSegments, savingsRate, trendAverages, trendRows } from './utils'

const category = (name: string, color: string): Category => ({
  id: `cat_${name}`,
  name,
  kind: 'expense',
  parentId: null,
  icon: 'basket-outline',
  color,
  archived: false,
})

const row = (name: string, color: string, minor: number): CategoryBreakdownRow => ({
  category: category(name, color),
  amount: { minor, currency: 'USD' },
  percentOfTotal: 0,
  transactionCount: 1,
})

const point = (label: string, income: number, expense: number): PeriodSummary => ({
  period: { start: '2026-08-01', end: '2026-08-31', label },
  income: { minor: income, currency: 'USD' },
  expense: { minor: expense, currency: 'USD' },
  net: { minor: income - expense, currency: 'USD' },
})

const CIRCUMFERENCE = 2 * Math.PI * 52

describe('donutSegments', () => {
  it('draws nothing when there is no spending', () => {
    // A ring of zero-length arcs would still paint the track and imply data.
    expect(donutSegments([row('Rent', 'danger', 0)], { minor: 0, currency: 'USD' })).toEqual([])
  })

  it('gives each slice an arc proportional to its share', () => {
    const rows = [row('Rent', 'danger', 7500), row('Food', 'warning', 2500)]
    const segments = donutSegments(rows, { minor: 10000, currency: 'USD' })
    const [first, second] = segments.map((s) => Number(s.dash.split(' ')[0]))
    expect(first).toBeCloseTo(CIRCUMFERENCE * 0.75, 6)
    expect(second).toBeCloseTo(CIRCUMFERENCE * 0.25, 6)
  })

  it('completes each dash pair to the full circumference', () => {
    const segments = donutSegments([row('Rent', 'danger', 5000)], { minor: 10000, currency: 'USD' })
    const [drawn, gap] = segments[0].dash.split(' ').map(Number)
    expect(drawn + gap).toBeCloseTo(CIRCUMFERENCE, 6)
  })

  it('offsets each slice by everything drawn before it', () => {
    const rows = [row('Rent', 'danger', 5000), row('Food', 'warning', 5000)]
    const segments = donutSegments(rows, { minor: 10000, currency: 'USD' })
    // Negative zero, since the offset is negated — harmless, and what SVG renders as 0.
    expect(segments[0].offset).toBeCloseTo(0, 6)
    expect(segments[1].offset).toBeCloseTo(-CIRCUMFERENCE / 2, 6)
  })

  it('caps the ring at eight slices, leaving the rest to the list below', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`c${i}`, 'primary', 1000))
    expect(donutSegments(rows, { minor: 12000, currency: 'USD' })).toHaveLength(8)
  })

  it('names the segment and maps the category colour to a CSS token', () => {
    const segments = donutSegments([row('Rent', 'danger', 1000)], { minor: 1000, currency: 'USD' })
    expect(segments[0]).toMatchObject({ name: 'Rent', color: 'var(--ion-color-danger)' })
  })
})

describe('trendRows', () => {
  it('turns the shared percentages into this screen’s CSS widths', () => {
    const bars = [
      {
        label: 'August 2026',
        short: 'Aug',
        income: { minor: 100, currency: 'USD' as const },
        expense: { minor: 50, currency: 'USD' as const },
        net: { minor: 50, currency: 'USD' as const },
        incomePercent: 100,
        expensePercent: 50,
      },
    ]
    expect(trendRows(bars)[0]).toMatchObject({ incomeWidth: '100%', expenseWidth: '50%' })
  })
})

describe('trendAverages', () => {
  it('averages only over the cycles with activity', () => {
    // Six cycles, two of them active: a young install should not read as a spending drop.
    const series = [
      point('Mar', 0, 0),
      point('Apr', 0, 0),
      point('May', 0, 0),
      point('Jun', 0, 0),
      point('Jul', 10000, 6000),
      point('Aug', 20000, 4000),
    ]
    expect(trendAverages(series, 'USD')).toEqual({
      income: { minor: 15000, currency: 'USD' },
      expense: { minor: 5000, currency: 'USD' },
      saved: { minor: 10000, currency: 'USD' },
      periods: 2,
    })
  })

  it('counts a cycle with spending but no income as active', () => {
    const series = [point('Jul', 0, 0), point('Aug', 0, 3000)]
    expect(trendAverages(series, 'USD')).toMatchObject({
      expense: { minor: 3000, currency: 'USD' },
      saved: { minor: -3000, currency: 'USD' },
      periods: 1,
    })
  })

  it('reports zero periods, and zero amounts, when nothing has happened', () => {
    expect(trendAverages([point('Jul', 0, 0)], 'USD')).toEqual({
      income: { minor: 0, currency: 'USD' },
      expense: { minor: 0, currency: 'USD' },
      saved: { minor: 0, currency: 'USD' },
      periods: 0,
    })
  })

  it('rounds to whole minor units, so the amounts stay constructible', () => {
    // money() throws on a fractional minor value; 10000/3 must not reach it raw.
    const series = [point('Jun', 10000, 0), point('Jul', 0, 1), point('Aug', 0, 1)]
    const averages = trendAverages(series, 'USD')
    expect(Number.isInteger(averages.income.minor)).toBe(true)
    expect(averages.income.minor).toBe(3333)
  })

  it('handles an empty series', () => {
    expect(trendAverages([], 'USD')).toMatchObject({ periods: 0 })
  })
})

describe('savingsRate', () => {
  it('is the share of income kept', () => {
    expect(savingsRate(point('Aug', 10000, 7500))).toBe(25)
  })

  it('goes negative when spending exceeds income', () => {
    expect(savingsRate(point('Aug', 10000, 12000))).toBe(-20)
  })

  it('is null with no income, since 0% would read as "saved nothing" rather than "no rate"', () => {
    expect(savingsRate(point('Aug', 0, 5000))).toBeNull()
  })
})
