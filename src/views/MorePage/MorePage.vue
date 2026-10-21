<script setup lang="ts">
import { computed } from 'vue'
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  barChartOutline,
  cardOutline,
  cashOutline,
  informationCircleOutline,
  lockClosedOutline,
  pricetagsOutline,
  repeatOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { currenciesNeedingRates } from '@/services/fx'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

/** From package.json, injected at build time — the same version every backup file records. */
const appVersion = __APP_VERSION__

const missingRates = computed(() => currenciesNeedingRates(store.wallets, store.settings))

const links = [
  { path: '/wallets', icon: cardOutline, title: 'Wallets', detail: 'Accounts, cash and savings' },
  { path: '/categories', icon: pricetagsOutline, title: 'Categories', detail: 'Income and spending categories' },
  { path: '/recurring', icon: repeatOutline, title: 'Recurring', detail: 'Bills and regular income' },
  { path: '/reports', icon: barChartOutline, title: 'Reports', detail: 'Trends and category breakdown' },
  { path: '/currencies', icon: cashOutline, title: 'Currencies & rates', detail: 'Manual exchange rates' },
  { path: '/settings', icon: settingsOutline, title: 'Settings', detail: 'Currency, cycle, theme, data' },
]
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonTitle>More</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem v-for="link in links" :key="link.path" button :router-link="link.path">
            <IonIcon slot="start" :icon="link.icon" color="primary" />
            <IonLabel>
              <h3>{{ link.title }}</h3>
              <p>{{ link.detail }}</p>
            </IonLabel>
            <IonNote v-if="link.path === '/currencies' && missingRates.length" slot="end" color="warning">
              {{ missingRates.length }} missing
            </IonNote>
          </IonItem>
        </IonList>
      </div>

      <IonListHeader class="app-section-title">Planned</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem :disabled="true">
            <IonIcon slot="start" :icon="lockClosedOutline" />
            <IonLabel>
              <h3>App lock</h3>
              <p>Fingerprint or PIN on launch — coming in a later build</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>

      <IonListHeader class="app-section-title">About</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem>
            <IonIcon slot="start" :icon="informationCircleOutline" color="primary" />
            <IonLabel>
              <h3>My Budget</h3>
              <p>Income, budgets, goals and currencies, on your own cycle</p>
            </IonLabel>
            <IonNote slot="end">Version {{ appVersion }}</IonNote>
          </IonItem>
          <IonItem>
            <IonIcon slot="start" :icon="shieldCheckmarkOutline" color="primary" />
            <IonLabel class="ion-text-wrap">
              <h3>Your data stays on this phone</h3>
              <p>
                No account and no internet connection — nothing is ever sent anywhere. Export a
                backup from Settings now and then, and keep the file somewhere safe.
              </p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>
    </IonContent>
  </IonPage>
</template>
