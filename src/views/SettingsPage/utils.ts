/**
 * Settings screen wording for backup and restore: what a backup file is, what importing it would
 * do, and the confirmation that guards "Start empty".
 */

import { formatDate } from '@/domain/format'

/** Per-record counts from an import's dry run. */
export interface ImportCounts {
  added: number
  identical: number
  conflicts: number
}

/** What the preview needs to know about a file that passed its checks. */
export interface ImportSummaryInput {
  /** The version that wrote the file, or null for one from before 2.0.0. */
  appVersion: string | null
  /** True when the file is an older format and will be converted. */
  converted: boolean
  exportedAt: string | null
  total: ImportCounts
}

const records = (n: number): string => `${n} record${n === 1 ? '' : 's'}`

/**
 * The preview, in sentences: which app made the file and when — checked first, since it decides
 * how the file is read — and then what importing it would add or collide with.
 */
export function importSummary(input: ImportSummaryInput): string {
  const made = input.exportedAt ? `, made ${formatDate(input.exportedAt.slice(0, 10))}` : ''
  const source = input.appVersion
    ? `Backup from My Budget ${input.appVersion}${made}.`
    : `Backup from an earlier My Budget (before 2.0.0)${made}.`
  const conversion = input.converted ? ' It will be converted to this version’s format.' : ''

  const { added, identical, conflicts } = input.total
  const parts = [
    added > 0 ? `${records(added)} new to this phone` : null,
    identical > 0 ? `${records(identical)} already here` : null,
    conflicts > 0
      ? `${records(conflicts)} that ${conflicts === 1 ? 'differs' : 'differ'} from this phone’s`
      : null,
  ].filter((p): p is string => p !== null)
  const contents = parts.length > 0 ? ` It has ${parts.join(', ')}.` : ' It is empty.'

  return `${source}${conversion}${contents}`
}

/** A merge needs a decision only when the two sides disagree about some record. */
export function needsWinnerChoice(total: ImportCounts): boolean {
  return total.conflicts > 0
}

/** The word "Start empty" asks the user to type, so wiping everything is never one tap away. */
export const CLEAR_CONFIRMATION = 'DELETE'

export function confirmsClear(typed: string | undefined): boolean {
  return (typed ?? '').trim().toUpperCase() === CLEAR_CONFIRMATION
}
