/**
 * Keeping a focused field clear of the on-screen keyboard.
 *
 * On Capacitor Android Ionic never starts its input shims, and with edge-to-edge enforced the
 * webview is not shrunk for the keyboard either — so nothing scrolls a field near the bottom of a
 * form into view, and the keyboard simply sits on it. `App.vue` listens to the keyboard plugin and
 * does that scrolling itself; these are the two measurements it needs, kept free of the DOM.
 */

/** Breathing room left between a revealed field and the top of the keyboard, in CSS pixels. */
export const KEYBOARD_GAP = 24

/**
 * How much of the keyboard actually lies over the webview.
 *
 * All of it when the window kept its height; none of it when Android shrank the window to make
 * room, which some devices still do — counting it there would pad and scroll twice over.
 */
export function coveredHeight(
  keyboardHeight: number,
  heightBefore: number,
  heightNow: number,
): number {
  const shrunk = Math.max(0, heightBefore - heightNow)
  return Math.max(0, Math.round(keyboardHeight - shrunk))
}

/**
 * How far to scroll so a field's bottom edge sits `gap` above the keyboard. Zero when it already
 * does — a field higher up the form is never moved.
 */
export function revealDelta(
  fieldBottom: number,
  viewportHeight: number,
  covered: number,
  gap = KEYBOARD_GAP,
): number {
  return Math.max(0, Math.ceil(fieldBottom - (viewportHeight - covered - gap)))
}
