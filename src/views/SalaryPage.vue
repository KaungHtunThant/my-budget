<script setup lang="ts">
/**
 * Salary: payslip history and the payday allocation flow.
 *
 * A payslip is recorded gross-first with itemised deductions, because that is how the
 * document in your hand is laid out and net pay is the thing that gets derived. The
 * allocation flow then splits that net figure across budgets and goals, and its whole job
 * is to make the unallocated remainder visible.
 */
import { computed, ref, watch } from 'vue'
import {
  IonAccordion,
  IonAccordionGroup,
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
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  addOutline,
  close,
  documentTextOutline,
  removeCircleOutline,
} from 'ionicons/icons'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import { amountPlaceholder, formatDate, formatMonthYear, formatMoney } from '@/domain/format'
import { type Money, parseMoney, subtract, sum, toDecimalString, zero } from '@/domain/money'
import { resolveAllocation } from '@/domain/budgeting'
import { deepClone } from '@/data/clone'
import { todayIso } from '@/domain/period'
import type { AllocationLine, Id, Payslip } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

// --- payslip form ---------------------------------------------------------

const payslipOpen = ref(false)
const employer = ref('')
const payDate = ref(todayIso())
const grossText = ref('')
const walletId = ref<Id | null>(null)
const deductionRows = ref<{ label: string; amount: string }[]>([])
const payslipNote = ref('')

const grossMoney = computed(() => parseMoney(grossText.value, store.base))

const deductionTotal = computed<Money>(() =>
  sum(
    deductionRows.value
      .map((r) => parseMoney(r.amount, store.base))
      .filter((m): m is Money => m !== null),
    store.base,
  ),
)

const netMoney = computed<Money>(() =>
  grossMoney.value ? subtract(grossMoney.value, deductionTotal.value) : zero(store.base),
)

const canSavePayslip = computed(
  () => Boolean(grossMoney.value && grossMoney.value.minor > 0 && walletId.value && employer.value.trim()),
)

function openPayslip(): void {
  employer.value = store.payslips[0]?.employer ?? ''
  payDate.value = todayIso()
  grossText.value = ''
  walletId.value = store.wallets[0]?.id ?? null
  // Prefill the deduction labels from the last payslip: they rarely change month to month.
  deductionRows.value = (store.payslips[0]?.deductions ?? []).map((d) => ({
    label: d.label,
    amount: toDecimalString(d.amount),
  }))
  payslipNote.value = ''
  payslipOpen.value = true
}

function addDeduction(): void {
  deductionRows.value.push({ label: '', amount: '' })
}

function removeDeduction(index: number): void {
  deductionRows.value.splice(index, 1)
}

async function savePayslip(): Promise<void> {
  if (!grossMoney.value || !walletId.value) return
  await store.addPayslip(
    {
      employer: employer.value.trim(),
      date: payDate.value.slice(0, 10),
      periodLabel: formatMonthYear(payDate.value),
      gross: grossMoney.value,
      deductions: deductionRows.value
        .map((r, i) => ({ id: `ded_${i}`, label: r.label.trim() || 'Deduction', amount: parseMoney(r.amount, store.base) }))
        .filter((d): d is { id: string; label: string; amount: Money } => d.amount !== null)
        .map((d) => ({ ...d, amount: d.amount })),
      net: netMoney.value,
      walletId: walletId.value,
      note: payslipNote.value.trim(),
    },
    true,
  )
  payslipOpen.value = false
}

// --- allocation -----------------------------------------------------------

const allocationOpen = ref(false)
const allocationPayslip = ref<Payslip | null>(null)
const lines = ref<AllocationLine[]>([])

const resolved = computed(() =>
  allocationPayslip.value
    ? resolveAllocation(allocationPayslip.value.net, lines.value)
    : null,
)

const allocatedPercent = computed(() => {
  if (!resolved.value || !allocationPayslip.value) return 0
  const net = allocationPayslip.value.net.minor
  return net === 0 ? 0 : (resolved.value.allocated.minor / net) * 100
})

function openAllocation(payslip: Payslip): void {
  allocationPayslip.value = payslip
  const existing = store.allocationFor(payslip.id)
  lines.value = existing
    ? deepClone(existing.lines)
    : deepClone(store.templates[0]?.lines ?? [])
  allocationOpen.value = true
}

function addLine(): void {
  lines.value.push({
    id: `ln_${Date.now()}_${lines.value.length}`,
    categoryId: store.expenseCategories[0]?.id ?? null,
    goalId: null,
    mode: 'fixed',
    fixedAmount: zero(store.base),
    percent: null,
  })
}

function removeLine(index: number): void {
  lines.value.splice(index, 1)
}

function applyTemplate(templateId: Id): void {
  const template = store.templates.find((t) => t.id === templateId)
  if (template) lines.value = deepClone(template.lines)
}

/** Target select binds to a single string so one control covers both categories and goals. */
function targetKey(line: AllocationLine): string {
  return line.goalId ? `goal:${line.goalId}` : `cat:${line.categoryId ?? ''}`
}

function setTarget(line: AllocationLine, key: string): void {
  const [kind, id] = key.split(':')
  if (kind === 'goal') {
    line.goalId = id
    line.categoryId = null
  } else {
    line.categoryId = id
    line.goalId = null
  }
}

function amountText(line: AllocationLine): string {
  return line.fixedAmount ? toDecimalString(line.fixedAmount) : ''
}

function setAmount(line: AllocationLine, value: string): void {
  line.fixedAmount = parseMoney(value, store.base) ?? zero(store.base)
}

async function saveAllocation(): Promise<void> {
  if (!allocationPayslip.value) return
  await store.saveAllocation(allocationPayslip.value.id, lines.value)
  allocationOpen.value = false
}

async function saveAsTemplate(): Promise<void> {
  await store.addTemplate(`Plan ${store.templates.length + 1}`, lines.value)
}

// Keep percent/fixed fields consistent when the mode is switched.
watch(
  lines,
  (current) => {
    for (const line of current) {
      if (line.mode === 'percent' && line.percent === null) line.percent = 10
      if (line.mode === 'fixed' && line.fixedAmount === null) line.fixedAmount = zero(store.base)
    }
  },
  { deep: true },
)

// --- history --------------------------------------------------------------

const yearToDate = computed(() => {
  const year = todayIso().slice(0, 4)
  const slips = store.payslips.filter((p) => p.date.startsWith(year))
  return {
    gross: sum(slips.map((p) => p.gross), store.base),
    net: sum(slips.map((p) => p.net), store.base),
    deductions: sum(
      slips.map((p) => sum(p.deductions.map((d) => d.amount), store.base)),
      store.base,
    ),
    count: slips.length,
  }
})

/** Flag a pay rise against the previous payslip, which is worth noticing. */
function changeVsPrevious(index: number): Money | null {
  const current = store.payslips[index]
  const previous = store.payslips[index + 1]
  if (!current || !previous) return null
  const delta = subtract(current.net, previous.net)
  return delta.minor === 0 ? null : delta
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonTitle>Salary</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <EmptyState
        v-if="store.payslips.length === 0"
        :icon="documentTextOutline"
        title="No payslips yet"
        message="Record a payslip with its gross pay and deductions, then split the net pay across your budgets and goals."
        action-label="Record a payslip"
        @action="openPayslip"
      />

      <template v-else>
        <div class="app-card app-card--stack">
          <span class="app-muted">Net pay this year</span>
          <MoneyText :value="yearToDate.net" class="app-figure--hero" />
          <div class="ytd">
            <div>
              <span class="app-muted">Gross</span>
              <MoneyText :value="yearToDate.gross" />
            </div>
            <div>
              <span class="app-muted">Deductions</span>
              <MoneyText :value="yearToDate.deductions" />
            </div>
            <div>
              <span class="app-muted">Payslips</span>
              <strong class="app-figure">{{ yearToDate.count }}</strong>
            </div>
          </div>
        </div>

        <div class="app-card allocation-status">
          <div class="app-row-split">
            <span class="app-muted">Not yet allocated this cycle</span>
            <MoneyText :value="store.unallocated" colored />
          </div>
          <IonButton
            v-if="store.payslips.length"
            size="small"
            expand="block"
            fill="outline"
            class="allocate-button"
            @click="openAllocation(store.payslips[0])"
          >
            Plan the latest payday
          </IonButton>
        </div>

        <div class="app-section-title">Payslip history</div>
        <IonAccordionGroup class="app-card app-card--flush">
          <IonAccordion v-for="(payslip, index) in store.payslips" :key="payslip.id" :value="payslip.id">
            <IonItem slot="header">
              <IonLabel>
                <h3>{{ payslip.periodLabel }}</h3>
                <p>{{ payslip.employer }} · paid {{ formatDate(payslip.date) }}</p>
              </IonLabel>
              <div slot="end" class="slip-trailing">
                <MoneyText :value="payslip.net" />
                <IonNote v-if="changeVsPrevious(index)" :class="changeVsPrevious(index)!.minor > 0 ? 'up' : 'down'">
                  {{ changeVsPrevious(index)!.minor > 0 ? '▲' : '▼' }}
                  {{ formatMoney(changeVsPrevious(index)!) }}
                </IonNote>
              </div>
            </IonItem>

            <div slot="content" class="slip-detail">
              <div class="slip-row">
                <span>Gross pay</span>
                <MoneyText :value="payslip.gross" />
              </div>
              <div v-for="d in payslip.deductions" :key="d.id" class="slip-row slip-row--deduction">
                <span>{{ d.label }}</span>
                <MoneyText :value="d.amount" />
              </div>
              <div class="slip-row slip-row--net">
                <span>Net pay</span>
                <MoneyText :value="payslip.net" />
              </div>
              <p v-if="payslip.note" class="app-muted slip-note">{{ payslip.note }}</p>
              <div class="slip-actions">
                <IonButton size="small" fill="clear" @click="openAllocation(payslip)">
                  {{ store.allocationFor(payslip.id) ? 'Edit allocation' : 'Allocate' }}
                </IonButton>
                <IonButton size="small" fill="clear" color="danger" @click="store.removePayslip(payslip.id)">
                  Delete
                </IonButton>
              </div>
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </template>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="openPayslip">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <!-- Payslip modal -->
      <IonModal :is-open="payslipOpen" @did-dismiss="payslipOpen = false">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton @click="payslipOpen = false">
                <IonIcon slot="icon-only" :icon="close" />
              </IonButton>
            </IonButtons>
            <IonTitle>Record payslip</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSavePayslip" @click="savePayslip">
                Save
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonInput v-model="employer" label="Employer" label-placement="stacked" placeholder="Company name" />
            </IonItem>
            <IonItem>
              <IonInput v-model="payDate" type="date" label="Date paid" label-placement="stacked" />
            </IonItem>
            <IonItem>
              <IonSelect v-model="walletId" label="Paid into" label-placement="stacked" interface="action-sheet">
                <IonSelectOption v-for="w in store.wallets" :key="w.id" :value="w.id">
                  {{ w.name }} ({{ w.currency }})
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonInput
                v-model="grossText"
                type="text"
                inputmode="decimal"
                :label="`Gross pay (${store.base})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(store.base)"
              />
            </IonItem>
          </IonList>

          <div class="deductions">
            <div class="app-row-split deductions__head">
              <strong>Deductions</strong>
              <IonButton size="small" fill="clear" @click="addDeduction">
                <IonIcon slot="start" :icon="addOutline" />
                Add
              </IonButton>
            </div>
            <div v-for="(row, index) in deductionRows" :key="index" class="deduction-row">
              <IonInput v-model="row.label" placeholder="Label" aria-label="Deduction label" />
              <IonInput
                v-model="row.amount"
                type="text"
                inputmode="decimal"
                :placeholder="amountPlaceholder(store.base)"
                aria-label="Deduction amount"
              />
              <IonButton fill="clear" color="danger" @click="removeDeduction(index)">
                <IonIcon slot="icon-only" :icon="removeCircleOutline" />
              </IonButton>
            </div>
            <IonNote v-if="deductionRows.length === 0" class="deductions__empty">
              No deductions — net pay will equal gross pay.
            </IonNote>
          </div>

          <div class="net-preview">
            <div class="app-row-split">
              <span class="app-muted">Total deductions</span>
              <MoneyText :value="deductionTotal" />
            </div>
            <div class="app-row-split net-preview__net">
              <strong>Net pay</strong>
              <MoneyText :value="netMoney" class="app-figure--large" />
            </div>
          </div>

          <IonNote class="modal-note">
            Saving also records the net pay as income into the chosen wallet.
          </IonNote>
        </IonContent>
      </IonModal>

      <!-- Allocation modal -->
      <IonModal :is-open="allocationOpen" @did-dismiss="allocationOpen = false">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton @click="allocationOpen = false">
                <IonIcon slot="icon-only" :icon="close" />
              </IonButton>
            </IonButtons>
            <IonTitle>Allocate pay</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" @click="saveAllocation">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <template v-if="allocationPayslip && resolved">
            <div class="alloc-summary">
              <div class="app-row-split">
                <span class="app-muted">Net pay {{ allocationPayslip.periodLabel }}</span>
                <MoneyText :value="allocationPayslip.net" class="app-figure--large" />
              </div>
              <ProgressMeter
                :percent="allocatedPercent"
                :over="resolved.overcommitted"
                color="primary"
              />
              <div class="app-row-split alloc-summary__row">
                <span class="app-muted">Allocated</span>
                <MoneyText :value="resolved.allocated" />
              </div>
              <div class="app-row-split alloc-summary__row">
                <strong>{{ resolved.overcommitted ? 'Over-committed by' : 'Left unallocated' }}</strong>
                <MoneyText :value="resolved.remainder" colored />
              </div>
              <IonText v-if="resolved.overcommitted" color="danger" class="alloc-warning">
                This plan commits more than the net pay.
              </IonText>
            </div>

            <IonList v-if="store.templates.length" lines="none" class="template-list">
              <IonItem>
                <IonSelect
                  label="Start from a saved plan"
                  label-placement="stacked"
                  interface="action-sheet"
                  @ion-change="applyTemplate($event.detail.value)"
                >
                  <IonSelectOption v-for="t in store.templates" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>

            <div v-for="(line, index) in lines" :key="line.id" class="alloc-line">
              <div class="alloc-line__head">
                <IonSelect
                  :value="targetKey(line)"
                  interface="action-sheet"
                  aria-label="Allocation target"
                  class="alloc-line__target"
                  @ion-change="setTarget(line, $event.detail.value)"
                >
                  <IonSelectOption v-for="c in store.expenseCategories" :key="c.id" :value="`cat:${c.id}`">
                    {{ c.name }}
                  </IonSelectOption>
                  <IonSelectOption v-for="g in store.goals" :key="g.id" :value="`goal:${g.id}`">
                    Goal — {{ g.name }}
                  </IonSelectOption>
                </IonSelect>
                <IonButton fill="clear" color="danger" size="small" @click="removeLine(index)">
                  <IonIcon slot="icon-only" :icon="removeCircleOutline" />
                </IonButton>
              </div>

              <IonSegment v-model="line.mode" class="alloc-line__mode">
                <IonSegmentButton value="fixed">Amount</IonSegmentButton>
                <IonSegmentButton value="percent">Percent</IonSegmentButton>
              </IonSegment>

              <IonInput
                v-if="line.mode === 'fixed'"
                :value="amountText(line)"
                type="text"
                inputmode="decimal"
                :placeholder="amountPlaceholder(store.base)"
                aria-label="Fixed amount"
                @ion-input="setAmount(line, String($event.detail.value ?? ''))"
              />
              <div v-else class="percent-row">
                <IonInput
                  v-model.number="line.percent"
                  type="number"
                  min="0"
                  max="100"
                  aria-label="Percent of net pay"
                />
                <span class="app-muted">
                  % of net =
                  <MoneyText :value="resolved.lines[index]?.amount ?? zero(store.base)" />
                </span>
              </div>
            </div>

            <IonButton expand="block" fill="outline" class="add-line" @click="addLine">
              <IonIcon slot="start" :icon="addOutline" />
              Add a line
            </IonButton>
            <IonButton expand="block" fill="clear" size="small" @click="saveAsTemplate">
              Save this plan for reuse
            </IonButton>
          </template>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.ytd {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--app-border);
}

.ytd > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ytd span {
  font-size: 0.74rem;
}

.allocation-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.allocate-button {
  margin: 0;
}

.slip-trailing {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.slip-trailing .up {
  color: var(--ion-color-success);
  font-size: 0.7rem;
}

.slip-trailing .down {
  color: var(--ion-color-danger);
  font-size: 0.7rem;
}

.slip-detail {
  padding: 6px 16px 14px;
  background: var(--app-surface-sunken);
}

.slip-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 0.88rem;
}

.slip-row--deduction {
  color: var(--app-text-muted);
  padding-left: 10px;
}

.slip-row--net {
  border-top: 1px solid var(--app-border);
  margin-top: 4px;
  font-weight: 700;
}

.slip-note {
  margin: 8px 0 0;
  font-size: 0.82rem;
}

.slip-actions {
  display: flex;
  gap: 4px;
  margin: 6px 0 0 -8px;
}

.deductions {
  margin-top: 18px;
}

.deductions__head {
  margin-bottom: 4px;
}

.deduction-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  gap: 6px;
  align-items: center;
  border-bottom: 1px solid var(--app-border);
}

.deductions__empty {
  display: block;
  font-size: 0.8rem;
  padding: 6px 0;
}

.net-preview {
  margin-top: 20px;
  padding: 14px 16px;
  background: var(--app-surface-sunken);
  border-radius: var(--app-radius);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.88rem;
}

.net-preview__net {
  padding-top: 8px;
  border-top: 1px solid var(--app-border);
}

.modal-note {
  display: block;
  padding: 14px 4px;
  font-size: 0.8rem;
  line-height: 1.45;
}

.alloc-summary {
  padding: 14px 16px;
  background: var(--app-surface-sunken);
  border-radius: var(--app-radius);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.alloc-summary__row {
  font-size: 0.88rem;
}

.alloc-warning {
  display: block;
  font-size: 0.82rem;
}

.template-list {
  margin: 0 -16px 8px;
  background: transparent;
}

.alloc-line {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 10px 12px;
  margin-bottom: 10px;
}

.alloc-line__head {
  display: flex;
  align-items: center;
  gap: 4px;
}

.alloc-line__target {
  flex: 1;
}

.alloc-line__mode {
  margin: 8px 0;
}

.percent-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.percent-row ion-input {
  max-width: 90px;
}

.percent-row span {
  font-size: 0.84rem;
}

.add-line {
  margin-top: 14px;
}
</style>
