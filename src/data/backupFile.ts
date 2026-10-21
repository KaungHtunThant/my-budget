/**
 * Moving a backup file in and out of the app.
 *
 * Out: the native share sheet on a phone, so the user can save the file anywhere — Drive, email,
 * Downloads — without the app needing a single permission or network call; a plain download in a
 * browser. In: the file arrives as text from an `<input type="file">` on the Settings screen, and
 * `backup.ts` does the rest.
 */

import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

import type { SeedData } from './fixtures'
import { nowIso } from './id'
import { buildSnapshot } from './snapshot'

/** Kept in the app's private data directory: what was on the device before the last import. */
export const PRE_IMPORT_FILE = 'my-budget-pre-import.json'

export function backupFileName(today: string): string {
  return `my-budget-backup-${today}.json`
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Hand the backup to the share sheet, or download it in a browser. */
export async function shareBackup(data: SeedData, today: string): Promise<ShareOutcome> {
  const json = JSON.stringify(buildSnapshot(data, nowIso()), null, 2)
  const name = backupFileName(today)

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  }

  const { uri } = await Filesystem.writeFile({
    path: name,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  try {
    await Share.share({ title: 'My Budget backup', files: [uri] })
    return 'shared'
  } catch (error) {
    // Dismissing the sheet rejects; that is the user's choice, not a failure.
    if (String(error).toLowerCase().includes('cancel')) return 'cancelled'
    throw error
  }
}

/**
 * Keep the device's data, as it stands, before an import replaces it — a way back from importing
 * the wrong file. Never throws: failing to keep the copy is no reason to refuse the import, but it
 * is reported so the caller can say so.
 */
export async function savePreImportCopy(data: SeedData): Promise<boolean> {
  try {
    await Filesystem.writeFile({
      path: PRE_IMPORT_FILE,
      data: JSON.stringify(buildSnapshot(data, nowIso())),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    return true
  } catch (error) {
    console.warn('[backup] could not keep the pre-import copy', error)
    return false
  }
}
