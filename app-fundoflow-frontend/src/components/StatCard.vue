<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "ok";
}>();
</script>

<template>
  <div class="card p-5">
    <div class="label">{{ label }}</div>
    <div
      class="font-display text-3xl font-bold"
      :class="{
        'text-ink': !tone || tone === 'default',
        'text-warn': tone === 'warn',
        'text-ok': tone === 'ok',
      }"
    >
      {{ value }}
    </div>
    <div v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</div>
    <slot />
  </div>
</template>
