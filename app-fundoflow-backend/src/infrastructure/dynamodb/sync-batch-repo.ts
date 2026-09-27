import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SyncBatch, SyncBatchStatus } from "../../domain/types.js";
import { InfrastructureError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";

type SendableDoc = {
  send<T>(command: unknown): Promise<T>;
};

export type SyncBatchRepo = {
  createPending: (
    batch: Omit<SyncBatch, "status" | "processed_at" | "error_message">,
  ) => Promise<void>;
  markProcessed: (id: string) => Promise<void>;
  markFailed: (id: string, message: string) => Promise<void>;
};

export function createDynamoSyncBatchRepo(
  rawDoc: DynamoDBDocumentClient,
  tableName: string,
  log: Logger,
): SyncBatchRepo {
  const doc = rawDoc as unknown as SendableDoc;

  return {
    async createPending(batch) {
      const item: SyncBatch = {
        ...batch,
        status: "pending" satisfies SyncBatchStatus,
        processed_at: null,
        error_message: null,
      };
      try {
        await doc.send<unknown>(
          new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: "attribute_not_exists(id)",
          }),
        );
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name === "ConditionalCheckFailedException") {
          log.warn("sync_batch.duplicate_ignored", { id: batch.id });
          return;
        }
        throw new InfrastructureError("dynamodb.put_failed", {
          table: tableName,
          cause: e.message,
        });
      }
    },

    async markProcessed(id) {
      try {
        await doc.send<unknown>(
          new UpdateCommand({
            TableName: tableName,
            Key: { id },
            UpdateExpression: "SET #s = :processed, processed_at = :now",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":processed": "processed",
              ":now": new Date().toISOString(),
            },
          }),
        );
      } catch (err) {
        throw new InfrastructureError("dynamodb.update_failed", {
          table: tableName,
          cause: (err as Error).message,
        });
      }
    },

    async markFailed(id, message) {
      try {
        await doc.send<unknown>(
          new UpdateCommand({
            TableName: tableName,
            Key: { id },
            UpdateExpression: "SET #s = :failed, error_message = :msg, processed_at = :now",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":failed": "failed",
              ":msg": message,
              ":now": new Date().toISOString(),
            },
          }),
        );
      } catch (err) {
        throw new InfrastructureError("dynamodb.update_failed", {
          table: tableName,
          cause: (err as Error).message,
        });
      }
    },
  };
}
