<script setup lang="ts">
defineProps<{
  online: boolean;
  pending: number;
}>();
</script>

<template>
  <div
    class="flex items-center gap-2 text-xs font-semibold"
    :class="online ? 'text-ok' : 'text-warn'"
  >
    <span
      class="inline-block h-2 w-2 rounded-full"
      :class="online ? 'bg-ok animate-pulse' : 'bg-warn'"
    />
    <span>{{ online ? "Conectado" : "Sin conexión" }}</span>
    <span v-if="pending > 0" class="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-warn">
      {{ pending }} en cola
    </span>
  </div>
</template>
