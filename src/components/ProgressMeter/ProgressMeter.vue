<script setup lang="ts">
/**
 * A single-bar meter for budget usage and goal progress.
 *
 * Over-budget bars stay full-width and turn red rather than overflowing, so a row that is
 * 300% spent still lines up with its neighbours. The `pace` marker shows how far through
 * the period we are, which is what turns "60% spent" into "60% spent, and it is only the
 * 10th" — the useful reading.
 */
import { computed } from 'vue'

import { fillColor as colorFor, fillWidth, paceOffset } from './utils'

const props = withDefaults(
  defineProps<{
    /** 0–100, may exceed 100. */
    percent: number
    /** Colour token: primary, success, warning, danger, tertiary… */
    color?: string
    /** Optional 0–1 marker showing elapsed time in the period. */
    pace?: number | null
    over?: boolean
  }>(),
  { color: 'primary', pace: null, over: false },
)

const width = computed(() => fillWidth(props.percent))

const fillColor = computed(() => colorFor(props.percent, props.over, props.color))
</script>

<template>
  <div class="meter-wrap">
    <div class="app-meter">
      <div class="app-meter__fill" :style="{ width, background: fillColor }" />
    </div>
    <div v-if="pace !== null" class="meter-pace" :style="{ left: paceOffset(pace) }" />
  </div>
</template>

<style scoped>
.meter-wrap {
  position: relative;
}

.meter-pace {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  border-radius: 2px;
  background: var(--app-text-muted);
  opacity: 0.55;
  transform: translateX(-1px);
}
</style>
