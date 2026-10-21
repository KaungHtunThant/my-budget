import { describe, expect, it } from 'vitest'

import { convertedLabel, missingConversionMessage } from './utils'

describe('convertedLabel', () => {
  it('says what left the wallet on an expense', () => {
    expect(convertedLabel('expense', 'AED', 'Cash', null)).toBe('AED deducted from Cash')
  })

  it('says what arrived on income', () => {
    expect(convertedLabel('income', 'AED', 'Cash', null)).toBe('AED received in Cash')
  })

  it('names the destination on a transfer, not the source', () => {
    expect(convertedLabel('transfer', 'VND', 'Cash', 'Travel')).toBe('VND received in Travel')
  })

  it('still reads before a wallet is chosen', () => {
    expect(convertedLabel('expense', 'AED', null, null)).toBe('AED deducted')
    expect(convertedLabel('income', 'AED', null, null)).toBe('AED received')
    expect(convertedLabel('transfer', 'VND', 'Cash', null)).toBe('VND received')
  })
})

describe('missingConversionMessage', () => {
  it('asks for the amount in amount mode and the rate in rate mode', () => {
    expect(missingConversionMessage('amount', 'AED')).toBe('Enter how much AED that came to.')
    expect(missingConversionMessage('rate', 'AED')).toBe('Enter the exchange rate you used.')
  })
})
