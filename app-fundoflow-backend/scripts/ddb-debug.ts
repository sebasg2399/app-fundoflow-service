import "dotenv/config";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

async function main() {
  const cfg = {
    region: process.env.AWS_REGION!,
    endpoint: process.env.AWS_ENDPOINT_URL!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  };
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient(cfg));

  const tableName = "fundoflow-local-workers";
  const id = "aaaa1111-0000-0000-0000-000000000001";

  const existing = await doc.send(new GetCommand({ TableName: tableName, Key: { id } }));
  console.log("EXISTING:", JSON.stringify(existing.Item, null, 2));

  const incoming = {
    id,
    tenantId: "tenant-a",
    qrCode: "QR-001-MODIFIED",
    fullName: "Juan Pérez (renombrado)",
    updatedAt: "2026-09-27T13:00:00.000Z",
    deletedAt: null,
  };

  try {
    await doc.send(new PutCommand({
      TableName: tableName,
      Item: incoming,
      ConditionExpression: "attribute_not_exists(id) OR #ua <= :incoming",
      ExpressionAttributeNames: { "#ua": "updatedAt" },
      ExpressionAttributeValues: { ":incoming": incoming.updatedAt },
    }));
    console.log("PUT succeeded");
  } catch (err) {
    console.log("PUT failed:", (err as Error).name, (err as Error).message);
  }

  const after = await doc.send(new GetCommand({ TableName: tableName, Key: { id } }));
  console.log("AFTER:", JSON.stringify(after.Item, null, 2));
}

main().catch(console.error);
