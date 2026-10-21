<script setup lang="ts">
/**
 * The currency-conversion field, shown by a form only when its amount crosses currencies.
 *
 * Three forms need one — a transaction, a recurring rule, a budget limit — and they need it to be
 * the *same* field: the rate convention (`1 from = ? to`), the inverse underneath it, and the
 * "entered → converted" preview are things a user should learn once. That is a shared *markup*
 * need, so it is a component rather than three copies of a card.
 *
 * It takes the conversion either way round: the amount that came out in the other currency (the
 * default — it is the number on the statement), with the rate implied from it, or the rate itself.
 * Each way keeps its own text and only the active one counts; an implied rate is never copied into
 * the rate box, where its sixteen digits would either alarm or, rounded, no longer reproduce the
 * amount.
 *
 * The parent owns the text and decides when the field appears; this owns how a rate reads.
 */
import { computed } from 'vue'
import { IonIcon, IonInput, IonItem, IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue'
import { swapHorizontalOutline } from 'ionicons/icons'
import type { CurrencyCode } from '@/domain/currency'
import { amountPlaceholder, formatMoney, formatRate } from '@/domain/format'
import { impliedRate, inverseRate } from '@/domain/fx'
import type { Money } from '@/domain/money'
import { type FxMode, parseRate } from '@/services/fx'

const rateText = defineModel<string>({ required: true })
const convertedText = defineModel<string>('convertedText', { required: true })
const mode = defineModel<FxMode>('mode', { required: true })

const props = defineProps<{
  /** The currency the amount was typed in. */
  from: CurrencyCode
  /** The currency the record will store. */
  to: CurrencyCode
  /** The amount as typed, for the preview. Null while it is unparseable. */
  entered: Money | null
  /** What it converts to, or null while the rate is unusable. */
  converted: Money | null
  /** One sentence on where this conversion ends up, which differs per record. */
  lead: string
  /** The converted-amount input's label, e.g. "AED deducted from Cash". */
  amountLabel: string
}>()

/**
 * The rate in force: typed, or implied by the two amounts. Null covers both "not typed yet" and
 * "not usable", which read the same here.
 */
const rate = computed(() => {
  if (mode.value === 'rate') return parseRate(rateText.value)
  const { entered, converted } = props
  return entered && converted && entered.minor > 0 && converted.minor > 0
    ? impliedRate(entered, converted)
    : null
})

const preview = computed(() =>
  props.entered && props.converted
    ? `${formatMoney(props.entered)} → ${formatMoney(props.converted)}`
    : null,
)
</script>

<template>
  <div class="fx-card">
    <div class="fx-card__head">
      <IonIcon :icon="swapHorizontalOutline" />
      <strong>Currency conversion</strong>
    </div>
    <p class="fx-card__lead">{{ lead }}</p>
    <IonSegment v-model="mode" class="fx-card__mode">
      <IonSegmentButton value="amount">
        <IonLabel>{{ to }} amount</IonLabel>
      </IonSegmentButton>
      <IonSegmentButton value="rate">
        <IonLabel>Rate</IonLabel>
      </IonSegmentButton>
    </IonSegment>
    <IonItem v-if="mode === 'amount'" lines="none" class="fx-card__item">
      <IonInput
        v-model="convertedText"
        type="text"
        inputmode="decimal"
        :label="amountLabel"
        label-placement="stacked"
        :placeholder="amountPlaceholder(to)"
      />
    </IonItem>
    <IonItem v-else lines="none" class="fx-card__item">
      <IonInput
        v-model="rateText"
        type="text"
        inputmode="decimal"
        :label="`1 ${from} = ? ${to}`"
        label-placement="stacked"
        placeholder="0.00"
      />
    </IonItem>
    <div v-if="rate !== null" class="fx-card__preview">
      <span v-if="mode === 'amount'" class="app-muted">
        1 {{ from }} = {{ formatRate(rate) }} {{ to }}
      </span>
      <span class="app-muted">
        1 {{ to }} = {{ formatRate(inverseRate(rate)) }} {{ from }}
      </span>
      <strong v-if="preview">{{ preview }}</strong>
    </div>
  </div>
</template>

<style scoped>
.fx-card {
  margin: 18px 0 8px;
  padding: 14px 16px;
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.4);
  background: rgba(var(--ion-color-warning-rgb), 0.08);
  border-radius: var(--app-radius);
}

.fx-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.fx-card__lead {
  margin: 0 0 8px;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.fx-card__mode {
  margin-bottom: 4px;
}

.fx-card__item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.fx-card__preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
  padding-top: 8px;
}
</style>
