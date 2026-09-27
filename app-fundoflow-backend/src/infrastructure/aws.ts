import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import type { AppConfig } from "../config.js";

export type AwsClients = {
  rawDynamo: DynamoDBClient;
  docDynamo: DynamoDBDocumentClient;
  sqs: SQSClient;
};

export function createAwsClients(cfg: AppConfig): AwsClients {
  const credentials =
    cfg.awsAccessKeyId && cfg.awsSecretAccessKey
      ? { accessKeyId: cfg.awsAccessKeyId, secretAccessKey: cfg.awsSecretAccessKey }
      : undefined;

  const baseClientConfig = {
    region: cfg.awsRegion,
    endpoint: cfg.awsEndpointUrl,
    credentials,
  };

  const rawDynamo = new DynamoDBClient(baseClientConfig);
  const docDynamo = DynamoDBDocumentClient.from(rawDynamo, {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
  });
  const sqs = new SQSClient(baseClientConfig);

  return { rawDynamo, docDynamo, sqs };
}
