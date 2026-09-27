<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import { workerRepo } from "../db/worker-repo";
import { harvestRepo } from "../db/harvest-repo";
import type { Worker } from "../types";

const auth = useAuthStore();
const sync = useSyncStore();

type CropType = "uva" | "palta" | "mango" | "limón" | "naranja";

const crops: CropType[] = ["uva", "palta", "mango", "limón", "naranja"];

const step = ref<"scan" | "form">("scan");
const qrInput = ref("");
const worker = ref<Worker | null>(null);
const crop = ref<CropType>("uva");
const quantity = ref(0);
const unit = ref<"kg" | "jabas">("kg");
const flash = ref<string | null>(null);

const timestamp = computed(() =>
  new Date().toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
);

const inFlight = ref(false);

function tryScan(qr: string) {
  if (!auth.activeTenantId) return;
  const found = workerRepo.findByQr(auth.activeTenantId, qr.trim());
  if (found) {
    worker.value = found;
    step.value = "form";
    flash.value = null;
  } else {
    flash.value = `No se encontró un trabajador con QR "${qr}"`;
  }
}

function submitEntry() {
  if (!auth.activeTenantId || !worker.value || quantity.value <= 0) return;
  inFlight.value = true;
  try {
    const now = new Date().toISOString();
    harvestRepo.createLocal({
      id: uuidv4(),
      tenant_id: auth.activeTenantId,
      worker_id: worker.value.id,
      crop_type: crop.value,
      quantity: quantity.value,
      scanned_at: now,
    });
    sync.enqueueLocal(); // arma un batch con todo lo unsynced
    flash.value = `Guardado ${quantity.value} ${unit.value} de ${crop.value} para ${worker.value.full_name}`;
    // Reset para el siguiente
    quantity.value = 0;
    setTimeout(() => {
      step.value = "scan";
      worker.value = null;
      qrInput.value = "";
    }, 700);
  } finally {
    inFlight.value = false;
  }
}

function cancel() {
  step.value = "scan";
  worker.value = null;
  quantity.value = 0;
  qrInput.value = "";
  flash.value = null;
}

function adjust(delta: number) {
  quantity.value = Math.max(0, Math.round((quantity.value + delta) * 10) / 10);
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

onMounted(() => {
  // Auto-focus para el input QR (placeholder de cámara real)
});
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-cream">
    <header class="flex items-center justify-between border-b border-forest-100 bg-white px-8 py-4">
      <div class="font-display text-base font-semibold">Registrar cosecha</div>
      <ConnectionStatus :online="sync.online" :pending="sync.outboxCount" />
    </header>

    <div v-if="sync.outboxCount > 0" class="bg-warn/10 px-8 py-2.5 text-sm text-warn">
      <strong>{{ sync.outboxCount }} {{ sync.outboxCount === 1 ? "registro en cola" : "registros en cola" }}</strong>
      — se sincronizarán al detectar conexión
    </div>

    <main class="mx-auto grid max-w-6xl gap-6 px-8 py-8 lg:grid-cols-[3fr_2fr]">
      <!-- Columna izquierda: cámara o worker card -->
      <section>
        <div v-if="step === 'scan'" class="card overflow-hidden">
          <div class="aspect-video w-full bg-ink relative">
            <!-- Placeholder de cámara con overlay QR -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center text-white/70">
                <svg viewBox="0 0 24 24" class="mx-auto h-16 w-16 opacity-30" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /></svg>
                <p class="mt-2 text-xs">Vista de cámara (placeholder)</p>
              </div>
            </div>
            <!-- Corner brackets -->
            <span class="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-white" />
            <span class="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-white" />
            <span class="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-white" />
            <span class="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-white" />
            <!-- Scanning line -->
            <div class="absolute inset-x-0 top-1/2 h-px bg-white/70 shadow-[0_0_8px_white] animate-pulse" />
          </div>
          <div class="p-6">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <span class="inline-block h-2 w-2 rounded-full bg-forest animate-pulse" />
              Apuntá al QR del trabajador
            </div>
            <p class="mt-1 text-xs text-muted">Si el QR está dañado, podés buscarlo manualmente abajo.</p>
            <form class="mt-4 flex gap-2" @submit.prevent="tryScan(qrInput)">
              <input v-model="qrInput" class="input" placeholder="Ingresar código QR manualmente (ej. QR-0001)" />
              <button class="btn-primary">Buscar</button>
            </form>
            <p v-if="flash" class="mt-2 text-sm text-err">{{ flash }}</p>
          </div>
        </div>

        <div v-else class="card p-5">
          <div class="flex items-center gap-3 border-l-4 border-forest pl-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 font-semibold text-forest-700">
              {{ initials(worker!.full_name) }}
            </div>
            <div class="flex-1">
              <div class="font-semibold">{{ worker!.full_name }}</div>
              <div class="text-xs text-muted">{{ worker!.qr_code }}</div>
            </div>
            <span class="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
              <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
              Verificado
            </span>
          </div>
        </div>
      </section>

      <!-- Columna derecha: form de cultivo + cantidad -->
      <section v-if="step === 'form'" class="space-y-4">
        <div class="card p-5">
          <h3 class="font-display text-sm font-semibold uppercase tracking-wide text-muted">Cultivo</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="c in crops"
              :key="c"
              :class="crop === c ? 'chip-active' : 'chip-idle'"
              class="capitalize"
              @click="crop = c"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <div class="card p-5">
          <h3 class="font-display text-sm font-semibold uppercase tracking-wide text-muted">Cantidad</h3>
          <div class="mt-3 flex items-center gap-3">
            <button class="btn-secondary !px-4 !py-3 text-xl" @click="adjust(-1)">−</button>
            <input
              v-model.number="quantity"
              type="number"
              min="0"
              step="0.5"
              class="input flex-1 text-center font-display text-2xl font-bold"
            />
            <button class="btn-secondary !px-4 !py-3 text-xl" @click="adjust(1)">+</button>
          </div>
          <div class="mt-3 flex gap-2">
            <button :class="unit === 'kg' ? 'chip-active' : 'chip-idle'" @click="unit = 'kg'">kg</button>
            <button :class="unit === 'jabas' ? 'chip-active' : 'chip-idle'" @click="unit = 'jabas'">jabas</button>
          </div>
        </div>

        <div class="card p-5">
          <h3 class="font-display text-sm font-semibold uppercase tracking-wide text-muted">Momento del registro</h3>
          <p class="mt-2 flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" class="h-4 w-4 text-muted" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            {{ timestamp }}
          </p>
        </div>

        <button class="btn-primary w-full py-4 text-base" :disabled="inFlight || quantity <= 0" @click="submitEntry">
          Guardar y siguiente
        </button>
        <button class="btn-ghost w-full" @click="cancel">Cancelar</button>

        <p v-if="flash" class="text-sm text-ok">{{ flash }}</p>
      </section>

      <section v-else class="card p-8 text-center">
        <p class="text-sm text-muted">Esperando QR…</p>
      </section>
    </main>
  </div>
</template>
