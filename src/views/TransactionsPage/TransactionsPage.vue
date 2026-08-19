<script setup lang="ts">
/**
 * Activity: the full transaction history, grouped by day with running filters.
 */
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, closeCircle, filterOutline, receiptOutline } from 'ionicons/icons'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import MoneyText from '@/components/MoneyText/MoneyText.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher/PeriodSwitcher.vue'
import TransactionModal from '@/components/TransactionModal/TransactionModal.vue'
import TransactionRow from '@/components/TransactionRow/TransactionRow.vue'
import { useBudgetContext } from '@/composables/useBudgetContext'
import { formatDate } from '@/domain/format'
import type { Id, Transaction, TransactionType } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

import { activeFilterCount as countFilters, applyFilters, dayGroups } from './utils'

const store = useBudgetStore()
const { ctx, period } = useBudgetContext()

const modalOpen = ref(false)
const editing = ref<Transaction | null>(null)
const filtersOpen = ref(false)
const search = ref('')
const typeFilter = ref<TransactionType | 'all'>('all')
const walletFilter = ref<Id | 'all'>('all')
const categoryFilter = ref<Id | 'all'>('all')
/** When false the list shows every transaction rather than only the selected cycle. */
const periodOnly = ref(true)

const filters = computed(() => ({
  search: search.value,
  type: typeFilter.value,
  walletId: walletFilter.value,
  categoryId: categoryFilter.value,
  periodOnly: periodOnly.value,
}))

const filtered = computed(() =>
  applyFilters(store.transactions, period.value, filters.value, store.categoriesById),
)

/** Grouped by date so the list reads as a diary rather than an undifferentiated feed. */
const grouped = computed(() => dayGroups(filtered.value, ctx.value))

const activeFilterCount = computed(() => countFilters(filters.value))

function clearFilters(): void {
  typeFilter.value = 'all'
  walletFilter.value = 'all'
  categoryFilter.value = 'all'
  periodOnly.value = true
}

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(tx: Transaction): void {
  editing.value = tx
  modalOpen.value = true
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonTitle>Activity</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="filtersOpen = true">
            <IonIcon slot="icon-only" :icon="filterOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Search notes and categories" :debounce="150" />
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <div class="app-card">
        <PeriodSwitcher v-if="periodOnly" :period="period" />
        <div v-else class="all-time app-muted">Showing all transactions</div>
      </div>

      <div v-if="activeFilterCount" class="app-chip-row filters">
        <IonChip v-if="!periodOnly" @click="periodOnly = true">
          <IonLabel>All time</IonLabel>
          <IonIcon :icon="closeCircle" />
        </IonChip>
        <IonChip v-if="typeFilter !== 'all'" @click="typeFilter = 'all'">
          <IonLabel>{{ typeFilter }}</IonLabel>
          <IonIcon :icon="closeCircle" />
        </IonChip>
        <IonChip v-if="walletFilter !== 'all'" @click="walletFilter = 'all'">
          <IonLabel>{{ store.walletsById.get(walletFilter)?.name }}</IonLabel>
          <IonIcon :icon="closeCircle" />
        </IonChip>
        <IonChip v-if="categoryFilter !== 'all'" @click="categoryFilter = 'all'">
          <IonLabel>{{ store.categoriesById.get(categoryFilter)?.name }}</IonLabel>
          <IonIcon :icon="closeCircle" />
        </IonChip>
      </div>

      <EmptyState
        v-if="grouped.length === 0"
        :icon="receiptOutline"
        title="Nothing here"
        :message="
          activeFilterCount || search
            ? 'No transactions match the current filters.'
            : 'No transactions in this cycle yet. Tap + to add one.'
        "
        :action-label="activeFilterCount ? 'Clear filters' : undefined"
        @action="clearFilters"
      />

      <template v-else>
        <div v-for="group in grouped" :key="group.date" class="group">
          <div class="group__head">
            <span class="app-muted">{{ formatDate(group.date) }}</span>
            <MoneyText :value="group.net" colored signed />
          </div>
          <div class="app-card app-card--flush">
            <IonList lines="full">
              <TransactionRow
                v-for="tx in group.items"
                :key="tx.id"
                :transaction="tx"
                :show-date="false"
                @select="openEdit"
              />
            </IonList>
          </div>
        </div>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="openNew">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <IonModal :is-open="modalOpen" @did-dismiss="modalOpen = false">
        <TransactionModal :transaction="editing" @dismiss="modalOpen = false" />
      </IonModal>

      <IonModal
        :is-open="filtersOpen"
        :initial-breakpoint="0.6"
        :breakpoints="[0, 0.6, 0.9]"
        @did-dismiss="filtersOpen = false"
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Filters</IonTitle>
            <IonButtons slot="end">
              <IonButton @click="filtersOpen = false">Done</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonSelect
              v-model="typeFilter"
              label="Type"
              label-placement="stacked"
              interface="popover"
            >
              <IonSelectOption value="all">All types</IonSelectOption>
              <IonSelectOption value="expense">Expense</IonSelectOption>
              <IonSelectOption value="income">Income</IonSelectOption>
              <IonSelectOption value="transfer">Transfer</IonSelectOption>
            </IonSelect>
            <IonSelect
              v-model="walletFilter"
              label="Wallet"
              label-placement="stacked"
              interface="popover"
            >
              <IonSelectOption value="all">All wallets</IonSelectOption>
              <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
                {{ w.name }}
              </IonSelectOption>
            </IonSelect>
            <IonSelect
              v-model="categoryFilter"
              label="Category"
              label-placement="stacked"
              interface="popover"
            >
              <IonSelectOption value="all">All categories</IonSelectOption>
              <IonSelectOption v-for="c in store.categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </IonSelectOption>
            </IonSelect>
            <IonSelect
              v-model="periodOnly"
              label="Date range"
              label-placement="stacked"
              interface="popover"
            >
              <IonSelectOption :value="true">Selected cycle only</IonSelectOption>
              <IonSelectOption :value="false">All time</IonSelectOption>
            </IonSelect>
          </IonList>
          <IonButton expand="block" fill="clear" @click="clearFilters">Reset filters</IonButton>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.all-time {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 6px 0;
}

.filters {
  margin-bottom: 8px;
}

.group {
  margin-bottom: 6px;
}

.group__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 6px 8px;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
