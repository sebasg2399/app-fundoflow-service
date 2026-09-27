<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import { workerRepo } from "../db/worker-repo";
import type { Worker } from "../types";

const auth = useAuthStore();
const sync = useSyncStore();
const search = ref("");
const filter = ref<"all" | "synced" | "pending">("all");
const tick = ref(0);

const workers = computed<Worker[]>(() => {
  tick.value;
  if (!auth.activeTenantId) return [];
  const all = workerRepo.list(auth.activeTenantId);
  return all.filter((w) => w.full_name.toLowerCase().includes(search.value.toLowerCase()));
});

onMounted(() => {
  tick.value += 1;
});

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-cream">
    <header class="flex items-center justify-between border-b border-forest-100 bg-white px-8 py-4">
      <div class="font-display text-base font-semibold">Trabajadores</div>
      <ConnectionStatus :online="sync.online" :pending="0" />
    </header>

    <main class="mx-auto max-w-6xl px-8 py-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="font-display text-2xl font-bold">Trabajadores</h1>
          <p class="mt-1 text-sm text-muted">{{ workers.length }} trabajadores en {{ auth.activeTenant?.name }}</p>
        </div>
        <div class="flex flex-1 items-center gap-3 md:max-w-md">
          <div class="relative flex-1">
            <svg viewBox="0 0 24 24" class="absolute left-3 top-2.5 h-4 w-4 text-muted" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input v-model="search" class="input pl-9" placeholder="Buscar por nombre o QR" />
          </div>
          <RouterLink :to="{ name: 'worker-new' }">
            <button class="btn-primary">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar
            </button>
          </RouterLink>
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        <button :class="filter === 'all' ? 'chip-active' : 'chip-idle'" @click="filter = 'all'">Todos</button>
        <button :class="filter === 'synced' ? 'chip-active' : 'chip-idle'" @click="filter = 'synced'">Sincronizados</button>
        <button :class="filter === 'pending' ? 'chip-active' : 'chip-idle'" @click="filter = 'pending'">Pendientes</button>
      </div>

      <div v-if="workers.length === 0" class="card mt-8 p-12 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-forest-100 text-forest-600">
          <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 100-8 4 4 0 000 8zm6 4a4 4 0 10-8 0" /></svg>
        </div>
        <p class="font-semibold">No hay trabajadores registrados</p>
        <p class="mt-1 text-sm text-muted">Toca Agregar para empezar a registrar tu cuadrilla.</p>
        <RouterLink :to="{ name: 'worker-new' }" class="mt-4 inline-block">
          <button class="btn-primary">+ Agregar trabajador</button>
        </RouterLink>
      </div>

      <div v-else class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="w in workers"
          :key="w.id"
          :to="{ name: 'worker-edit', params: { id: w.id } }"
          class="card flex items-center gap-4 p-4 transition-shadow hover:shadow-floating"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 font-semibold text-forest-700">
            {{ initials(w.full_name) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-semibold">{{ w.full_name }}</div>
            <div class="text-xs text-muted">{{ w.qr_code }}</div>
          </div>
          <svg viewBox="0 0 24 24" class="h-4 w-4 text-muted" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" /></svg>
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import ConnectionStatus from "../components/ConnectionStatus.vue";
export default { components: { ConnectionStatus } };
</script>
