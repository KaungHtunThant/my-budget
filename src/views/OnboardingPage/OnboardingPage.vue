<script setup lang="ts">
/**
 * First-run setup.
 *
 * Two things genuinely have to be decided before the app can show a single number: the
 * base currency every report is expressed in, and the period budgets run on. Everything
 * else has a sensible default and lives in Settings.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/vue'
import {
  arrowForward,
  calendarNumberOutline,
  cashOutline,
  checkmarkCircle,
  chevronForward,
  sparklesOutline,
  walletOutline,
} from 'ionicons/icons'
import CurrencyPicker from '@/components/CurrencyPicker/CurrencyPicker.vue'
import { type CurrencyCode, currency } from '@/domain/currency'
import {
  type BudgetPeriodConfig,
  type BudgetPeriodType,
  WEEKDAY_NAMES,
  describePeriodConfig,
  periodFor,
  todayIso,
} from '@/domain/period'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()
const router = useRouter()

const step = ref(0)
const baseCurrency = ref<CurrencyCode>('USD')
const periodType = ref<BudgetPeriodType>('calendar-month')
const anchorDay = ref(25)
const startWeekday = ref(1)
const withDemoData = ref(true)
const pickerOpen = ref(false)
const saving = ref(false)

const currencyDef = computed(() => currency(baseCurrency.value))

const periodConfig = computed<BudgetPeriodConfig>(() => {
  switch (periodType.value) {
    case 'anchored-month':
      return { type: 'anchored-month', anchorDay: anchorDay.value }
    case 'weekly':
      return { type: 'weekly', startWeekday: startWeekday.value }
    case 'fortnightly':
      return { type: 'fortnightly', anchorDate: todayIso() }
    case 'calendar-month':
      return { type: 'calendar-month' }
  }
})

/** Show the user the actual dates their choice produces, not just its name. */
const periodPreview = computed(() => periodFor(todayIso(), periodConfig.value))

/**
 * The controls live in one footer rather than one copy per pane, so the bar never moves
 * between steps. That means the footer, not the pane, decides what the primary button says.
 */
const LAST_STEP = 3

const primaryLabel = computed(() => {
  if (step.value === 0) return 'Get started'
  if (step.value < LAST_STEP) return 'Continue'
  return saving.value ? 'Setting up…' : 'Start using My Budget'
})

function advance(): void {
  if (step.value < LAST_STEP) next()
  else void finish()
}

function next(): void {
  step.value += 1
}

function back(): void {
  step.value -= 1
}

function pick(code: CurrencyCode): void {
  baseCurrency.value = code
  pickerOpen.value = false
}

async function finish(): Promise<void> {
  saving.value = true
  try {
    await store.completeOnboarding({
      baseCurrency: baseCurrency.value,
      budgetPeriod: periodConfig.value,
      withDemoData: withDemoData.value,
    })
    await router.replace('/tabs/home')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonContent class="onboarding">
      <!-- Step 0: welcome -->
      <section v-if="step === 0" class="pane">
        <IonIcon :icon="walletOutline" class="pane__icon" />
        <h1 class="pane__title">My Budget</h1>
        <p class="pane__lead">
          Record what comes in and what goes out, set a limit per category, and watch where
          your money actually goes. Everything stays on this device — no account, no
          internet needed.
        </p>
        <ul class="feature-list">
          <li><IonIcon :icon="checkmarkCircle" /> Log income and spending in seconds</li>
          <li><IonIcon :icon="checkmarkCircle" /> Budgets per category, on your own cycle</li>
          <li><IonIcon :icon="checkmarkCircle" /> Multiple currencies, with rates you set</li>
          <li><IonIcon :icon="checkmarkCircle" /> Savings goals with progress tracking</li>
        </ul>
      </section>

      <!-- Step 1: base currency -->
      <section v-else-if="step === 1" class="pane">
        <IonIcon :icon="cashOutline" class="pane__icon" />
        <h1 class="pane__title">Your main currency</h1>
        <p class="pane__lead">
          Totals and reports are shown in this currency. You can still hold wallets in other
          currencies and enter a rate whenever money crosses between them.
        </p>

        <button class="picker-button" type="button" @click="pickerOpen = true">
          <span class="picker-button__symbol">{{ currencyDef.symbol }}</span>
          <span class="picker-button__text">
            <strong>{{ currencyDef.code }}</strong>
            <small>{{ currencyDef.name }}</small>
          </span>
          <IonIcon :icon="chevronForward" class="app-muted" />
        </button>

        <IonNote class="pane__note">
          {{ currencyDef.name }} uses
          {{ currencyDef.decimals === 0 ? 'no decimal places' : `${currencyDef.decimals} decimal places` }}.
          Amounts will be entered and shown to match.
        </IonNote>
      </section>

      <!-- Step 2: budget period -->
      <section v-else-if="step === 2" class="pane">
        <IonIcon :icon="calendarNumberOutline" class="pane__icon" />
        <h1 class="pane__title">Your budget cycle</h1>
        <p class="pane__lead">
          Budgets reset every cycle. If your pay lands mid-month, anchoring the cycle to
          payday is usually more useful than a calendar month.
        </p>

        <IonList class="pane__list" lines="full">
          <IonRadioGroup v-model="periodType">
            <IonItem>
              <IonRadio value="calendar-month" label-placement="end" justify="start">
                <IonLabel>
                  <h3>Calendar month</h3>
                  <p>1st to the end of each month</p>
                </IonLabel>
              </IonRadio>
            </IonItem>
            <IonItem>
              <IonRadio value="anchored-month" label-placement="end" justify="start">
                <IonLabel>
                  <h3>Monthly from payday</h3>
                  <p>Starts on a day you choose</p>
                </IonLabel>
              </IonRadio>
            </IonItem>
            <IonItem>
              <IonRadio value="weekly" label-placement="end" justify="start">
                <IonLabel>
                  <h3>Weekly</h3>
                  <p>Seven days from a chosen weekday</p>
                </IonLabel>
              </IonRadio>
            </IonItem>
            <IonItem>
              <IonRadio value="fortnightly" label-placement="end" justify="start">
                <IonLabel>
                  <h3>Every two weeks</h3>
                  <p>14-day cycles starting today</p>
                </IonLabel>
              </IonRadio>
            </IonItem>
          </IonRadioGroup>
        </IonList>

        <IonList v-if="periodType === 'anchored-month'" class="pane__list" lines="none">
          <IonItem>
            <IonInput
              v-model.number="anchorDay"
              type="number"
              min="1"
              max="28"
              label="Cycle starts on day"
              label-placement="stacked"
            />
          </IonItem>
          <IonNote class="pane__note">
            Capped at 28 so every month has the day.
          </IonNote>
        </IonList>

        <IonList v-if="periodType === 'weekly'" class="pane__list" lines="none">
          <IonItem>
            <IonSelect
              v-model.number="startWeekday"
              label="Week starts on"
              label-placement="stacked"
              interface="popover"
            >
              <IonSelectOption v-for="(name, i) in WEEKDAY_NAMES" :key="name" :value="i">
                {{ name }}
              </IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>

        <div class="preview">
          <span class="app-muted">Current cycle would be</span>
          <strong>{{ periodPreview.label }}</strong>
          <small class="app-muted">{{ describePeriodConfig(periodConfig) }}</small>
        </div>
      </section>

      <!-- Step 3: demo data -->
      <section v-else class="pane">
        <IonIcon :icon="sparklesOutline" class="pane__icon" />
        <h1 class="pane__title">Ready to go</h1>
        <p class="pane__lead">
          Start with sample wallets, budgets and a few months of history so there is
          something to look at, or begin completely empty.
        </p>

        <IonList class="pane__list" lines="none">
          <IonItem>
            <IonToggle v-model="withDemoData">
              <IonLabel>
                <h3>Load sample data</h3>
                <p>Four wallets, budgets, goals and 3 months of transactions</p>
              </IonLabel>
            </IonToggle>
          </IonItem>
        </IonList>

        <div class="summary">
          <div class="summary__row">
            <span class="app-muted">Main currency</span>
            <strong>{{ currencyDef.code }} — {{ currencyDef.name }}</strong>
          </div>
          <div class="summary__row">
            <span class="app-muted">Budget cycle</span>
            <strong>{{ describePeriodConfig(periodConfig) }}</strong>
          </div>
        </div>

        <IonNote class="pane__note">
          A screen lock using your fingerprint or a PIN is planned for a later build.
        </IonNote>
      </section>

      <IonModal :is-open="pickerOpen" @did-dismiss="pickerOpen = false">
        <CurrencyPicker
          :selected="baseCurrency"
          title="Main currency"
          @select="pick"
          @dismiss="pickerOpen = false"
        />
      </IonModal>
    </IonContent>

    <IonFooter class="onboarding-footer ion-no-border">
      <div class="footer-inner">
        <div class="dots">
          <span
            v-for="i in LAST_STEP + 1"
            :key="i"
            class="dot"
            :class="{ 'dot--on': i - 1 === step }"
          />
        </div>

        <div class="footer-actions">
          <IonButton
            v-if="step > 0"
            fill="clear"
            class="footer-actions__back"
            :disabled="saving"
            @click="back"
          >
            Back
          </IonButton>
          <IonButton expand="block" class="grow" :disabled="saving" @click="advance">
            {{ primaryLabel }}
            <IonIcon v-if="step < LAST_STEP" slot="end" :icon="arrowForward" />
          </IonButton>
        </div>
      </div>
    </IonFooter>
  </IonPage>
</template>

<style scoped>
.onboarding {
  --padding-start: 22px;
  --padding-end: 22px;
  --padding-top: 72px;
  --padding-bottom: 40px;
}

.pane {
  display: flex;
  flex-direction: column;
}

.pane__icon {
  font-size: 42px;
  color: var(--ion-color-primary);
}

.pane__title {
  margin: 16px 0 8px;
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.pane__lead {
  margin: 0 0 20px;
  color: var(--app-text-muted);
  line-height: 1.55;
}

/* Rows sit flush with the heading text rather than at Ionic's default item inset. */
.pane__list {
  margin: 0 0 12px;
  padding: 0;
  background: transparent;
}

.pane__list ion-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.pane__note {
  display: block;
  font-size: 0.82rem;
  line-height: 1.45;
  margin-bottom: 12px;
}

/* The control bar is pinned below the scrolling panes, so it keeps its own padding and
   clears the device's bottom inset. */
.onboarding-footer {
  background: var(--ion-background-color);
  border-top: 1px solid var(--app-border);
}

.footer-inner {
  padding: 14px 22px calc(34px + var(--ion-safe-area-bottom, 0px));
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-actions__back {
  flex-shrink: 0;
}

.grow {
  flex: 1;
}

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}

.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.95rem;
  line-height: 1.4;
}

.feature-list ion-icon {
  color: var(--ion-color-primary);
  font-size: 20px;
  flex-shrink: 0;
}

.picker-button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.picker-button__symbol {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 1.1rem;
  font-weight: 700;
}

.picker-button__text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.picker-button__text small {
  color: var(--app-text-muted);
  font-size: 0.82rem;
}

.preview,
.summary {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.9rem;
}

.summary {
  gap: 10px;
  margin-bottom: 14px;
}

.summary__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 7px;
  padding: 0 0 14px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-border);
}

.dot--on {
  background: var(--ion-color-primary);
  width: 20px;
  border-radius: 999px;
}
</style>
