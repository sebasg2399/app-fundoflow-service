import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { HarvestLog } from "../../domain/types.js";
import { InfrastructureError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";

type SendableDoc = {
  send<T>(command: unknown): Promise<T>;
};

export type HarvestLogRepo = {
  getById: (tenant_id: string, id: string) => Promise<HarvestLog | null>;
  put: (log: HarvestLog) => Promise<void>;
};

export function createDynamoHarvestLogRepo(
  rawDoc: DynamoDBDocumentClient,
  tableName: string,
  log: Logger,
): HarvestLogRepo {
  const doc = rawDoc as unknown as SendableDoc;

  return {
    async getById(tenant_id, id) {
      try {
        const out = await doc.send<{ Item?: HarvestLog } | null>(
          new GetCommand({ TableName: tableName, Key: { id } }),
        );
        if (!out?.Item) return null;
        const h = out.Item;
        if (h.tenant_id !== tenant_id) return null;
        return h;
      } catch (err) {
        throw new InfrastructureError("dynamodb.get_failed", {
          table: tableName,
          cause: (err as Error).message,
        });
      }
    },

    async put(item) {
      try {
        await doc.send<unknown>(
          new PutCommand({
            TableName: tableName,
            Item: item,
            ConditionExpression: "attribute_not_exists(id) OR updated_at <= :incoming",
            ExpressionAttributeValues: { ":incoming": item.updated_at },
          }),
        );
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name === "ConditionalCheckFailedException") {
          log.warn("harvest_log.put_condition_failed", {
            id: item.id,
            incomingUpdatedAt: item.updated_at,
          });
          return;
        }
        throw new InfrastructureError("dynamodb.put_failed", {
          table: tableName,
          cause: e.message,
        });
      }
    },
  };
}
