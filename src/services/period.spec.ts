import { describe, expect, it } from 'vitest'

import { DEFAULT_PERIOD_CONFIG, currentPeriod, periodFor } from '@/domain/period'
import type { Settings } from '@/domain/types'

import { currentPace, periodConfigFrom, selectedPeriod } from './period'

const TODAY = '2026-08-20'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  baseCurrency: 'USD',
  activeCurrencies: ['USD'],
  rates: {},
  budgetPeriod: DEFAULT_PERIOD_CONFIG,
  theme: 'system',
  appLockEnabled: false,
  onboardingComplete: true,
  ...overrides,
})

describe('selectedPeriod', () => {
  it('resolves the current cycle at offset zero', () => {
    expect(selectedPeriod(settings(), 0, TODAY)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
      label: 'August 2026',
    })
  })

  it('steps back and forward', () => {
    expect(selectedPeriod(settings(), -1, TODAY).label).toBe('July 2026')
    expect(selectedPeriod(settings(), 1, TODAY).label).toBe('September 2026')
    expect(selectedPeriod(settings(), -2, TODAY).label).toBe('June 2026')
  })

  it('agrees with domain currentPeriod at offset zero, which is why the branch went away', () => {
    // The store used to special-case offset zero to call `currentPeriod`. `shiftPeriod` already
    // returns `periodFor(today, config)` for a zero offset, so the two are the same period.
    expect(selectedPeriod(settings(), 0, TODAY)).toEqual(periodFor(TODAY, DEFAULT_PERIOD_CONFIG))
    expect(currentPeriod(DEFAULT_PERIOD_CONFIG)).toEqual(periodFor(TODAY, DEFAULT_PERIOD_CONFIG))
  })

  it('follows the configured cycle shape, not just months', () => {
    const weekly = settings({ budgetPeriod: { type: 'weekly', startWeekday: 1 } })
    const current = selectedPeriod(weekly, 0, TODAY)
    const back = selectedPeriod(weekly, -1, TODAY)
    expect(current.start).toBe('2026-08-17')
    expect(back.start).toBe('2026-08-10')

    const anchored = settings({ budgetPeriod: { type: 'anchored-month', anchorDay: 25 } })
    expect(selectedPeriod(anchored, 0, TODAY)).toMatchObject({
      start: '2026-07-25',
      end: '2026-08-24',
    })
  })
})

describe('periodConfigFrom', () => {
  const draft = { type: 'calendar-month' as const, anchorDay: 25, startWeekday: 1, today: TODAY }

  it('keeps only the field each cycle shape uses', () => {
    expect(periodConfigFrom({ ...draft, type: 'calendar-month' })).toEqual({
      type: 'calendar-month',
    })
    expect(periodConfigFrom({ ...draft, type: 'anchored-month' })).toEqual({
      type: 'anchored-month',
      anchorDay: 25,
    })
    expect(periodConfigFrom({ ...draft, type: 'weekly' })).toEqual({
      type: 'weekly',
      startWeekday: 1,
    })
  })

  it('anchors a fortnightly cycle to the given day, not to the clock', () => {
    expect(periodConfigFrom({ ...draft, type: 'fortnightly' })).toEqual({
      type: 'fortnightly',
      anchorDate: TODAY,
    })
  })

  it('produces a config the domain can resolve to real dates', () => {
    const config = periodConfigFrom({ ...draft, type: 'anchored-month', anchorDay: 25 })
    expect(periodFor(TODAY, config)).toMatchObject({ start: '2026-07-25', end: '2026-08-24' })
  })
})

describe('currentPace', () => {
  const period = { start: '2026-08-01', end: '2026-08-31', label: 'August 2026' }

  it('reports progress through the current cycle', () => {
    const pace = currentPace(period, 0, TODAY)
    expect(pace).not.toBeNull()
    expect(pace!).toBeGreaterThan(0)
    expect(pace!).toBeLessThanOrEqual(1)
  })

  it('is null off the current cycle, where a marker would be a lie', () => {
    expect(currentPace(period, -1, TODAY)).toBeNull()
    expect(currentPace(period, 1, TODAY)).toBeNull()
  })
})
