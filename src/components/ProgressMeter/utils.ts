/**
 * Meter geometry and its colour thresholds.
 *
 * The 85% warning threshold is a *display* rule, not a budgeting one — nothing is stored or
 * calculated differently at 85%, a bar just starts looking anxious. That is why it lives with the
 * component rather than in a service, but it is named and tested here rather than buried in a
 * template expression.
 */

/** Above this share of a budget the bar turns amber, as a warning before it turns red. */
export const WARNING_AT_PERCENT = 85

/**
 * Fill width, clamped to the track.
 *
 * An over-budget bar stays full rather than overflowing, so a row that is 300% spent still lines
 * up with its neighbours instead of breaking the layout. `over` is what communicates the excess.
 */
export function fillWidth(percent: number): string {
  return `${Math.min(100, Math.max(0, percent))}%`
}

/** Fill colour: red once over, amber approaching, otherwise the caller's token. */
export function fillColor(percent: number, over: boolean, color: string): string {
  if (over) return 'var(--ion-color-danger)'
  if (percent >= WARNING_AT_PERCENT) return 'var(--ion-color-warning)'
  return `var(--ion-color-${color})`
}

/**
 * Where the elapsed-time marker sits, as a CSS offset.
 *
 * Takes a 0–1 fraction rather than a percentage, matching `periodProgress`. Clamped so a marker
 * cannot sit outside the track on the last day of a cycle.
 */
export function paceOffset(pace: number): string {
  return `${Math.min(100, Math.max(0, pace * 100))}%`
}
