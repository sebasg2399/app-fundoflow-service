<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import { outboxRepo } from "../db/outbox-repo";
import type { OutboxEntry } from "../db/outbox-repo";

const auth = useAuthStore();
const sync = useSyncStore();

const pending = ref<OutboxEntry[]>([]);
const log = ref<Array<{ id: number; outcome: "ok" | "error"; direction: "push" | "pull"; message: string | null; items_count: number | null; occurred_at: string }>>([]);

function refresh() {
  if (!auth.activeTenantId) return;
  pending.value = outboxRepo.list(auth.activeTenantId);
  log.value = outboxRepo.recentLog(8);
}

async function pushNow() {
  await sync.pushNow();
  refresh();
}

async function pullNow() {
  await sync.pullNow();
  refresh();
}

onMounted(refresh);

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function relative(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
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
      <div class="font-display text-base font-semibold">Sincronización</div>
      <ConnectionStatus :online="sync.online" :pending="sync.outboxCount" />
    </header>

    <main class="mx-auto max-w-3xl px-8 py-8">
      <div class="card p-7">
        <div class="flex items-center gap-4">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full"
            :class="sync.online ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'"
          >
            <svg v-if="sync.online" viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
            <svg v-else viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" /></svg>
          </div>
          <div>
            <div class="font-display text-xl font-bold">{{ sync.online ? "Conectado" : "Sin conexión" }}</div>
            <div class="text-sm text-muted">
              <span v-if="sync.lastPushAt">Última sincronización: {{ relative(sync.lastPushAt) }}</span>
              <span v-else>Sin sincronizaciones previas</span>
            </div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-3">
          <button class="btn-primary" :disabled="sync.isPushing || pending.length === 0" @click="pushNow">
            <span v-if="sync.isPushing">Sincronizando…</span>
            <span v-else>Sincronizar ahora ({{ pending.length }})</span>
          </button>
          <button class="btn-secondary" :disabled="sync.isPulling || !sync.online" @click="pullNow">
            <span v-if="sync.isPulling">Trayendo…</span>
            <span v-else>Traer cambios</span>
          </button>
        </div>
        <p v-if="sync.lastError" class="mt-3 text-sm text-err">{{ sync.lastError }}</p>
      </div>

      <section class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold">Batches pendientes</h2>
          <span class="chip-idle">{{ pending.length }}</span>
        </div>
        <div v-if="pending.length === 0" class="card p-8 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok">
            <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
          </div>
          <p class="font-semibold">Todo sincronizado</p>
          <p class="mt-1 text-sm text-muted">No hay batches pendientes</p>
        </div>
        <ul v-else class="card divide-y divide-forest-100">
          <li v-for="entry in pending" :key="entry.batch_id" class="px-5 py-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-mono text-xs text-muted">{{ entry.batch_id.slice(0, 8) }}…</div>
                <div class="mt-1 text-sm font-semibold">
                  {{ entry.payload.workers.length }} trabajadores · {{ entry.payload.harvest_logs.length }} registros de cosecha
                </div>
                <div class="text-xs text-muted">Creado {{ relative(entry.created_at) }} · {{ entry.attempts }} intento(s)</div>
                <div v-if="entry.last_error" class="mt-1 text-xs text-err">⚠ {{ entry.last_error }}</div>
              </div>
              <span class="chip border border-warn/40 bg-warn/10 text-warn">pendiente</span>
            </div>
          </li>
        </ul>
      </section>

      <section class="mt-8">
        <h2 class="mb-3 font-display text-lg font-semibold">Historial reciente</h2>
        <ul class="card divide-y divide-forest-100">
          <li v-for="row in log" :key="row.id" class="flex items-center gap-3 px-5 py-3 text-sm">
            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded-full"
              :class="row.outcome === 'ok' ? 'bg-ok/10 text-ok' : 'bg-err/10 text-err'"
            >
              <svg v-if="row.outcome === 'ok'" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
              <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
            </span>
            <span class="flex-1">
              <span class="font-semibold capitalize">{{ row.direction === "push" ? "Push" : "Pull" }}</span>
              <span v-if="row.items_count" class="text-muted"> · {{ row.items_count }} items</span>
              <span v-if="row.message" class="block text-xs text-err">{{ row.message }}</span>
            </span>
            <span class="text-xs text-muted">{{ fmtTime(row.occurred_at) }}</span>
          </li>
          <li v-if="log.length === 0" class="px-5 py-6 text-center text-sm text-muted">Sin eventos aún</li>
        </ul>
      </section>
    </main>
  </div>
</template>
