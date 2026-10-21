<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { IonApp, IonRouterOutlet, toastController, useBackButton, useIonRouter } from '@ionic/vue'
import { App as CapacitorApp } from '@capacitor/app'
import { useBudgetStore } from '@/stores/budget'
import { EXIT_WINDOW_MS, backAction } from '@/router/back'

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
})

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
