<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { IonApp, IonRouterOutlet, toastController, useBackButton, useIonRouter } from '@ionic/vue'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { todayIso } from '@/domain/period'
import { useBudgetStore } from '@/stores/budget'
import { EXIT_WINDOW_MS, backAction } from '@/router/back'
import { coveredHeight, revealDelta } from '@/shell/keyboard'

const store = useBudgetStore()
const route = useRoute()
const ionRouter = useIonRouter()

/**
 * The hardware back button, in priority order: close the topmost overlay, else go to the page's
 * parent, else warn and exit on a second press. Ionic's overlays claim the press at priority 100;
 * this sits at 10, above the router outlet's history-back at 0, which it replaces by never
 * calling `processNextHandler`.
 */
const OPEN_OVERLAY = [
  'ion-modal',
  'ion-popover',
  'ion-action-sheet',
  'ion-alert',
  'ion-picker',
  'ion-select-modal',
]
  .map((tag) => `${tag}:not(.overlay-hidden)`)
  .join(', ')

let lastWarnAt: number | null = null

useBackButton(10, async () => {
  // Ionic's overlay handler only looks at the *last* presented overlay, and the exit toast —
  // appended to ion-app — is last while it shows. A sheet opened in those two seconds would be
  // masked by it and the press would exit underneath; close the sheet here instead.
  const overlays = document.querySelectorAll<HTMLIonModalElement>(OPEN_OVERLAY)
  const top = overlays[overlays.length - 1]
  if (top) {
    if (top.backdropDismiss !== false) await top.dismiss(undefined, 'backdrop')
    return
  }

  const now = Date.now()
  const action = backAction(route.meta.parent, lastWarnAt, now)
  switch (action.kind) {
    case 'parent':
      // Pop when the parent is the real previous entry; otherwise replace, so backing out of
      // Settings-from-Home onto More leaves no forward entry behind.
      if (window.history.state?.back === action.to) ionRouter.back()
      else ionRouter.navigate(action.to, 'back', 'replace')
      return
    case 'warn': {
      lastWarnAt = now
      const toast = await toastController.create({
        message: 'Press back again to exit',
        duration: EXIT_WINDOW_MS,
        position: 'bottom',
        positionAnchor: document.querySelector<HTMLElement>('ion-tab-bar') ?? undefined,
      })
      await toast.present()
      return
    }
    case 'exit':
      await CapacitorApp.exitApp()
  }
})

/**
 * Backgrounding the app is the last reliable moment to write the durability snapshot —
 * Android can kill the process afterwards without running our code again. On the web this
 * plugin maps to `visibilitychange`, so the same listener covers the browser dev loop.
 */
void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) void store.flushSnapshot()
  // An app left in the background can wake up in a new cycle, owed its recurring budgets.
  else if (store.ready) void store.rollRecurringBudgets(todayIso())
})

/**
 * Keep the focused field above the on-screen keyboard. Nothing else does on Android (see
 * `shell/keyboard.ts`), so: publish how much of the keyboard covers the view as
 * `--app-keyboard-covered`, which `ion-content` adds to its bottom padding to make room, then
 * scroll the field up into that room. Native only — a browser handles its own keyboard.
 */
if (Capacitor.isNativePlatform()) {
  let heightBefore: number | null = null
  let covered = 0

  const setCovered = (px: number): void => {
    covered = px
    document.documentElement.style.setProperty('--app-keyboard-covered', `${px}px`)
  }

  const reveal = (target: EventTarget | null): void => {
    if (!(target instanceof HTMLElement)) return
    const content = target.closest('ion-content')
    if (!content) return
    // The whole item, so a stacked label stays in view with its input.
    const field = target.closest('ion-item') ?? target
    const delta = revealDelta(field.getBoundingClientRect().bottom, window.innerHeight, covered)
    if (delta > 0) void content.scrollByPoint(0, delta, 200)
  }

  // Measured before the keyboard opens, so a window that does shrink for it is not padded twice.
  void Keyboard.addListener('keyboardWillShow', () => {
    heightBefore ??= window.innerHeight
  })
  void Keyboard.addListener('keyboardDidShow', ({ keyboardHeight }) => {
    const now = window.innerHeight
    setCovered(coveredHeight(keyboardHeight, heightBefore ?? now, now))
    // A frame for the new padding to lay out, or there is nothing yet to scroll into.
    requestAnimationFrame(() => reveal(document.activeElement))
  })
  void Keyboard.addListener('keyboardWillHide', () => {
    heightBefore = null
    setCovered(0)
  })
  // Moving to another field with the keyboard already up fires no keyboard event.
  document.addEventListener('focusin', (event) => {
    if (covered > 0) requestAnimationFrame(() => reveal(event.target))
  })
}

/**
 * Apply the theme preference. "system" follows the OS, so we listen to the media query
 * rather than reading it once — the phone can switch to dark at sunset while the app is open.
 */
const media = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(): void {
  const preference = store.settings.theme
  const dark = preference === 'dark' || (preference === 'system' && media.matches)
  document.documentElement.classList.toggle('ion-palette-dark', dark)
}

media.addEventListener('change', applyTheme)
watch(() => store.settings.theme, applyTheme, { immediate: true })
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>
