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
import { createHttpServer } from "./interface/http/server.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = createLogger(cfg.logLevel, { service: "fundoflow-backend", kind: "http" });

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

  const app = createHttpServer({ syncService, log });

  log.info("http.starting", { port: cfg.port });

  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: cfg.port }, (info) => {
    log.info("http.listening", { port: info.port });
  });
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
