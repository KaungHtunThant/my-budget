import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import { convert } from '@/domain/fx'
import type { Money } from '@/domain/money'
import { DEFAULT_PERIOD_CONFIG } from '@/domain/period'
import type { EnteredFx, Settings, Wallet } from '@/domain/types'

import {
  type AmountEntry,
  type ConversionInput,
  convertedTextOf,
  currenciesNeedingRates,
  entryIsComplete,
  entryNeedsRate,
  parseRate,
  rateTextOf,
  resolveConversion,
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
  budgetsRolledInto: null,
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
  fxMode: 'rate',
  rateText: '',
  convertedText: '',
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

describe('resolveConversion', () => {
  const vnd = (minor: number): Money => ({ minor, currency: 'VND' })
  const input = (overrides: Partial<ConversionInput> = {}): ConversionInput => ({
    fxMode: 'amount',
    rateText: '',
    convertedText: '',
    ...overrides,
  })

  it('stores the typed amount exactly and implies the rate from it', () => {
    // The case that prompted the mode: 100,000 VND paid, 14.50 AED off the statement.
    const result = resolveConversion(vnd(100_000), 'AED', input({ convertedText: '14.50' }))
    expect(result!.amount).toEqual({ minor: 1450, currency: 'AED' })
    expect(result!.rate).toBeCloseTo(0.000145, 12)
  })

  it('accepts a comma decimal mark in the amount', () => {
    const result = resolveConversion(vnd(100_000), 'AED', input({ convertedText: '14,50' }))
    expect(result!.amount.minor).toBe(1450)
  })

  it('gives nothing for a blank, junk or non-positive amount', () => {
    for (const convertedText of ['', '  ', 'abc', '0', '-3']) {
      expect(resolveConversion(vnd(100_000), 'AED', input({ convertedText }))).toBeNull()
    }
  })

  it('gives nothing, rather than throwing, when the entered amount is zero', () => {
    expect(resolveConversion(vnd(0), 'AED', input({ convertedText: '14.50' }))).toBeNull()
  })

  it('reads only the field the mode names', () => {
    const both = { rateText: '0.0002', convertedText: '14.50' }
    expect(resolveConversion(vnd(100_000), 'AED', input({ ...both }))!.amount.minor).toBe(1450)
    expect(
      resolveConversion(vnd(100_000), 'AED', input({ ...both, fxMode: 'rate' }))!.amount.minor,
    ).toBe(2000)
    expect(resolveConversion(vnd(100_000), 'AED', input({ rateText: '0.0002' }))).toBeNull()
  })

  it('implies a rate that converts back to the typed amount, across precisions', () => {
    // A stored record re-resolved in rate mode (as `rateTextOf` hands it back) must land on the
    // same minor units, whichever way the decimals differ.
    const cases: [Money, CurrencyCode, string][] = [
      [vnd(100_000), 'AED', '14.50'],
      [{ minor: 1450, currency: 'AED' }, 'VND', '100000'],
      [{ minor: 999, currency: 'USD' }, 'KWD', '3.071'],
      [{ minor: 3071, currency: 'KWD' }, 'JPY', '1543'],
      [{ minor: 12_345, currency: 'JPY' }, 'USD', '83.17'],
    ]
    for (const [entered, target, convertedText] of cases) {
      const { amount, rate } = resolveConversion(entered, target, input({ convertedText }))!
      expect(convert(entered, target, rate)).toEqual(amount)
      const reread = resolveConversion(entered, target, input({ fxMode: 'rate', rateText: String(rate) }))
      expect(reread!.amount).toEqual(amount)
    }
  })
})

describe('resolveEntry in amount mode', () => {
  it('freezes the implied rate beside the typed amount', () => {
    const resolved = resolveEntry(
      entry({
        amountText: '100000',
        entryCurrency: 'VND',
        targetCurrency: 'AED',
        fxMode: 'amount',
        convertedText: '14.50',
      }),
    )
    expect(resolved!.amount).toEqual({ minor: 1450, currency: 'AED' })
    expect(resolved!.fx!.enteredAmount).toEqual({ minor: 100_000, currency: 'VND' })
    expect(resolved!.fx!.rate).toBeCloseTo(0.000145, 12)
    expect(resolved!.rateOk).toBe(true)
  })

  it('keeps showing the entered amount while the converted one is missing', () => {
    const resolved = resolveEntry(
      entry({ entryCurrency: 'EUR', targetCurrency: 'USD', fxMode: 'amount' }),
    )
    expect(resolved).toMatchObject({ amount: null, fx: null, rateOk: false })
    expect(resolved!.entered).toEqual({ minor: 10000, currency: 'EUR' })
  })

  it('ignores the converted text when nothing crosses currencies', () => {
    const resolved = resolveEntry(entry({ fxMode: 'amount', convertedText: '1' }))
    expect(resolved).toMatchObject({ amount: { minor: 10000, currency: 'USD' }, fx: null })
  })
})

describe('convertedTextOf', () => {
  const vndAmount: Money = { minor: 100_000, currency: 'VND' }
  it('is the stored amount when the record crossed currencies, and empty otherwise', () => {
    const fx: EnteredFx = { enteredAmount: vndAmount, rate: 0.000145 }
    expect(convertedTextOf(fx, { minor: 1450, currency: 'AED' })).toBe('14.50')
    expect(convertedTextOf(null, { minor: 1450, currency: 'AED' })).toBe('')
    expect(convertedTextOf(undefined, { minor: 1450, currency: 'AED' })).toBe('')
  })
})
