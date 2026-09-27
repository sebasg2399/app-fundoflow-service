<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const route = useRoute();

const navItems = [
  { name: "dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { name: "workers", label: "Trabajadores", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 100-8 4 4 0 000 8zm6 4a4 4 0 10-8 0" },
  { name: "harvest", label: "Registrar cosecha", icon: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" },
  { name: "sync", label: "Sincronización", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
];

const initials = computed(() => auth.supervisorName.slice(0, 2).toUpperCase());
</script>

<template>
  <aside class="flex w-60 shrink-0 flex-col bg-forest-600 text-white">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <div class="flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c4-3 7-7 7-12a7 7 0 10-14 0c0 5 3 9 7 12z" />
          <path d="M12 12c-2-2-2-5 0-7 2 2 2 5 0 7z" />
        </svg>
      </div>
      <div>
        <div class="font-display text-base font-bold leading-tight">FundoFlow</div>
        <div class="text-[10px] uppercase tracking-wider text-forest-100/70">offline-first</div>
      </div>
    </div>

    <nav class="flex-1 space-y-1 px-3">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="nav-item"
        :class="{ 'nav-item-active': route.name === item.name }"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path :d="item.icon" />
        </svg>
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="border-t border-forest-700 p-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-forest-700 text-sm font-semibold">
          {{ initials }}
        </div>
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold">{{ auth.supervisorName }}</div>
          <div class="truncate text-xs text-forest-100/70">{{ auth.activeTenant?.name ?? "Sin fundo" }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>
