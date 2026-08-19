import { describe, expect, it } from 'vitest'

import { isPositiveAmount, parsePositiveAmount } from './money'

describe('parsePositiveAmount', () => {
  it('parses an amount at the currency’s precision', () => {
    expect(parsePositiveAmount('12.34', 'USD')).toEqual({ minor: 1234, currency: 'USD' })
    expect(parsePositiveAmount('100', 'JPY')).toEqual({ minor: 100, currency: 'JPY' })
  })

  it('accepts a comma decimal mark', () => {
    expect(parsePositiveAmount('12,34', 'USD')).toEqual({ minor: 1234, currency: 'USD' })
  })

  it('rejects zero — the rule the five copies existed to enforce', () => {
    expect(parsePositiveAmount('0', 'USD')).toBeNull()
    expect(parsePositiveAmount('0.00', 'USD')).toBeNull()
  })

  it('rejects a negative amount: direction comes from the type, not the sign', () => {
    expect(parsePositiveAmount('-5', 'USD')).toBeNull()
  })

  it('rejects text that is not an amount', () => {
    expect(parsePositiveAmount('', 'USD')).toBeNull()
    expect(parsePositiveAmount('   ', 'USD')).toBeNull()
    expect(parsePositiveAmount('abc', 'USD')).toBeNull()
  })
})

describe('isPositiveAmount', () => {
  it('agrees with the parser', () => {
    expect(isPositiveAmount('1', 'USD')).toBe(true)
    expect(isPositiveAmount('0', 'USD')).toBe(false)
    expect(isPositiveAmount('', 'USD')).toBe(false)
  })
})
