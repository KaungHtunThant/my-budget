<script setup lang="ts">
/**
 * Savings goals.
 *
 * A contribution is recorded as a transfer into the goal's wallet, tagged with the goal.
 * That way the money is genuinely in a wallet and counted once, rather than existing as a
 * separate parallel balance that could drift from reality.
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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, checkmarkCircle, close, trashOutline, trophyOutline } from 'ionicons/icons'
import { GOAL_ICON_NAMES, iconFor } from '@/theme/icons'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import { amountPlaceholder, formatDate, formatMoney } from '@/domain/format'
import { parseMoney, toDecimalString } from '@/domain/money'
import type { GoalStatus, Id } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const modalOpen = ref(false)
const contributeOpen = ref(false)
const editingId = ref<Id | null>(null)
const name = ref('')
const targetText = ref('')
const walletId = ref<Id | null>(null)
const targetDate = ref('')
const icon = ref('trophy-outline')

const contributeGoalId = ref<Id | null>(null)
const contributeFromWalletId = ref<Id | null>(null)
const contributeText = ref('')

const ICONS = GOAL_ICON_NAMES

const canSave = computed(() => {
  const parsed = parseMoney(targetText.value, store.base)
  return name.value.trim().length > 0 && parsed !== null && parsed.minor > 0 && Boolean(walletId.value)
})

const canContribute = computed(() => {
  const parsed = parseMoney(contributeText.value, store.base)
  return parsed !== null && parsed.minor > 0 && Boolean(contributeFromWalletId.value)
})

const active = computed(() => store.goalStatusList.filter((s) => !s.complete))
const done = computed(() => store.goalStatusList.filter((s) => s.complete))

function openNew(): void {
  editingId.value = null
  name.value = ''
  targetText.value = ''
  walletId.value = store.wallets.find((w) => w.kind === 'savings')?.id ?? store.wallets[0]?.id ?? null
  targetDate.value = ''
  icon.value = 'trophy-outline'
  modalOpen.value = true
}

function openEdit(status: GoalStatus): void {
  editingId.value = status.goal.id
  name.value = status.goal.name
  targetText.value = toDecimalString(status.goal.target)
  walletId.value = status.goal.walletId
  targetDate.value = status.goal.targetDate ?? ''
  icon.value = status.goal.icon
  modalOpen.value = true
}

async function save(): Promise<void> {
  const target = parseMoney(targetText.value, store.base)
  if (!target || !walletId.value) return

  if (editingId.value) {
    const existing = store.goals.find((g) => g.id === editingId.value)
    if (existing) {
      await store.editGoal({
        ...existing,
        name: name.value.trim(),
        target,
        walletId: walletId.value,
        targetDate: targetDate.value || null,
        icon: icon.value,
      })
    }
  } else {
    await store.addGoal({
      name: name.value.trim(),
      target,
      walletId: walletId.value,
      targetDate: targetDate.value || null,
      icon: icon.value,
      color: 'primary',
      archived: false,
    })
  }
  modalOpen.value = false
}

async function remove(): Promise<void> {
  if (editingId.value) await store.removeGoal(editingId.value)
  modalOpen.value = false
}

function openContribute(status: GoalStatus): void {
  contributeGoalId.value = status.goal.id
  contributeFromWalletId.value =
    store.wallets.find((w) => w.id !== status.goal.walletId)?.id ?? store.wallets[0]?.id ?? null
  contributeText.value = ''
  contributeOpen.value = true
}

async function contribute(): Promise<void> {
  const amount = parseMoney(contributeText.value, store.base)
  if (!amount || !contributeGoalId.value || !contributeFromWalletId.value) return
  await store.contributeToGoal(contributeGoalId.value, contributeFromWalletId.value, amount)
  contributeOpen.value = false
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Savings goals</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <EmptyState
        v-if="store.goalStatusList.length === 0"
        :icon="trophyOutline"
        title="No goals yet"
        message="Set a target and a date, then contribute to it directly or from each payday's allocation."
        action-label="Add a goal"
        @action="openNew"
      />

      <template v-else>
        <div v-for="status in active" :key="status.goal.id" class="app-card goal">
          <div class="goal__head">
            <div class="goal__title">
              <IonIcon :icon="iconFor(status.goal.icon)" :color="status.goal.color" />
              <div>
                <h3>{{ status.goal.name }}</h3>
                <span class="app-muted">
                  {{ store.walletsById.get(status.goal.walletId)?.name ?? 'No wallet' }}
                  <template v-if="status.goal.targetDate">
                    · by {{ formatDate(status.goal.targetDate) }}
                  </template>
                </span>
              </div>
            </div>
            <span class="goal__percent app-figure">{{ Math.round(status.percentComplete) }}%</span>
          </div>

          <ProgressMeter :percent="status.percentComplete" :color="status.goal.color" />

          <div class="goal__figures">
            <div>
              <span class="app-muted">Saved</span>
              <MoneyText :value="status.saved" />
            </div>
            <div>
              <span class="app-muted">Target</span>
              <MoneyText :value="status.goal.target" />
            </div>
            <div>
              <span class="app-muted">To go</span>
              <MoneyText :value="status.remaining" />
            </div>
          </div>

          <p v-if="status.requiredPerPeriod" class="app-muted goal__pace">
            {{ formatMoney(status.requiredPerPeriod) }} per cycle to reach it on time.
          </p>

          <div class="goal__actions">
            <IonButton size="small" fill="outline" @click="openContribute(status)">
              Add money
            </IonButton>
            <IonButton size="small" fill="clear" @click="openEdit(status)">Edit</IonButton>
          </div>
        </div>

        <template v-if="done.length">
          <div class="app-section-title">Reached</div>
          <div class="app-card app-card--flush">
            <IonList lines="full">
              <IonItem v-for="status in done" :key="status.goal.id" button :detail="false" @click="openEdit(status)">
                <IonIcon slot="start" :icon="checkmarkCircle" color="success" />
                <IonLabel>
                  <h3>{{ status.goal.name }}</h3>
                  <p>{{ formatMoney(status.saved) }} saved</p>
                </IonLabel>
              </IonItem>
            </IonList>
          </div>
        </template>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="openNew">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <!-- Goal editor -->
      <IonModal :is-open="modalOpen" @did-dismiss="modalOpen = false">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton @click="modalOpen = false">
                <IonIcon slot="icon-only" :icon="close" />
              </IonButton>
            </IonButtons>
            <IonTitle>{{ editingId ? 'Edit' : 'New' }} goal</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSave" @click="save">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonInput v-model="name" label="Goal" label-placement="stacked" placeholder="e.g. Emergency fund" />
            </IonItem>
            <IonItem>
              <IonInput
                v-model="targetText"
                type="text"
                inputmode="decimal"
                :label="`Target (${store.base})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(store.base)"
              />
            </IonItem>
            <IonItem>
              <IonSelect v-model="walletId" label="Saved in" label-placement="stacked" interface="action-sheet">
                <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
                  {{ w.name }} ({{ w.currency }})
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonInput v-model="targetDate" type="date" label="Target date (optional)" label-placement="stacked" />
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

          <IonButton
            v-if="editingId"
            expand="block"
            fill="clear"
            color="danger"
            class="delete"
            @click="remove"
          >
            <IonIcon slot="start" :icon="trashOutline" />
            Delete goal
          </IonButton>
        </IonContent>
      </IonModal>

      <!-- Contribution sheet -->
      <IonModal
        :is-open="contributeOpen"
        :initial-breakpoint="0.5"
        :breakpoints="[0, 0.5]"
        @did-dismiss="contributeOpen = false"
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Add to goal</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canContribute" @click="contribute">Add</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonInput
                v-model="contributeText"
                type="text"
                inputmode="decimal"
                :label="`Amount (${store.base})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(store.base)"
              />
            </IonItem>
            <IonItem>
              <IonSelect
                v-model="contributeFromWalletId"
                label="From wallet"
                label-placement="stacked"
                interface="action-sheet"
              >
                <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
                  {{ w.name }} ({{ w.currency }})
                </IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>
          <IonNote class="modal-note">
            Recorded as a transfer into the goal's wallet, so the money stays visible in your
            balances.
          </IonNote>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.goal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.goal__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.goal__title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.goal__title ion-icon {
  font-size: 26px;
}

.goal__title h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.goal__title span {
  font-size: 0.76rem;
}

.goal__percent {
  font-size: 1.05rem;
  font-weight: 700;
}

.goal__figures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.goal__figures > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.goal__figures span {
  font-size: 0.72rem;
}

.goal__pace {
  margin: 0;
  font-size: 0.78rem;
}

.goal__actions {
  display: flex;
  gap: 6px;
  margin: 0 0 -4px -4px;
}

.picker-label {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 18px 4px 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
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
  font-size: 20px;
}

.icon-option--on {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.modal-note {
  display: block;
  padding: 14px 4px;
  font-size: 0.8rem;
  line-height: 1.45;
}

.delete {
  margin-top: 20px;
}
</style>
