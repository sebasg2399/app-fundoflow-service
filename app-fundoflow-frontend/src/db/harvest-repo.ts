import { withDb } from "./sqlite";
import type { HarvestLog } from "../types";

export const harvestRepo = {
  createLocal(input: Omit<HarvestLog, "updated_at" | "deleted_at">): HarvestLog {
    const now = new Date().toISOString();
    const log: HarvestLog = {
      ...input,
      updated_at: now,
      deleted_at: null,
    };
    withDb((db) => {
      db.run(
        `INSERT INTO harvest_logs
           (id, tenant_id, worker_id, crop_type, quantity, scanned_at, updated_at, deleted_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
        [log.id, log.tenant_id, log.worker_id, log.crop_type, log.quantity, log.scanned_at, log.updated_at],
      );
    });
    return log;
  },

  listSince(tenant_id: string, sinceIso: string): HarvestLog[] {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, tenant_id, worker_id, crop_type, quantity, scanned_at, updated_at, deleted_at
         FROM harvest_logs
         WHERE tenant_id = ? AND scanned_at > ?
         ORDER BY scanned_at DESC`,
        [tenant_id, sinceIso],
      );
      return (r[0]?.values ?? []).map((row) => rowToLog(row));
    });
  },

  countToday(tenant_id: string): { logs: number; kilos: number } {
    return withDb((db) => {
      const today = new Date().toISOString().slice(0, 10);
      const stmt = db.prepare(
        `SELECT COUNT(*) AS logs, COALESCE(SUM(quantity), 0) AS kilos
         FROM harvest_logs
         WHERE tenant_id = ? AND scanned_at LIKE ?`,
      );
      stmt.bind([tenant_id, `${today}%`]);
      stmt.step();
      const row = stmt.get() as unknown[];
      stmt.free();
      return { logs: row[0] as number, kilos: row[1] as number };
    });
  },

  recentByWorker(worker_id: string, limit = 5): HarvestLog[] {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, tenant_id, worker_id, crop_type, quantity, scanned_at, updated_at, deleted_at
         FROM harvest_logs
         WHERE worker_id = ?
         ORDER BY scanned_at DESC
         LIMIT ?`,
        [worker_id, limit],
      );
      return (r[0]?.values ?? []).map((row) => rowToLog(row));
    });
  },

  unsynced(tenant_id: string): HarvestLog[] {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, tenant_id, worker_id, crop_type, quantity, scanned_at, updated_at, deleted_at
         FROM harvest_logs
         WHERE tenant_id = ? AND synced_at IS NULL AND deleted_at IS NULL`,
        [tenant_id],
      );
      return (r[0]?.values ?? []).map((row) => rowToLog(row));
    });
  },

  markSynced(ids: string[]): void {
    if (ids.length === 0) return;
    withDb((db) => {
      const now = new Date().toISOString();
      const stmt = db.prepare(`UPDATE harvest_logs SET synced_at = ? WHERE id = ?`);
      for (const id of ids) {
        stmt.reset();
        stmt.bind([now, id]);
        stmt.step();
      }
      stmt.free();
    });
  },
};

function rowToLog(row: unknown[]): HarvestLog {
  return {
    id: row[0] as string,
    tenant_id: row[1] as string,
    worker_id: row[2] as string,
    crop_type: row[3] as string,
    quantity: row[4] as number,
    scanned_at: row[5] as string,
    updated_at: row[6] as string,
    deleted_at: (row[7] as string | null) ?? null,
  };
}
