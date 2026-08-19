<script setup lang="ts">
/**
 * The exchange-rate field, shown by a form only when its amount crosses currencies.
 *
 * Three forms need one — a transaction, a recurring rule, a budget limit — and they need it to be
 * the *same* field: the rate convention (`1 from = ? to`), the inverse underneath it, and the
 * "entered → converted" preview are things a user should learn once. That is a shared *markup*
 * need, so it is a component rather than three copies of a card.
 *
 * The parent owns the text and decides when the field appears; this owns how a rate reads.
 */
import { computed } from 'vue'
import { IonIcon, IonInput, IonItem } from '@ionic/vue'
import { swapHorizontalOutline } from 'ionicons/icons'
import type { CurrencyCode } from '@/domain/currency'
import { formatMoney, formatRate } from '@/domain/format'
import { inverseRate } from '@/domain/fx'
import type { Money } from '@/domain/money'
import { parseRate } from '@/services/fx'

const rateText = defineModel<string>({ required: true })

const props = defineProps<{
  /** The currency the amount was typed in. */
  from: CurrencyCode
  /** The currency the record will store. */
  to: CurrencyCode
  /** The amount as typed, for the preview. Null while it is unparseable. */
  entered: Money | null
  /** What it converts to, or null while the rate is unusable. */
  converted: Money | null
  /** One sentence on where this rate ends up, which differs per record. */
  lead: string
}>()

/** Null covers both "not typed yet" and "not a usable rate", which read the same here. */
const rate = computed(() => parseRate(rateText.value))

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
      <strong>Exchange rate</strong>
    </div>
    <p class="fx-card__lead">{{ lead }}</p>
    <IonItem lines="none" class="fx-card__item">
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
