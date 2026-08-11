<script setup lang="ts">
/**
 * Wallets.
 *
 * Each wallet is single-currency by design, so the currency picker is only offered when
 * creating one — changing it later would silently reinterpret every stored balance.
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
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, cardOutline, chevronForward, close, trashOutline } from 'ionicons/icons'
import { iconFor } from '@/theme/icons'
import CurrencyPicker from '@/components/CurrencyPicker.vue'
import EmptyState from '@/components/EmptyState.vue'
import MoneyText from '@/components/MoneyText.vue'
import { type CurrencyCode, currency } from '@/domain/currency'
import { amountPlaceholder, formatMoney } from '@/domain/format'
import { parseMoney, toDecimalString, zero } from '@/domain/money'
import type { Id, Wallet, WalletKind } from '@/domain/types'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const modalOpen = ref(false)
const pickerOpen = ref(false)
const editingId = ref<Id | null>(null)
const name = ref('')
const kind = ref<WalletKind>('bank')
const walletCurrency = ref<CurrencyCode>(store.base)
const openingText = ref('')
const archived = ref(false)

const KINDS: { value: WalletKind; label: string; icon: string }[] = [
  { value: 'bank', label: 'Bank account', icon: 'business-outline' },
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'savings', label: 'Savings', icon: 'shield-checkmark-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'other', label: 'Other', icon: 'ellipse-outline' },
]

const editing = computed(() => editingId.value !== null)
const currencyDef = computed(() => currency(walletCurrency.value))
const canSave = computed(() => name.value.trim().length > 0)

/** Totals per currency, so a multi-currency user sees each holding on its own terms. */
const byCurrency = computed(() => {
  const groups = new Map<CurrencyCode, { total: number; count: number }>()
  for (const w of store.wallets) {
    const entry = groups.get(w.currency) ?? { total: 0, count: 0 }
    entry.total += store.balanceOf(w.id).minor
    entry.count += 1
    groups.set(w.currency, entry)
  }
  return [...groups.entries()].map(([code, entry]) => ({
    code,
    total: { minor: entry.total, currency: code },
    count: entry.count,
  }))
})

function openNew(): void {
  editingId.value = null
  name.value = ''
  kind.value = 'bank'
  walletCurrency.value = store.base
  openingText.value = ''
  archived.value = false
  modalOpen.value = true
}

function openEdit(wallet: Wallet): void {
  editingId.value = wallet.id
  name.value = wallet.name
  kind.value = wallet.kind
  walletCurrency.value = wallet.currency
  openingText.value = toDecimalString(wallet.openingBalance)
  archived.value = wallet.archived
  modalOpen.value = true
}

async function save(): Promise<void> {
  const opening = parseMoney(openingText.value, walletCurrency.value) ?? zero(walletCurrency.value)
  const icon = KINDS.find((k) => k.value === kind.value)?.icon ?? 'wallet-outline'

  if (editingId.value) {
    const existing = store.wallets.find((w) => w.id === editingId.value)
    if (existing) {
      await store.editWallet({
        ...existing,
        name: name.value.trim(),
        kind: kind.value,
        openingBalance: opening,
        icon,
        archived: archived.value,
      })
    }
  } else {
    await store.addWallet({
      name: name.value.trim(),
      kind: kind.value,
      currency: walletCurrency.value,
      openingBalance: opening,
      icon,
      color: 'primary',
      archived: false,
    })
  }
  modalOpen.value = false
}

async function remove(): Promise<void> {
  if (editingId.value) await store.removeWallet(editingId.value)
  modalOpen.value = false
}

function pick(code: CurrencyCode): void {
  walletCurrency.value = code
  pickerOpen.value = false
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/more" />
        </IonButtons>
        <IonTitle>Wallets</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="app-content">
      <EmptyState
        v-if="store.wallets.length === 0"
        :icon="cardOutline"
        title="No wallets"
        message="A wallet holds money in one currency — a bank account, cash in hand, or a savings pot."
        action-label="Add a wallet"
        @action="openNew"
      />

      <template v-else>
        <div class="app-card app-card--stack">
          <span class="app-muted">Combined, in {{ store.base }}</span>
          <MoneyText :value="store.netWorth.total" class="app-figure--hero" />
          <div v-if="store.netWorth.missing.length" class="app-muted missing">
            {{ store.netWorth.missing.join(', ') }} excluded — no rate set yet
          </div>
          <div v-if="byCurrency.length > 1" class="by-currency">
            <div v-for="row in byCurrency" :key="row.code" class="by-currency__row">
              <span class="app-muted">{{ row.code }} · {{ row.count }} wallet{{ row.count === 1 ? '' : 's' }}</span>
              <MoneyText :value="row.total" />
            </div>
          </div>
        </div>

        <div class="app-card app-card--flush">
          <IonList lines="full">
            <IonItem
              v-for="wallet in store.wallets"
              :key="wallet.id"
              button
              :detail="false"
              @click="openEdit(wallet)"
            >
              <IonIcon slot="start" :icon="iconFor(wallet.icon)" :color="wallet.color" />
              <IonLabel>
                <h3>{{ wallet.name }}</h3>
                <p>{{ wallet.currency }} · opened with {{ formatMoney(wallet.openingBalance) }}</p>
              </IonLabel>
              <MoneyText slot="end" :value="store.balanceOf(wallet.id)" colored />
            </IonItem>
          </IonList>
        </div>
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
            <IonTitle>{{ editing ? 'Edit' : 'New' }} wallet</IonTitle>
            <IonButtons slot="end">
              <IonButton :strong="true" :disabled="!canSave" @click="save">Save</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonList lines="full">
            <IonItem>
              <IonInput v-model="name" label="Name" label-placement="stacked" placeholder="Main account" />
            </IonItem>
            <IonItem>
              <IonSelect v-model="kind" label="Type" label-placement="stacked" interface="popover">
                <IonSelectOption v-for="k in KINDS" :key="k.value" :value="k.value">
                  {{ k.label }}
                </IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem :button="!editing" :detail="false" @click="!editing && (pickerOpen = true)">
              <IonLabel>
                <p>Currency</p>
                <h3>{{ currencyDef.code }} — {{ currencyDef.name }}</h3>
              </IonLabel>
              <IonIcon v-if="!editing" slot="end" :icon="chevronForward" />
            </IonItem>
            <IonItem>
              <IonInput
                v-model="openingText"
                type="text"
                inputmode="decimal"
                :label="`Opening balance (${walletCurrency})`"
                label-placement="stacked"
                :placeholder="amountPlaceholder(walletCurrency)"
              />
            </IonItem>
            <IonItem v-if="editing">
              <IonToggle v-model="archived">
                <IonLabel>
                  <h3>Archived</h3>
                  <p>Hide from lists without deleting its history</p>
                </IonLabel>
              </IonToggle>
            </IonItem>
          </IonList>

          <IonNote class="modal-note">
            <template v-if="editing">
              A wallet's currency cannot be changed — every stored balance is expressed in
              it. Create a new wallet instead.
            </template>
            <template v-else>
              Set the opening balance to what is in the account today, so balances are right
              from the start without entering past history.
            </template>
          </IonNote>

          <IonButton
            v-if="editing"
            expand="block"
            fill="clear"
            color="danger"
            class="delete"
            @click="remove"
          >
            <IonIcon slot="start" :icon="trashOutline" />
            Delete wallet and its transactions
          </IonButton>
        </IonContent>
      </IonModal>

      <IonModal :is-open="pickerOpen" @did-dismiss="pickerOpen = false">
        <CurrencyPicker
          :selected="walletCurrency"
          :favourites="store.settings.activeCurrencies"
          title="Wallet currency"
          @select="pick"
          @dismiss="pickerOpen = false"
        />
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.missing {
  font-size: 0.78rem;
  margin-top: 4px;
}

.by-currency {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
  display: grid;
  gap: 7px;
}

.by-currency__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.86rem;
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
