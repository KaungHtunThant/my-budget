<script setup lang="ts">
/**
 * One transaction in a list. Shared by the dashboard and the activity screen so a
 * transaction reads identically wherever it appears.
 *
 * When a foreign-currency amount was entered, both readings are shown — the wallet-currency
 * amount that affects balances, and underneath what the user actually typed.
 */
import { computed } from 'vue'
import { IonIcon, IonItem, IonLabel, IonNote } from '@ionic/vue'
import { arrowForwardOutline, swapHorizontalOutline } from 'ionicons/icons'
import { iconFor } from '@/theme/icons'
import MoneyText from '../MoneyText/MoneyText.vue'
import { formatMoney } from '@/domain/format'
import { todayIso } from '@/domain/period'
import type { Transaction } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

import { displayAmount as signedForDisplay, rowColor, rowSubtitle, rowTitle } from './utils'

const props = defineProps<{ transaction: Transaction; showDate?: boolean }>()
const emit = defineEmits<{ select: [tx: Transaction] }>()

const store = useBudgetStore()

const category = computed(() =>
  props.transaction.categoryId ? store.categoriesById.get(props.transaction.categoryId) : undefined,
)

const wallet = computed(() => store.walletsById.get(props.transaction.walletId))
const toWallet = computed(() =>
  props.transaction.toWalletId ? store.walletsById.get(props.transaction.toWalletId) : undefined,
)

const goal = computed(() =>
  props.transaction.goalId ? store.goalsById.get(props.transaction.goalId) : undefined,
)

const entities = computed(() => ({
  category: category.value,
  wallet: wallet.value,
  toWallet: toWallet.value,
  goal: goal.value,
}))

const title = computed(() => rowTitle(props.transaction, entities.value))

const subtitle = computed(() =>
  rowSubtitle(props.transaction, entities.value, todayIso(), props.showDate !== false),
)

const icon = computed(() => {
  if (props.transaction.type === 'transfer') {
    return goal.value ? iconFor(goal.value.icon) : swapHorizontalOutline
  }
  return category.value ? iconFor(category.value.icon) : arrowForwardOutline
})

const color = computed(() => rowColor(props.transaction, entities.value))

/** Expenses read as negative on screen even though they are stored as positive amounts. */
const displayAmount = computed(() => signedForDisplay(props.transaction))
</script>

<template>
  <IonItem button :detail="false" @click="emit('select', transaction)">
    <div slot="start" class="avatar" :style="{ background: `rgba(var(--ion-color-${color}-rgb), 0.14)` }">
      <IonIcon :icon="icon" :color="color" />
    </div>

    <IonLabel>
      <h3>{{ title }}</h3>
      <p>{{ subtitle }}</p>
    </IonLabel>

    <div slot="end" class="trailing">
      <MoneyText
        :value="displayAmount"
        :colored="transaction.type !== 'transfer'"
        :signed="transaction.type === 'income'"
      />
      <IonNote v-if="transaction.fx" class="fx-note">
        {{ formatMoney(transaction.fx.enteredAmount) }} @ {{ transaction.fx.rate }}
      </IonNote>
      <IonNote v-else-if="transaction.toAmount && transaction.toAmount.currency !== transaction.amount.currency" class="fx-note">
        → {{ formatMoney(transaction.toAmount) }}
      </IonNote>
    </div>
  </IonItem>
</template>

<style scoped>
.avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  margin-inline-end: 12px;
}

.avatar ion-icon {
  font-size: 19px;
}

.trailing {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.fx-note {
  font-size: 0.7rem;
}
</style>
