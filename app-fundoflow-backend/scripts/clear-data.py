import boto3
import os

os.environ["AWS_ACCESS_KEY_ID"] = "test"
os.environ["AWS_SECRET_ACCESS_KEY"] = "test"

ddb = boto3.client("dynamodb", endpoint_url="http://localhost:4566", region_name="us-east-1")
tables = ["fundoflow-local-workers", "fundoflow-local-harvest_logs", "fundoflow-local-sync_batches"]

for t in tables:
    items = ddb.scan(TableName=t, ProjectionExpression="id").get("Items", [])
    for it in items:
        ddb.delete_item(TableName=t, Key={"id": it["id"]})
    out = ddb.scan(TableName=t, Select="COUNT")
    print(f"{t}: cleared, now {out['Count']} items")

sqs = boto3.client("sqs", endpoint_url="http://localhost:4566", region_name="us-east-1")
sqs.purge_queue(QueueUrl="http://localhost:4566/000000000000/fundoflow-local-sync")
print("SQS purged")
