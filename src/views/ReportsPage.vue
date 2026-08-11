<script setup lang="ts">
/**
 * Reports: category breakdown and the income-vs-spend trend.
 *
 * Charts are hand-rolled SVG/CSS rather than a charting library — the shapes needed here
 * are simple, and it keeps the bundle small and the rendering predictable in a webview.
 */
import { computed } from 'vue'
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { alertCircleOutline, barChartOutline } from 'ionicons/icons'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import { formatMoney, formatMoneyCompact } from '@/domain/format'
import { subtract, toFloat } from '@/domain/money'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

/** Donut segments for the category breakdown. */
const donut = computed(() => {
  const rows = store.breakdown.rows
  const total = store.breakdown.total.minor
  if (total === 0) return []

  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return rows.slice(0, 8).map((row) => {
    const fraction = row.amount.minor / total
    const length = fraction * circumference
    const segment = {
      color: `var(--ion-color-${row.category.color})`,
      dash: `${length} ${circumference - length}`,
      offset: -offset,
      name: row.category.name,
    }
    offset += length
    return segment
  })
})

const trendMax = computed(() =>
  Math.max(1, ...store.trend.flatMap((t) => [toFloat(t.income), toFloat(t.expense)])),
)

const trendRows = computed(() =>
  store.trend.map((t) => ({
    label: t.period.label,
    short: t.period.label.split(' ')[0].slice(0, 3),
    income: t.income,
    expense: t.expense,
    net: t.net,
    incomeWidth: `${(toFloat(t.income) / trendMax.value) * 100}%`,
    expenseWidth: `${(toFloat(t.expense) / trendMax.value) * 100}%`,
  })),
)

/** Averages over the periods that actually have activity, so a fresh install isn't skewed. */
const averages = computed(() => {
  const active = store.trend.filter((t) => t.income.minor !== 0 || t.expense.minor !== 0)
  const count = Math.max(1, active.length)
  const income = active.reduce((a, t) => a + t.income.minor, 0)
  const expense = active.reduce((a, t) => a + t.expense.minor, 0)
  return {
    income: { minor: Math.round(income / count), currency: store.base },
    expense: { minor: Math.round(expense / count), currency: store.base },
    saved: { minor: Math.round((income - expense) / count), currency: store.base },
    periods: active.length,
  }
})

const savingsRate = computed(() => {
  const { income, expense } = store.currentSummary
  if (income.minor <= 0) return null
  return (subtract(income, expense).minor / income.minor) * 100
})
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Reports</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <div class="app-card">
        <PeriodSwitcher />
      </div>

      <EmptyState
        v-if="store.transactions.length === 0"
        :icon="barChartOutline"
        title="Nothing to report yet"
        message="Record some transactions and this screen will show where the money goes and how it trends."
      />

      <template v-else>
        <!-- Cycle overview -->
        <div class="app-card">
          <div class="overview">
            <div>
              <span class="app-muted">Income</span>
              <MoneyText :value="store.currentSummary.income" class="app-figure--large" />
            </div>
            <div>
              <span class="app-muted">Spent</span>
              <MoneyText :value="store.currentSummary.expense" class="app-figure--large" />
            </div>
            <div>
              <span class="app-muted">Net</span>
              <MoneyText :value="store.currentSummary.net" colored class="app-figure--large" />
            </div>
          </div>
          <div v-if="savingsRate !== null" class="rate">
            <div class="app-row-split">
              <span class="app-muted">Savings rate this cycle</span>
              <strong class="app-figure">{{ Math.round(savingsRate) }}%</strong>
            </div>
            <ProgressMeter
              :percent="Math.max(0, savingsRate)"
              :color="savingsRate >= 20 ? 'success' : savingsRate >= 0 ? 'warning' : 'danger'"
              :over="savingsRate < 0"
            />
          </div>
        </div>

        <!-- Category breakdown -->
        <div class="app-section-title">Where it went</div>
        <div class="app-card">
          <div v-if="donut.length" class="donut-wrap">
            <svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Spending by category">
              <circle cx="60" cy="60" r="52" class="donut__track" />
              <circle
                v-for="segment in donut"
                :key="segment.name"
                cx="60"
                cy="60"
                r="52"
                class="donut__segment"
                :stroke="segment.color"
                :stroke-dasharray="segment.dash"
                :stroke-dashoffset="segment.offset"
              />
            </svg>
            <div class="donut__center">
              <span class="app-muted">Total</span>
              <strong>{{ formatMoneyCompact(store.breakdown.total) }}</strong>
            </div>
          </div>

          <div v-if="store.breakdown.missing.length" class="warn">
            <IonIcon :icon="alertCircleOutline" />
            <span>
              Spending in {{ store.breakdown.missing.join(', ') }} is excluded — no rate set.
            </span>
          </div>

          <div class="rows">
            <div v-for="row in store.breakdown.rows" :key="row.category.id" class="row">
              <div class="row__head">
                <span class="row__name">
                  <i class="swatch" :style="{ background: `var(--ion-color-${row.category.color})` }" />
                  {{ row.category.name }}
                </span>
                <MoneyText :value="row.amount" />
              </div>
              <ProgressMeter :percent="row.percentOfTotal" :color="row.category.color" />
              <span class="row__meta app-muted">
                {{ Math.round(row.percentOfTotal) }}% ·
                {{ row.transactionCount }}
                {{ row.transactionCount === 1 ? 'transaction' : 'transactions' }}
              </span>
            </div>
          </div>

          <IonNote v-if="store.breakdown.rows.length === 0" class="empty-note">
            No spending recorded in {{ store.period.label }}.
          </IonNote>
        </div>

        <!-- Trend -->
        <div class="app-section-title">Last 6 cycles</div>
        <div class="app-card">
          <div v-for="row in trendRows" :key="row.label" class="trend-row">
            <div class="trend-row__head">
              <span>{{ row.label }}</span>
              <MoneyText :value="row.net" colored signed />
            </div>
            <div class="trend-row__bar">
              <div class="bar bar--income" :style="{ width: row.incomeWidth }" />
            </div>
            <div class="trend-row__bar">
              <div class="bar bar--expense" :style="{ width: row.expenseWidth }" />
            </div>
            <div class="trend-row__meta app-muted">
              <span>In {{ formatMoney(row.income) }}</span>
              <span>Out {{ formatMoney(row.expense) }}</span>
            </div>
          </div>
        </div>

        <!-- Averages -->
        <div class="app-section-title">Averages per cycle</div>
        <div class="app-card">
          <div class="overview">
            <div>
              <span class="app-muted">Income</span>
              <MoneyText :value="averages.income" />
            </div>
            <div>
              <span class="app-muted">Spent</span>
              <MoneyText :value="averages.expense" />
            </div>
            <div>
              <span class="app-muted">Saved</span>
              <MoneyText :value="averages.saved" colored />
            </div>
          </div>
          <IonNote class="avg-note">
            Across {{ averages.periods }} {{ averages.periods === 1 ? 'cycle' : 'cycles' }} with
            activity.
          </IonNote>
        </div>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.overview > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.overview span {
  font-size: 0.74rem;
}

.rate {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.86rem;
}

.donut-wrap {
  position: relative;
  width: 168px;
  margin: 4px auto 18px;
}

.donut {
  width: 100%;
  transform: rotate(-90deg);
}

.donut__track {
  fill: none;
  stroke: var(--app-border);
  stroke-width: 14;
}

.donut__segment {
  fill: none;
  stroke-width: 14;
  stroke-linecap: butt;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.donut__center span {
  font-size: 0.7rem;
}

.donut__center strong {
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
}

.warn {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 14px;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: rgba(var(--ion-color-warning-rgb), 0.14);
  color: var(--ion-color-warning-shade);
  font-size: 0.78rem;
}

.rows {
  display: grid;
  gap: 14px;
}

.row {
  display: grid;
  gap: 5px;
}

.row__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-size: 0.88rem;
}

.row__name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}

.row__meta {
  font-size: 0.74rem;
}

.empty-note {
  display: block;
  font-size: 0.84rem;
}

.trend-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--app-border);
}

.trend-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.trend-row:first-child {
  padding-top: 0;
}

.trend-row__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.86rem;
  font-weight: 600;
  margin-bottom: 7px;
}

.trend-row__bar {
  height: 7px;
  background: var(--app-border);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 4px;
}

.bar {
  height: 100%;
  border-radius: 999px;
  min-width: 2px;
}

.bar--income {
  background: var(--ion-color-success);
}

.bar--expense {
  background: var(--ion-color-danger);
  opacity: 0.8;
}

.trend-row__meta {
  display: flex;
  gap: 14px;
  font-size: 0.74rem;
  margin-top: 4px;
}

.avg-note {
  display: block;
  padding-top: 12px;
  font-size: 0.76rem;
}
</style>
