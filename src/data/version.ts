/**
 * Which build of the app this is, and how two versions compare.
 *
 * Every file the app writes — the automatic snapshot and an exported backup alike — records the
 * version that wrote it, so a restore can pick the reader that understands that file. See
 * `backup.ts`.
 */

/** This build's version, from package.json. */
export const APP_VERSION: string = __APP_VERSION__

/** `major.minor.patch` as numbers. Missing or non-numeric parts read as 0. */
export function parseVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split('.').map((part) => Number.parseInt(part, 10))
  return [major || 0, minor || 0, patch || 0]
}

/** Negative when `a` is older than `b`, positive when newer, zero when the same. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a)
  const y = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i]
  }
  return 0
}

/** Whether `version` is in a later major series than `than` — a change this build cannot read. */
export function isNewerMajor(version: string, than: string): boolean {
  return parseVersion(version)[0] > parseVersion(than)[0]
}
