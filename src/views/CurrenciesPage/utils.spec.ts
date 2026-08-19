import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { Settings, Wallet } from '@/domain/types'

import {
  canRemoveCurrency,
  currenciesInUse,
  otherCurrencies,
  ratePreview,
  rateDrafts,
} from './utils'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  baseCurrency: 'USD',
  activeCurrencies: ['USD', 'EUR', 'JPY'],
  rates: { EUR: 1.08 },
  budgetPeriod: DEFAULT_PERIOD_CONFIG,
  theme: 'system',
  appLockEnabled: false,
  onboardingComplete: true,
  ...overrides,
})

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

describe('otherCurrencies', () => {
  it('excludes base, which has no rate against itself', () => {
    expect(otherCurrencies(settings())).toEqual(['EUR', 'JPY'])
  })

  it('is empty for a single-currency setup', () => {
    expect(otherCurrencies(settings({ activeCurrencies: ['USD'] }))).toEqual([])
  })
})

describe('currenciesInUse', () => {
  it('reports each currency held by a wallet, once', () => {
    const wallets = [wallet('a', 'USD'), wallet('b', 'EUR'), wallet('c', 'EUR')]
    expect([...currenciesInUse(wallets)]).toEqual(['USD', 'EUR'])
  })

  it('is empty with no wallets', () => {
    expect(currenciesInUse([]).size).toBe(0)
  })
})

describe('canRemoveCurrency', () => {
  it('allows removing a currency nothing holds', () => {
    expect(canRemoveCurrency('JPY', new Set<CurrencyCode>(['USD']))).toBe(true)
  })

  it('refuses while a wallet still holds it', () => {
    // Removing it would leave that wallet unconvertible and silently drop it from every total.
    expect(canRemoveCurrency('EUR', new Set<CurrencyCode>(['USD', 'EUR']))).toBe(false)
  })
})

describe('rateDrafts', () => {
  it('seeds a field per currency from the saved rate', () => {
    expect(rateDrafts(['EUR'], { EUR: 1.08 })).toEqual({ EUR: '1.08' })
  })

  it('leaves an unset rate blank rather than showing zero', () => {
    // "0" would read as a rate of zero; empty reads as not yet entered.
    expect(rateDrafts(['JPY'], {})).toEqual({ JPY: '' })
  })

  it('covers every requested currency', () => {
    expect(Object.keys(rateDrafts(['EUR', 'JPY'], { EUR: 1.08 }))).toEqual(['EUR', 'JPY'])
  })
})

describe('ratePreview', () => {
  it('shows the sample conversion for the typed rate', () => {
    expect(ratePreview('EUR', 'USD', '1.08')).toBe('€100.00 = $108.00')
  })

  it('accepts a comma decimal mark, as the rate field does', () => {
    expect(ratePreview('EUR', 'USD', '1,08')).toBe('€100.00 = $108.00')
  })

  it('respects the target currency’s precision', () => {
    expect(ratePreview('USD', 'JPY', '150')).toBe('$100.00 = ¥15,000')
  })

  it('is null while the rate is unusable, so nothing misleading is shown', () => {
    expect(ratePreview('EUR', 'USD', '')).toBeNull()
    expect(ratePreview('EUR', 'USD', '0')).toBeNull()
    expect(ratePreview('EUR', 'USD', 'abc')).toBeNull()
  })
})
