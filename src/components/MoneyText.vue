<script setup lang="ts">
/**
 * Renders an amount with consistent tabular figures, and colours it by direction when
 * asked. Centralising this keeps every screen showing the same currency symbol for the
 * same wallet, which is the whole reason `formatMoney` owns its own symbol table.
 */
import { computed } from 'vue'
import { formatMoney, formatMoneyCompact } from '@/domain/format'
import type { Money } from '@/domain/money'

const props = withDefaults(
  defineProps<{
    value: Money
    /** Colour green when positive and red when negative. */
    colored?: boolean
    /** Always show an explicit + or −. */
    signed?: boolean
    /** Abbreviate to 1.2k / 3.4M. */
    compact?: boolean
    showCode?: boolean
    /** Flip the colour meaning, for expense figures stored as positive amounts. */
    negativeMeaning?: boolean
  }>(),
  {
    colored: false,
    signed: false,
    compact: false,
    showCode: false,
    negativeMeaning: false,
  },
)

const text = computed(() =>
  props.compact
    ? formatMoneyCompact(props.value)
    : formatMoney(props.value, { signed: props.signed, showCode: props.showCode }),
)

const tone = computed(() => {
  if (!props.colored) return ''
  if (props.negativeMeaning) return props.value.minor === 0 ? '' : 'tone-negative'
  if (props.value.minor > 0) return 'tone-positive'
  if (props.value.minor < 0) return 'tone-negative'
  return ''
})
</script>

<template>
  <span class="app-figure" :class="tone">{{ text }}</span>
</template>

<style scoped>
.tone-positive {
  color: var(--ion-color-success);
}

.tone-negative {
  color: var(--ion-color-danger);
}
</style>
