import { describe, expect, it } from 'vitest'

import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { Settings } from '@/domain/types'

import { withActiveCurrency, withBaseCurrency, withoutCurrency } from './settings'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  baseCurrency: 'USD',
  activeCurrencies: ['USD', 'EUR'],
  rates: { EUR: 1.08 },
  budgetPeriod: DEFAULT_PERIOD_CONFIG,
  theme: 'system',
  appLockEnabled: false,
  onboardingComplete: true,
  ...overrides,
})

describe('withActiveCurrency', () => {
  it('appends a currency the shortlist does not have', () => {
    expect(withActiveCurrency(settings(), 'JPY')).toEqual({
      activeCurrencies: ['USD', 'EUR', 'JPY'],
    })
  })

  it('returns null when there is nothing to write', () => {
    // Null rather than an unchanged patch, so the caller can skip the repository round trip.
    expect(withActiveCurrency(settings(), 'EUR')).toBeNull()
  })

  it('does not mutate the settings it was given', () => {
    const original = settings()
    withActiveCurrency(original, 'JPY')
    expect(original.activeCurrencies).toEqual(['USD', 'EUR'])
  })
})

describe('withoutCurrency', () => {
  it('drops the currency and its rate together', () => {
    expect(withoutCurrency(settings(), 'EUR')).toEqual({
      activeCurrencies: ['USD'],
      rates: {},
    })
  })

  it('leaves other rates alone', () => {
    const s = settings({ activeCurrencies: ['USD', 'EUR', 'GBP'], rates: { EUR: 1.08, GBP: 1.27 } })
    expect(withoutCurrency(s, 'EUR')).toEqual({
      activeCurrencies: ['USD', 'GBP'],
      rates: { GBP: 1.27 },
    })
  })

  it('does not mutate the original rates', () => {
    const original = settings()
    withoutCurrency(original, 'EUR')
    expect(original.rates).toEqual({ EUR: 1.08 })
  })
})

describe('withBaseCurrency', () => {
  it('sets the base and puts it at the head of the shortlist', () => {
    expect(withBaseCurrency(settings(), 'JPY')).toEqual({
      baseCurrency: 'JPY',
      activeCurrencies: ['JPY', 'USD', 'EUR'],
    })
  })

  it('dedupes when the new base is already on the shortlist', () => {
    expect(withBaseCurrency(settings(), 'EUR')).toEqual({
      baseCurrency: 'EUR',
      activeCurrencies: ['EUR', 'USD'],
    })
  })

  it('is idempotent on the current base', () => {
    expect(withBaseCurrency(settings(), 'USD')).toEqual({
      baseCurrency: 'USD',
      activeCurrencies: ['USD', 'EUR'],
    })
  })
})
