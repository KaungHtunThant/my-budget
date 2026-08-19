<script setup lang="ts">
/**
 * Categories, split by income and expense.
 *
 * Deleting a category detaches its transactions rather than removing them — spend history
 * should never disappear because a label was tidied up.
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
  IonToolbar,
} from '@ionic/vue'
import { addOutline, close, pricetagsOutline, trashOutline } from 'ionicons/icons'
import { CATEGORY_ICON_NAMES, iconFor } from '@/theme/icons'
import EmptyState from '@/components/EmptyState/EmptyState.vue'
import MoneyText from '@/components/MoneyText/MoneyText.vue'
import { toBase } from '@/domain/budgeting'
import { sum, zero } from '@/domain/money'
import type { Category, CategoryKind, Id } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const tab = ref<CategoryKind>('expense')
const modalOpen = ref(false)
const editingId = ref<Id | null>(null)
const name = ref('')
const kind = ref<CategoryKind>('expense')
const icon = ref('pricetag-outline')
const color = ref('primary')

const ICONS = CATEGORY_ICON_NAMES

const COLORS = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'medium']

const visible = computed(() => store.categories.filter((c) => c.kind === tab.value))

const canSave = computed(() => name.value.trim().length > 0)

/** Spend or income per category this cycle, so the list is informative not just editable. */
const totals = computed(() => {
  const map = new Map<Id, ReturnType<typeof zero>>()
  for (const category of visible.value) {
    const amounts = store.periodTransactions
      .filter((t) => t.categoryId === category.id && t.type === tab.value)
      .map((t) => toBase(t.amount, store.ctx))
      .filter((m): m is NonNullable<typeof m> => m !== null)
    map.set(category.id, sum(amounts, store.base))
  }
  return map
})

function openNew(): void {
  editingId.value = null
  name.value = ''
  kind.value = tab.value
  icon.value = tab.value === 'income' ? 'trending-up-outline' : 'pricetag-outline'
  color.value = tab.value === 'income' ? 'success' : 'primary'
  modalOpen.value = true
}

function openEdit(category: Category): void {
  editingId.value = category.id
  name.value = category.name
  kind.value = category.kind
  icon.value = category.icon
  color.value = category.color
  modalOpen.value = true
}

async function save(): Promise<void> {
  if (editingId.value) {
    const existing = store.categories.find((c) => c.id === editingId.value)
    if (existing) {
      await store.editCategory({
        ...existing,
        name: name.value.trim(),
        kind: kind.value,
        icon: icon.value,
        color: color.value,
      })
    }
  } else {
    await store.addCategory({
      name: name.value.trim(),
      kind: kind.value,
      parentId: null,
      icon: icon.value,
      color: color.value,
      archived: false,
    })
  }
  modalOpen.value = false
}

async function remove(): Promise<void> {
  if (editingId.value) await store.removeCategory(editingId.value)
  modalOpen.value = false
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Categories</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="tab">
          <IonSegmentButton value="expense">Spending</IonSegmentButton>
          <IonSegmentButton value="income">Income</IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <EmptyState
        v-if="visible.length === 0"
        :icon="pricetagsOutline"
        title="No categories"
        message="Categories are how spending gets grouped into budgets and reports."
        action-label="Add a category"
        @action="openNew"
      />

      <div v-else class="app-card app-card--flush">
        <IonList lines="full">
          <IonItem
            v-for="category in visible"
            :key="category.id"
            button
            :detail="false"
            @click="openEdit(category)"
          >
            <div slot="start" class="avatar" :style="{ background: `rgba(var(--ion-color-${category.color}-rgb), 0.14)` }">
              <IonIcon :icon="iconFor(category.icon)" :color="category.color" />
            </div>
            <IonLabel>{{ category.name }}</IonLabel>
            <MoneyText slot="end" :value="totals.get(category.id) ?? zero(store.base)" class="app-muted" />
          </IonItem>
        </IonList>
      </div>

      <p class="app-muted note">
        Showing {{ tab === 'income' ? 'income' : 'spending' }} for {{ store.period.label }}.
      </p>

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
            <IonTitle>{{ editingId ? 'Edit' : 'New' }} category</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSave" @click="save">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonInput v-model="name" label="Name" label-placement="stacked" placeholder="e.g. Groceries" />
            </IonItem>
            <IonItem>
              <IonSelect v-model="kind" label="Type" label-placement="stacked" interface="popover">
                <IonSelectOption value="expense">Spending</IonSelectOption>
                <IonSelectOption value="income">Income</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>

          <div class="picker-label app-muted">Icon</div>
          <div class="icon-grid">
            <button
              v-for="option in ICONS"
              :key="option"
              type="button"
              class="icon-option"
              :class="{ 'icon-option--on': option === icon }"
              @click="icon = option"
            >
              <IonIcon :icon="iconFor(option)" />
            </button>
          </div>

          <div class="picker-label app-muted">Colour</div>
          <div class="color-row">
            <button
              v-for="option in COLORS"
              :key="option"
              type="button"
              class="color-option"
              :class="{ 'color-option--on': option === color }"
              :style="{ background: `var(--ion-color-${option})` }"
              @click="color = option"
            />
          </div>

          <IonNote class="modal-note">
            Deleting a category keeps its transactions — they simply become uncategorised.
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
            Delete category
          </IonButton>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-inline-end: 12px;
}

.note {
  font-size: 0.78rem;
  padding: 4px 6px;
}

.picker-label {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 18px 4px 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.icon-option {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-surface);
  color: inherit;
  cursor: pointer;
  font-size: 18px;
}

.icon-option--on {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.color-row {
  display: flex;
  gap: 10px;
}

.color-option {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-option--on {
  border-color: var(--ion-text-color);
  box-shadow: 0 0 0 2px var(--app-surface) inset;
}

.modal-note {
  display: block;
  padding: 18px 4px 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.delete {
  margin-top: 12px;
}
</style>
