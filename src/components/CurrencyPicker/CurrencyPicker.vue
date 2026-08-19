<script setup lang="ts">
/**
 * Currency picker over the full ISO 4217 table.
 *
 * ~160 currencies is too many to scroll, so the list is search-first: a search bar,
 * then the user's own currencies, then a popular shortlist, then everything. `decimals`
 * is shown because it explains why a JPY amount refuses to take cents.
 */
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { checkmark, close } from 'ionicons/icons'
import { type CurrencyCode, type CurrencyDef, searchCurrencies } from '@/domain/currency'

import { favouriteDefs, isSearching, popularDefs } from './utils'

const props = defineProps<{
  selected: CurrencyCode
  /** Currencies the user already holds, listed first. */
  favourites?: CurrencyCode[]
  title?: string
}>()

const emit = defineEmits<{ select: [code: CurrencyCode]; dismiss: [] }>()

const query = ref('')

const searching = computed(() => isSearching(query.value))
const results = computed(() => searchCurrencies(query.value))

const favourites = computed<CurrencyDef[]>(() => favouriteDefs(props.favourites))
const popular = computed<CurrencyDef[]>(() => popularDefs(props.favourites))

function choose(code: string): void {
  emit('select', code as CurrencyCode)
}
</script>

<template>
  <IonHeader>
    <IonToolbar>
      <IonTitle>{{ title ?? 'Choose currency' }}</IonTitle>
      <IonButtons slot="end">
        <IonButton @click="emit('dismiss')">
          <IonIcon slot="icon-only" :icon="close" />
        </IonButton>
      </IonButtons>
    </IonToolbar>
    <IonToolbar>
      <IonSearchbar
        v-model="query"
        placeholder="Search code or name"
        :debounce="120"
        autocapitalize="characters"
      />
    </IonToolbar>
  </IonHeader>

  <IonContent>
    <IonList v-if="searching" lines="full">
      <IonItem
        v-for="def in results"
        :key="def.code"
        button
        :detail="false"
        @click="choose(def.code)"
      >
        <IonLabel>
          <h3>{{ def.code }} — {{ def.name }}</h3>
          <p>{{ def.symbol }} · {{ def.decimals }} decimal places</p>
        </IonLabel>
        <IonIcon v-if="def.code === selected" slot="end" :icon="checkmark" color="primary" />
      </IonItem>
      <IonItem v-if="results.length === 0">
        <IonLabel class="app-muted">No currency matches “{{ query }}”.</IonLabel>
      </IonItem>
    </IonList>

    <template v-else>
      <IonList v-if="favourites.length" lines="full">
        <IonListHeader>Your currencies</IonListHeader>
        <IonItem
          v-for="def in favourites"
          :key="`fav-${def.code}`"
          button
          :detail="false"
          @click="choose(def.code)"
        >
          <IonLabel>
            <h3>{{ def.code }} — {{ def.name }}</h3>
            <p>{{ def.symbol }} · {{ def.decimals }} decimal places</p>
          </IonLabel>
          <IonIcon v-if="def.code === selected" slot="end" :icon="checkmark" color="primary" />
        </IonItem>
      </IonList>

      <IonList lines="full">
        <IonListHeader>Commonly used</IonListHeader>
        <IonItem
          v-for="def in popular"
          :key="`pop-${def.code}`"
          button
          :detail="false"
          @click="choose(def.code)"
        >
          <IonLabel>
            <h3>{{ def.code }} — {{ def.name }}</h3>
            <p>{{ def.symbol }} · {{ def.decimals }} decimal places</p>
          </IonLabel>
          <IonIcon v-if="def.code === selected" slot="end" :icon="checkmark" color="primary" />
        </IonItem>
      </IonList>

      <IonList lines="full">
        <IonListHeader>All currencies</IonListHeader>
        <IonNote class="all-note">
          Every ISO 4217 currency, {{ results.length }} in total.
        </IonNote>
        <IonItem
          v-for="def in results"
          :key="`all-${def.code}`"
          button
          :detail="false"
          @click="choose(def.code)"
        >
          <IonLabel>
            <h3>{{ def.code }} — {{ def.name }}</h3>
            <p>{{ def.symbol }} · {{ def.decimals }} decimal places</p>
          </IonLabel>
          <IonIcon v-if="def.code === selected" slot="end" :icon="checkmark" color="primary" />
        </IonItem>
      </IonList>
    </template>
  </IonContent>
</template>

<style scoped>
.all-note {
  display: block;
  padding: 0 16px 8px;
  font-size: 0.8rem;
}
</style>
