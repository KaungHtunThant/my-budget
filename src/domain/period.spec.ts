import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  isWithin,
  nextPeriod,
  periodFor,
  periodProgress,
  previousPeriod,
} from './period'

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('clamps when adding months to a long month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('counts days between dates', () => {
    expect(daysBetween('2026-08-01', '2026-08-11')).toBe(10)
    expect(daysBetween('2026-08-11', '2026-08-01')).toBe(-10)
  })
})

describe('calendar-month periods', () => {
  const config = { type: 'calendar-month' } as const

  it('spans the whole month', () => {
    const p = periodFor('2026-08-11', config)
    expect(p.start).toBe('2026-08-01')
    expect(p.end).toBe('2026-08-31')
    expect(p.label).toBe('August 2026')
  })

  it('handles February in a leap year', () => {
    expect(periodFor('2024-02-10', config).end).toBe('2024-02-29')
  })

  it('steps forward and back', () => {
    expect(nextPeriod('2026-08-11', config).start).toBe('2026-09-01')
    expect(previousPeriod('2026-01-15', config).start).toBe('2025-12-01')
  })
})

describe('anchored-month periods', () => {
  const config = { type: 'anchored-month', anchorDay: 25 } as const

  it('starts on the anchor day when the date is on or after it', () => {
    const p = periodFor('2026-08-28', config)
    expect(p.start).toBe('2026-08-25')
    expect(p.end).toBe('2026-09-24')
  })

  it('belongs to the previous cycle when the date is before the anchor', () => {
    const p = periodFor('2026-08-11', config)
    expect(p.start).toBe('2026-07-25')
    expect(p.end).toBe('2026-08-24')
  })

  it('is contiguous — one period ends the day before the next begins', () => {
    const p = periodFor('2026-08-11', config)
    const next = nextPeriod('2026-08-11', config)
    expect(addDays(p.end, 1)).toBe(next.start)
  })

  it('caps the anchor at 28 so every month has the day', () => {
    const p = periodFor('2026-02-10', { type: 'anchored-month', anchorDay: 31 })
    expect(p.start).toBe('2026-01-28')
  })
})

describe('weekly and fortnightly periods', () => {
  it('starts a weekly period on the configured weekday', () => {
    // 2026-08-11 is a Tuesday; a Monday-start week began the day before.
    const p = periodFor('2026-08-11', { type: 'weekly', startWeekday: 1 })
    expect(p.start).toBe('2026-08-10')
    expect(p.end).toBe('2026-08-16')
  })

  it('lands fortnightly periods on 14-day boundaries from the anchor', () => {
    const config = { type: 'fortnightly', anchorDate: '2026-08-01' } as const
    expect(periodFor('2026-08-11', config).start).toBe('2026-08-01')
    expect(periodFor('2026-08-16', config).start).toBe('2026-08-15')
    // Dates before the anchor still land on a boundary rather than breaking.
    expect(periodFor('2026-07-20', config).start).toBe('2026-07-18')
  })
})

describe('period membership and progress', () => {
  const p = periodFor('2026-08-11', { type: 'calendar-month' })

  it('includes both endpoints', () => {
    expect(isWithin('2026-08-01', p)).toBe(true)
    expect(isWithin('2026-08-31', p)).toBe(true)
    expect(isWithin('2026-07-31', p)).toBe(false)
    expect(isWithin('2026-09-01', p)).toBe(false)
  })

  it('reports how far through the period a date sits', () => {
    expect(periodProgress(p, '2026-08-01')).toBeCloseTo(1 / 31)
    expect(periodProgress(p, '2026-08-31')).toBe(1)
  })
})
