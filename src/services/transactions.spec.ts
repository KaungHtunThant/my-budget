import { describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/domain/currency'
import { impliedRate } from '@/domain/fx'
import type { Transaction, Wallet } from '@/domain/types'

import {
  type TransactionDraft,
  buildTransaction,
  canSaveDraft,
  needsRate,
  rateFrom,
  rateTextFor,
  rateTo,
  resolveDraft,
  walletCurrency,
} from './transactions'

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

const WALLETS = [wallet('usd', 'USD'), wallet('eur', 'EUR'), wallet('jpy', 'JPY')]

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: 'expense',
  base: 'USD',
  walletId: 'usd',
  toWalletId: null,
  categoryId: 'cat_1',
  amountText: '100',
  entryCurrency: 'USD',
  rateText: '',
  date: '2026-08-20',
  note: '',
  recurringRuleId: null,
  goalId: null,
  ...overrides,
})

describe('walletCurrency', () => {
  it('is the chosen wallet’s currency', () => {
    expect(walletCurrency(draft({ walletId: 'eur' }), WALLETS)).toBe('EUR')
  })

  it('falls back to base before a wallet is chosen', () => {
    expect(walletCurrency(draft({ walletId: null }), WALLETS)).toBe('USD')
  })
})

describe('needsRate', () => {
  it('is false when an amount is entered in the wallet’s own currency', () => {
    expect(needsRate(draft({ walletId: 'usd', entryCurrency: 'USD' }), WALLETS)).toBe(false)
  })

  it('is true when an expense is entered in a foreign currency', () => {
    expect(needsRate(draft({ walletId: 'usd', entryCurrency: 'EUR' }), WALLETS)).toBe(true)
  })

  it('is true for income entered in a foreign currency', () => {
    const d = draft({ type: 'income', walletId: 'usd', entryCurrency: 'EUR' })
    expect(needsRate(d, WALLETS)).toBe(true)
  })

  it('is false for a transfer between wallets of the same currency', () => {
    const same = [wallet('a', 'USD'), wallet('b', 'USD')]
    const d = draft({ type: 'transfer', walletId: 'a', toWalletId: 'b' })
    expect(needsRate(d, same)).toBe(false)
  })

  it('is true for a transfer across currencies', () => {
    const d = draft({ type: 'transfer', walletId: 'usd', toWalletId: 'jpy' })
    expect(needsRate(d, WALLETS)).toBe(true)
  })

  it('cannot say yet when a transfer has only one wallet chosen', () => {
    const d = draft({ type: 'transfer', walletId: 'usd', toWalletId: null })
    expect(needsRate(d, WALLETS)).toBe(false)
  })

  it('ignores the entry currency on a transfer, which is driven by the two wallets', () => {
    const same = [wallet('a', 'USD'), wallet('b', 'USD')]
    const d = draft({ type: 'transfer', walletId: 'a', toWalletId: 'b', entryCurrency: 'EUR' })
    expect(needsRate(d, same)).toBe(false)
  })
})

describe('rateFrom / rateTo', () => {
  it('reads entry -> wallet for income and expense', () => {
    const d = draft({ walletId: 'usd', entryCurrency: 'EUR' })
    expect([rateFrom(d, WALLETS), rateTo(d, WALLETS)]).toEqual(['EUR', 'USD'])
  })

  it('reads source wallet -> destination wallet for a transfer', () => {
    const d = draft({ type: 'transfer', walletId: 'usd', toWalletId: 'jpy' })
    expect([rateFrom(d, WALLETS), rateTo(d, WALLETS)]).toEqual(['USD', 'JPY'])
  })
})

describe('resolveDraft', () => {
  it('returns null only when the amount cannot be parsed', () => {
    expect(resolveDraft(draft({ amountText: '' }), WALLETS)).toBeNull()
    expect(resolveDraft(draft({ amountText: 'abc' }), WALLETS)).toBeNull()
  })

  it('parses at the currency the amount was typed in', () => {
    const resolved = resolveDraft(draft({ amountText: '12,34' }), WALLETS)
    expect(resolved!.entered).toEqual({ minor: 1234, currency: 'USD' })
  })

  it('passes a same-currency amount straight through', () => {
    const resolved = resolveDraft(draft({ amountText: '100' }), WALLETS)
    expect(resolved).toMatchObject({
      entered: { minor: 10000, currency: 'USD' },
      amount: { minor: 10000, currency: 'USD' },
      toAmount: null,
      fx: null,
      rateOk: true,
    })
  })

  it('converts a foreign expense into the wallet’s currency and freezes the rate', () => {
    const d = draft({ walletId: 'usd', entryCurrency: 'EUR', amountText: '100', rateText: '1.1' })
    const resolved = resolveDraft(d, WALLETS)
    expect(resolved).toMatchObject({
      entered: { minor: 10000, currency: 'EUR' },
      amount: { minor: 11000, currency: 'USD' },
      fx: { enteredAmount: { minor: 10000, currency: 'EUR' }, rate: 1.1 },
      rateOk: true,
    })
  })

  it('rescales across differing decimal counts', () => {
    // 100 USD at 150 JPY per USD is 15,000 JPY — and JPY has no minor unit.
    const d = draft({ walletId: 'jpy', entryCurrency: 'USD', amountText: '100', rateText: '150' })
    const resolved = resolveDraft(d, WALLETS)
    expect(resolved!.amount).toEqual({ minor: 15000, currency: 'JPY' })
  })

  it('flags an unusable rate without blanking the entered amount', () => {
    const d = draft({ walletId: 'usd', entryCurrency: 'EUR', amountText: '100', rateText: '' })
    const resolved = resolveDraft(d, WALLETS)
    expect(resolved).toMatchObject({
      entered: { minor: 10000, currency: 'EUR' },
      amount: null,
      rateOk: false,
    })
  })

  it('leaves a transfer’s own amount in the source wallet’s currency', () => {
    const d = draft({
      type: 'transfer',
      walletId: 'usd',
      toWalletId: 'jpy',
      amountText: '100',
      rateText: '150',
    })
    const resolved = resolveDraft(d, WALLETS)
    expect(resolved).toMatchObject({
      amount: { minor: 10000, currency: 'USD' },
      toAmount: { minor: 15000, currency: 'JPY' },
      fx: null,
      rateOk: true,
    })
  })

  it('never stores an fx snapshot on a transfer — the rate lives in the two amounts', () => {
    const d = draft({
      type: 'transfer',
      walletId: 'usd',
      toWalletId: 'jpy',
      amountText: '100',
      rateText: '150',
    })
    expect(resolveDraft(d, WALLETS)!.fx).toBeNull()
  })

  it('credits a same-currency transfer with the identical amount', () => {
    const same = [wallet('a', 'USD'), wallet('b', 'USD')]
    const d = draft({ type: 'transfer', walletId: 'a', toWalletId: 'b', amountText: '50' })
    const resolved = resolveDraft(d, same)
    expect(resolved!.toAmount).toEqual(resolved!.amount)
  })
})

describe('canSaveDraft', () => {
  it('accepts a complete entry', () => {
    expect(canSaveDraft(draft(), WALLETS)).toBe(true)
  })

  it('refuses without a wallet', () => {
    expect(canSaveDraft(draft({ walletId: null }), WALLETS)).toBe(false)
  })

  it('refuses a zero or unparseable amount', () => {
    expect(canSaveDraft(draft({ amountText: '0' }), WALLETS)).toBe(false)
    expect(canSaveDraft(draft({ amountText: '' }), WALLETS)).toBe(false)
  })

  it('refuses a transfer with no destination', () => {
    const d = draft({ type: 'transfer', walletId: 'usd', toWalletId: null })
    expect(canSaveDraft(d, WALLETS)).toBe(false)
  })

  it('refuses when a rate is needed and missing', () => {
    const d = draft({ walletId: 'usd', entryCurrency: 'EUR', rateText: '' })
    expect(canSaveDraft(d, WALLETS)).toBe(false)
  })

  it('accepts once the rate is supplied', () => {
    const d = draft({ walletId: 'usd', entryCurrency: 'EUR', rateText: '1.1' })
    expect(canSaveDraft(d, WALLETS)).toBe(true)
  })
})

describe('buildTransaction', () => {
  it('builds an expense record', () => {
    expect(buildTransaction(draft({ note: '  lunch  ' }), WALLETS)).toEqual({
      type: 'expense',
      amount: { minor: 10000, currency: 'USD' },
      fx: null,
      walletId: 'usd',
      toWalletId: null,
      toAmount: null,
      categoryId: 'cat_1',
      date: '2026-08-20',
      note: 'lunch',
      recurringRuleId: null,
      goalId: null,
    })
  })

  it('nulls the category on a transfer, which neither earns nor spends', () => {
    const d = draft({
      type: 'transfer',
      walletId: 'usd',
      toWalletId: 'jpy',
      categoryId: 'cat_1',
      rateText: '150',
    })
    expect(buildTransaction(d, WALLETS)).toMatchObject({ categoryId: null, toWalletId: 'jpy' })
  })

  it('nulls the destination on anything that is not a transfer', () => {
    const d = draft({ type: 'expense', toWalletId: 'eur' })
    expect(buildTransaction(d, WALLETS)).toMatchObject({ toWalletId: null, toAmount: null })
  })

  it('trims a datetime down to a calendar date', () => {
    // Ionic's datetime hands back a full ISO string; the domain stores plain dates.
    const d = draft({ date: '2026-08-20T14:33:00.000Z' })
    expect(buildTransaction(d, WALLETS)!.date).toBe('2026-08-20')
  })

  it('preserves the back-links of the record being edited', () => {
    const d = draft({ recurringRuleId: 'rec_rent', goalId: 'gol_x' })
    expect(buildTransaction(d, WALLETS)).toMatchObject({
      recurringRuleId: 'rec_rent',
      goalId: 'gol_x',
    })
  })

  it('refuses to build when the draft is not saveable', () => {
    expect(buildTransaction(draft({ amountText: '' }), WALLETS)).toBeNull()
    expect(buildTransaction(draft({ walletId: null }), WALLETS)).toBeNull()
    expect(
      buildTransaction(draft({ walletId: 'usd', entryCurrency: 'EUR', rateText: '' }), WALLETS),
    ).toBeNull()
  })
})

describe('rateTextFor', () => {
  const tx = (overrides: Partial<Transaction>): Transaction => ({
    id: 'txn_1',
    type: 'expense',
    amount: { minor: 10000, currency: 'USD' },
    fx: null,
    walletId: 'usd',
    toWalletId: null,
    toAmount: null,
    categoryId: null,
    date: '2026-08-20',
    note: '',
    recurringRuleId: null,
    goalId: null,
    createdAt: '2026-08-20',
    ...overrides,
  })

  it('replays a frozen fx rate verbatim', () => {
    const t = tx({ fx: { enteredAmount: { minor: 10000, currency: 'EUR' }, rate: 1.08 } })
    expect(rateTextFor(t)).toBe('1.08')
  })

  it('is blank when no rate was involved', () => {
    expect(rateTextFor(tx({}))).toBe('')
  })

  it('is blank for a same-currency transfer', () => {
    const t = tx({ type: 'transfer', toWalletId: 'b', toAmount: { minor: 10000, currency: 'USD' } })
    expect(rateTextFor(t)).toBe('')
  })

  it('recovers the rate for a cross-currency transfer at equal precision', () => {
    // USD and EUR both have 2 decimals, so the old raw-minor-unit division agreed here. Kept as
    // a regression test that the fix did not disturb the same-precision case.
    const t = tx({
      type: 'transfer',
      toWalletId: 'eur',
      toAmount: { minor: 9000, currency: 'EUR' },
    })
    expect(rateTextFor(t)).toBe('0.9')
    expect(Number(rateTextFor(t))).toBe(impliedRate(t.amount, t.toAmount!))
  })

  it('recovers the rate across differing precisions', () => {
    // 100.00 USD -> 15,000 JPY is a rate of 150. Dividing minor units without rescaling for
    // JPY's zero decimals gave 1.5 — out by 100x — and because this value populates the rate
    // field when editing, saving that form again wrote a corrupted amount.
    const t = tx({
      type: 'transfer',
      toWalletId: 'jpy',
      toAmount: { minor: 15000, currency: 'JPY' },
    })
    expect(rateTextFor(t)).toBe('150')
    expect(Number(rateTextFor(t))).toBe(impliedRate(t.amount, t.toAmount!))
  })

  it('round-trips a cross-decimal transfer through edit without changing the amounts', () => {
    // The bug's real cost: reopening a saved USD<->JPY transfer and saving it again used to
    // rewrite toAmount 100x off. This asserts the recovered rate reproduces the stored amounts.
    const stored = tx({
      type: 'transfer',
      walletId: 'usd',
      toWalletId: 'jpy',
      amount: { minor: 10000, currency: 'USD' },
      toAmount: { minor: 15000, currency: 'JPY' },
    })

    const reopened = draft({
      type: 'transfer',
      walletId: 'usd',
      toWalletId: 'jpy',
      amountText: '100',
      rateText: rateTextFor(stored),
    })

    const resaved = buildTransaction(reopened, WALLETS)
    expect(resaved!.amount).toEqual(stored.amount)
    expect(resaved!.toAmount).toEqual(stored.toAmount)
  })
})
