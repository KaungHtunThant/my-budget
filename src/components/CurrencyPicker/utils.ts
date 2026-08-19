/**
 * Which currencies the picker offers, in which order.
 *
 * ~160 currencies is too many to scroll, so the list is search-first: the user's own holdings,
 * then a popular shortlist, then everything. The de-duplication between those groups is the part
 * worth testing — a currency appearing twice in a picker looks like a bug even when it is
 * harmless.
 */

import {
  type CurrencyCode,
  type CurrencyDef,
  CURRENCIES,
  POPULAR_CURRENCY_CODES,
} from '@/domain/currency'

/** Whether the user has typed enough to be searching rather than browsing. */
export function isSearching(query: string): boolean {
  return query.trim().length > 0
}

/**
 * The user's own currencies, as definitions.
 *
 * Unknown codes are dropped rather than rendered as blanks — a shortlist restored from a backup
 * written by a newer version could name a currency this build does not have.
 */
export function favouriteDefs(favourites: readonly CurrencyCode[] = []): CurrencyDef[] {
  return favourites.map((code) => CURRENCIES[code]).filter(Boolean)
}

/** The popular shortlist, minus anything already shown as one of the user's own. */
export function popularDefs(favourites: readonly CurrencyCode[] = []): CurrencyDef[] {
  return POPULAR_CURRENCY_CODES.filter((code) => !favourites.includes(code)).map(
    (code) => CURRENCIES[code],
  )
}
