/**
 * Id generation.
 *
 * Ids are opaque strings so the SQLite layer can keep generating them the same way in
 * Stage 2 without a migration. `crypto.randomUUID` is available in the Android webview
 * and in modern browsers; the counter fallback keeps unit tests working under any runtime.
 */

let counter = 0

export function newId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
  return prefix ? `${prefix}_${raw}` : raw
}

export function nowIso(): string {
  return new Date().toISOString()
}
