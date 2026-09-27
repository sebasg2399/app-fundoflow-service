<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { v4 as uuidv4 } from "uuid";
import { useAuthStore } from "../stores/auth";
import { workerRepo } from "../db/worker-repo";
import { harvestRepo } from "../db/harvest-repo";


const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const id = computed(() => (route.params.id as string) || "");
const isNew = computed(() => !id.value);

const full_name = ref("");
const qr_code = ref("");
const recentHarvests = ref<Array<{ id: string; crop_type: string; quantity: number; scanned_at: string }>>([]);
const saving = ref(false);
const message = ref<{ kind: "ok" | "err"; text: string } | null>(null);

onMounted(() => {
  if (isNew.value) {
    qr_code.value = `QR-${Date.now().toString().slice(-6)}`;
  } else if (auth.activeTenantId) {
    const w = workerRepo.getById(auth.activeTenantId, id.value);
    if (w) {
      full_name.value = w.full_name;
      qr_code.value = w.qr_code;
      recentHarvests.value = harvestRepo.recentByWorker(w.id, 5);
    }
  }
});

async function save() {
  if (!auth.activeTenantId) return;
  if (!full_name.value.trim() || !qr_code.value.trim()) {
    message.value = { kind: "err", text: "Nombre y QR son obligatorios" };
    return;
  }
  saving.value = true;
  try {
    if (isNew.value) {
      workerRepo.createLocal({
        id: uuidv4(),
        tenant_id: auth.activeTenantId,
        full_name: full_name.value.trim(),
        qr_code: qr_code.value.trim(),
      });
      message.value = { kind: "ok", text: "Trabajador creado — se sincronizará al detectar conexión" };
    } else {
      const existing = workerRepo.getById(auth.activeTenantId, id.value);
      if (existing) {
        workerRepo.upsertLocal({
          ...existing,
          full_name: full_name.value.trim(),
          qr_code: qr_code.value.trim(),
          updated_at: new Date().toISOString(),
        });
      }
      message.value = { kind: "ok", text: "Cambios guardados — se sincronizarán al detectar conexión" };
    }
    setTimeout(() => router.push({ name: "workers" }), 900);
  } finally {
    saving.value = false;
  }
}

function removeWorker() {
  if (!auth.activeTenantId || isNew.value) return;
  if (!confirm(`¿Eliminar a ${full_name.value}? Esto marcará el registro como borrado y se propagará al sincronizar.`)) return;
  workerRepo.softDelete(auth.activeTenantId, id.value);
  router.push({ name: "workers" });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

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
    <header class="flex items-center gap-3 border-b border-forest-100 bg-white px-8 py-4">
      <button class="rounded-md p-2 text-muted hover:bg-forest-50" @click="router.push({ name: 'workers' })">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="font-display text-base font-semibold">{{ isNew ? "Nuevo trabajador" : "Editar trabajador" }}</div>
    </header>

    <main class="mx-auto max-w-2xl px-8 py-8">
      <div class="card p-7">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-28 w-28 items-center justify-center rounded-full bg-forest-100 font-display text-3xl font-bold text-forest-700">
            {{ full_name ? initials(full_name) : "??" }}
          </div>
          <div class="font-display text-lg font-semibold">{{ full_name || "Nuevo" }}</div>
          <div class="text-xs text-muted">{{ qr_code }}</div>
        </div>

        <div class="mt-7 space-y-4">
          <div>
            <label class="label">Nombre completo</label>
            <input v-model="full_name" class="input" placeholder="Juan Ramírez" autofocus />
          </div>
          <div>
            <label class="label">Código QR</label>
            <input v-model="qr_code" class="input" placeholder="QR-0001" />
          </div>
          <div>
            <label class="label">Tenant</label>
            <input :value="auth.activeTenant?.name ?? '—'" class="input" disabled />
          </div>
        </div>

        <p v-if="message" class="mt-4 text-sm" :class="message.kind === 'ok' ? 'text-ok' : 'text-err'">
          {{ message.text }}
        </p>

        <div class="mt-7 space-y-2">
          <button class="btn-primary w-full" :disabled="saving" @click="save">
            {{ saving ? "Guardando…" : isNew ? "Crear trabajador" : "Guardar cambios" }}
          </button>
          <button class="btn-ghost w-full" @click="router.push({ name: 'workers' })">Cancelar</button>
        </div>

        <button v-if="!isNew" class="mt-4 text-sm font-semibold text-err hover:underline" @click="removeWorker">
          Eliminar trabajador
        </button>
      </div>

      <div v-if="!isNew && recentHarvests.length > 0" class="card mt-6 p-5">
        <h3 class="font-display text-base font-semibold">Historial reciente</h3>
        <ul class="mt-3 divide-y divide-forest-100">
          <li v-for="h in recentHarvests" :key="h.id" class="flex items-center justify-between py-2 text-sm">
            <span class="font-medium">{{ h.crop_type }}</span>
            <span class="text-muted">{{ timeAgo(h.scanned_at) }}</span>
            <span class="font-semibold">{{ h.quantity }} kg</span>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>
