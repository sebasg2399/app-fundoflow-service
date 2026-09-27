# FundoFlow

> Offline-first agricultural traceability SaaS for farm supervisors.
> Syncs harvest logs from the field to the cloud via an outbox pattern with
> Last-Write-Wins conflict resolution.

## Highlights

- **Offline-first**: every record lives in a local SQLite (sql.js in the
  browser). The app works without internet; sync happens when the
  connection comes back.
- **Client-generated UUIDs** for all entities. Devices never depend on
  the server to mint IDs — necessary to merge records created offline.
- **LWW conflict resolution**: when a worker syncs a record whose
  `updated_at` is older than what's already in the server, the server
  keeps its own copy. Re-syncs are idempotent.
- **Outbox pattern**: every mutation enqueues a batch in a local
  outbox. The sync worker drains the outbox when the network is up;
  failures are recorded per batch and retried on the next push.
- **Stripe Metered Billing** ready: harvest logs accumulate per
  (tenant, day, worker) and feed the metering event stream.

## Architecture

```
┌──────────────────────────┐    POST /api/v1/sync    ┌─────────────────────────┐
│  Browser (Vue 3 + sql.js)│ ─────────────────────▶ │  Hono HTTP server :3001 │
│                          │                         └────────────┬────────────┘
│  • local SQLite          │                                      │ SendMessage
│  • outbox (pending)      │                                      ▼
│  • Pinia stores          │                         ┌─────────────────────────┐
│  • Tailwind + Stitch DS  │                         │  SQS fundoflow-local    │
└──────────────────────────┘                         │  (queue + DLQ)          │
                                                     └────────────┬────────────┘
                                                                  │ ReceiveMessage (long-poll)
                                                                  ▼
                                                     ┌─────────────────────────┐
                                                     │  Worker (Node.ts)       │
                                                     │  • LWW resolve          │
                                                     │  • PutItem DynamoDB     │
                                                     └────────────┬────────────┘
                                                                  │
                                                                  ▼
                                                     ┌─────────────────────────┐
                                                     │  DynamoDB (4 tables)    │
                                                     │  tenants · workers ·    │
                                                     │  harvest_logs ·         │
                                                     │  sync_batches           │
                                                     └─────────────────────────┘
```

## Tech stack

| Layer        | Choice                                                          |
|--------------|-----------------------------------------------------------------|
| Monorepo     | pnpm workspaces                                                |
| Infrastructure | LocalStack 0.14.5 + Terraform 1.9.8                          |
| Backend      | Node 20 · TypeScript · Hono · AWS SDK v3 (pinned 3.350.0)       |
| Backend test | Vitest                                                          |
| Frontend     | Vue 3 · Vite · TypeScript · Pinia · Vue Router · Tailwind      |
| Local DB     | sql.js (SQLite compiled to WebAssembly, persisted to localStorage) |
| Design       | Stitch project `6367632785633000009` (FundoFlow Theme)         |

## Repository layout

```
app-fundoflow-service/
├── app-fundoflow-infra/        # LocalStack + Terraform
│   ├── docker-compose.yml      # LocalStack container (DynamoDB, SQS, Lambda, Events)
│   ├── Makefile                # up/down/plan/apply/bootstrap-sqs/smoke
│   ├── scripts/
│   │   ├── bootstrap-sqs.sh    # creates main queue + DLQ with redrive_policy
│   │   └── smoke.sh            # end-to-end smoke test against LocalStack
│   └── terraform/
│       ├── dynamodb.tf         # 4 tables with GSIs
│       ├── sqs.tf              # reference only — see bootstrap-sqs.sh
│       └── outputs.tf          # table/queue names for backend consumption
│
├── app-fundoflow-backend/      # Node + TS + Hono
│   ├── src/
│   │   ├── config.ts           # Zod-validated env loader
│   │   ├── shared/             # logger + AppError hierarchy
│   │   ├── domain/             # types + pure LWW resolver
│   │   ├── application/        # sync-service.ts (orchestrator)
│   │   ├── infrastructure/
│   │   │   ├── aws.ts          # DynamoDB + SQS clients (LocalStack-aware)
│   │   │   ├── dynamodb/       # worker, harvest-log, sync-batch repos
│   │   │   └── sqs/            # sync queue adapter
│   │   └── interface/
│   │       ├── http/server.ts  # Hono app
│   │       └── http-main.ts    # HTTP server entry
│   ├── src/worker-main.ts      # SQS worker entry (long-poll)
│   └── tests/                  # vitest unit tests
│
├── app-fundoflow-frontend/     # Vue 3 + Vite + sql.js
│   ├── src/
│   │   ├── db/                 # sql.js wrapper + repos (mirrors backend)
│   │   ├── services/           # api.ts + sync.ts (outbox drain)
│   │   ├── stores/             # Pinia (auth, sync)
│   │   ├── router/             # 6 routes + login guard
│   │   ├── components/         # AppSidebar, StatCard, ConnectionStatus
│   │   └── views/              # Login, Dashboard, Workers, WorkerEdit,
│   │                           # Harvest, Sync (one per Stitch screen)
│   └── tailwind.config.ts      # mirrors the Stitch design system tokens
│
├── package.json                # pnpm workspace root + cross-package scripts
├── pnpm-workspace.yaml
└── init.md                     # original brainstorm (kept for context)
```

## Quickstart

### Prerequisites

- Node 20+
- pnpm 10+
- Docker (for LocalStack)
- Terraform 1.5+
- AWS CLI (optional, for ad-hoc inspection)

### 1. Clone and install

```bash
git clone https://github.com/sebasg2399/app-fundoflow-service.git
cd app-fundoflow-service
pnpm install
```

### 2. Bring up LocalStack

```bash
cd app-fundoflow-infra
docker compose up -d
make init       # terraform init
make apply      # creates 4 DynamoDB tables
make bootstrap-sqs   # creates main queue + DLQ via awslocal (boto3)
make smoke      # end-to-end roundtrip on DynamoDB + SQS
```

### 3. Run the backend

In two terminals:

```bash
# Terminal 1 — HTTP server
cd app-fundoflow-backend
pnpm dev          # http://localhost:3001

# Terminal 2 — SQS worker (long-poll, ~20s cycles)
cd app-fundoflow-backend
pnpm dev:worker
```

### 4. Run the frontend

```bash
cd app-fundoflow-frontend
pnpm dev          # http://localhost:5173
```

Open the app, log in with any email/password, pick a fundo
(`Fundo La Viña` or `Fundo El Olivar` are pre-seeded). The seed data
includes 3 workers with QR codes `QR-0001`, `QR-0002`, `QR-0003` so
you can scan them in the Harvest screen.

### 5. Verify end-to-end

Register a worker, record a harvest, hit **Sincronizar ahora** in the
Sync screen. Then inspect DynamoDB:

```bash
docker exec fundoflow-localstack awslocal dynamodb scan \
  --table-name fundoflow-local-workers
docker exec fundoflow-localstack awslocal dynamodb scan \
  --table-name fundoflow-local-sync_batches
```

You should see the new worker plus a `processed` batch with your
`device_id`.

## API surface

| Method | Path                          | Purpose                                         |
|--------|-------------------------------|-------------------------------------------------|
| GET    | `/health`                     | Liveness                                        |
| POST   | `/api/v1/sync`                | Ingest a sync batch (workers + harvest_logs)    |
| GET    | `/api/v1/workers/changes`     | Pull workers modified since `since` (ISO 8601)  |

Payload schemas are validated by Zod and live next to the routes
(`src/interface/http/server.ts`).

## Design decisions

- **snake_case** for all DynamoDB attribute names so they match the
  GSI key schema (`tenant_id`, `updated_at`, `worker_id`, `scanned_at`).
  Mixing cases silently produces zero matches on GSI queries — this
  cost us an afternoon to debug.
- **Hexagonal** structure on the backend (`domain` / `application` /
  `infrastructure` / `interface`) so domain rules (LWW) stay pure and
  testable without any AWS dependency. The 5 vitest tests in
  `tests/conflict-resolver.test.ts` cover all the LWW branches in
  microseconds.
- **Worker instead of Lambda** for SQS consumption in dev. Same
  handler code; just runs as a long-lived Node process polling SQS
  every 20 s. Swap to Lambda + EventSourceMapping for production
  without touching `sync-service.ts`.
- **`@aws-sdk/*` pinned to 3.350.0**. Newer versions break against
  LocalStack 0.14.x (see
  [localstack/localstack#9599](https://github.com/localstack/localstack/issues/9599)).

## Known issues and gotchas

- **LocalStack 3.x community edition does NOT initialize DynamoDB /
  SQS / Lambda / Events** — only apigateway, iam, logs, sts show as
  available. We use `localstack/localstack:0.14.5` which is the last
  fully open-source build. See `app-fundoflow-infra/docker-compose.yml`.
- **`terraform apply` for SQS with `redrive_policy` hangs >5 min**
  against LocalStack 0.14.5 (the DynamoDB apply works fine). We
  provision SQS via `scripts/bootstrap-sqs.sh` using boto3 directly
  inside the container. The `sqs.tf` is kept as a reference for
  production migration.
- **AWS CLI from the host returns 500 errors** against LocalStack
  0.14.5 for SQS operations (DynamoDB works fine via Terraform).
  Workaround: use `awslocal` from inside the container. The Node SDK
  v3 works fine because it uses a different signing pipeline.
- **Tauri migration deferred**: the frontend was built with
  `sql.js` instead of `tauri-plugin-sql` so we could develop without
  installing Rust + `webkit2gtk` (which requires sudo). The Vue code
  does not need to change for the migration — only the bundler and
  the SQLite import in `src/db/sqlite.ts`.

## Roadmap

- [ ] Migrate frontend to Tauri once `libwebkit2gtk-4.1-dev` is
      installed (Rust + Tauri CLI). Swap `sql.js` for `tauri-plugin-sql`.
- [ ] Wire EventBridge cron → Stripe Billing Meters (the project's
      namesake use case).
- [ ] JWT-based tenant auth on the backend (currently the
      `tenant_id` is trusted from the payload — fine for local dev).
- [ ] Real QR scanner via `getUserMedia` (currently a styled
      placeholder with manual code entry fallback).
- [ ] DLQ inspector surface in the frontend.

## Design reference

The 6 UI screens were generated with [Stitch](https://stitch.google.com)
(project `6367632785633000009`, "FundoFlow Theme") and implemented in
Tailwind tokens that mirror the Stitch design system (forest green
`#0F4C3A`, Inter body, Plus Jakarta Sans headlines, 8 px radius).
