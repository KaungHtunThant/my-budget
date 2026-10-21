<script setup lang="ts">
/**
 * The icon grid and colour row for a category. Shared by the Categories screen's form and the
 * quick "New category" sheet, so a category looks the same however it was made.
 */
import { IonIcon } from '@ionic/vue'
import { CATEGORY_ICON_NAMES, iconFor } from '@/theme/icons'

const icon = defineModel<string>('icon', { required: true })
const color = defineModel<string>('color', { required: true })

const COLORS = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'medium']
</script>

<template>
  <div class="picker-label app-muted">Icon</div>
  <div class="icon-grid">
    <button
      v-for="option in CATEGORY_ICON_NAMES"
      :key="option"
      type="button"
      class="icon-option"
      :class="{ 'icon-option--on': option === icon }"
      :aria-label="option"
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
      :aria-label="option"
      @click="color = option"
    />
  </div>
</template>

<style scoped>
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
</style>
