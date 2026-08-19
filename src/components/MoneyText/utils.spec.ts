import { describe, expect, it } from 'vitest'

import { moneyText, moneyTone } from './utils'

const usd = (minor: number) => ({ minor, currency: 'USD' as const })

describe('moneyText', () => {
  it('formats at the currency’s precision by default', () => {
    expect(moneyText(usd(123456))).toBe('$1,234.56')
  })

  it('can show an explicit sign', () => {
    expect(moneyText(usd(1000), { signed: true })).toBe('+$10.00')
  })

  it('can show the currency code', () => {
    expect(moneyText(usd(1000), { showCode: true })).toContain('USD')
  })

  it('abbreviates when compact', () => {
    expect(moneyText(usd(123456), { compact: true })).toBe('$1.2k')
  })

  it('lets compact win, since an abbreviated figure has no room for the extras', () => {
    expect(moneyText(usd(123456), { compact: true, signed: true, showCode: true })).toBe('$1.2k')
  })
})

describe('moneyTone', () => {
  it('is blank unless colouring was asked for', () => {
    expect(moneyTone(usd(1000))).toBe('')
    expect(moneyTone(usd(-1000))).toBe('')
  })

  it('colours by sign when asked', () => {
    expect(moneyTone(usd(1000), { colored: true })).toBe('tone-positive')
    expect(moneyTone(usd(-1000), { colored: true })).toBe('tone-negative')
  })

  it('never colours zero — nothing spent is not bad news', () => {
    expect(moneyTone(usd(0), { colored: true })).toBe('')
    expect(moneyTone(usd(0), { colored: true, negativeMeaning: true })).toBe('')
  })

  it('reads any non-zero value as negative when the figure means a reduction', () => {
    // Expense totals are stored positive, so their sign says nothing about direction.
    expect(moneyTone(usd(1000), { colored: true, negativeMeaning: true })).toBe('tone-negative')
    expect(moneyTone(usd(-1000), { colored: true, negativeMeaning: true })).toBe('tone-negative')
  })
})
