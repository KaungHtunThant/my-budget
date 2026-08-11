import { describe, expect, it } from 'vitest'
import {
  add,
  fromMajor,
  money,
  multiply,
  parseMoney,
  percentOf,
  splitEvenly,
  subtract,
  sum,
  toDecimalString,
  toFloat,
  zero,
} from './money'

describe('money construction', () => {
  it('rejects non-integer minor units', () => {
    expect(() => money(10.5, 'USD')).toThrow(/integer/)
  })

  it('builds from major units at the currency precision', () => {
    expect(fromMajor(12.34, 'USD')).toEqual({ minor: 1234, currency: 'USD' })
    expect(fromMajor(1234, 'JPY')).toEqual({ minor: 1234, currency: 'JPY' })
    expect(fromMajor(1.234, 'KWD')).toEqual({ minor: 1234, currency: 'KWD' })
  })
})

describe('arithmetic', () => {
  it('adds and subtracts within a currency', () => {
    expect(add(fromMajor(10, 'USD'), fromMajor(2.5, 'USD')).minor).toBe(1250)
    expect(subtract(fromMajor(10, 'USD'), fromMajor(2.5, 'USD')).minor).toBe(750)
  })

  it('refuses to mix currencies', () => {
    expect(() => add(fromMajor(10, 'USD'), fromMajor(10, 'EUR'))).toThrow(/convert/)
    expect(() => sum([fromMajor(1, 'EUR')], 'USD')).toThrow(/conversion/)
  })

  it('sums an empty list to zero in the stated currency', () => {
    expect(sum([], 'JPY')).toEqual(zero('JPY'))
  })

  it('avoids the classic float error', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in minor units it is exact.
    const total = add(fromMajor(0.1, 'USD'), fromMajor(0.2, 'USD'))
    expect(total.minor).toBe(30)
    expect(toDecimalString(total)).toBe('0.30')
  })

  it('computes percentages and multiples', () => {
    expect(percentOf(fromMajor(3066, 'USD'), 10).minor).toBe(30_660)
    expect(multiply(fromMajor(15.99, 'USD'), 3).minor).toBe(4797)
  })
})

describe('splitEvenly', () => {
  it('distributes the remainder without losing minor units', () => {
    const parts = splitEvenly(money(100, 'USD'), 3)
    expect(parts.map((p) => p.minor)).toEqual([34, 33, 33])
    expect(sum(parts, 'USD').minor).toBe(100)
  })

  it('handles negative amounts symmetrically', () => {
    const parts = splitEvenly(money(-100, 'USD'), 3)
    expect(sum(parts, 'USD').minor).toBe(-100)
  })

  it('rejects a non-positive part count', () => {
    expect(() => splitEvenly(money(100, 'USD'), 0)).toThrow()
  })
})

describe('parseMoney', () => {
  it('parses plain decimals', () => {
    expect(parseMoney('12.34', 'USD')?.minor).toBe(1234)
    expect(parseMoney('  7 ', 'USD')?.minor).toBe(700)
  })

  it('honours currency precision', () => {
    expect(parseMoney('1234', 'JPY')?.minor).toBe(1234)
    // A JPY amount has no minor unit, so fractions round away.
    expect(parseMoney('1234.6', 'JPY')?.minor).toBe(1235)
    expect(parseMoney('1.234', 'KWD')?.minor).toBe(1234)
  })

  it('rounds rather than truncates excess precision', () => {
    expect(parseMoney('1.005', 'USD')?.minor).toBe(101)
    expect(parseMoney('1.004', 'USD')?.minor).toBe(100)
  })

  it('accepts comma decimal marks and grouped digits', () => {
    expect(parseMoney('1234,56', 'USD')?.minor).toBe(123_456)
    expect(parseMoney('1,234.56', 'USD')?.minor).toBe(123_456)
    expect(parseMoney('1.234,56', 'USD')?.minor).toBe(123_456)
  })

  it('strips currency symbols', () => {
    expect(parseMoney('$1,999.99', 'USD')?.minor).toBe(199_999)
    expect(parseMoney('€45', 'EUR')?.minor).toBe(4500)
  })

  it('reads a leading minus or bracket as negative', () => {
    expect(parseMoney('-12.34', 'USD')?.minor).toBe(-1234)
    expect(parseMoney('(12.34)', 'USD')?.minor).toBe(-1234)
  })

  it('returns null for unparseable input', () => {
    expect(parseMoney('', 'USD')).toBeNull()
    expect(parseMoney('   ', 'USD')).toBeNull()
    expect(parseMoney('abc', 'USD')).toBeNull()
  })
})

describe('display conversions', () => {
  it('renders decimals at the currency precision', () => {
    expect(toDecimalString(money(1234, 'USD'))).toBe('12.34')
    expect(toDecimalString(money(1234, 'JPY'))).toBe('1234')
    expect(toDecimalString(money(1234, 'KWD'))).toBe('1.234')
    expect(toDecimalString(money(-5, 'USD'))).toBe('-0.05')
  })

  it('round-trips through float for display', () => {
    expect(toFloat(money(1234, 'USD'))).toBe(12.34)
    expect(toFloat(money(1234, 'JPY'))).toBe(1234)
  })
})
