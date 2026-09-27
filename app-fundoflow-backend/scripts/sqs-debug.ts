import "dotenv/config";
import { SQSClient, ReceiveMessageCommand, SendMessageCommand } from "@aws-sdk/client-sqs";

async function main() {
  const endpoint = process.env.AWS_ENDPOINT_URL!;
  const queueUrl = process.env.SQS_QUEUE_URL!;
  const region = process.env.AWS_REGION!;

  console.log("endpoint:", endpoint);
  console.log("region:", region);
  console.log("queueUrl:", queueUrl);

  const sqs = new SQSClient({
    region,
    endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    console.log("--- Sending test message ---");
    const sent = await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ hello: "world", ts: Date.now() }),
    }));
    console.log("sent MessageId:", sent.MessageId);

    console.log("--- Receiving ---");
    const recv = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
    }));
    console.log("messages:", recv.Messages);
  } catch (err) {
    console.error("ERR:", err);
    if (err && typeof err === "object") {
      console.error("name:", (err as { name?: string }).name);
      console.error("$metadata:", JSON.stringify((err as { $metadata?: unknown }).$metadata));
    }
  }
}

main();
