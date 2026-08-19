/**
 * How an amount reads: its text, and whether it is coloured.
 *
 * The tone rule is subtler than it looks, which is why it is worth testing rather than trusting
 * to a glance at a template.
 */

import { formatMoney, formatMoneyCompact } from '@/domain/format'
import type { Money } from '@/domain/money'

export interface MoneyTextOptions {
  signed?: boolean
  showCode?: boolean
  compact?: boolean
}

/**
 * The formatted amount. Compact wins over the signed and code options, which it has no room for.
 */
export function moneyText(value: Money, options: MoneyTextOptions = {}): string {
  if (options.compact) return formatMoneyCompact(value)
  return formatMoney(value, { signed: options.signed, showCode: options.showCode })
}

/**
 * The CSS class carrying the amount's direction, or none.
 *
 * `negativeMeaning` exists for figures that are *stored* positive but *mean* a reduction —
 * expense totals, most of them. For those, any non-zero value reads negative, because the sign of
 * the stored number says nothing about direction; `type` does. Zero is never coloured either way:
 * nothing spent is not bad news.
 */
export function moneyTone(
  value: Money,
  options: { colored?: boolean; negativeMeaning?: boolean } = {},
): string {
  if (!options.colored) return ''
  if (options.negativeMeaning) return value.minor === 0 ? '' : 'tone-negative'
  if (value.minor > 0) return 'tone-positive'
  if (value.minor < 0) return 'tone-negative'
  return ''
}
