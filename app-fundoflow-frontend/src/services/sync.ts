import { v4 as uuidv4 } from "uuid";
import type { SyncBatchPayload } from "../types";
import { api } from "./api";
import { workerRepo } from "../db/worker-repo";
import { harvestRepo } from "../db/harvest-repo";
import { outboxRepo } from "../db/outbox-repo";

const DEVICE_ID_KEY = "fundoflow.device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${uuidv4().slice(0, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export type SyncPushResult = {
  attempted: number;
  succeeded: number;
  failed: number;
};

export const syncService = {
  /**
   * Toma todos los workers/harvest_logs unsynced del tenant, los empaqueta
   * en un batch y los encola en el outbox local. NO toca la red.
   */
  enqueueBatch(tenant_id: string): { batchId: string; workers: number; logs: number } {
    const workers = workerRepo.unsynced(tenant_id);
    const logs = harvestRepo.unsynced(tenant_id);

    const batchId = uuidv4();
    const now = new Date().toISOString();
    const payload: SyncBatchPayload = {
      batch_id: batchId,
      tenant_id,
      device_id: getDeviceId(),
      generated_at: now,
      workers,
      harvest_logs: logs,
    };
    outboxRepo.enqueue({ tenant_id, payload });

    // Marca como "intención de sincronizar" — el flag synced_at sigue NULL
    // hasta que el backend confirme; si falla, vuelven a unsynced.
    return { batchId, workers: workers.length, logs: logs.length };
  },

  /**
   * Intenta empujar todos los batches pendientes. Si la red falla, los
   * deja en el outbox para el próximo intento.
   */
  async pushAll(tenant_id: string): Promise<SyncPushResult> {
    const pending = outboxRepo.list(tenant_id);
    let succeeded = 0;
    let failed = 0;

    for (const entry of pending) {
      try {
        await api.syncBatch(entry.payload);
        // Marcar items como synced
        workerRepo.markSynced(entry.payload.workers.map((w) => w.id));
        harvestRepo.markSynced(entry.payload.harvest_logs.map((l) => l.id));
        outboxRepo.remove(entry.batch_id);
        outboxRepo.appendLog({
          batch_id: entry.batch_id,
          direction: "push",
          outcome: "ok",
          items_count: entry.payload.workers.length + entry.payload.harvest_logs.length,
        });
        succeeded += 1;
      } catch (err) {
        const message = (err as Error).message;
        outboxRepo.recordAttempt(entry.batch_id, message);
        outboxRepo.appendLog({
          batch_id: entry.batch_id,
          direction: "push",
          outcome: "error",
          message,
        });
        failed += 1;
      }
    }

    return { attempted: pending.length, succeeded, failed };
  },

  /**
   * Pull: trae del backend los workers modificados desde `since` y los
   * guarda localmente. No afecta harvest_logs en este MVP.
   */
  async pull(tenant_id: string, since: string): Promise<{ received: number }> {
    try {
      const { workers } = await api.pullWorkers({ tenantId: tenant_id, since });
      for (const w of workers) workerRepo.upsertLocal(w);
      outboxRepo.appendLog({
        batch_id: null,
        direction: "pull",
        outcome: "ok",
        items_count: workers.length,
      });
      return { received: workers.length };
    } catch (err) {
      outboxRepo.appendLog({
        batch_id: null,
        direction: "pull",
        outcome: "error",
        message: (err as Error).message,
      });
      throw err;
    }
  },
};

export { getDeviceId };
