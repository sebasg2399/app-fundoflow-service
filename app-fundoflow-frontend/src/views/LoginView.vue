<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";

const auth = useAuthStore();
const sync = useSyncStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const selectedFarm = ref<string | null>(null);
const submitting = ref(false);

onMounted(() => {
  auth.loadTenants();
  if (auth.activeTenantId) selectedFarm.value = auth.activeTenantId;
});

async function submit() {
  if (!email.value || !password.value || !selectedFarm.value) return;
  submitting.value = true;
  // Demo: aceptamos cualquier password no vacío
  auth.setSupervisorName(email.value.split("@")[0] || "Supervisor");
  auth.setActiveTenant(selectedFarm.value);
  await router.push({ name: "dashboard" });
}

async function continueOffline() {
  if (!auth.activeTenantId) {
    if (auth.tenants.length > 0) {
      auth.setActiveTenant(auth.tenants[0]!.id);
    } else {
      return;
    }
  }
  await router.push({ name: "dashboard" });
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
    <div class="w-full max-w-md">
      <div class="mb-6 flex items-center justify-center gap-2">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-forest-600 text-white">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c4-3 7-7 7-12a7 7 0 10-14 0c0 5 3 9 7 12z" />
            <path d="M12 12c-2-2-2-5 0-7 2 2 2 5 0 7z" />
          </svg>
        </div>
        <div>
          <div class="font-display text-xl font-bold text-forest-700">FundoFlow</div>
          <div class="text-xs text-muted">Trazabilidad agrícola offline-first</div>
        </div>
      </div>

      <div class="card p-7">
        <h1 class="font-display text-2xl font-bold">Iniciar sesión</h1>
        <p class="mt-1 text-sm text-muted">Supervisor — FundoFlow v0.1</p>

        <form class="mt-6 space-y-4" @submit.prevent="submit">
          <div>
            <label class="label">Email</label>
            <input v-model="email" class="input" type="email" placeholder="supervisor@fundoflow.cl" autocomplete="email" />
          </div>
          <div>
            <label class="label">Contraseña</label>
            <input v-model="password" class="input" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="submitting || !email || !password || !selectedFarm">
            Ingresar
          </button>
        </form>

        <div class="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
          <span class="h-px flex-1 bg-forest-100" />
          <span>o elige tu fundo</span>
          <span class="h-px flex-1 bg-forest-100" />
        </div>

        <div class="space-y-2">
          <button
            v-for="t in auth.tenants"
            :key="t.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left text-sm transition-colors"
            :class="selectedFarm === t.id ? 'border-forest bg-forest-50' : 'border-forest-100 hover:border-forest-200'"
            @click="selectedFarm = t.id"
          >
            <span class="flex items-center gap-3">
              <span class="flex h-8 w-8 items-center justify-center rounded-md bg-forest-100 text-forest-700">
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" /></svg>
              </span>
              <span>
                <span class="block font-semibold">{{ t.name }}</span>
                <span class="block text-xs text-muted">{{ t.region }}</span>
              </span>
            </span>
            <svg v-if="selectedFarm === t.id" viewBox="0 0 24 24" class="h-5 w-5 text-forest" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
          </button>
        </div>

        <button class="mt-5 flex w-full items-center justify-center gap-2 text-sm font-semibold text-forest hover:underline" @click="continueOffline">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" /></svg>
          Continuar sin conexión (usar último fundo activo)
        </button>
      </div>

      <div class="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <ConnectionStatus :online="sync.online" :pending="sync.outboxCount" />
        <span class="text-muted/60">·</span>
        <span>FundoFlow v0.1</span>
      </div>
    </div>
  </div>
</template>
