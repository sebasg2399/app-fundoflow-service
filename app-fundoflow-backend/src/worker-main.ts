import "dotenv/config";
import { loadConfig } from "./config.js";
import { createLogger } from "./shared/logger.js";
import { createAwsClients } from "./infrastructure/aws.js";
import { getTableNames } from "./infrastructure/tables.js";
import { createDynamoWorkerRepo } from "./infrastructure/dynamodb/worker-repo.js";
import { createDynamoHarvestLogRepo } from "./infrastructure/dynamodb/harvest-log-repo.js";
import { createDynamoSyncBatchRepo } from "./infrastructure/dynamodb/sync-batch-repo.js";
import { createSqsSyncQueue } from "./infrastructure/sqs/sync-queue.js";
import { createSyncService } from "./application/sync-service.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = createLogger(cfg.logLevel, { service: "fundoflow-backend", kind: "worker" });

  const aws = createAwsClients(cfg);
  const tables = getTableNames(cfg);

  const workerRepo = createDynamoWorkerRepo(aws.docDynamo, tables.workers, log);
  const harvestLogRepo = createDynamoHarvestLogRepo(aws.docDynamo, tables.harvestLogs, log);
  const syncBatchRepo = createDynamoSyncBatchRepo(aws.docDynamo, tables.syncBatches, log);
  const syncQueue = createSqsSyncQueue(aws.sqs, cfg.sqsQueueUrl, log);

  const syncService = createSyncService({
    workerRepo,
    harvestLogRepo,
    syncBatchRepo,
    syncQueue,
    log,
  });

  let running = true;
  let idleCycles = 0;

  const shutdown = (signal: string) => {
    log.info("worker.shutdown_signal", { signal });
    running = false;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  log.info("worker.starting", {
    queue: cfg.sqsQueueUrl,
    maxMessages: cfg.workerMaxMessages,
    pollWait: cfg.workerPollWaitSeconds,
  });

  while (running) {
    let processed = 0;
    try {
      const messages = await syncQueue.receive(cfg.workerMaxMessages, cfg.workerPollWaitSeconds);
      if (messages.length === 0) {
        idleCycles += 1;
        if (idleCycles % 10 === 0) {
          log.debug("worker.idle", { cycles: idleCycles });
        }
        continue;
      }
      idleCycles = 0;

      for (const m of messages) {
        const batch_id = m.body?.payload?.batch_id;
        if (!batch_id) {
          log.error("worker.invalid_message", { messageId: m.messageId });
          await syncQueue.delete(m.receiptHandle).catch(() => {});
          continue;
        }

        try {
          const result = await syncService.process(m.body);
          processed += 1;
          log.debug("worker.processed", {
            batch_id: result.batch_id,
            workersUpserted: result.workersUpserted,
            harvestLogsUpserted: result.harvestLogsUpserted,
          });
          await syncQueue.delete(m.receiptHandle);
        } catch (err) {
          log.error("worker.process_failed", {
            batch_id,
            cause: (err as Error).message,
          });
          await syncBatchRepo.markFailed(batch_id, (err as Error).message).catch(() => {});
        }
      }
    } catch (err) {
      log.error("worker.loop_error", { cause: (err as Error).message });
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (processed > 0) {
      log.info("worker.cycle_done", { processed });
    }
  }

  log.info("worker.stopped");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
