import { getDb, withDb } from "./sqlite";
import type { Worker } from "../types";

export type CreateWorkerInput = {
  tenant_id: string;
  qr_code: string;
  full_name: string;
};

export const workerRepo = {
  list(tenant_id: string): Worker[] {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, tenant_id, qr_code, full_name, updated_at, deleted_at
         FROM workers
         WHERE tenant_id = ? AND deleted_at IS NULL
         ORDER BY full_name`,
        [tenant_id],
      );
      return (r[0]?.values ?? []).map((row) => rowToWorker(row));
    });
  },

  findByQr(tenant_id: string, qr_code: string): Worker | null {
    return withDb((db) => {
      const stmt = db.prepare(
        `SELECT id, tenant_id, qr_code, full_name, updated_at, deleted_at
         FROM workers
         WHERE tenant_id = ? AND qr_code = ? AND deleted_at IS NULL
         LIMIT 1`,
      );
      stmt.bind([tenant_id, qr_code]);
      if (stmt.step()) {
        const row = stmt.get();
        stmt.free();
        return rowToWorker(row as unknown[]);
      }
      stmt.free();
      return null;
    });
  },

  getById(tenant_id: string, id: string): Worker | null {
    return withDb((db) => {
      const stmt = db.prepare(
        `SELECT id, tenant_id, qr_code, full_name, updated_at, deleted_at
         FROM workers WHERE tenant_id = ? AND id = ? LIMIT 1`,
      );
      stmt.bind([tenant_id, id]);
      if (stmt.step()) {
        const row = stmt.get();
        stmt.free();
        return rowToWorker(row as unknown[]);
      }
      stmt.free();
      return null;
    });
  },

  upsertLocal(worker: Worker): void {
    withDb((db) => {
      const existing = db
        .exec("SELECT updated_at FROM workers WHERE id = ?", [worker.id])[0]?.values[0]?.[0] as
        | string
        | undefined;
      if (!existing || worker.updated_at > existing) {
        db.run(
          `INSERT OR REPLACE INTO workers
             (id, tenant_id, qr_code, full_name, updated_at, deleted_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [
            worker.id,
            worker.tenant_id,
            worker.qr_code,
            worker.full_name,
            worker.updated_at,
            worker.deleted_at,
          ],
        );
      }
    });
  },

  createLocal(input: CreateWorkerInput & { id: string }): Worker {
    const now = new Date().toISOString();
    const worker: Worker = {
      id: input.id,
      tenant_id: input.tenant_id,
      qr_code: input.qr_code,
      full_name: input.full_name,
      updated_at: now,
      deleted_at: null,
    };
    withDb((db) => {
      db.run(
        `INSERT INTO workers (id, tenant_id, qr_code, full_name, updated_at, deleted_at, synced_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [worker.id, worker.tenant_id, worker.qr_code, worker.full_name, worker.updated_at],
      );
    });
    return worker;
  },

  softDelete(tenant_id: string, id: string): void {
    withDb((db) => {
      const now = new Date().toISOString();
      db.run(
        `UPDATE workers SET deleted_at = ?, updated_at = ?, synced_at = NULL
         WHERE tenant_id = ? AND id = ?`,
        [now, now, tenant_id, id],
      );
    });
  },

  unsynced(tenant_id: string): Worker[] {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, tenant_id, qr_code, full_name, updated_at, deleted_at
         FROM workers
         WHERE tenant_id = ? AND synced_at IS NULL AND deleted_at IS NULL`,
        [tenant_id],
      );
      return (r[0]?.values ?? []).map((row) => rowToWorker(row));
    });
  },

  markSynced(ids: string[]): void {
    if (ids.length === 0) return;
    withDb((db) => {
      const now = new Date().toISOString();
      const stmt = db.prepare(`UPDATE workers SET synced_at = ? WHERE id = ?`);
      stmt.bind([now, ""]);
      for (const id of ids) {
        stmt.reset();
        stmt.bind([now, id]);
        stmt.step();
      }
      stmt.free();
    });
  },

  countActive(tenant_id: string): number {
    return withDb((db) => {
      const stmt = db.prepare(
        `SELECT COUNT(*) FROM workers WHERE tenant_id = ? AND deleted_at IS NULL`,
      );
      stmt.bind([tenant_id]);
      stmt.step();
      const c = stmt.get()[0] as number;
      stmt.free();
      return c;
    });
  },
};

function rowToWorker(row: unknown[]): Worker {
  return {
    id: row[0] as string,
    tenant_id: row[1] as string,
    qr_code: row[2] as string,
    full_name: row[3] as string,
    updated_at: row[4] as string,
    deleted_at: (row[5] as string | null) ?? null,
  };
}

// Helper no usado en runtime, sólo para evitar warning de import-only-types
void getDb;
