import { describe, expect, it } from 'vitest'

import { POPULAR_CURRENCY_CODES } from '@/domain/currency'

import { favouriteDefs, isSearching, popularDefs } from './utils'

describe('isSearching', () => {
  it('is false while the box is empty or only whitespace', () => {
    expect(isSearching('')).toBe(false)
    expect(isSearching('   ')).toBe(false)
  })

  it('is true once something is typed', () => {
    expect(isSearching('eu')).toBe(true)
  })
})

describe('favouriteDefs', () => {
  it('resolves codes to definitions, in the order given', () => {
    expect(favouriteDefs(['EUR', 'USD']).map((d) => d.code)).toEqual(['EUR', 'USD'])
  })

  it('carries the precision through, which is why a JPY amount refuses cents', () => {
    const [jpy] = favouriteDefs(['JPY'])
    expect(jpy.decimals).toBe(0)
  })

  it('drops a code this build does not know rather than rendering a blank row', () => {
    // A shortlist restored from a backup written by a newer version could name one.
    expect(favouriteDefs(['USD', 'XYZ' as never]).map((d) => d.code)).toEqual(['USD'])
  })

  it('handles an absent list', () => {
    expect(favouriteDefs()).toEqual([])
    expect(favouriteDefs([])).toEqual([])
  })
})

describe('popularDefs', () => {
  it('offers the popular shortlist when the user has none of their own', () => {
    expect(popularDefs().map((d) => d.code)).toEqual([...POPULAR_CURRENCY_CODES])
  })

  it('omits anything already listed as one of the user’s own', () => {
    // A currency appearing twice in a picker reads as a bug even when it is harmless.
    const codes = popularDefs(['USD', 'EUR']).map((d) => d.code)
    expect(codes).not.toContain('USD')
    expect(codes).not.toContain('EUR')
  })

  it('keeps the rest of the shortlist intact', () => {
    const codes = popularDefs(['USD']).map((d) => d.code)
    expect(codes).toEqual(POPULAR_CURRENCY_CODES.filter((c) => c !== 'USD'))
  })
})
