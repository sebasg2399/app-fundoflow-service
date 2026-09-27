import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { z } from "zod";
import type { SyncService } from "../../application/sync-service.js";
import type { AppError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";

const WorkerSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().min(1),
  qr_code: z.string().min(1),
  full_name: z.string().min(1),
  updated_at: z.string().datetime({ offset: true }),
  deleted_at: z.string().datetime({ offset: true }).nullable(),
});

const HarvestLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().min(1),
  worker_id: z.string().uuid(),
  crop_type: z.string().min(1),
  quantity: z.number().nonnegative(),
  scanned_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  deleted_at: z.string().datetime({ offset: true }).nullable(),
});

const SyncBatchPayloadSchema = z.object({
  batch_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  device_id: z.string().min(1),
  generated_at: z.string().datetime({ offset: true }),
  workers: z.array(WorkerSchema),
  harvest_logs: z.array(HarvestLogSchema),
});

export type CreateHttpServerDeps = {
  syncService: SyncService;
  log: Logger;
};

export function createHttpServer(deps: CreateHttpServerDeps) {
  const { syncService, log } = deps;
  const app = new Hono();

  app.use("*", logger((str) => log.debug(str)));
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.onError((err, c) => {
    const appErr = err as Partial<AppError> & Error;
    const code = appErr.code ?? "INTERNAL_ERROR";
    const statusCode = appErr.statusCode ?? 500;
    log.error("http.error", { code, message: err.message, path: c.req.path });
    return c.json(
      {
        error: {
          code,
          message: err.message,
          ...(appErr.details ? { details: appErr.details } : {}),
        },
      },
      statusCode as 400 | 404 | 500 | 502,
    );
  });

  app.get("/health", (c) => c.json({ status: "ok", service: "fundoflow-backend" }));

  app.post("/api/v1/sync", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "Body must be valid JSON" } }, 400);
    }

    const parsed = SyncBatchPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid sync batch payload",
            details: { issues: parsed.error.issues },
          },
        },
        400,
      );
    }

    const result = await syncService.ingest(parsed.data);
    return c.json({ status: "accepted", ...result }, 202);
  });

  app.get("/api/v1/workers/changes", async (c) => {
    const tenantId = c.req.query("tenantId");
    const since = c.req.query("since");
    if (!tenantId || !since) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "tenantId and since (ISO timestamp) are required",
          },
        },
        400,
      );
    }

    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "since must be ISO timestamp" } },
        400,
      );
    }

    const workers = await syncService.listChanges(tenantId, sinceDate.toISOString());
    return c.json({ tenantId, since: sinceDate.toISOString(), workers });
  });

  return app;
}
