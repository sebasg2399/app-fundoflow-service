import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { SyncBatchMessage } from "../../domain/types.js";
import { InfrastructureError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";

export type SyncQueue = {
  enqueue: (msg: SyncBatchMessage) => Promise<string>;
  receive: (maxMessages: number, waitSeconds: number) => Promise<ReceivedSyncMessage[]>;
  delete: (receiptHandle: string) => Promise<void>;
};

export type ReceivedSyncMessage = {
  body: SyncBatchMessage;
  receiptHandle: string;
  messageId: string;
};

export function createSqsSyncQueue(
  client: SQSClient,
  queueUrl: string,
  log: Logger,
): SyncQueue {
  return {
    async enqueue(msg) {
      try {
        const out = await client.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(msg),
            MessageAttributes: {
              batchId: { DataType: "String", StringValue: msg.payload.batch_id },
              tenantId: { DataType: "String", StringValue: msg.payload.tenant_id },
            },
          }),
        );
        return out.MessageId ?? "";
      } catch (err) {
        throw new InfrastructureError("sqs.send_failed", {
          queueUrl,
          cause: (err as Error).message,
        });
      }
    },

    async receive(maxMessages, waitSeconds) {
      try {
        const out = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: waitSeconds,
            MessageAttributeNames: ["All"],
            VisibilityTimeout: 120,
          }),
        );
        const messages: ReceivedSyncMessage[] = [];
        for (const m of out.Messages ?? []) {
          if (!m.Body || !m.ReceiptHandle) continue;
          try {
            const body = JSON.parse(m.Body) as SyncBatchMessage;
            messages.push({
              body,
              receiptHandle: m.ReceiptHandle,
              messageId: m.MessageId ?? "",
            });
          } catch (parseErr) {
            log.error("sqs.message_invalid_json", {
              messageId: m.MessageId,
              cause: (parseErr as Error).message,
            });
          }
        }
        return messages;
      } catch (err) {
        throw new InfrastructureError("sqs.receive_failed", {
          queueUrl,
          cause: (err as Error).message,
        });
      }
    },

    async delete(receiptHandle) {
      try {
        await client.send(
          new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }),
        );
      } catch (err) {
        throw new InfrastructureError("sqs.delete_failed", {
          queueUrl,
          cause: (err as Error).message,
        });
      }
    },
  };
}
