<script setup lang="ts">
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
  cloudUploadOutline,
  lockClosedOutline,
  pricetagsOutline,
  repeatOutline,
  settingsOutline,
} from 'ionicons/icons'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

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
            <IonNote v-if="link.path === '/currencies' && store.missingRates.length" slot="end" color="warning">
              {{ store.missingRates.length }} missing
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
          <IonItem :disabled="true">
            <IonIcon slot="start" :icon="cloudUploadOutline" />
            <IonLabel>
              <h3>Backup &amp; restore</h3>
              <p>Local export first, then Google Drive — arrives with the database</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>

      <p class="app-muted stage-note">
        This is a design prototype. Data is held in memory only, so it resets when the app
        reloads — persistence, backup and Drive sync come in the next stage.
      </p>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.stage-note {
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 6px 6px 0;
}
</style>
