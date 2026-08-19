<script setup lang="ts">
/**
 * Steps through budget periods. The label comes from `Period.label`, so it automatically
 * reads "August 2026" for a calendar month and "25 Jul – 24 Aug" for a payday-anchored
 * cycle — the user's chosen period shape is visible rather than implied.
 *
 * The period arrives as a prop because it is derived, not stored: the store keeps only the raw
 * offset, and a service turns that plus the cycle config into a range. The offset itself, and
 * the three actions that move it, remain plain store state.
 */
import { IonButton, IonIcon } from '@ionic/vue'
import { chevronBack, chevronForward } from 'ionicons/icons'
import type { Period } from '@/domain/period'
import { useBudgetStore } from '@/stores/budget'

defineProps<{ period: Period }>()

const store = useBudgetStore()
</script>

<template>
  <div class="switcher">
    <IonButton fill="clear" size="small" @click="store.goToPreviousPeriod()">
      <IonIcon slot="icon-only" :icon="chevronBack" />
    </IonButton>

    <button class="switcher__label" type="button" @click="store.goToCurrentPeriod()">
      <span>{{ period.label }}</span>
      <small v-if="!store.isCurrentPeriod" class="app-muted">Tap for current</small>
    </button>

    <IonButton fill="clear" size="small" @click="store.goToNextPeriod()">
      <IonIcon slot="icon-only" :icon="chevronForward" />
    </IonButton>
  </div>
</template>

<style scoped>
.switcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.switcher__label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: none;
  border: 0;
  padding: 4px;
  font: inherit;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
}

.switcher__label small {
  font-size: 0.7rem;
  font-weight: 500;
}
</style>
