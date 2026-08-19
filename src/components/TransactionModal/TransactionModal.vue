<script setup lang="ts">
/**
 * Add or edit a transaction.
 *
 * The multi-currency rule the whole app rests on lives here. A wallet holds exactly one
 * currency, so:
 *  - Income/expense: if the amount was in a different currency, the user supplies the rate
 *    and we store both the entered amount and the converted wallet-currency amount.
 *  - Transfer between wallets of different currencies: the user supplies the rate and we
 *    store what left one wallet and what arrived in the other, separately.
 *
 * Either way the rate is frozen onto the record. Nothing recalculates it later.
 */
import { computed, ref, watch } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { close, swapHorizontalOutline, trashOutline } from 'ionicons/icons'
import CurrencyPicker from '../CurrencyPicker/CurrencyPicker.vue'
import type { CurrencyCode } from '@/domain/currency'
import { amountPlaceholder, formatMoney, formatRate } from '@/domain/format'
import { toDecimalString, zero } from '@/domain/money'
import { todayIso } from '@/domain/period'
import type { Id, Transaction, TransactionType } from '@/domain/types'
import { inverseRate } from '@/domain/fx'
import { parseRate } from '@/services/fx'
import {
  type TransactionDraft,
  buildTransaction,
  canSaveDraft,
  needsRate as entryNeedsRate,
  rateFrom as rateFromOf,
  rateTextFor,
  rateTo as rateToOf,
  resolveDraft,
  walletCurrency as walletCurrencyOf,
} from '@/services/transactions'
import { useBudgetStore } from '@/stores/budget'

const props = defineProps<{
  /** Existing transaction to edit, or null to create a new one. */
  transaction: Transaction | null
  /** Preselected type when creating. */
  initialType?: TransactionType
}>()

const emit = defineEmits<{ dismiss: [] }>()

const store = useBudgetStore()

const type = ref<TransactionType>(props.initialType ?? 'expense')
const walletId = ref<Id | null>(null)
const toWalletId = ref<Id | null>(null)
const categoryId = ref<Id | null>(null)
const amountText = ref('')
const entryCurrency = ref<CurrencyCode>(store.base)
const rateText = ref('')
const date = ref(todayIso())
const note = ref('')
const saving = ref(false)
const error = ref('')
const pickerOpen = ref(false)

const editing = computed(() => props.transaction !== null)

/**
 * The form as one value, so every rule below is a plain function of it. Assembled inside a
 * computed rather than hoisted, or the primitives would freeze at setup.
 */
const draft = computed<TransactionDraft>(() => ({
  type: type.value,
  base: store.base,
  walletId: walletId.value,
  toWalletId: toWalletId.value,
  categoryId: categoryId.value,
  amountText: amountText.value,
  entryCurrency: entryCurrency.value,
  rateText: rateText.value,
  date: date.value,
  note: note.value,
  recurringRuleId: props.transaction?.recurringRuleId ?? null,
  goalId: props.transaction?.goalId ?? null,
}))

const walletCurrency = computed<CurrencyCode>(() => walletCurrencyOf(draft.value, store.wallets))

const availableCategories = computed(() =>
  type.value === 'income' ? store.incomeCategories : store.expenseCategories,
)

const transferTargets = computed(() => store.wallets.filter((w) => w.id !== walletId.value))

const needsRate = computed(() => entryNeedsRate(draft.value, store.wallets))
const rateFrom = computed<CurrencyCode>(() => rateFromOf(draft.value, store.wallets))
const rateTo = computed<CurrencyCode>(() => rateToOf(draft.value, store.wallets))

const rate = computed(() => parseRate(rateText.value))

/** Entered amount, what lands in the wallet, what arrives on a transfer, and rate validity. */
const resolved = computed(() => resolveDraft(draft.value, store.wallets))

const rateValid = computed(() => resolved.value?.rateOk ?? !needsRate.value)
const enteredMoney = computed(() => resolved.value?.entered ?? null)
const resolvedAmount = computed(() => resolved.value?.amount ?? null)
const resolvedToAmount = computed(() => resolved.value?.toAmount ?? null)

const canSave = computed(() => canSaveDraft(draft.value, store.wallets))

// Default the entry currency to the wallet's, which is right the vast majority of the time.
watch(walletId, () => {
  if (!editing.value) entryCurrency.value = walletCurrency.value
})

watch(type, () => {
  // Drop the category only when it cannot belong to the new type. Clearing it
  // unconditionally would wipe the category of any income transaction being edited:
  // `load()` assigns the type first, and this watcher runs after it.
  const stillValid = availableCategories.value.some((c) => c.id === categoryId.value)
  if (!stillValid) categoryId.value = null
  if (type.value !== 'transfer') toWalletId.value = null
})

function load(): void {
  const tx = props.transaction
  if (tx) {
    type.value = tx.type
    walletId.value = tx.walletId
    toWalletId.value = tx.toWalletId
    categoryId.value = tx.categoryId
    date.value = tx.date
    note.value = tx.note
    if (tx.fx) {
      entryCurrency.value = tx.fx.enteredAmount.currency
      amountText.value = toDecimalString(tx.fx.enteredAmount)
    } else {
      entryCurrency.value = tx.amount.currency
      amountText.value = toDecimalString(tx.amount)
    }
    rateText.value = rateTextFor(tx)
  } else {
    type.value = props.initialType ?? 'expense'
    walletId.value = store.wallets[0]?.id ?? null
    entryCurrency.value = walletCurrency.value
    amountText.value = ''
    rateText.value = ''
    categoryId.value = null
    toWalletId.value = null
    date.value = todayIso()
    note.value = ''
  }
  error.value = ''
}

load()

function pickCurrency(code: CurrencyCode): void {
  entryCurrency.value = code
  pickerOpen.value = false
  // A fresh currency needs a fresh rate; a stale one would be silently wrong.
  if (code !== walletCurrency.value) rateText.value = ''
}

async function save(): Promise<void> {
  // Guard order mirrors the previous implementation exactly, including the consequence that a
  // non-transfer missing its rate reports the amount message rather than the rate one — its
  // resolved amount is null, so it fails this check first. Preserved so this commit is a no-op;
  // see the note in the commit message.
  const state = resolved.value
  if (!state || state.amount === null || walletId.value === null) {
    error.value = 'Enter an amount and choose a wallet.'
    return
  }
  if (needsRate.value && !rateValid.value) {
    error.value = 'Enter the exchange rate you used.'
    return
  }

  const payload = buildTransaction(draft.value, store.wallets)
  if (!payload) return

  saving.value = true
  try {
    if (props.transaction) {
      await store.editTransaction({ ...props.transaction, ...payload })
    } else {
      await store.addTransaction(payload)
    }
    emit('dismiss')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.transaction) return
  await store.removeTransaction(props.transaction.id)
  emit('dismiss')
}
</script>

<template>
  <IonHeader>
    <IonToolbar>
      <IonButtons slot="start">
        <IonButton @click="emit('dismiss')">
          <IonIcon slot="icon-only" :icon="close" />
        </IonButton>
      </IonButtons>
      <IonTitle>{{ editing ? 'Edit' : 'New' }} transaction</IonTitle>
      <IonButtons slot="end">
        <IonButton :strong="true" :disabled="!canSave || saving" @click="save">Save</IonButton>
      </IonButtons>
    </IonToolbar>
  </IonHeader>

  <IonContent class="ion-padding-horizontal">
    <IonSegment v-model="type" class="type-segment">
      <IonSegmentButton value="expense">Expense</IonSegmentButton>
      <IonSegmentButton value="income">Income</IonSegmentButton>
      <IonSegmentButton value="transfer">Transfer</IonSegmentButton>
    </IonSegment>

    <!-- Amount -->
    <div class="amount-block">
      <button
        v-if="type !== 'transfer'"
        class="currency-tag"
        type="button"
        @click="pickerOpen = true"
      >
        {{ entryCurrency }}
      </button>
      <span v-else class="currency-tag currency-tag--static">{{ walletCurrency }}</span>
      <IonInput
        v-model="amountText"
        class="amount-input"
        type="text"
        inputmode="decimal"
        :placeholder="amountPlaceholder(type === 'transfer' ? walletCurrency : entryCurrency)"
        aria-label="Amount"
      />
    </div>
    <IonNote v-if="type !== 'transfer'" class="hint">
      Tap the currency to enter this in another currency.
    </IonNote>

    <IonList lines="full" class="form-list">
      <IonItem>
        <IonSelect
          v-model="walletId"
          :label="type === 'transfer' ? 'From wallet' : type === 'income' ? 'Into wallet' : 'Paid from'"
          label-placement="stacked"
          interface="action-sheet"
        >
          <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
            {{ w.name }} ({{ w.currency }})
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem v-if="type === 'transfer'">
        <IonSelect
          v-model="toWalletId"
          label="To wallet"
          label-placement="stacked"
          interface="action-sheet"
        >
          <IonSelectOption v-for="w in transferTargets" :key="w.id" :value="w.id">
            {{ w.name }} ({{ w.currency }})
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem v-if="type !== 'transfer'">
        <IonSelect
          v-model="categoryId"
          label="Category"
          label-placement="stacked"
          interface="action-sheet"
        >
          <IonSelectOption v-for="c in availableCategories" :key="c.id" :value="c.id">
            {{ c.name }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem>
        <IonLabel>Date</IonLabel>
        <IonDatetimeButton slot="end" datetime="tx-date" />
      </IonItem>

      <IonItem>
        <IonTextarea
          v-model="note"
          label="Note"
          label-placement="stacked"
          :auto-grow="true"
          :rows="1"
          placeholder="Optional"
        />
      </IonItem>
    </IonList>

    <!-- Exchange rate, only when money crosses currencies -->
    <div v-if="needsRate" class="fx-card">
      <div class="fx-card__head">
        <IonIcon :icon="swapHorizontalOutline" />
        <strong>Exchange rate</strong>
      </div>
      <p class="fx-card__lead">
        This crosses currencies, so enter the rate you actually got. It is stored with the
        transaction and never updated later.
      </p>
      <IonItem lines="none" class="fx-card__item">
        <IonInput
          v-model="rateText"
          type="text"
          inputmode="decimal"
          :label="`1 ${rateFrom} = ? ${rateTo}`"
          label-placement="stacked"
          placeholder="0.00"
        />
      </IonItem>
      <div v-if="rateValid && rate !== null" class="fx-card__preview">
        <span class="app-muted">1 {{ rateTo }} = {{ formatRate(inverseRate(rate)) }} {{ rateFrom }}</span>
        <template v-if="type === 'transfer' && resolvedToAmount">
          <strong>
            {{ formatMoney(enteredMoney ?? zero(walletCurrency)) }} →
            {{ formatMoney(resolvedToAmount) }}
          </strong>
        </template>
        <template v-else-if="resolvedAmount">
          <strong>
            {{ formatMoney(enteredMoney ?? zero(entryCurrency)) }} →
            {{ formatMoney(resolvedAmount) }}
          </strong>
        </template>
      </div>
    </div>

    <IonText v-if="error" color="danger" class="error">{{ error }}</IonText>

    <IonButton
      v-if="editing"
      expand="block"
      fill="clear"
      color="danger"
      class="delete-button"
      @click="remove"
    >
      <IonIcon slot="start" :icon="trashOutline" />
      Delete transaction
    </IonButton>

    <IonModal keep-contents-mounted>
      <IonDatetime
        id="tx-date"
        v-model="date"
        presentation="date"
        :prefer-wheel="false"
        :show-default-buttons="true"
      />
    </IonModal>

    <IonModal :is-open="pickerOpen" @did-dismiss="pickerOpen = false">
      <CurrencyPicker
        :selected="entryCurrency"
        :favourites="store.settings.activeCurrencies"
        title="Amount currency"
        @select="pickCurrency"
        @dismiss="pickerOpen = false"
      />
    </IonModal>
  </IonContent>
</template>

<style scoped>
.type-segment {
  margin: 12px 0 20px;
}

.amount-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px 4px;
  border-bottom: 2px solid var(--app-border);
}

.currency-tag {
  border: 1px solid var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.currency-tag--static {
  border-color: var(--app-border);
  background: var(--app-surface-sunken);
  color: var(--app-text-muted);
  cursor: default;
}

.amount-input {
  --padding-start: 0;
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hint {
  display: block;
  font-size: 0.78rem;
  padding: 8px 4px 0;
}

.form-list {
  margin: 16px -16px 0;
  background: transparent;
}

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

.error {
  display: block;
  padding: 12px 4px 0;
  font-size: 0.85rem;
}

.delete-button {
  margin-top: 24px;
}
</style>
