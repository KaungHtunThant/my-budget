/**
 * Amount-entry rules shared by every form that takes a money value.
 *
 * `parsed !== null && parsed.minor > 0` appeared in five places — four view forms and the
 * transaction modal — two of them byte-identical. "A positive amount" is one rule: a zero
 * transaction, budget or goal is not a thing the app should accept, and the check should not be
 * re-derived per screen.
 */

import type { CurrencyCode } from '@/domain/currency'
import { type Money, parseMoney } from '@/domain/money'

/** Parse user text, rejecting anything that is not strictly greater than zero. */
export function parsePositiveAmount(text: string, currency: CurrencyCode): Money | null {
  const parsed = parseMoney(text, currency)
  return parsed !== null && parsed.minor > 0 ? parsed : null
}

/** The same rule as a predicate, for form-completeness checks. */
export function isPositiveAmount(text: string, currency: CurrencyCode): boolean {
  return parsePositiveAmount(text, currency) !== null
}
