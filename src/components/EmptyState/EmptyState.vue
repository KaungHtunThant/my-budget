<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'

defineProps<{
  icon: string
  title: string
  message: string
  actionLabel?: string
}>()

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty">
    <IonIcon :icon="icon" class="empty__icon" />
    <h3 class="empty__title">{{ title }}</h3>
    <p class="empty__message">{{ message }}</p>
    <IonButton v-if="actionLabel" size="default" @click="emit('action')">
      {{ actionLabel }}
    </IonButton>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 44px 24px;
}

.empty__icon {
  font-size: 46px;
  color: var(--app-text-muted);
  opacity: 0.5;
}

.empty__title {
  margin: 14px 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}

.empty__message {
  margin: 0 0 18px;
  color: var(--app-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
