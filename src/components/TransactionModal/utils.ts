/**
 * The transaction form's wording around a currency conversion. The rules that decide what money
 * is stored live in `services/transactions`; this is only how the form talks about them.
 */

import type { CurrencyCode } from '@/domain/currency'
import type { TransactionType } from '@/domain/types'
import type { FxMode } from '@/services/fx'

/**
 * The label on the converted-amount field — the figure the user reads off their statement, so it
 * names the wallet it hit and which way the money went. A transfer's converted side is what
 * *arrived*, in the destination wallet.
 */
export function convertedLabel(
  type: TransactionType,
  currency: CurrencyCode,
  walletName: string | null,
  toWalletName: string | null,
): string {
  if (type === 'transfer') {
    return toWalletName ? `${currency} received in ${toWalletName}` : `${currency} received`
  }
  if (type === 'income') {
    return walletName ? `${currency} received in ${walletName}` : `${currency} received`
  }
  return walletName ? `${currency} deducted from ${walletName}` : `${currency} deducted`
}

/** The save error when the conversion field is empty or unusable, naming the field in use. */
export function missingConversionMessage(mode: FxMode, currency: CurrencyCode): string {
  return mode === 'amount'
    ? `Enter how much ${currency} that came to.`
    : 'Enter the exchange rate you used.'
}
