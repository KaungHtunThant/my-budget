import { describe, expect, it } from 'vitest'
import { convert, convertWithSnapshot, impliedRate, inverseRate, totalInBase } from './fx'
import { fromMajor, money } from './money'

describe('convert', () => {
  it('applies the rate as "1 from = rate to"', () => {
    // 100 USD at 4400 MMK per USD
    expect(convert(fromMajor(100, 'USD'), 'MMK', 4400)).toEqual(fromMajor(440_000, 'MMK'))
  })

  it('returns the amount untouched when currencies match', () => {
    const usd = fromMajor(50, 'USD')
    expect(convert(usd, 'USD', 999)).toBe(usd)
  })

  it('rescales across differing precisions', () => {
    // 1000 JPY (0 decimals) to USD (2 decimals) at 0.0067
    expect(convert(money(1000, 'JPY'), 'USD', 0.0067).minor).toBe(670)
    // 10 USD (2 decimals) to KWD (3 decimals) at 0.31
    expect(convert(fromMajor(10, 'USD'), 'KWD', 0.31).minor).toBe(3100)
  })

  it('rejects a non-positive or non-finite rate', () => {
    expect(() => convert(fromMajor(1, 'USD'), 'EUR', 0)).toThrow()
    expect(() => convert(fromMajor(1, 'USD'), 'EUR', -1)).toThrow()
    expect(() => convert(fromMajor(1, 'USD'), 'EUR', Number.NaN)).toThrow()
  })
})

describe('snapshots', () => {
  it('records the original amount, the result and the rate', () => {
    const snap = convertWithSnapshot(fromMajor(60, 'EUR'), 'USD', 1.08)
    expect(snap.original).toEqual(fromMajor(60, 'EUR'))
    expect(snap.converted).toEqual(fromMajor(64.8, 'USD'))
    expect(snap.rate).toBe(1.08)
  })

  it('a stored snapshot is unaffected by a later rate change', () => {
    const snap = convertWithSnapshot(fromMajor(100, 'USD'), 'MMK', 4400)
    // A newer rate is used elsewhere; the historical record must not move.
    convert(fromMajor(100, 'USD'), 'MMK', 5200)
    expect(snap.converted).toEqual(fromMajor(440_000, 'MMK'))
    expect(snap.rate).toBe(4400)
  })
})

describe('rate helpers', () => {
  it('inverts a rate', () => {
    expect(inverseRate(4)).toBe(0.25)
  })

  it('derives a rate from a pair of amounts', () => {
    expect(impliedRate(fromMajor(100, 'USD'), fromMajor(440_000, 'MMK'))).toBe(4400)
  })

  it('refuses to derive a rate from a zero amount', () => {
    expect(() => impliedRate(fromMajor(0, 'USD'), fromMajor(10, 'EUR'))).toThrow()
  })
})

describe('totalInBase', () => {
  it('sums mixed currencies using supplied rates', () => {
    const result = totalInBase(
      [fromMajor(100, 'USD'), fromMajor(50, 'EUR'), fromMajor(10_000, 'JPY')],
      'USD',
      { EUR: 1.08, JPY: 0.0067 },
    )
    expect(result.total.minor).toBe(10_000 + 5400 + 6700)
    expect(result.missing).toEqual([])
  })

  it('reports currencies it could not convert instead of understating silently', () => {
    const result = totalInBase([fromMajor(100, 'USD'), fromMajor(50, 'CHF')], 'USD', {})
    expect(result.total).toEqual(fromMajor(100, 'USD'))
    expect(result.missing).toEqual(['CHF'])
  })
})
