<script setup lang="ts">
/**
 * Currencies and manual rates.
 *
 * The app never fetches a rate. This screen is where the user records what a currency is
 * worth against their base currency, used only for combined multi-currency totals — each
 * individual transaction keeps the rate it was entered with, so editing a rate here never
 * rewrites history.
 */
import { computed, ref, watch } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, alertCircleOutline } from 'ionicons/icons'
import CurrencyPicker from '@/components/CurrencyPicker/CurrencyPicker.vue'
import { type CurrencyCode, currency } from '@/domain/currency'
import { formatMoney, formatRate } from '@/domain/format'
import { fromMajor } from '@/domain/money'
import { convert, isValidRate } from '@/domain/fx'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const pickerOpen = ref(false)
/** Local text state per currency so a half-typed rate is not written to settings. */
const drafts = ref<Record<string, string>>({})

const others = computed(() =>
  store.settings.activeCurrencies.filter((c) => c !== store.base),
)

/** Currencies held in a wallet — these are the ones that actually need a rate. */
const inUse = computed(() => new Set(store.wallets.map((w) => w.currency)))

function syncDrafts(): void {
  const next: Record<string, string> = {}
  for (const code of others.value) {
    const rate = store.settings.rates[code]
    next[code] = rate === undefined ? '' : String(rate)
  }
  drafts.value = next
}

watch([others, () => store.settings.rates], syncDrafts, { immediate: true, deep: true })

async function commit(code: CurrencyCode): Promise<void> {
  const raw = drafts.value[code]?.replace(',', '.') ?? ''
  const value = Number(raw)
  if (!raw.trim() || !isValidRate(value)) return
  await store.setRate(code, value)
}

function preview(code: CurrencyCode): string | null {
  const value = Number(drafts.value[code]?.replace(',', '.') ?? '')
  if (!isValidRate(value)) return null
  const sample = fromMajor(100, code)
  return `${formatMoney(sample)} = ${formatMoney(convert(sample, store.base, value))}`
}

async function addCurrency(code: CurrencyCode): Promise<void> {
  pickerOpen.value = false
  if (store.settings.activeCurrencies.includes(code)) return
  await store.saveSettings({
    activeCurrencies: [...store.settings.activeCurrencies, code],
  })
}

async function removeCurrency(code: CurrencyCode): Promise<void> {
  if (inUse.value.has(code)) return
  const rates = { ...store.settings.rates }
  delete rates[code]
  await store.saveSettings({
    activeCurrencies: store.settings.activeCurrencies.filter((c) => c !== code),
    rates,
  })
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Currencies &amp; rates</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <div class="app-card app-card--stack">
        <span class="app-muted">Main currency</span>
        <div class="base">
          <strong>{{ store.base }}</strong>
          <span class="app-muted">{{ currency(store.base).name }}</span>
        </div>
        <IonNote class="base__note">
          All totals and budgets are shown in {{ store.base }}. Change it in Settings.
        </IonNote>
      </div>

      <div v-if="store.missingRates.length" class="warn">
        <IonIcon :icon="alertCircleOutline" />
        <span>
          {{ store.missingRates.join(', ') }}
          {{ store.missingRates.length === 1 ? 'is' : 'are' }} held in a wallet but
          {{ store.missingRates.length === 1 ? 'has' : 'have' }} no rate, so
          {{ store.missingRates.length === 1 ? 'it is' : 'they are' }} left out of combined totals.
        </span>
      </div>

      <div class="app-section-title">Other currencies</div>

      <div v-if="others.length === 0" class="app-card">
        <p class="app-muted empty">
          Only {{ store.base }} is in use. Add a currency here, or create a wallet in another
          currency and it will appear automatically.
        </p>
      </div>

      <div v-for="code in others" :key="code" class="app-card rate-card">
        <div class="rate-card__head">
          <div>
            <strong>{{ code }}</strong>
            <span class="app-muted"> — {{ currency(code).name }}</span>
          </div>
          <IonButton
            v-if="!inUse.has(code)"
            fill="clear"
            size="small"
            color="danger"
            @click="removeCurrency(code)"
          >
            Remove
          </IonButton>
          <IonNote v-else color="primary">in use</IonNote>
        </div>

        <IonItem lines="none" class="rate-card__item">
          <IonInput
            v-model="drafts[code]"
            type="text"
            inputmode="decimal"
            :label="`1 ${code} = ? ${store.base}`"
            label-placement="stacked"
            placeholder="0.00"
            @ion-blur="commit(code)"
          />
        </IonItem>

        <div class="rate-card__preview app-muted">
          <template v-if="preview(code)">
            <span>{{ preview(code) }}</span>
            <span>1 {{ store.base }} = {{ formatRate(1 / Number(drafts[code])) }} {{ code }}</span>
          </template>
          <span v-else>Enter a rate to include this currency in combined totals.</span>
        </div>
      </div>

      <p class="app-muted footnote">
        Rates here are only used for combined totals. Each transaction keeps the rate you
        entered at the time, so changing a rate never alters past records.
      </p>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="pickerOpen = true">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <IonModal :is-open="pickerOpen" @did-dismiss="pickerOpen = false">
        <CurrencyPicker
          :selected="store.base"
          :favourites="store.settings.activeCurrencies"
          title="Add currency"
          @select="addCurrency"
          @dismiss="pickerOpen = false"
        />
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.base {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.base strong {
  font-size: 1.5rem;
}

.base__note {
  display: block;
  padding-top: 6px;
  font-size: 0.78rem;
}

.warn {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: var(--app-radius);
  background: rgba(var(--ion-color-warning-rgb), 0.14);
  color: var(--ion-color-warning-shade);
  font-size: 0.82rem;
  line-height: 1.45;
}

.warn ion-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.empty {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
}

.rate-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.rate-card__item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.rate-card__preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  padding-top: 8px;
}

.footnote {
  font-size: 0.78rem;
  line-height: 1.5;
  padding: 6px 6px 0;
}

.close-hidden {
  display: none;
}
</style>
