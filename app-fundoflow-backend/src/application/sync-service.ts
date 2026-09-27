import { resolveLWW } from "../domain/conflict-resolver.js";
import type {
  HarvestLog,
  SyncBatchMessage,
  SyncBatchPayload,
  Worker,
} from "../domain/types.js";
import type { SyncBatchRepo } from "../infrastructure/dynamodb/sync-batch-repo.js";
import type { HarvestLogRepo } from "../infrastructure/dynamodb/harvest-log-repo.js";
import type { WorkerRepo } from "../infrastructure/dynamodb/worker-repo.js";
import type { SyncQueue } from "../infrastructure/sqs/sync-queue.js";
import type { Logger } from "../shared/logger.js";

export type SyncServiceDeps = {
  workerRepo: WorkerRepo;
  harvestLogRepo: HarvestLogRepo;
  syncBatchRepo: SyncBatchRepo;
  syncQueue: SyncQueue;
  log: Logger;
};

export type IngestResult = {
  batch_id: string;
  enqueued_at: string;
  messageId: string;
};

export type ProcessResult = {
  batch_id: string;
  workersUpserted: number;
  workersSkipped: number;
  harvestLogsUpserted: number;
  harvestLogsSkipped: number;
};

export function createSyncService(deps: SyncServiceDeps) {
  const { workerRepo, harvestLogRepo, syncBatchRepo, syncQueue, log } = deps;

  return {
    async ingest(payload: SyncBatchPayload): Promise<IngestResult> {
      const received_at = new Date().toISOString();

      await syncBatchRepo.createPending({
        id: payload.batch_id,
        tenant_id: payload.tenant_id,
        device_id: payload.device_id,
        workers_count: payload.workers.length,
        harvest_logs_count: payload.harvest_logs.length,
        received_at,
      });

      const message: SyncBatchMessage = { payload, enqueued_at: received_at };
      const messageId = await syncQueue.enqueue(message);

      log.info("sync.batch_enqueued", {
        batch_id: payload.batch_id,
        tenant_id: payload.tenant_id,
        workers: payload.workers.length,
        harvest_logs: payload.harvest_logs.length,
        messageId,
      });

      return { batch_id: payload.batch_id, enqueued_at: received_at, messageId };
    },

    async process(msg: SyncBatchMessage): Promise<ProcessResult> {
      const { payload } = msg;
      let workersUpserted = 0;
      let workersSkipped = 0;
      let harvestLogsUpserted = 0;
      let harvestLogsSkipped = 0;

      log.info("sync.batch_processing", {
        batch_id: payload.batch_id,
        tenant_id: payload.tenant_id,
        workers: payload.workers.length,
        harvest_logs: payload.harvest_logs.length,
      });

      for (const incoming of payload.workers) {
        const existing = await workerRepo.getById(incoming.tenant_id, incoming.id);
        const resolution = resolveLWW<Worker>(incoming, existing);
        if (resolution.winner === "incoming") {
          await workerRepo.put(incoming);
          workersUpserted += 1;
        } else {
          workersSkipped += 1;
        }
      }

      for (const incoming of payload.harvest_logs) {
        const existing = await harvestLogRepo.getById(incoming.tenant_id, incoming.id);
        const resolution = resolveLWW<HarvestLog>(incoming, existing);
        if (resolution.winner === "incoming") {
          await harvestLogRepo.put(incoming);
          harvestLogsUpserted += 1;
        } else {
          harvestLogsSkipped += 1;
        }
      }

      await syncBatchRepo.markProcessed(payload.batch_id);

      log.info("sync.batch_processed", {
        batch_id: payload.batch_id,
        workersUpserted,
        workersSkipped,
        harvestLogsUpserted,
        harvestLogsSkipped,
      });

      return {
        batch_id: payload.batch_id,
        workersUpserted,
        workersSkipped,
        harvestLogsUpserted,
        harvestLogsSkipped,
      };
    },

    async listChanges(tenant_id: string, sinceIso: string): Promise<Worker[]> {
      return workerRepo.listChangedSince(tenant_id, sinceIso);
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
