#!/usr/bin/env bash
# Smoke test: confirma que las tablas DynamoDB y las colas SQS existen y son
# operables. Usa awslocal desde el container para evitar problemas de
# signature del AWS CLI del host contra LocalStack 0.14.x.

set -euo pipefail

CONTAINER="${CONTAINER:-fundoflow-localstack}"
PREFIX="${NAME_PREFIX:-fundoflow-local}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
title() { printf "\n\033[1;34m== %s ==\033[0m\n" "$*"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  red "Container $CONTAINER is not running. Run: make up"
  exit 1
fi

awslocal() {
  docker exec -i "$CONTAINER" \
    env AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
         AWS_DEFAULT_REGION="$REGION" \
    awslocal "$@" 2>/dev/null | grep -v '^INFO:'
}

title "LocalStack health"
HEALTH=$(docker exec -i "$CONTAINER" \
  env AWS_DEFAULT_REGION="$REGION" \
  curl -fsS http://localhost:4566/_localstack/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -qE '"dynamodb": "(available|running)"'; then
  green "DynamoDB available"
else
  red "DynamoDB NOT available"
  echo "$HEALTH" | head -1
  exit 1
fi
if echo "$HEALTH" | grep -qE '"sqs": "(available|running)"'; then
  green "SQS available"
else
  red "SQS NOT available"
  exit 1
fi

title "DynamoDB tables"
TABLES=(
  "${PREFIX}-tenants"
  "${PREFIX}-workers"
  "${PREFIX}-harvest_logs"
  "${PREFIX}-sync_batches"
)
for table in "${TABLES[@]}"; do
  if awslocal dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
    green "OK  $table"
  else
    red "MISSING $table"
    exit 1
  fi
done

title "SQS queues"
for q in "${PREFIX}-sync" "${PREFIX}-sync-dlq"; do
  url=$(awslocal sqs get-queue-url --queue-name "$q" \
        --query 'QueueUrl' --output text 2>/dev/null || true)
  if [[ -n "$url" && "$url" != "None" ]]; then
    green "OK  $q -> $url"
  else
    red "MISSING $q"
    exit 1
  fi
done

title "Smoke write/read on ${PREFIX}-tenants"
TEST_ID="smoke-$(date +%s)"
awslocal dynamodb put-item \
  --table-name "${PREFIX}-tenants" \
  --item "{\"id\":{\"S\":\"$TEST_ID\"},\"name\":{\"S\":\"smoke\"}}" >/dev/null
got=$(awslocal dynamodb get-item \
  --table-name "${PREFIX}-tenants" \
  --key "{\"id\":{\"S\":\"$TEST_ID\"}}" \
  --query 'Item.id.S' --output text)
if [[ "$got" == "$TEST_ID" ]]; then
  green "OK  round-trip DynamoDB"
  awslocal dynamodb delete-item \
    --table-name "${PREFIX}-tenants" \
    --key "{\"id\":{\"S\":\"$TEST_ID\"}}" >/dev/null
else
  red "FAIL round-trip (got: $got)"
  exit 1
fi

title "Smoke SQS send/receive on ${PREFIX}-sync"
MSG_BODY="smoke-$(date +%s)"
awslocal sqs send-message \
  --queue-url "http://localhost:4566/000000000000/${PREFIX}-sync" \
  --message-body "$MSG_BODY" >/dev/null

RECEIVED=$(awslocal sqs receive-message \
  --queue-url "http://localhost:4566/000000000000/${PREFIX}-sync" \
  --max-number-of-messages 5 --wait-time-seconds 2 \
  --query "Messages[?Body==\`$MSG_BODY\`].Body | [0]" \
  --output text 2>/dev/null || echo "")

if [[ "$RECEIVED" == "$MSG_BODY" ]]; then
  green "OK  round-trip SQS"
else
  red "FAIL round-trip SQS (expected: $MSG_BODY, got: $RECEIVED)"
  exit 1
fi

green "All smoke checks passed."
