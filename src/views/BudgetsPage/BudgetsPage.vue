<script setup lang="ts">
/**
 * Budgets for the selected cycle.
 *
 * The pace marker on each bar is the point of this screen: 70% spent means something very
 * different on day 3 than on day 28, and the marker makes that readable at a glance.
 */
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, close, pieChartOutline, trashOutline } from 'ionicons/icons'
import { iconFor } from '@/theme/icons'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import MoneyText from '@/components/MoneyText/MoneyText.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher/PeriodSwitcher.vue'
import ProgressMeter from '@/components/ProgressMeter/ProgressMeter.vue'
import { amountPlaceholder, formatMoney } from '@/domain/format'
import { parseMoney, toDecimalString } from '@/domain/money'
import { describePeriodConfig, periodProgress, todayIso } from '@/domain/period'
import type { Budget, BudgetStatus, Id } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const modalOpen = ref(false)
const editingId = ref<Id | null>(null)
const formCategoryId = ref<Id | null>(null)
const formLimit = ref('')
const formRollover = ref(false)

const pace = computed(() => (store.isCurrentPeriod ? periodProgress(store.period, todayIso()) : null))

/** Categories without a budget yet — the only sensible options when adding one. */
const availableCategories = computed(() => {
  const used = new Set(store.budgets.map((b) => b.categoryId))
  return store.expenseCategories.filter((c) => !used.has(c.id) || c.id === formCategoryId.value)
})

const canSave = computed(() => {
  const parsed = parseMoney(formLimit.value, store.base)
  return Boolean(formCategoryId.value) && parsed !== null && parsed.minor > 0
})

function openNew(): void {
  editingId.value = null
  formCategoryId.value = availableCategories.value[0]?.id ?? null
  formLimit.value = ''
  formRollover.value = false
  modalOpen.value = true
}

function openEdit(status: BudgetStatus): void {
  editingId.value = status.budget.id
  formCategoryId.value = status.budget.categoryId
  formLimit.value = toDecimalString(status.budget.limit)
  formRollover.value = status.budget.rollover
  modalOpen.value = true
}

async function save(): Promise<void> {
  const limit = parseMoney(formLimit.value, store.base)
  if (!limit || !formCategoryId.value) return

  if (editingId.value) {
    const existing = store.budgets.find((b) => b.id === editingId.value)
    if (existing) {
      await store.editBudget({
        ...existing,
        categoryId: formCategoryId.value,
        limit,
        rollover: formRollover.value,
      })
    }
  } else {
    await store.addBudget({
      categoryId: formCategoryId.value,
      limit,
      rollover: formRollover.value,
      archived: false,
    } satisfies Omit<Budget, 'id'>)
  }
  modalOpen.value = false
}

async function remove(): Promise<void> {
  if (editingId.value) await store.removeBudget(editingId.value)
  modalOpen.value = false
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonTitle>Budgets</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <div class="app-card">
        <PeriodSwitcher :period="store.period" />
        <IonNote class="cycle-note">{{ describePeriodConfig(store.periodConfig) }}</IonNote>
      </div>

      <EmptyState
        v-if="store.budgetStatusList.length === 0"
        :icon="pieChartOutline"
        title="No budgets set"
        message="Set a spending limit on a category and this screen will show how much of it you have used each cycle."
        action-label="Add a budget"
        @action="openNew"
      />

      <template v-else>
        <div class="app-card summary">
          <div class="summary__figures">
            <div>
              <span class="app-muted">Budgeted</span>
              <MoneyText :value="store.budgetSummary.budgeted" class="app-figure--large" />
            </div>
            <div>
              <span class="app-muted">Spent</span>
              <MoneyText :value="store.budgetSummary.spent" class="app-figure--large" />
            </div>
            <div>
              <span class="app-muted">Left</span>
              <MoneyText
                :value="store.budgetSummary.remaining"
                colored
                class="app-figure--large"
              />
            </div>
          </div>
          <ProgressMeter
            :percent="store.budgetSummary.percentUsed"
            :pace="pace"
            :over="store.budgetSummary.remaining.minor < 0"
          />
          <p v-if="store.budgetSummary.overspentCount" class="over-note">
            {{ store.budgetSummary.overspentCount }}
            {{ store.budgetSummary.overspentCount === 1 ? 'budget is' : 'budgets are' }} over limit.
          </p>
        </div>

        <div class="app-section-title">By category</div>
        <div class="app-card">
          <button
            v-for="status in store.budgetStatusList"
            :key="status.budget.id"
            class="row"
            type="button"
            @click="openEdit(status)"
          >
            <div class="row__head">
              <div class="row__name">
                <IonIcon :icon="iconFor(status.category.icon)" :color="status.category.color" />
                <span>{{ status.category.name }}</span>
              </div>
              <MoneyText :value="status.remaining" colored />
            </div>
            <ProgressMeter
              :percent="status.percentUsed"
              :color="status.category.color"
              :pace="pace"
              :over="status.overspent"
            />
            <div class="row__detail app-muted">
              <span>
                {{ formatMoney(status.spent) }} of {{ formatMoney(status.limit) }}
              </span>
              <span v-if="status.carriedIn.minor > 0" class="row__rollover">
                incl. {{ formatMoney(status.carriedIn) }} rolled over
              </span>
            </div>
          </button>
        </div>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :disabled="availableCategories.length === 0" @click="openNew">
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
            <IonTitle>{{ editingId ? 'Edit' : 'New' }} budget</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSave" @click="save">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonSelect
                v-model="formCategoryId"
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
              <IonInput
                v-model="formLimit"
                type="text"
                inputmode="decimal"
                :label="`Limit per cycle (${store.base})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(store.base)"
              />
            </IonItem>
            <IonItem>
              <IonToggle v-model="formRollover">
                <IonLabel>
                  <h3>Roll over unspent</h3>
                  <p>Add what you did not spend to next cycle's limit</p>
                </IonLabel>
              </IonToggle>
            </IonItem>
          </IonList>

          <IonNote class="modal-note">
            Budgets are set in {{ store.base }}. Spending in another currency is converted
            using the rate stored with each transaction.
          </IonNote>

          <IonButton
            v-if="editingId"
            expand="block"
            fill="clear"
            color="danger"
            class="delete"
            @click="remove"
          >
            <IonIcon slot="start" :icon="trashOutline" />
            Delete budget
          </IonButton>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.cycle-note {
  display: block;
  text-align: center;
  font-size: 0.76rem;
  padding-top: 4px;
}

.summary__figures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.summary__figures > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary__figures span {
  font-size: 0.74rem;
}

.over-note {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
}

.row {
  display: grid;
  gap: 7px;
  width: 100%;
  padding: 14px 0;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.row:first-child {
  padding-top: 2px;
}

.row:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.row__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
}

.row__name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row__detail {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.76rem;
}

.row__rollover {
  color: var(--ion-color-primary);
}

.modal-note {
  display: block;
  padding: 14px 4px;
  font-size: 0.8rem;
  line-height: 1.45;
}

.delete {
  margin-top: 12px;
}
</style>
