<script setup lang="ts">
/**
 * The tab shell: five views, one dock, and the swipe between them.
 *
 * Swiping horizontally moves to the adjacent tab, and the dock's indicator follows the finger
 * rather than jumping when the route changes — so a half-finished swipe shows exactly how far it
 * got, and springs back if abandoned.
 *
 * Three Ionic details this rests on, all verified against the installed 8.8.17:
 *
 *  - Tapping a tab navigates with direction `none` and action `push`, and `IonRouterOutlet` gives a
 *    `none` navigation `duration: 0` **unless an animation builder is passed explicitly**. So
 *    `navigate(path, 'none', 'push', slide)` keeps a swipe's history and tab bookkeeping identical
 *    to a tap while still playing our own transition. Taps keep the instant change they have today:
 *    the slide direction is the *gesture's* feedback, and a tap has no direction to report.
 *  - `IonTabBar.updated()` re-runs `setupTabState()`, which re-walks its child vnodes. So the
 *    indicator is written to the element imperatively rather than bound in the template: a
 *    per-frame reactive value would re-run Ionic's tab bookkeeping sixty times a second. Nothing
 *    the gesture touches is reactive, which is also why `drag` is a plain `let`.
 *  - `ion-tab-bar` is shadow DOM with `contain: strict`, which already makes it the containing
 *    block for the indicator. The indicator is slotted light DOM, so this component's scoped CSS
 *    styles it, and being absolutely positioned it stays out of the buttons' flex row.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  createAnimation,
  createGesture,
  getIonPageElement,
  useIonRouter,
} from '@ionic/vue'
import type { AnimationBuilder, Gesture, GestureDetail } from '@ionic/vue'
import {
  ellipsisHorizontalOutline,
  homeOutline,
  pieChartOutline,
  swapVerticalOutline,
  trophyOutline,
} from 'ionicons/icons'

import {
  type SwipeState,
  type TabName,
  TAB_ORDER,
  activeTabFor,
  indicatorPercent,
  shouldCommit,
  swipeState,
  tabPath,
} from './utils'

/**
 * Icon and label per tab. `TAB_ORDER` is the order, this is the dressing, and the `Record` is what
 * stops the two drifting apart — add a tab and the type check fails until it has both. Icons cannot
 * live in `utils.ts`, which may not import `ionicons`.
 */
const TAB_META: Record<TabName, { icon: string; label: string }> = {
  home: { icon: homeOutline, label: 'Home' },
  transactions: { icon: swapVerticalOutline, label: 'Activity' },
  budgets: { icon: pieChartOutline, label: 'Budgets' },
  goals: { icon: trophyOutline, label: 'Goals' },
  more: { icon: ellipsisHorizontalOutline, label: 'More' },
}

/** Matches the one existing transition in the app, `.app-meter__fill`. */
const SLIDE_MS = 220
const SLIDE_EASING = 'cubic-bezier(0.25, 0.8, 0.5, 1)'

/** How far the outgoing view trails behind the incoming one, as a share of its own width. */
const TRAIL_PERCENT = 28

/**
 * Controls that own the pointer once it is down.
 *
 * Sliding rows, ranges, toggles and segments also register their own gestures at a higher priority
 * than ours, so the gesture controller would arbitrate anyway; they are named here because priority
 * only settles a contest between two gestures that both reach their threshold — and because a FAB
 * has no gesture at all, yet dragging a screen's primary action should never navigate.
 */
const OWNS_POINTER = [
  'ion-modal',
  'ion-popover',
  'ion-item-sliding',
  'ion-fab',
  'ion-refresher',
  'ion-range',
  'ion-searchbar',
  'ion-segment',
  'ion-datetime',
  'ion-toggle',
  '[data-no-swipe]',
].join(', ')

/**
 * A *presented* overlay. `:not(.overlay-hidden)` is load-bearing rather than defensive: every
 * create/edit sheet is declared inside its tab page, and `TransactionModal` keeps a date-picker
 * modal permanently mounted — matching `ion-modal` alone would disable the gesture on Home and
 * Activity forever.
 */
const PRESENTED_OVERLAY = [
  'ion-modal',
  'ion-popover',
  'ion-action-sheet',
  'ion-alert',
  'ion-loading',
  'ion-picker',
  'ion-select-modal',
]
  .map((tag) => `${tag}:not(.overlay-hidden)`)
  .join(', ')

const route = useRoute()
const ionRouter = useIonRouter()

const tabs = ref<{ $el: HTMLElement } | null>(null)
const bar = ref<{ $el: HTMLElement } | null>(null)

/** Null when the route is not a tab at all, which is when the gesture must stay out of the way. */
const activeTab = computed<TabName | null>(() => activeTabFor(route.path))

let gesture: Gesture | undefined

/** Gesture state, deliberately not reactive — see the note about `setupTabState` above. */
let drag: SwipeState | null = null
let dragging = false
let origin: TabName | null = null
let width = 0

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Put the indicator where the current state says it should be.
 *
 * One function for every source — the drag, the release, the route landing, the first render — so
 * there is a single expression of "where does the pill go" rather than four.
 */
function paintIndicator(): void {
  const el = bar.value?.$el
  if (!el) return

  const wasDragging = el.classList.contains('dock--dragging')
  el.classList.toggle('dock--dragging', dragging)
  // Releasing re-enables the transition. Read layout first so the browser has resolved the new
  // rule before the value moves, or the settle would land in a single frame with `transition: none`
  // still in force. Once per gesture, not per frame.
  if (wasDragging && !dragging) void el.offsetWidth

  const at = indicatorPercent(drag, activeTab.value ?? TAB_ORDER[0])
  el.style.setProperty('--dock-indicator-x', `${at}%`)
}

/** A scroller with somewhere left to scroll horizontally is already using this drag. */
function scrollsHorizontally(el: Element): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false
  const { overflowX } = getComputedStyle(el)
  return overflowX === 'auto' || overflowX === 'scroll'
}

/**
 * Whether something between the touch and the tab shell has a prior claim on the drag.
 *
 * The scroller test is deliberately generic rather than naming `.app-chip-row`: any future strip
 * with `overflow-x: auto` is protected without anyone remembering to add it here.
 */
function claimedByDescendant(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null
  while (el !== null && el !== root) {
    if (el.matches(OWNS_POINTER) || scrollsHorizontally(el)) return true
    el = el.parentElement
  }
  return false
}

function canStart(detail: GestureDetail): boolean {
  const root = tabs.value?.$el
  if (!root || activeTab.value === null) return false
  // The tabs page stays mounted underneath /settings and friends. `.ion-page-hidden` is
  // `display: none`, so a touch cannot reach it anyway — this states the intent for one call.
  if (root.closest('.ion-page')?.classList.contains('ion-page-hidden')) return false
  if (document.querySelector(PRESENTED_OVERLAY) !== null) return false
  return !claimedByDescendant(detail.event.target, root)
}

function onStart(): void {
  drag = null
  dragging = true
  // Captured once, so a mid-gesture route change cannot make the second half of a drag mean
  // something different from the first, and so no frame has to measure.
  origin = activeTab.value
  width = tabs.value?.$el.clientWidth || window.innerWidth
  paintIndicator()
}

function onMove(detail: GestureDetail): void {
  if (origin === null) return
  drag = swipeState(origin, detail.deltaX, width)
  paintIndicator()
}

function onEnd(detail: GestureDetail): void {
  const state = drag
  const commit =
    state !== null &&
    state.to !== null &&
    shouldCommit(detail.deltaX, detail.velocityX, width)

  dragging = false
  // On a commit the indicator is parked on the destination until the route catches up. Clearing it
  // now would send it back to the tab being left and then forward again a tick later, because the
  // router guard makes every navigation asynchronous.
  drag = commit && state !== null ? { ...state, progress: 1 } : null
  paintIndicator()

  if (commit && state?.to) {
    ionRouter.navigate(
      tabPath(state.to),
      'none',
      'push',
      reducedMotion.matches ? undefined : slide(state.step),
    )
  }
}

/**
 * The incoming view enters from the side the finger came from, and the outgoing one trails a little
 * way after it.
 *
 * `beforeRemoveClass('ion-page-invisible')` is not optional: the outlet hides the entering page
 * with that class and only removes it once the transition has finished, so an animation that does
 * not lift it itself plays against an invisible page and the view pops in at the end. Ionic's own
 * `mdTransitionAnimation` does the same, for the same reason.
 */
function slide(step: -1 | 1): AnimationBuilder {
  return (_baseEl, opts) => {
    const entering = createAnimation()
      .addElement(getIonPageElement(opts.enteringEl))
      .fill('both')
      .beforeRemoveClass('ion-page-invisible')
      .duration(SLIDE_MS)
      .easing(SLIDE_EASING)
      .fromTo('transform', `translateX(${step * 100}%)`, 'translateX(0)')
      .fromTo('opacity', 0.6, 1)

    if (opts.leavingEl) {
      entering.addAnimation(
        createAnimation()
          .addElement(getIonPageElement(opts.leavingEl))
          // Cleared rather than filled: the page stays mounted, so a leftover transform would
          // still be on it the next time the tab is shown.
          .afterClearStyles(['transform', 'opacity'])
          .fromTo('transform', 'translateX(0)', `translateX(${step * -TRAIL_PERCENT}%)`)
          .fromTo('opacity', 1, 0.6),
      )
    }

    return entering
  }
}

// Once the route has caught up, the active tab alone says where the indicator belongs.
watch(activeTab, () => {
  drag = null
  paintIndicator()
})

onMounted(() => {
  paintIndicator()

  const el = tabs.value?.$el
  if (!el) return

  gesture = createGesture({
    el,
    gestureName: 'tab-swipe',
    direction: 'x',
    // 12 rather than the default 10, so the direction test runs over a longer sample and a sliding
    // row (threshold 5) always captures first. `maxAngle` is tightened from 40 so a diagonal drag
    // over a scrolling list stays a scroll. Priority is left at 0 on purpose: everything with its
    // own drag registers above it and therefore wins without being named.
    threshold: 12,
    maxAngle: 30,
    canStart,
    onStart,
    onMove,
    onEnd,
  })
  gesture.enable()
})

onBeforeUnmount(() => {
  gesture?.destroy()
})
</script>

<template>
  <IonPage>
    <IonTabs ref="tabs">
      <IonRouterOutlet />
      <IonTabBar ref="bar" slot="bottom">
        <span class="dock-indicator" aria-hidden="true" />
        <IonTabButton v-for="tab in TAB_ORDER" :key="tab" :tab="tab" :href="tabPath(tab)">
          <IonIcon :icon="TAB_META[tab].icon" />
          <IonLabel>{{ TAB_META[tab].label }}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>

<style scoped>
/*
 * One slot per tab with the visible bar centred inside it, so the geometry stays a percentage and
 * nothing needs measuring. `ion-tab-bar` is already the containing block: it sets `contain: strict`,
 * which includes layout containment.
 *
 * `--dock-indicator-x` is written on the bar by the gesture rather than bound in the template.
 * The `0%` fallback covers the frame before the first paint.
 */
.dock-indicator {
  position: absolute;
  top: 0;
  left: var(--dock-indicator-x, 0%);
  width: calc(100% / 5);
  height: 3px;
  transition: left 220ms ease;
  pointer-events: none;
}

.dock-indicator::after {
  content: '';
  display: block;
  width: 28px;
  height: 100%;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--ion-color-primary);
}

/* While a finger is down the indicator is driven directly; the transition is for what follows. */
.dock--dragging .dock-indicator {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .dock-indicator {
    transition: none;
  }
}
</style>
