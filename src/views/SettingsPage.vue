<script setup lang="ts">
/**
 * Settings.
 *
 * Base currency and budget cycle live here as well as in onboarding, because both are
 * things people change once they have used the app for a while. Backup and app lock are
 * shown as disabled rows rather than hidden — they are planned, and the prototype should
 * be honest about where they will sit.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import {
  cashOutline,
  cloudUploadOutline,
  colorPaletteOutline,
  calendarNumberOutline,
  informationCircleOutline,
  lockClosedOutline,
  refreshOutline,
} from 'ionicons/icons'
import CurrencyPicker from '@/components/CurrencyPicker.vue'
import { type CurrencyCode, currency } from '@/domain/currency'
import {
  type BudgetPeriodType,
  WEEKDAY_NAMES,
  describePeriodConfig,
  periodFor,
  todayIso,
} from '@/domain/period'
import type { ThemePreference } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()
const router = useRouter()

const currencyPickerOpen = ref(false)
const periodModalOpen = ref(false)
const resetAlertOpen = ref(false)
const currencyAlertOpen = ref(false)
const pendingCurrency = ref<CurrencyCode | null>(null)

const periodType = ref<BudgetPeriodType>(store.periodConfig.type)
const anchorDay = ref(store.periodConfig.anchorDay ?? 25)
const startWeekday = ref(store.periodConfig.startWeekday ?? 1)

const baseDef = computed(() => currency(store.base))

const draftPeriodConfig = computed(() => {
  switch (periodType.value) {
    case 'anchored-month':
      return { type: 'anchored-month' as const, anchorDay: anchorDay.value }
    case 'weekly':
      return { type: 'weekly' as const, startWeekday: startWeekday.value }
    case 'fortnightly':
      return { type: 'fortnightly' as const, anchorDate: todayIso() }
    case 'calendar-month':
      return { type: 'calendar-month' as const }
  }
})

const draftPreview = computed(() => periodFor(todayIso(), draftPeriodConfig.value))

function openPeriodModal(): void {
  periodType.value = store.periodConfig.type
  anchorDay.value = store.periodConfig.anchorDay ?? 25
  startWeekday.value = store.periodConfig.startWeekday ?? 1
  periodModalOpen.value = true
}

async function savePeriod(): Promise<void> {
  await store.saveSettings({ budgetPeriod: draftPeriodConfig.value })
  store.goToCurrentPeriod()
  periodModalOpen.value = false
}

/**
 * Changing the base currency reinterprets every budget and goal limit, which were entered
 * as base-currency figures. That is worth an explicit confirmation.
 */
function requestCurrencyChange(code: CurrencyCode): void {
  currencyPickerOpen.value = false
  if (code === store.base) return
  pendingCurrency.value = code
  currencyAlertOpen.value = true
}

async function confirmCurrencyChange(): Promise<void> {
  if (!pendingCurrency.value) return
  await store.saveSettings({
    baseCurrency: pendingCurrency.value,
    activeCurrencies: Array.from(
      new Set([pendingCurrency.value, ...store.settings.activeCurrencies]),
    ),
  })
  pendingCurrency.value = null
}

async function setTheme(value: ThemePreference): Promise<void> {
  await store.saveSettings({ theme: value })
}

async function resetWithDemo(): Promise<void> {
  await store.resetApp(true)
}

async function resetEmpty(): Promise<void> {
  await store.resetApp(false)
  await router.replace('/tabs/home')
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/home" />
        </IonButtons>
        <IonTitle>Settings</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <IonListHeader class="app-section-title">Money</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem button :detail="true" @click="currencyPickerOpen = true">
            <IonIcon slot="start" :icon="cashOutline" color="primary" />
            <IonLabel>
              <h3>Main currency</h3>
              <p>{{ baseDef.code }} — {{ baseDef.name }}</p>
            </IonLabel>
          </IonItem>
          <IonItem button :detail="true" router-link="/currencies">
            <IonIcon slot="start" :icon="cashOutline" color="primary" />
            <IonLabel>
              <h3>Currencies &amp; rates</h3>
              <p>{{ store.settings.activeCurrencies.length }} in use</p>
            </IonLabel>
            <IonNote v-if="store.missingRates.length" slot="end" color="warning">
              {{ store.missingRates.length }} missing
            </IonNote>
          </IonItem>
          <IonItem button :detail="true" @click="openPeriodModal">
            <IonIcon slot="start" :icon="calendarNumberOutline" color="primary" />
            <IonLabel>
              <h3>Budget cycle</h3>
              <p>{{ describePeriodConfig(store.periodConfig) }}</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>

      <IonListHeader class="app-section-title">Appearance</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem>
            <IonIcon slot="start" :icon="colorPaletteOutline" color="primary" />
            <IonSelect
              :value="store.settings.theme"
              label="Theme"
              interface="popover"
              @ion-change="setTheme($event.detail.value)"
            >
              <IonSelectOption value="system">Follow system</IonSelectOption>
              <IonSelectOption value="light">Light</IonSelectOption>
              <IonSelectOption value="dark">Dark</IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>
      </div>

      <IonListHeader class="app-section-title">Security &amp; backup</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem :disabled="true">
            <IonIcon slot="start" :icon="lockClosedOutline" />
            <IonToggle :checked="store.settings.appLockEnabled">
              <IonLabel>
                <h3>App lock</h3>
                <p>Fingerprint or PIN — planned for a later build</p>
              </IonLabel>
            </IonToggle>
          </IonItem>
          <IonItem :disabled="true">
            <IonIcon slot="start" :icon="cloudUploadOutline" />
            <IonLabel>
              <h3>Backup &amp; restore</h3>
              <p>Export to a file, then Google Drive — arrives with the database</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>

      <IonListHeader class="app-section-title">Prototype data</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem button :detail="false" @click="resetWithDemo">
            <IonIcon slot="start" :icon="refreshOutline" color="primary" />
            <IonLabel>
              <h3>Reload sample data</h3>
              <p>Regenerate demo wallets, budgets and history</p>
            </IonLabel>
          </IonItem>
          <IonItem button :detail="false" @click="resetAlertOpen = true">
            <IonIcon slot="start" :icon="refreshOutline" color="danger" />
            <IonLabel color="danger">
              <h3>Start empty</h3>
              <p>Clear everything and run first-time setup again</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>

      <div class="app-card about">
        <IonIcon :icon="informationCircleOutline" color="primary" />
        <div>
          <strong>Prototype build</strong>
          <p class="app-muted">
            Screens and behaviour are complete, but data lives in memory only and resets on
            reload. Persistence, local backup and Google Drive sync come in the next stage.
          </p>
        </div>
      </div>

      <!-- Base currency picker -->
      <IonModal :is-open="currencyPickerOpen" @did-dismiss="currencyPickerOpen = false">
        <CurrencyPicker
          :selected="store.base"
          :favourites="store.settings.activeCurrencies"
          title="Main currency"
          @select="requestCurrencyChange"
          @dismiss="currencyPickerOpen = false"
        />
      </IonModal>

      <IonAlert
        :is-open="currencyAlertOpen"
        header="Change main currency?"
        :message="`Budget limits and goal targets were entered as ${store.base} figures. They keep their numeric values and will now read as ${pendingCurrency ?? ''}. Wallet balances and past transactions are unaffected.`"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Change', role: 'confirm', handler: confirmCurrencyChange },
        ]"
        @did-dismiss="currencyAlertOpen = false"
      />

      <!-- Budget cycle -->
      <IonModal
        :is-open="periodModalOpen"
        :initial-breakpoint="0.85"
        :breakpoints="[0, 0.85]"
        @did-dismiss="periodModalOpen = false"
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Budget cycle</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" @click="savePeriod">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonRadioGroup v-model="periodType">
              <IonItem>
                <IonRadio value="calendar-month" label-placement="end" justify="start">
                  Calendar month
                </IonRadio>
              </IonItem>
              <IonItem>
                <IonRadio value="anchored-month" label-placement="end" justify="start">
                  Monthly from a chosen day
                </IonRadio>
              </IonItem>
              <IonItem>
                <IonRadio value="weekly" label-placement="end" justify="start">Weekly</IonRadio>
              </IonItem>
              <IonItem>
                <IonRadio value="fortnightly" label-placement="end" justify="start">
                  Every two weeks
                </IonRadio>
              </IonItem>
            </IonRadioGroup>
          </IonList>

          <IonList v-if="periodType === 'anchored-month'" lines="none">
            <IonItem>
              <IonInput
                v-model.number="anchorDay"
                type="number"
                min="1"
                max="28"
                label="Cycle starts on day"
                label-placement="stacked"
              />
            </IonItem>
          </IonList>

          <IonList v-if="periodType === 'weekly'" lines="none">
            <IonItem>
              <IonSelect
                v-model.number="startWeekday"
                label="Week starts on"
                label-placement="stacked"
                interface="popover"
              >
                <IonSelectOption v-for="(day, i) in WEEKDAY_NAMES" :key="day" :value="i">
                  {{ day }}
                </IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>

          <div class="preview">
            <span class="app-muted">Current cycle would be</span>
            <strong>{{ draftPreview.label }}</strong>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        :is-open="resetAlertOpen"
        header="Clear all data?"
        message="Every wallet, transaction, budget and goal will be removed and first-time setup will run again."
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Clear', role: 'destructive', handler: resetEmpty },
        ]"
        @did-dismiss="resetAlertOpen = false"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.about {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.about ion-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.about p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.preview {
  margin-top: 14px;
  padding: 14px 16px;
  background: var(--app-surface-sunken);
  border-radius: var(--app-radius);
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.9rem;
}
</style>
