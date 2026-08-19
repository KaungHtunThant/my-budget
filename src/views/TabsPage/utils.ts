/**
 * Tab shell logic: the tab order, and the rules that turn a horizontal drag into a tab change.
 *
 * `TAB_ORDER` is the single source of that order. The router's child routes, the buttons the dock
 * renders and the indicator's geometry all read it, so a tab cannot be in one order visually and
 * another when swiped. Icons and labels stay in the `.vue` because this file may not import
 * `ionicons`.
 *
 * The four thresholds are the part worth testing: how far a drag has to travel, how fast a flick
 * has to be, and how a drag that reverses at the last moment is refused. All of them are pure
 * functions of `deltaX`, `velocityX` and the viewport width — which is the only way any of this is
 * testable at all, since jsdom cannot produce a gesture.
 */

/** Left to right, matching the `/tabs/` children in `src/router/index.ts`. */
export const TAB_ORDER = ['home', 'transactions', 'budgets', 'goals', 'more'] as const

export type TabName = (typeof TAB_ORDER)[number]

/** Fraction of the viewport a drag must cover to change tab on its distance alone. */
export const COMMIT_FRACTION = 0.3

/** px/ms at release that counts as a flick, so a short fast swipe still commits. */
export const FLICK_VELOCITY = 0.35

/** A flick still has to have gone somewhere; this rejects a tap that registered a stray velocity. */
export const FLICK_DISTANCE = 32

/**
 * How much of the drag the indicator shows when there is no tab to move to. A fifth of the travel
 * reads as resistance rather than as a change that failed to happen.
 */
export const EDGE_RESISTANCE = 0.18

export function tabPath(tab: TabName): string {
  return `/tabs/${tab}`
}

/**
 * The tab a route path is showing, or null when the path is not a tab at all.
 *
 * Null for `/tabs/` and `/tabs` as well as for `/settings`: the router redirects the empty child to
 * `/tabs/home`, so there is no moment worth guessing about, and guessing would put the indicator
 * under Home while some other view was on screen.
 */
export function activeTabFor(path: string): TabName | null {
  const [, section, tab] = path.split('/')
  if (section !== 'tabs') return null
  return TAB_ORDER.find((candidate) => candidate === tab) ?? null
}

/** The tab one step along, or null at either end — the dock is a fixed row, not a carousel. */
export function neighbourTab(tab: TabName, step: -1 | 1): TabName | null {
  const next = TAB_ORDER.indexOf(tab) + step
  return TAB_ORDER[next] ?? null
}

export interface SwipeState {
  /** The tab the drag started on. */
  readonly from: TabName
  /** Where it is heading, or null at an edge. */
  readonly to: TabName | null
  /** 1 towards the next tab, -1 towards the previous one. */
  readonly step: -1 | 1
  /** 0…1 of the way there, already damped when `to` is null. */
  readonly progress: number
}

/**
 * Read a drag as a move between tabs.
 *
 * Dragging left carries the view left and brings the *next* tab in, which is the convention every
 * paged interface uses. `progress` is capped at 1 so a drag that runs past the screen width does
 * not overshoot the indicator.
 */
export function swipeState(active: TabName, deltaX: number, width: number): SwipeState {
  const step: -1 | 1 = deltaX < 0 ? 1 : -1
  const to = neighbourTab(active, step)
  const travelled = width > 0 ? Math.min(Math.abs(deltaX) / width, 1) : 0

  return {
    from: active,
    to,
    step,
    progress: to === null ? travelled * EDGE_RESISTANCE : travelled,
  }
}

/**
 * Whether the drag earned the tab change.
 *
 * A drag reversed at the last moment is refused outright: the finger was heading back where it
 * came from, whatever distance it had already covered. Otherwise either a long drag or a flick is
 * enough — requiring both would make a quick swipe feel broken.
 */
export function shouldCommit(deltaX: number, velocityX: number, width: number): boolean {
  const distance = Math.abs(deltaX)
  if (distance === 0) return false
  if (velocityX !== 0 && Math.sign(velocityX) !== Math.sign(deltaX)) return false

  const dragged = distance > width * COMMIT_FRACTION
  const flicked = Math.abs(velocityX) > FLICK_VELOCITY && distance > FLICK_DISTANCE
  return dragged || flicked
}

/**
 * The indicator's left edge, as a percentage of the dock's width.
 *
 * The tabs divide the dock evenly, so this is arithmetic on indices and needs no measurement — no
 * `getBoundingClientRect`, nothing to invalidate on rotation, and a plain number to unit-test. At
 * an edge the target is one step past the end, which is what produces the damped nudge.
 */
export function indicatorPercent(state: SwipeState | null, active: TabName): number {
  const slot = 100 / TAB_ORDER.length
  if (state === null) return TAB_ORDER.indexOf(active) * slot

  const from = TAB_ORDER.indexOf(state.from)
  const target = state.to === null ? from + state.step : TAB_ORDER.indexOf(state.to)
  return (from + (target - from) * state.progress) * slot
}
