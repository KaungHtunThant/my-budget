import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { Settings, Wallet } from '@/domain/types'

import {
  type AmountEntry,
  currenciesNeedingRates,
  entryIsComplete,
  entryNeedsRate,
  parseRate,
  rateTextOf,
  resolveEntry,
} from './fx'

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

const entry = (overrides: Partial<AmountEntry> = {}): AmountEntry => ({
  amountText: '100',
  entryCurrency: 'USD',
  targetCurrency: 'USD',
  rateText: '',
  ...overrides,
})

describe('entryNeedsRate', () => {
  it('is false when the amount was typed in the currency the record stores', () => {
    expect(entryNeedsRate(entry())).toBe(false)
  })

  it('is true as soon as the two differ', () => {
    expect(entryNeedsRate(entry({ targetCurrency: 'MMK' }))).toBe(true)
  })
})

describe('resolveEntry', () => {
  it('passes a same-currency amount through with no snapshot to store', () => {
    expect(resolveEntry(entry({ amountText: '12.50' }))).toEqual({
      entered: { minor: 1250, currency: 'USD' },
      amount: { minor: 1250, currency: 'USD' },
      fx: null,
      rateOk: true,
    })
  })

  it('converts at the typed rate and freezes what was typed', () => {
    const resolved = resolveEntry(entry({ targetCurrency: 'MMK', rateText: '4400' }))
    expect(resolved).toEqual({
      entered: { minor: 10000, currency: 'USD' },
      amount: { minor: 44000000, currency: 'MMK' },
      fx: { enteredAmount: { minor: 10000, currency: 'USD' }, rate: 4400 },
      rateOk: true,
    })
  })

  it('rescales across currencies of different precision', () => {
    // 100.00 USD at 150 is 15,000 JPY, not 150.00 — JPY has no minor unit.
    const resolved = resolveEntry(entry({ targetCurrency: 'JPY', rateText: '150' }))
    expect(resolved?.amount).toEqual({ minor: 15000, currency: 'JPY' })
  })

  it('keeps the entered amount but withholds the converted one while the rate is missing', () => {
    // The form still shows what was typed rather than blanking as the user reaches for the rate.
    expect(resolveEntry(entry({ targetCurrency: 'MMK' }))).toEqual({
      entered: { minor: 10000, currency: 'USD' },
      amount: null,
      fx: null,
      rateOk: false,
    })
  })

  it('treats an unusable rate as a missing one', () => {
    expect(resolveEntry(entry({ targetCurrency: 'MMK', rateText: '0' }))?.rateOk).toBe(false)
    expect(resolveEntry(entry({ targetCurrency: 'MMK', rateText: 'abc' }))?.rateOk).toBe(false)
  })

  it('reads a comma decimal mark in both fields', () => {
    const resolved = resolveEntry(
      entry({ amountText: '12,50', targetCurrency: 'MMK', rateText: '4400,5' }),
    )
    expect(resolved?.entered).toEqual({ minor: 1250, currency: 'USD' })
    expect(resolved?.fx?.rate).toBe(4400.5)
  })

  it('is null only when the amount itself cannot be read', () => {
    expect(resolveEntry(entry({ amountText: '' }))).toBeNull()
    expect(resolveEntry(entry({ amountText: 'abc' }))).toBeNull()
  })
})

describe('entryIsComplete', () => {
  it('accepts a positive same-currency amount', () => {
    expect(entryIsComplete(entry())).toBe(true)
  })

  it('rejects zero, which is not a thing worth recording', () => {
    expect(entryIsComplete(entry({ amountText: '0' }))).toBe(false)
  })

  it('rejects a cross-currency amount until a rate is given', () => {
    expect(entryIsComplete(entry({ targetCurrency: 'MMK' }))).toBe(false)
    expect(entryIsComplete(entry({ targetCurrency: 'MMK', rateText: '4400' }))).toBe(true)
  })
})

describe('rateTextOf', () => {
  it('returns the frozen rate verbatim', () => {
    expect(rateTextOf({ enteredAmount: { minor: 10000, currency: 'USD' }, rate: 4400 })).toBe('4400')
  })

  it('is empty for a record that never crossed currencies', () => {
    expect(rateTextOf(null)).toBe('')
    expect(rateTextOf(undefined)).toBe('')
  })
})
