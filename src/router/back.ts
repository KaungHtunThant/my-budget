/**
 * What the Android back button does once no overlay has claimed the press.
 *
 * A page with a `parent` goes to that parent — a fixed page, not the previous history entry, so
 * Settings opened from Home still backs out to More. A page without one is a top level: the first
 * press warns, and a second press inside the window exits.
 */
export const EXIT_WINDOW_MS = 2000

export type BackAction =
  | { kind: 'parent'; to: string }
  | { kind: 'warn' }
  | { kind: 'exit' }

export function backAction(
  parent: string | undefined,
  lastWarnAt: number | null,
  now: number,
  windowMs = EXIT_WINDOW_MS,
): BackAction {
  if (parent) return { kind: 'parent', to: parent }
  if (lastWarnAt !== null && now - lastWarnAt < windowMs) return { kind: 'exit' }
  return { kind: 'warn' }
}
