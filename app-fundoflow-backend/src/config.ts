import { z } from "zod";

const ConfigSchema = z.object({
  nodeEnv: z.enum(["local", "development", "test", "production"]).default("local"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  port: z.coerce.number().int().positive().default(3001),

  awsRegion: z.string().min(1).default("us-east-1"),
  awsEndpointUrl: z.string().url().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),

  dynamodbTableTenants: z.string().min(1),
  dynamodbTableWorkers: z.string().min(1),
  dynamodbTableHarvestLogs: z.string().min(1),
  dynamodbTableSyncBatches: z.string().min(1),

  sqsQueueUrl: z.string().url(),
  sqsDlqUrl: z.string().url(),

  workerPollWaitSeconds: z.coerce.number().int().nonnegative().default(20),
  workerMaxMessages: z.coerce.number().int().positive().default(10),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;

  const parsed = ConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    port: env.PORT,

    awsRegion: env.AWS_REGION,
    awsEndpointUrl: env.AWS_ENDPOINT_URL,
    awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,

    dynamodbTableTenants: env.DYNAMODB_TABLE_TENANTS,
    dynamodbTableWorkers: env.DYNAMODB_TABLE_WORKERS,
    dynamodbTableHarvestLogs: env.DYNAMODB_TABLE_HARVEST_LOGS,
    dynamodbTableSyncBatches: env.DYNAMODB_TABLE_SYNC_BATCHES,

    sqsQueueUrl: env.SQS_QUEUE_URL,
    sqsDlqUrl: env.SQS_DLQ_URL,

    workerPollWaitSeconds: env.WORKER_POLL_WAIT_SECONDS,
    workerMaxMessages: env.WORKER_MAX_MESSAGES,
  });

  cached = parsed;
  return parsed;
}
