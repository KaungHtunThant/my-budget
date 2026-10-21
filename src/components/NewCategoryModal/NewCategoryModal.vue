<script setup lang="ts">
/**
 * Create a category without leaving the form you are in.
 *
 * Opened from the "New category…" entry of a category picker. The kind is the picker's — an
 * expense form makes a spending category — so the sheet asks only for a name, icon and colour.
 * Typing a name that already exists selects that category instead of making a duplicate.
 */
import { computed, ref, watch } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { close } from 'ionicons/icons'
import CategoryAppearance from '../CategoryAppearance/CategoryAppearance.vue'
import type { Category, CategoryKind } from '@/domain/types'
import {
  buildCategory,
  canSaveCategory,
  defaultAppearance,
  matchingCategory,
} from '@/services/categories'
import { useBudgetStore } from '@/stores/budget'

const props = defineProps<{
  isOpen: boolean
  kind: CategoryKind
}>()

const emit = defineEmits<{
  /** The category to select: the new one, or the existing one with the same name. */
  created: [category: Category]
  dismiss: []
}>()

const store = useBudgetStore()

const name = ref('')
const icon = ref(defaultAppearance(props.kind).icon)
const color = ref(defaultAppearance(props.kind).color)
const saving = ref(false)

// A fresh sheet every time it opens.
watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    name.value = ''
    ;({ icon: icon.value, color: color.value } = defaultAppearance(props.kind))
  },
)

const existing = computed(() => matchingCategory(store.categories, name.value, props.kind))
const canSave = computed(() => canSaveCategory(name.value) && !saving.value)

async function save(): Promise<void> {
  if (!canSave.value) return
  if (existing.value) {
    emit('created', existing.value)
    emit('dismiss')
    return
  }
  saving.value = true
  try {
    const created = await store.addCategory(
      buildCategory({ name: name.value, kind: props.kind, icon: icon.value, color: color.value }),
    )
    emit('created', created)
    emit('dismiss')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="emit('dismiss')">
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton aria-label="Close" @click="emit('dismiss')">
            <IonIcon slot="icon-only" :icon="close" />
          </IonButton>
        </IonButtons>
        <IonTitle>New {{ kind === 'income' ? 'income' : 'spending' }} category</IonTitle>
        <IonButtons slot="end">
          <IonButton :strong="true" :disabled="!canSave" @click="save">
            {{ existing ? 'Use it' : 'Create' }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <IonList lines="full">
        <IonItem>
          <IonInput
            v-model="name"
            label="Name"
            label-placement="stacked"
            :placeholder="kind === 'income' ? 'e.g. Bonus' : 'e.g. Pets'"
            @keyup.enter="save"
          />
        </IonItem>
      </IonList>
      <IonNote v-if="existing" class="note" color="medium">
        “{{ existing.name }}” already exists — it will be selected instead.
      </IonNote>

      <CategoryAppearance v-model:icon="icon" v-model:color="color" />

      <IonNote class="note">
        You can rename, recolour or delete it later in Categories.
      </IonNote>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.note {
  display: block;
  padding: 14px 4px 0;
  font-size: 0.8rem;
  line-height: 1.45;
}
</style>
