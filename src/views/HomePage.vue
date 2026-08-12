<script setup lang="ts">
/**
 * Dashboard.
 *
 * Ordered by the question a person actually opens a budget app to answer: how much do I
 * have, what is left to spend this cycle, and where has it been going. Balances come first,
 * then the cycle's income-vs-spend, then budgets, goals and recent activity.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonList,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  addOutline,
  alertCircleOutline,
  arrowForwardOutline,
  settingsOutline,
  trendingDownOutline,
  trendingUpOutline,
} from 'ionicons/icons'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import TransactionModal from '@/components/TransactionModal.vue'
import TransactionRow from '@/components/TransactionRow.vue'
import { formatMoneyCompact } from '@/domain/format'
import { toFloat } from '@/domain/money'
import { periodProgress, todayIso, daysRemaining } from '@/domain/period'
import type { Transaction } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()
const router = useRouter()

const modalOpen = ref(false)
const editing = ref<Transaction | null>(null)

const pace = computed(() => periodProgress(store.period, todayIso()))
const daysLeft = computed(() => daysRemaining(store.period, todayIso()))

const topBudgets = computed(() => store.budgetStatusList.slice(0, 4))
const topGoals = computed(() => store.goalStatusList.filter((g) => !g.goal.archived).slice(0, 2))

/** Bar heights for the six-period trend, scaled to the largest value on show. */
const trendBars = computed(() => {
  const peak = Math.max(
    1,
    ...store.trend.flatMap((t) => [toFloat(t.income), toFloat(t.expense)]),
  )
  return store.trend.map((t) => ({
    label: t.period.label.split(' ')[0].slice(0, 3),
    income: t.income,
    expense: t.expense,
    incomeHeight: `${(toFloat(t.income) / peak) * 100}%`,
    expenseHeight: `${(toFloat(t.expense) / peak) * 100}%`,
  }))
})

function openNew(): void {
  editing.value = null
  modalOpen.value = true
}

function openEdit(tx: Transaction): void {
  editing.value = tx
  modalOpen.value = true
}

async function refresh(event: CustomEvent): Promise<void> {
  await store.reload()
  ;(event.target as HTMLIonRefresherElement).complete()
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonTitle>My Budget</IonTitle>
        <IonButton slot="end" fill="clear" @click="router.push('/settings')">
          <IonIcon slot="icon-only" :icon="settingsOutline" />
        </IonButton>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <IonRefresher slot="fixed" @ion-refresh="refresh">
        <IonRefresherContent />
      </IonRefresher>

      <EmptyState
        v-if="store.wallets.length === 0"
        :icon="addOutline"
        title="No wallets yet"
        message="Add a wallet — a bank account, cash, or savings — and your balances and budgets will start filling in."
        action-label="Add a wallet"
        @action="router.push('/wallets')"
      />

      <template v-else>
        <!-- Balances -->
        <div class="app-card hero">
          <span class="app-muted hero__label">Total balance</span>
          <MoneyText :value="store.netWorth.total" class="app-figure--hero" />

          <button
            v-if="store.netWorth.missing.length"
            class="warn"
            type="button"
            @click="router.push('/currencies')"
          >
            <IonIcon :icon="alertCircleOutline" />
            <span>
              {{ store.netWorth.missing.join(', ') }} not included — set
              {{ store.netWorth.missing.length === 1 ? 'a rate' : 'rates' }}
            </span>
          </button>

          <div class="wallet-chips app-chip-row">
            <button
              v-for="w in store.wallets"
              :key="w.id"
              class="wallet-chip"
              type="button"
              @click="router.push('/wallets')"
            >
              <span class="wallet-chip__name">{{ w.name }}</span>
              <MoneyText :value="store.balanceOf(w.id)" compact />
            </button>
          </div>
        </div>

        <!-- This cycle -->
        <div class="app-card">
          <PeriodSwitcher />
          <div class="cycle-figures">
            <div class="cycle-figure">
              <span class="app-muted"><IonIcon :icon="trendingUpOutline" /> Income</span>
              <MoneyText :value="store.currentSummary.income" class="app-figure--large" />
            </div>
            <div class="cycle-figure">
              <span class="app-muted"><IonIcon :icon="trendingDownOutline" /> Spent</span>
              <MoneyText :value="store.currentSummary.expense" class="app-figure--large" />
            </div>
          </div>
          <div class="cycle-net">
            <span class="app-muted">Net this cycle</span>
            <MoneyText :value="store.currentSummary.net" colored signed />
          </div>
          <p v-if="store.isCurrentPeriod" class="app-muted cycle-days">
            {{ daysLeft }} {{ daysLeft === 1 ? 'day' : 'days' }} left in this cycle
          </p>
        </div>

        <!-- Budgets -->
        <template v-if="topBudgets.length">
          <div class="app-section-title">Budgets</div>
          <div class="app-card">
            <div class="app-row-split budget-total">
              <span class="app-muted">
                <MoneyText :value="store.budgetSummary.spent" /> of
                <MoneyText :value="store.budgetSummary.budgeted" />
              </span>
              <MoneyText
                :value="store.budgetSummary.remaining"
                :colored="true"
              />
            </div>
            <ProgressMeter
              :percent="store.budgetSummary.percentUsed"
              :pace="store.isCurrentPeriod ? pace : null"
              :over="store.budgetSummary.remaining.minor < 0"
            />

            <div class="budget-rows">
              <button
                v-for="status in topBudgets"
                :key="status.budget.id"
                class="budget-row"
                type="button"
                @click="router.push('/tabs/budgets')"
              >
                <div class="app-row-split">
                  <span>{{ status.category.name }}</span>
                  <span class="app-muted app-figure">
                    <MoneyText :value="status.spent" compact /> /
                    <MoneyText :value="status.limit" compact />
                  </span>
                </div>
                <ProgressMeter
                  :percent="status.percentUsed"
                  :color="status.category.color"
                  :over="status.overspent"
                />
              </button>
            </div>

            <IonButton size="small" fill="clear" @click="router.push('/tabs/budgets')">
              All budgets
              <IonIcon slot="end" :icon="arrowForwardOutline" />
            </IonButton>
          </div>
        </template>

        <!-- Trend -->
        <div class="app-section-title">Last 6 cycles</div>
        <div class="app-card">
          <div class="trend">
            <div v-for="bar in trendBars" :key="bar.label" class="trend__col">
              <div class="trend__bars">
                <div class="trend__bar trend__bar--income" :style="{ height: bar.incomeHeight }" />
                <div class="trend__bar trend__bar--expense" :style="{ height: bar.expenseHeight }" />
              </div>
              <span class="trend__label app-muted">{{ bar.label }}</span>
            </div>
          </div>
          <div class="trend__legend app-muted">
            <span><i class="swatch swatch--income" /> Income</span>
            <span><i class="swatch swatch--expense" /> Spending</span>
          </div>
          <IonButton size="small" fill="clear" @click="router.push('/reports')">
            Full reports
            <IonIcon slot="end" :icon="arrowForwardOutline" />
          </IonButton>
        </div>

        <!-- Goals -->
        <template v-if="topGoals.length">
          <div class="app-section-title">Savings goals</div>
          <div class="app-card">
            <button
              v-for="status in topGoals"
              :key="status.goal.id"
              class="goal-row"
              type="button"
              @click="router.push('/tabs/goals')"
            >
              <div class="app-row-split">
                <span>{{ status.goal.name }}</span>
                <span class="app-muted app-figure">
                  {{ Math.round(status.percentComplete) }}%
                </span>
              </div>
              <ProgressMeter :percent="status.percentComplete" :color="status.goal.color" />
              <span class="app-muted goal-row__detail">
                {{ formatMoneyCompact(status.saved) }} of {{ formatMoneyCompact(status.goal.target) }}
                <template v-if="status.requiredPerPeriod">
                  · {{ formatMoneyCompact(status.requiredPerPeriod) }} per cycle to stay on track
                </template>
              </span>
            </button>
          </div>
        </template>

        <!-- Recent activity -->
        <div class="app-section-title">Recent activity</div>
        <div v-if="store.recentTransactions.length" class="app-card app-card--flush">
          <IonList lines="full">
            <TransactionRow
              v-for="tx in store.recentTransactions"
              :key="tx.id"
              :transaction="tx"
              @select="openEdit"
            />
          </IonList>
        </div>
        <div v-else class="app-card">
          <p class="app-muted no-activity">
            Nothing recorded yet. Tap + to add your first transaction.
          </p>
        </div>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end" class="fab">
        <IonFabButton @click="openNew">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <IonModal :is-open="modalOpen" @did-dismiss="modalOpen = false">
        <TransactionModal :transaction="editing" @dismiss="modalOpen = false" />
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero__label {
  font-size: 0.8rem;
}

.warn {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: rgba(var(--ion-color-warning-rgb), 0.14);
  color: var(--ion-color-warning-shade);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.wallet-chips {
  margin-top: 14px;
}

.wallet-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  padding: 9px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-surface-sunken);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.wallet-chip__name {
  font-size: 0.72rem;
  color: var(--app-text-muted);
}

.cycle-figures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}

.cycle-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cycle-figure span {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
}

.cycle-net {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
  font-size: 0.88rem;
}

.cycle-days {
  margin: 8px 0 0;
  font-size: 0.78rem;
}

.budget-total {
  margin-bottom: 10px;
  font-size: 0.85rem;
}

.budget-rows {
  display: grid;
  gap: 14px;
  margin: 18px 0 6px;
}

.budget-row,
.goal-row {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.budget-row .app-row-split,
.goal-row .app-row-split {
  font-size: 0.88rem;
}

.goal-row {
  padding-bottom: 14px;
}

.goal-row:last-of-type {
  padding-bottom: 0;
}

.goal-row__detail {
  font-size: 0.76rem;
}

.trend {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 8px;
  height: 120px;
  align-items: end;
}

.trend__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
  justify-content: flex-end;
}

.trend__bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100%;
  width: 100%;
  justify-content: center;
}

.trend__bar {
  width: 42%;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
}

.trend__bar--income {
  background: var(--ion-color-success);
}

.trend__bar--expense {
  background: var(--ion-color-danger);
  opacity: 0.75;
}

.trend__label {
  font-size: 0.7rem;
}

.trend__legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 0.76rem;
}

.trend__legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
}

.swatch--income {
  background: var(--ion-color-success);
}

.swatch--expense {
  background: var(--ion-color-danger);
  opacity: 0.75;
}

.no-activity {
  margin: 0;
  font-size: 0.88rem;
}

.fab {
  margin-bottom: 6px;
}
</style>
