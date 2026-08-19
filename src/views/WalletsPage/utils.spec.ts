import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import type { Money } from '@/domain/money'
import type { Id, Wallet, WalletKind } from '@/domain/types'

import { balancesByCurrency, canSaveWallet, iconForKind, openingBalance } from './utils'

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

const KINDS: { value: WalletKind; icon: string }[] = [
  { value: 'bank', icon: 'business-outline' },
  { value: 'cash', icon: 'cash-outline' },
]

describe('balancesByCurrency', () => {
  const balances: Record<Id, Money> = {
    a: { minor: 10000, currency: 'USD' },
    b: { minor: 2500, currency: 'USD' },
    c: { minor: 5000, currency: 'EUR' },
  }

  it('totals and counts the wallets in each currency', () => {
    const groups = balancesByCurrency(
      [wallet('a', 'USD'), wallet('b', 'USD'), wallet('c', 'EUR')],
      balances,
    )
    expect(groups).toEqual([
      { code: 'USD', total: { minor: 12500, currency: 'USD' }, count: 2 },
      { code: 'EUR', total: { minor: 5000, currency: 'EUR' }, count: 1 },
    ])
  })

  it('never converts between currencies — each group stays in its own', () => {
    const groups = balancesByCurrency([wallet('a', 'USD'), wallet('c', 'EUR')], balances)
    expect(groups.map((g) => g.total.currency)).toEqual(['USD', 'EUR'])
  })

  it('counts a wallet with no cached balance as zero, not as absent', () => {
    const groups = balancesByCurrency([wallet('a', 'USD'), wallet('missing', 'USD')], balances)
    expect(groups).toEqual([{ code: 'USD', total: { minor: 10000, currency: 'USD' }, count: 2 }])
  })

  it('keeps the order wallets first appear in', () => {
    const groups = balancesByCurrency([wallet('c', 'EUR'), wallet('a', 'USD')], balances)
    expect(groups.map((g) => g.code)).toEqual(['EUR', 'USD'])
  })

  it('has nothing to group with no wallets', () => {
    expect(balancesByCurrency([], {})).toEqual([])
  })
})

describe('iconForKind', () => {
  it('finds the glyph for a kind', () => {
    expect(iconForKind('cash', KINDS)).toBe('cash-outline')
  })

  it('falls back rather than rendering nothing for an unlisted kind', () => {
    expect(iconForKind('other', KINDS)).toBe('wallet-outline')
  })
})

describe('canSaveWallet', () => {
  it('needs a name with something in it', () => {
    expect(canSaveWallet('Cash')).toBe(true)
    expect(canSaveWallet('')).toBe(false)
    expect(canSaveWallet('   ')).toBe(false)
  })
})

describe('openingBalance', () => {
  it('parses what was typed', () => {
    expect(openingBalance('120.50', 'USD')).toEqual({ minor: 12050, currency: 'USD' })
  })

  it('treats a blank field as zero', () => {
    expect(openingBalance('', 'USD')).toEqual({ minor: 0, currency: 'USD' })
    expect(openingBalance('   ', 'USD')).toEqual({ minor: 0, currency: 'USD' })
  })

  it('accepts zero and negative, unlike an amount on a transaction', () => {
    // A negative opening balance is how an overdraft or a credit card is entered, so this
    // deliberately does not go through parsePositiveAmount.
    expect(openingBalance('0', 'USD')).toEqual({ minor: 0, currency: 'USD' })
    expect(openingBalance('-250', 'USD')).toEqual({ minor: -25000, currency: 'USD' })
  })
})
