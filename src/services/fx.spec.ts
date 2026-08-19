import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { Settings, Wallet } from '@/domain/types'

import { currenciesNeedingRates, parseRate } from './fx'

const wallet = (id: string, currency: CurrencyCode): Wallet => ({
  id,
  name: id,
  kind: 'bank',
  currency,
  openingBalance: { minor: 0, currency },
  icon: 'wallet-outline',
  color: 'primary',
  archived: false,
  createdAt: '2026-01-01',
})

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

describe('currenciesNeedingRates', () => {
  it('never asks for a rate against base itself', () => {
    expect(currenciesNeedingRates([wallet('a', 'USD')], settings())).toEqual([])
  })

  it('reports a held currency with no rate', () => {
    expect(currenciesNeedingRates([wallet('a', 'USD'), wallet('b', 'EUR')], settings())).toEqual([
      'EUR',
    ])
  })

  it('stays quiet once a usable rate exists', () => {
    const s = settings({ rates: { EUR: 1.08 } })
    expect(currenciesNeedingRates([wallet('b', 'EUR')], s)).toEqual([])
  })

  it('treats a non-positive rate as no rate', () => {
    expect(currenciesNeedingRates([wallet('b', 'EUR')], settings({ rates: { EUR: 0 } }))).toEqual([
      'EUR',
    ])
    expect(currenciesNeedingRates([wallet('b', 'EUR')], settings({ rates: { EUR: -2 } }))).toEqual([
      'EUR',
    ])
  })

  it('reports each currency once, however many wallets hold it', () => {
    const wallets = [wallet('a', 'EUR'), wallet('b', 'EUR'), wallet('c', 'GBP')]
    expect(currenciesNeedingRates(wallets, settings())).toEqual(['EUR', 'GBP'])
  })

  it('asks about holdings, not about the shortlist', () => {
    // GBP is on the picker shortlist but no wallet holds it, so no rate is needed for it.
    const s = settings({ activeCurrencies: ['USD', 'GBP'] })
    expect(currenciesNeedingRates([wallet('a', 'USD')], s)).toEqual([])
  })

  it('has nothing to report with no wallets', () => {
    expect(currenciesNeedingRates([], settings())).toEqual([])
  })
})

describe('parseRate', () => {
  it('reads a decimal rate', () => {
    expect(parseRate('1.08')).toBe(1.08)
    expect(parseRate('150')).toBe(150)
  })

  it('accepts a comma decimal mark, which is what most phone keyboards offer', () => {
    expect(parseRate('1,08')).toBe(1.08)
  })

  it('returns null for anything unusable rather than a NaN that would reach stored money', () => {
    expect(parseRate('')).toBeNull()
    expect(parseRate('   ')).toBeNull()
    expect(parseRate('abc')).toBeNull()
    expect(parseRate('0')).toBeNull()
    expect(parseRate('-1')).toBeNull()
    expect(parseRate('Infinity')).toBeNull()
  })
})
