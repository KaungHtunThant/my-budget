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
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { amountPlaceholder } from '@/domain/format'
import { parseMoney, toDecimalString } from '@/domain/money'
import { WEEKDAY_NAMES, todayIso } from '@/domain/period'
import type { Id, RecurrenceFrequency, RecurringRule, TransactionType } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

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

const usesWeekday = computed(() => frequency.value === 'weekly' || frequency.value === 'fortnightly')

const canSave = computed(() => {
  const parsed = parseMoney(amountText.value, store.base)
  return name.value.trim().length > 0 && parsed !== null && parsed.minor > 0 && Boolean(walletId.value)
})

const availableCategories = computed(() =>
  type.value === 'income' ? store.incomeCategories : store.expenseCategories,
)

/** Monthly-equivalent totals, so the commitment is visible as one figure. */
const monthlyCommitment = computed(() => {
  const perMonth = (rule: RecurringRule): number => {
    const factor =
      rule.frequency === 'weekly'
        ? 52 / 12
        : rule.frequency === 'fortnightly'
          ? 26 / 12
          : rule.frequency === 'yearly'
            ? 1 / 12
            : 1
    return Math.round(rule.amount.minor * factor)
  }
  const expenses = store.rules.filter((r) => r.active && r.type === 'expense')
  const income = store.rules.filter((r) => r.active && r.type === 'income')
  return {
    expense: { minor: expenses.reduce((a, r) => a + perMonth(r), 0), currency: store.base },
    income: { minor: income.reduce((a, r) => a + perMonth(r), 0), currency: store.base },
  }
})

function describe(rule: RecurringRule): string {
  const parts: string[] = []
  switch (rule.frequency) {
    case 'weekly':
      parts.push(`Every ${WEEKDAY_NAMES[rule.weekday ?? 1]}`)
      break
    case 'fortnightly':
      parts.push(`Every 2 weeks on ${WEEKDAY_NAMES[rule.weekday ?? 1]}`)
      break
    case 'monthly':
      parts.push(`Monthly on day ${rule.dayOfMonth ?? 1}`)
      break
    case 'yearly':
      parts.push(`Yearly on day ${rule.dayOfMonth ?? 1}`)
      break
  }
  const wallet = store.walletsById.get(rule.walletId)
  if (wallet) parts.push(wallet.name)
  return parts.join(' · ')
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

  const payload = {
    name: name.value.trim(),
    type: type.value,
    amount,
    walletId: walletId.value,
    toWalletId: null,
    categoryId: type.value === 'transfer' ? null : categoryId.value,
    frequency: frequency.value,
    dayOfMonth: usesWeekday.value ? null : dayOfMonth.value,
    weekday: usesWeekday.value ? weekday.value : null,
    startDate: todayIso(),
    endDate: null,
    lastRunDate: null,
    active: active.value,
    note: '',
  }

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
  await store.addTransaction({
    type: rule.type,
    amount: rule.amount,
    fx: null,
    walletId: rule.walletId,
    toWalletId: rule.toWalletId,
    toAmount: null,
    categoryId: rule.categoryId,
    date: todayIso(),
    note: rule.name,
    recurringRuleId: rule.id,
    goalId: null,
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
            <MoneyText :value="monthlyCommitment.expense" class="app-figure--large" />
          </div>
          <div>
            <span class="app-muted">Expected monthly</span>
            <MoneyText :value="monthlyCommitment.income" class="app-figure--large" />
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
