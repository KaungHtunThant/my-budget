/**
 * JSON snapshot of the whole database, written to a real file.
 *
 * Two jobs, one artefact:
 *
 * 1. **Durability backstop.** IndexedDB lives in the webview's storage for the app's own
 *    origin — private to the app and cleared only by uninstall or "Clear storage", not by
 *    browser-style eviction. This file is the answer to the residual doubt: it sits in the
 *    app's private data directory, so if the object stores ever come up empty the app can
 *    rebuild from it instead of silently starting over.
 * 2. **The export format.** The payload is `SeedData` plus a schema version and a timestamp,
 *    which is exactly what local export/import and, later, Drive upload need to move. One
 *    serialiser, three transports.
 *
 * Writes are never done in place. The new content goes to a temp file, the current snapshot
 * is kept as `.bak`, and only then does the temp file take its place — so a process death
 * mid-write can cost at most the newest snapshot, never the existing one.
 */

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { SCHEMA_VERSION } from './db'
import type { SeedData } from './fixtures'

const DIR = Directory.Data
const FILE = 'my-budget-snapshot.json'
const TEMP = 'my-budget-snapshot.tmp.json'
const BACKUP = 'my-budget-snapshot.bak.json'

export interface Snapshot extends SeedData {
  schemaVersion: number
  exportedAt: string
}

/** Build the payload. Kept separate from writing so export-to-share reuses it verbatim. */
export function buildSnapshot(data: SeedData, exportedAt: string): Snapshot {
  return { schemaVersion: SCHEMA_VERSION, exportedAt, ...data }
}

async function remove(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: DIR })
  } catch {
    // Absent already, which is the state we wanted.
  }
}

/**
 * Write the snapshot, keeping the previous one as `.bak`.
 *
 * Never throws: a failed snapshot must not break the write the user actually asked for. The
 * object stores remain the source of truth, and the next write tries again.
 */
export async function writeSnapshot(snapshot: Snapshot): Promise<boolean> {
  try {
    await Filesystem.writeFile({
      path: TEMP,
      directory: DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(snapshot),
      recursive: true,
    })

    await remove(BACKUP)
    try {
      await Filesystem.rename({ from: FILE, to: BACKUP, directory: DIR, toDirectory: DIR })
    } catch {
      // No snapshot yet, so there is nothing to keep.
    }
    await Filesystem.rename({ from: TEMP, to: FILE, directory: DIR, toDirectory: DIR })
    return true
  } catch (error) {
    console.warn('[snapshot] write failed; object stores remain authoritative', error)
    return false
  }
}

/** Read the snapshot, falling back to the `.bak` if the primary is missing or unreadable. */
export async function readSnapshot(): Promise<Snapshot | null> {
  for (const path of [FILE, BACKUP]) {
    try {
      const { data } = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 })
      const parsed = JSON.parse(typeof data === 'string' ? data : await data.text()) as Snapshot

      if (typeof parsed.schemaVersion !== 'number') continue
      if (parsed.schemaVersion > SCHEMA_VERSION) {
        // Written by a newer build. Refuse rather than guess at fields we do not know.
        console.warn(
          `[snapshot] ${path} is schema v${parsed.schemaVersion}, this build understands v${SCHEMA_VERSION}`,
        )
        continue
      }
      if (!Array.isArray(parsed.transactions) || !parsed.settings) continue

      return parsed
    } catch {
      // Missing or corrupt — try the backup, then give up.
    }
  }
  return null
}

export interface Debounced {
  schedule(): void
  /** Drop any pending run. Called on shutdown so no timer outlives the repository. */
  cancel(): void
  /** Run now if one is pending — used when the app goes to the background. */
  flush(): void
}

/**
 * Coalesce bursts of writes into one snapshot.
 *
 * Every store mutation currently triggers a full reload, so a few edits in a row would
 * otherwise serialise the whole database several times over for no benefit.
 */
export function debounceSnapshot(run: () => void, waitMs = 5000): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  return {
    schedule() {
      clear()
      timer = setTimeout(() => {
        timer = null
        run()
      }, waitMs)
    },
    cancel: clear,
    flush() {
      if (!timer) return
      clear()
      run()
    },
  }
}
