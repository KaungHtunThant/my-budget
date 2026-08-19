<script setup lang="ts">
/**
 * Recurring rules for regular bills and income.
 *
 * The prototype shows the rules and what they add up to per cycle; actually generating the
 * transactions on schedule needs a persistent `lastRunDate` to stay idempotent, which is a
 * Stage 2 concern. "Add now" lets the flow be exercised meanwhile.
 */
import { computed, ref } from 'vue'
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
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, close, repeatOutline, trashOutline } from 'ionicons/icons'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import MoneyText from '@/components/MoneyText/MoneyText.vue'
import { amountPlaceholder } from '@/domain/format'
import { parseMoney, toDecimalString } from '@/domain/money'
import { WEEKDAY_NAMES, todayIso } from '@/domain/period'
import type { Id, RecurrenceFrequency, RecurringRule, TransactionType } from '@/domain/types'
import { transactionFromRule } from '@/services/recurring'
import { useBudgetStore } from '@/stores/budget'

import {
  buildRule,
  canSaveRule,
  describeRule,
  monthlyCommitment,
  usesWeekday as anchoredToWeekday,
} from './utils'

const store = useBudgetStore()

const modalOpen = ref(false)
const editingId = ref<Id | null>(null)
const name = ref('')
const type = ref<TransactionType>('expense')
const amountText = ref('')
const walletId = ref<Id | null>(null)
const categoryId = ref<Id | null>(null)
const frequency = ref<RecurrenceFrequency>('monthly')
const dayOfMonth = ref(1)
const weekday = ref(1)
const active = ref(true)

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const usesWeekday = computed(() => anchoredToWeekday(frequency.value))

const canSave = computed(() =>
  canSaveRule(name.value, amountText.value, walletId.value, store.base),
)

const availableCategories = computed(() =>
  type.value === 'income' ? store.incomeCategories : store.expenseCategories,
)

/** Monthly-equivalent totals, so the commitment is visible as one figure. */
const commitment = computed(() => monthlyCommitment(store.rules, store.base))

function describe(rule: RecurringRule): string {
  return describeRule(rule, store.walletsById.get(rule.walletId))
}

function openNew(): void {
  editingId.value = null
  name.value = ''
  type.value = 'expense'
  amountText.value = ''
  walletId.value = store.wallets[0]?.id ?? null
  categoryId.value = store.expenseCategories[0]?.id ?? null
  frequency.value = 'monthly'
  dayOfMonth.value = 1
  weekday.value = 1
  active.value = true
  modalOpen.value = true
}

function openEdit(rule: RecurringRule): void {
  editingId.value = rule.id
  name.value = rule.name
  type.value = rule.type
  amountText.value = toDecimalString(rule.amount)
  walletId.value = rule.walletId
  categoryId.value = rule.categoryId
  frequency.value = rule.frequency
  dayOfMonth.value = rule.dayOfMonth ?? 1
  weekday.value = rule.weekday ?? 1
  active.value = rule.active
  modalOpen.value = true
}

async function save(): Promise<void> {
  const amount = parseMoney(amountText.value, store.base)
  if (!amount || !walletId.value) return

  const payload = buildRule({
    name: name.value,
    type: type.value,
    amount,
    walletId: walletId.value,
    categoryId: categoryId.value,
    frequency: frequency.value,
    dayOfMonth: dayOfMonth.value,
    weekday: weekday.value,
    active: active.value,
    today: todayIso(),
  })

  if (editingId.value) {
    const existing = store.rules.find((r) => r.id === editingId.value)
    if (existing) await store.editRule({ ...existing, ...payload })
  } else {
    await store.addRule(payload)
  }
  modalOpen.value = false
}

async function remove(id: Id): Promise<void> {
  await store.removeRule(id)
  modalOpen.value = false
}

async function toggleActive(rule: RecurringRule): Promise<void> {
  await store.editRule({ ...rule, active: !rule.active })
}

/** Record this rule's transaction today — a manual stand-in for scheduled generation. */
async function addNow(rule: RecurringRule): Promise<void> {
  await store.addTransaction(transactionFromRule(rule, todayIso()))
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Recurring</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <EmptyState
        v-if="store.rules.length === 0"
        :icon="repeatOutline"
        title="No recurring items"
        message="Add rent, subscriptions or regular income once, and see what they commit you to each month."
        action-label="Add a recurring item"
        @action="openNew"
      />

      <template v-else>
        <div class="app-card app-grid-2">
          <div>
            <span class="app-muted">Committed monthly</span>
            <MoneyText :value="commitment.expense" class="app-figure--large" />
          </div>
          <div>
            <span class="app-muted">Expected monthly</span>
            <MoneyText :value="commitment.income" class="app-figure--large" />
          </div>
        </div>

        <div class="app-card app-card--flush">
          <IonList lines="full">
            <IonItemSliding v-for="rule in store.rules" :key="rule.id">
              <IonItem button :detail="false" @click="openEdit(rule)">
                <IonIcon
                  slot="start"
                  :icon="repeatOutline"
                  :color="rule.active ? (rule.type === 'income' ? 'success' : 'primary') : 'medium'"
                />
                <IonLabel :class="{ inactive: !rule.active }">
                  <h3>{{ rule.name }}</h3>
                  <p>{{ describe(rule) }}</p>
                </IonLabel>
                <MoneyText slot="end" :value="rule.amount" :colored="rule.active" />
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption @click="addNow(rule)">Add now</IonItemOption>
                <IonItemOption color="medium" @click="toggleActive(rule)">
                  {{ rule.active ? 'Pause' : 'Resume' }}
                </IonItemOption>
                <IonItemOption color="danger" @click="remove(rule.id)">Delete</IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          </IonList>
        </div>

        <p class="app-muted note">
          Swipe a row for quick actions. Automatic generation on the due date arrives with the
          database stage — until then “Add now” records one immediately.
        </p>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="openNew">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <IonModal :is-open="modalOpen" @did-dismiss="modalOpen = false">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton @click="modalOpen = false">
                <IonIcon slot="icon-only" :icon="close" />
              </IonButton>
            </IonButtons>
            <IonTitle>{{ editingId ? 'Edit' : 'New' }} recurring item</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSave" @click="save">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonSegment v-model="type" class="type-segment">
            <IonSegmentButton value="expense">Bill</IonSegmentButton>
            <IonSegmentButton value="income">Income</IonSegmentButton>
          </IonSegment>

          <IonList lines="full">
            <IonItem>
              <IonInput v-model="name" label="Name" label-placement="stacked" placeholder="e.g. Rent" />
            </IonItem>
            <IonItem>
              <IonInput
                v-model="amountText"
                type="text"
                inputmode="decimal"
                :label="`Amount (${store.base})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(store.base)"
              />
            </IonItem>
            <IonItem>
              <IonSelect v-model="walletId" label="Wallet" label-placement="stacked" interface="action-sheet">
                <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
                  {{ w.name }} ({{ w.currency }})
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect v-model="categoryId" label="Category" label-placement="stacked" interface="action-sheet">
                <IonSelectOption v-for="c in availableCategories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect v-model="frequency" label="Repeats" label-placement="stacked" interface="popover">
                <IonSelectOption v-for="f in FREQUENCIES" :key="f.value" :value="f.value">
                  {{ f.label }}
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem v-if="usesWeekday">
              <IonSelect v-model.number="weekday" label="On" label-placement="stacked" interface="popover">
                <IonSelectOption v-for="(day, i) in WEEKDAY_NAMES" :key="day" :value="i">
                  {{ day }}
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem v-else>
              <IonInput
                v-model.number="dayOfMonth"
                type="number"
                min="1"
                max="28"
                label="Day of month"
                label-placement="stacked"
              />
            </IonItem>
            <IonItem>
              <IonToggle v-model="active">
                <IonLabel>Active</IonLabel>
              </IonToggle>
            </IonItem>
          </IonList>

          <IonNote class="modal-note">
            Day of month is capped at 28 so the rule fires in every month.
          </IonNote>

          <IonButton
            v-if="editingId"
            expand="block"
            fill="clear"
            color="danger"
            class="delete"
            @click="remove(editingId)"
          >
            <IonIcon slot="start" :icon="trashOutline" />
            Delete rule
          </IonButton>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.app-grid-2 > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-grid-2 span {
  font-size: 0.74rem;
}

.inactive {
  opacity: 0.5;
}

.note {
  font-size: 0.78rem;
  line-height: 1.5;
  padding: 4px 6px;
}

.type-segment {
  margin-bottom: 16px;
}

.modal-note {
  display: block;
  padding: 14px 4px;
  font-size: 0.8rem;
}

.delete {
  margin-top: 12px;
}
</style>
