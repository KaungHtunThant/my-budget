/**
 * Wallets screen logic: the per-currency roll-up above the list, and the form's rules.
 *
 * Grouping wallets by currency is specific to this screen — everywhere else either converts into
 * base or shows one wallet at a time — so it stays here rather than becoming a service.
 */

import type { BaseContext, BaseTotal } from '@/domain/budgeting'
import type { CurrencyCode } from '@/domain/currency'
import { type Money, parseMoney, sum, zero } from '@/domain/money'
import type { Id, Wallet, WalletKind } from '@/domain/types'
import { netWorth } from '@/services/budgeting'

export interface CurrencyGroup {
  code: CurrencyCode
  total: Money
  count: number
}

/**
 * Balances totalled per currency, so a multi-currency user sees each holding on its own terms
 * rather than only as a converted lump.
 *
 * Totals go through `domain/money.sum`, which refuses to add across currencies and rejects a
 * fractional minor value. The previous version assembled `{ minor, currency }` by hand and so
 * had neither check.
 */
export function balancesByCurrency(
  wallets: readonly Wallet[],
  balances: Readonly<Record<Id, Money>>,
): CurrencyGroup[] {
  const groups = new Map<CurrencyCode, Money[]>()

  for (const wallet of wallets) {
    const amounts = groups.get(wallet.currency) ?? []
    amounts.push(balances[wallet.id] ?? zero(wallet.currency))
    groups.set(wallet.currency, amounts)
  }

  return [...groups.entries()].map(([code, amounts]) => ({
    code,
    total: sum(amounts, code),
    count: amounts.length,
  }))
}

/** Ionicons name for a wallet kind, so the list and the saved record agree on the glyph. */
export function iconForKind(
  kind: WalletKind,
  kinds: readonly { value: WalletKind; icon: string }[],
): string {
  return kinds.find((k) => k.value === kind)?.icon ?? 'wallet-outline'
}

/** A wallet needs a name; every other field has a sensible default. */
export function canSaveWallet(name: string): boolean {
  return name.trim().length > 0
}

/**
 * The opening balance as typed, or zero if it was left blank.
 *
 * Deliberately not `parsePositiveAmount`: an opening balance may legitimately be zero or
 * negative, which is how an overdrawn account or a credit card is entered.
 */
export function openingBalance(text: string, currency: CurrencyCode): Money {
  return parseMoney(text, currency) ?? zero(currency)
}

export interface WalletsInput {
  wallets: readonly Wallet[]
  balances: Readonly<Record<Id, Money>>
  ctx: BaseContext
}

export interface WalletsView {
  netWorth: BaseTotal
  groups: CurrencyGroup[]
}

export function walletsView(input: WalletsInput): WalletsView {
  return {
    netWorth: netWorth(input.wallets, input.balances, input.ctx),
    groups: balancesByCurrency(input.wallets, input.balances),
  }
}
