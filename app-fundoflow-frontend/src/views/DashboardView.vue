<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import { workerRepo } from "../db/worker-repo";
import { harvestRepo } from "../db/harvest-repo";
import { outboxRepo } from "../db/outbox-repo";
import StatCard from "../components/StatCard.vue";
import ConnectionStatus from "../components/ConnectionStatus.vue";
import { RouterLink } from "vue-router";

const auth = useAuthStore();
const sync = useSyncStore();

const stats = ref({ workers: 0, kilos: 0, logs: 0, pending: 0 });
const recent = ref<Array<{ id: string; crop_type: string; quantity: number; scanned_at: string; worker_name: string; synced: boolean }>>([]);

function refresh() {
  if (!auth.activeTenantId) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  stats.value.workers = workerRepo.countActive(auth.activeTenantId);
  const todayStats = harvestRepo.countToday(auth.activeTenantId);
  stats.value.kilos = Math.round(todayStats.kilos);
  stats.value.logs = todayStats.logs;
  stats.value.pending = outboxRepo.count(auth.activeTenantId);

  // Recent activity
  const logs = harvestRepo.listSince(auth.activeTenantId, today.toISOString()).slice(0, 5);
  recent.value = logs.map((l) => {
    const w = workerRepo.getById(auth.activeTenantId!, l.worker_id);
    const synced = l.id ? true : false;
    return {
      id: l.id,
      crop_type: l.crop_type,
      quantity: l.quantity,
      scanned_at: l.scanned_at,
      worker_name: w?.full_name ?? "—",
      synced,
    };
  });
}

onMounted(refresh);

const today = computed(() =>
  new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
);

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-CL");
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-cream">
    <header class="flex items-center justify-between border-b border-forest-100 bg-white px-8 py-4">
      <div class="text-sm text-muted">{{ auth.activeTenant?.name }}</div>
      <div class="font-display text-sm font-semibold capitalize">{{ today }}</div>
      <ConnectionStatus :online="sync.online" :pending="sync.outboxCount" />
    </header>

    <main class="mx-auto max-w-6xl px-8 py-8">
      <h1 class="font-display text-3xl font-bold">Buenos días, {{ auth.supervisorName }}</h1>
      <p class="mt-1 text-sm text-muted">Esta es la actividad de hoy en {{ auth.activeTenant?.name }}.</p>

      <section class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trabajadores activos" :value="stats.workers" hint="Registrados en el fundo" />
        <StatCard label="Kilos cosechados" :value="`${stats.kilos} kg`" hint="Hoy, en todos los cultivos" />
        <StatCard label="Lotes por sincronizar" :value="stats.pending" :tone="stats.pending > 0 ? 'warn' : 'ok'" hint="Pendientes de subir al backend" />
        <StatCard label="Última sincronización" :value="sync.lastPushAt ? timeAgo(sync.lastPushAt) : '—'" :tone="sync.lastPushAt ? 'ok' : 'default'" />
      </section>

      <RouterLink :to="{ name: 'harvest' }" class="mt-6 block">
        <button class="btn-primary w-full py-4 text-base">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
          Registrar cosecha
        </button>
      </RouterLink>

      <section class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold">Actividad reciente</h2>
          <button class="text-sm font-semibold text-forest hover:underline" @click="refresh">Actualizar</button>
        </div>
        <div v-if="recent.length === 0" class="card p-8 text-center text-sm text-muted">
          Aún no registraste cosechas hoy. Tocá <strong class="text-forest">Registrar cosecha</strong> para empezar.
        </div>
        <ul v-else class="card divide-y divide-forest-100">
          <li v-for="r in recent" :key="r.id" class="flex items-center justify-between px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-full bg-forest-100 text-sm font-semibold text-forest-700">
                {{ r.worker_name.slice(0, 2).toUpperCase() }}
              </div>
              <div>
                <div class="text-sm font-semibold">{{ r.worker_name }}</div>
                <div class="text-xs text-muted">{{ timeAgo(r.scanned_at) }} · {{ r.crop_type }}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold">{{ r.quantity }} kg</span>
              <span v-if="r.synced" class="inline-flex items-center gap-1 text-xs text-ok">
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
                ok
              </span>
              <span v-else class="text-xs text-warn">pendiente</span>
            </div>
          </li>
        </ul>
      </section>

      <div v-if="!sync.online" class="mt-6 rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
        <strong>Trabajando sin conexión</strong> — los datos se guardan localmente y se sincronizarán al reconectar.
      </div>
    </main>
  </div>
</template>
