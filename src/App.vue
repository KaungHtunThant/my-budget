<script setup lang="ts">
import { watch } from 'vue'
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

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
