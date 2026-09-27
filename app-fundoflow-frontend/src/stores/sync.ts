import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useOnline } from "@vueuse/core";
import { syncService } from "../services/sync";
import { outboxRepo } from "../db/outbox-repo";
import { useAuthStore } from "./auth";

export const useSyncStore = defineStore("sync", () => {
  const online = useOnline();
  const isPushing = ref(false);
  const isPulling = ref(false);
  const lastPushAt = ref<string | null>(localStorage.getItem("fundoflow.last_push_at"));
  const lastPullAt = ref<string | null>(localStorage.getItem("fundoflow.last_pull_at"));
  const lastError = ref<string | null>(null);
  const tick = ref(0); // bump to force re-evaluation of computeds

  const auth = useAuthStore();

  const outboxCount = computed(() => {
    tick.value;
    if (!auth.activeTenantId) return 0;
    return outboxRepo.count(auth.activeTenantId);
  });

  async function pushNow() {
    if (!auth.activeTenantId) return;
    isPushing.value = true;
    lastError.value = null;
    try {
      await syncService.pushAll(auth.activeTenantId);
      lastPushAt.value = new Date().toISOString();
      localStorage.setItem("fundoflow.last_push_at", lastPushAt.value);
      tick.value += 1;
    } catch (err) {
      lastError.value = (err as Error).message;
    } finally {
      isPushing.value = false;
    }
  }

  async function pullNow(since?: string) {
    if (!auth.activeTenantId) return;
    isPulling.value = true;
    lastError.value = null;
    try {
      const sinceIso = since ?? lastPullAt.value ?? new Date(0).toISOString();
      await syncService.pull(auth.activeTenantId, sinceIso);
      lastPullAt.value = new Date().toISOString();
      localStorage.setItem("fundoflow.last_pull_at", lastPullAt.value);
    } catch (err) {
      lastError.value = (err as Error).message;
    } finally {
      isPulling.value = false;
    }
  }

  function enqueueLocal() {
    if (!auth.activeTenantId) return null;
    return syncService.enqueueBatch(auth.activeTenantId);
  }

  return {
    online,
    isPushing,
    isPulling,
    lastPushAt,
    lastPullAt,
    lastError,
    outboxCount,
    pushNow,
    pullNow,
    enqueueLocal,
  };
});
