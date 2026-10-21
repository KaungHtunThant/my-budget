<script setup lang="ts">
/**
 * Settings.
 *
 * Base currency and budget cycle live here as well as in onboarding, because both are
 * things people change once they have used the app for a while. App lock is shown as a
 * disabled row rather than hidden — it is planned, and the screen should be honest about
 * where it will sit.
 *
 * Backup and restore: export goes out through the share sheet; import comes in through a
 * plain file input, is checked and previewed before anything is written (`previewImport`),
 * and then merges or replaces behind its own confirmation.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  type AlertButton,
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
  toastController,
} from '@ionic/vue'
import {
  cashOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  colorPaletteOutline,
  calendarNumberOutline,
  informationCircleOutline,
  lockClosedOutline,
  trashOutline,
} from 'ionicons/icons'
import CurrencyPicker from '@/components/CurrencyPicker/CurrencyPicker.vue'
import { type CurrencyCode, currency } from '@/domain/currency'
import {
  type BudgetPeriodType,
  WEEKDAY_NAMES,
  describePeriodConfig,
  periodFor,
  todayIso,
} from '@/domain/period'
import type { ThemePreference } from '@/domain/types'
import { periodConfigFrom } from '@/services/period'
import { withBaseCurrency } from '@/services/settings'
import { currenciesNeedingRates } from '@/services/fx'
import { type ImportPreview, useBudgetStore } from '@/stores/budget'
import { CLEAR_CONFIRMATION, confirmsClear, importSummary, needsWinnerChoice } from './utils'

const store = useBudgetStore()

const missingRates = computed(() => currenciesNeedingRates(store.wallets, store.settings))
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

const draftPeriodConfig = computed(() =>
  periodConfigFrom({
    type: periodType.value,
    anchorDay: anchorDay.value,
    startWeekday: startWeekday.value,
    today: todayIso(),
  }),
)

const draftPreview = computed(() => periodFor(todayIso(), draftPeriodConfig.value))

function openPeriodModal(): void {
  periodType.value = store.periodConfig.type
  anchorDay.value = store.periodConfig.anchorDay ?? 25
  startWeekday.value = store.periodConfig.startWeekday ?? 1
  periodModalOpen.value = true
}

async function savePeriod(): Promise<void> {
  await store.saveSettings({ budgetPeriod: draftPeriodConfig.value })
  // A new cycle shape can put "today" in a cycle that has not had its recurring copies yet.
  await store.rollRecurringBudgets(todayIso())
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
  await store.saveSettings(withBaseCurrency(store.settings, pendingCurrency.value))
  pendingCurrency.value = null
}

async function setTheme(value: ThemePreference): Promise<void> {
  await store.saveSettings({ theme: value })
}

/** Typed confirmation: returning false keeps the alert open until the word is right. */
function confirmResetEmpty(values: { confirm?: string }): boolean {
  if (!confirmsClear(values.confirm)) return false
  void resetEmpty()
  return true
}

async function resetEmpty(): Promise<void> {
  await store.resetApp(false)
  await router.replace('/tabs/home')
}

// --- backup ----------------------------------------------------------------

const appVersion = __APP_VERSION__
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
/** The file being restored, once it has passed its checks. */
const preview = ref<Extract<ImportPreview, { ok: true }> | null>(null)
const previewOpen = ref(false)
const winnerOpen = ref(false)
const replaceOpen = ref(false)
const importError = ref<string | null>(null)

async function toast(message: string): Promise<void> {
  const t = await toastController.create({ message, duration: 2500, position: 'bottom' })
  await t.present()
}

async function exportBackup(): Promise<void> {
  busy.value = true
  try {
    const outcome = await store.exportBackup()
    if (outcome === 'downloaded') await toast('Backup downloaded.')
  } catch {
    await toast('The backup could not be exported.')
  } finally {
    busy.value = false
  }
}

function chooseFile(): void {
  if (fileInput.value) {
    // Cleared first, or picking the same file twice in a row fires no change event.
    fileInput.value.value = ''
    fileInput.value.click()
  }
}

async function onFileChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const result = await store.previewImport(await file.text())
  if (!result.ok) {
    importError.value = result.reason
    return
  }
  preview.value = result
  previewOpen.value = true
}

const previewMessage = computed(() =>
  preview.value
    ? importSummary({
        appVersion: preview.value.appVersion,
        converted: preview.value.converted,
        exportedAt: preview.value.exportedAt,
        total: preview.value.plan.total,
      })
    : '',
)

const previewButtons = computed<AlertButton[]>(() => [
  { text: 'Cancel', role: 'cancel' },
  {
    text: 'Replace everything',
    role: 'destructive',
    handler: () => {
      replaceOpen.value = true
    },
  },
  {
    text: 'Merge',
    handler: () => {
      if (preview.value && needsWinnerChoice(preview.value.plan.total)) winnerOpen.value = true
      else void applyImport('merge')
    },
  },
])

async function applyImport(mode: 'merge' | 'replace', winner: 'incoming' | 'device' = 'incoming'): Promise<void> {
  if (!preview.value) return
  busy.value = true
  try {
    await store.importBackup(preview.value.data, mode, winner)
    await toast(mode === 'replace' ? 'Backup restored.' : 'Backup merged.')
  } catch {
    await toast('The backup could not be restored. Nothing was changed.')
  } finally {
    busy.value = false
    preview.value = null
  }
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
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
            <IonNote v-if="missingRates.length" slot="end" color="warning">
              {{ missingRates.length }} missing
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
          <IonItem button :detail="false" :disabled="busy" @click="exportBackup">
            <IonIcon slot="start" :icon="cloudUploadOutline" />
            <IonLabel>
              <h3>Export backup</h3>
              <p>Save everything to one file — keep it somewhere off this phone</p>
            </IonLabel>
          </IonItem>
          <IonItem button :detail="false" :disabled="busy" @click="chooseFile">
            <IonIcon slot="start" :icon="cloudDownloadOutline" />
            <IonLabel>
              <h3>Restore from backup</h3>
              <p>Merge a backup file in, or replace everything with it</p>
            </IonLabel>
          </IonItem>
        </IonList>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onFileChosen"
        />
      </div>

      <IonListHeader class="app-section-title">Data</IonListHeader>
      <div class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem button :detail="false" @click="resetAlertOpen = true">
            <IonIcon slot="start" :icon="trashOutline" color="danger" />
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
          <strong>My Budget {{ appVersion }}</strong>
          <p class="app-muted">
            Everything stays on this phone. Export a backup now and then, and keep the file
            somewhere else — it restores into this version or any later one.
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
        :expand-to-scroll="false"
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
        :message="`Every wallet, transaction, budget and goal will be removed and first-time setup will run again. Export a backup first if you might want them back. Type ${CLEAR_CONFIRMATION} to confirm.`"
        :inputs="[{ name: 'confirm', placeholder: CLEAR_CONFIRMATION, attributes: { autocapitalize: 'characters' } }]"
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Clear everything', role: 'destructive', handler: confirmResetEmpty },
        ]"
        @did-dismiss="resetAlertOpen = false"
      />

      <!-- Restore: preview, then a conflict choice or a replace confirmation -->
      <IonAlert
        :is-open="previewOpen"
        header="Restore this backup?"
        :message="previewMessage"
        :buttons="previewButtons"
        @did-dismiss="previewOpen = false"
      />
      <IonAlert
        :is-open="winnerOpen"
        header="Some records differ"
        message="The backup and this phone have different versions of some records. Which should be kept? Records only one side has are kept either way."
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'This phone’s', handler: () => applyImport('merge', 'device') },
          { text: 'The backup’s', handler: () => applyImport('merge', 'incoming') },
        ]"
        @did-dismiss="winnerOpen = false"
      />
      <IonAlert
        :is-open="replaceOpen"
        header="Replace everything?"
        message="Everything on this phone will be replaced by the backup. A copy of what is here now is kept on the phone first."
        :buttons="[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Replace', role: 'destructive', handler: () => applyImport('replace') },
        ]"
        @did-dismiss="replaceOpen = false"
      />
      <IonAlert
        :is-open="importError !== null"
        header="Can’t restore this file"
        :message="importError ?? ''"
        :buttons="['OK']"
        @did-dismiss="importError = null"
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
