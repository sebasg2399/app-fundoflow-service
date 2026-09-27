import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Worker } from "../../domain/types.js";
import { InfrastructureError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";

// En lib-dynamodb 3.350.0 el retorno de doc.send es una union compleja de
// outputs que TypeScript no narrow correctamente. Usamos un wrapper con tipo
// genérico para que el caller mantenga inferencia natural.
type SendableDoc = {
  send<T>(command: unknown): Promise<T>;
};

export type WorkerRepo = {
  getById: (tenant_id: string, id: string) => Promise<Worker | null>;
  put: (worker: Worker) => Promise<void>;
  listChangedSince: (tenant_id: string, sinceIso: string, limit?: number) => Promise<Worker[]>;
};

export function createDynamoWorkerRepo(
  rawDoc: DynamoDBDocumentClient,
  tableName: string,
  log: Logger,
): WorkerRepo {
  const doc = rawDoc as unknown as SendableDoc;

  return {
    async getById(tenant_id, id) {
      try {
        const out = await doc.send<{ Item?: Worker } | null>(
          new GetCommand({ TableName: tableName, Key: { id } }),
        );
        if (!out?.Item) return null;
        const w = out.Item;
        if (w.tenant_id !== tenant_id) {
          log.warn("worker.tenant_mismatch", { id, expected: tenant_id, got: w.tenant_id });
          return null;
        }
        return w;
      } catch (err) {
        throw new InfrastructureError("dynamodb.get_failed", {
          table: tableName,
          cause: (err as Error).message,
        });
      }
    },

    async put(worker) {
      try {
        await doc.send<unknown>(
          new PutCommand({
            TableName: tableName,
            Item: worker,
            ConditionExpression: "attribute_not_exists(id) OR updated_at <= :incoming",
            ExpressionAttributeValues: { ":incoming": worker.updated_at },
          }),
        );
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name === "ConditionalCheckFailedException") {
          log.warn("worker.put_condition_failed", {
            id: worker.id,
            incomingUpdatedAt: worker.updated_at,
          });
          return;
        }
        throw new InfrastructureError("dynamodb.put_failed", {
          table: tableName,
          cause: e.message,
        });
      }
    },

    async listChangedSince(tenant_id, sinceIso, limit = 200) {
      try {
        const command = new QueryCommand({
          TableName: tableName,
          IndexName: "tenant_id-updated_at-index",
          KeyConditionExpression: "tenant_id = :t AND updated_at > :since",
          ExpressionAttributeValues: { ":t": tenant_id, ":since": sinceIso },
          Limit: limit,
          ScanIndexForward: true,
        });
        const out = await doc.send<{ Items?: Worker[] }>(command);
        return out.Items ?? [];
      } catch (err) {
        throw new InfrastructureError("dynamodb.query_failed", {
          table: tableName,
          cause: (err as Error).message,
        });
      }
    },
  };
}
