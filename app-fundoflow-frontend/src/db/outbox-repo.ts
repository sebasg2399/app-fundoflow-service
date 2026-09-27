import { withDb } from "./sqlite";
import type { SyncBatchPayload } from "../types";

export type OutboxEntry = {
  batch_id: string;
  tenant_id: string;
  payload: SyncBatchPayload;
  created_at: string;
  last_attempt_at: string | null;
  attempts: number;
  last_error: string | null;
};

export const outboxRepo = {
  enqueue(entry: { tenant_id: string; payload: SyncBatchPayload }): void {
    withDb((db) => {
      db.run(
        `INSERT OR REPLACE INTO outbox (batch_id, tenant_id, payload, created_at, last_attempt_at, attempts, last_error)
         VALUES (?, ?, ?, ?, NULL, 0, NULL)`,
        [
          entry.payload.batch_id,
          entry.tenant_id,
          JSON.stringify(entry.payload),
          entry.payload.generated_at,
        ],
      );
    });
  },

  list(tenant_id?: string): OutboxEntry[] {
    return withDb((db) => {
      const sql = tenant_id
        ? `SELECT batch_id, tenant_id, payload, created_at, last_attempt_at, attempts, last_error
           FROM outbox WHERE tenant_id = ? ORDER BY created_at ASC`
        : `SELECT batch_id, tenant_id, payload, created_at, last_attempt_at, attempts, last_error
           FROM outbox ORDER BY created_at ASC`;
      const r = db.exec(sql, tenant_id ? [tenant_id] : []);
      return (r[0]?.values ?? []).map((row) => ({
        batch_id: row[0] as string,
        tenant_id: row[1] as string,
        payload: JSON.parse(row[2] as string) as SyncBatchPayload,
        created_at: row[3] as string,
        last_attempt_at: (row[4] as string | null) ?? null,
        attempts: row[5] as number,
        last_error: (row[6] as string | null) ?? null,
      }));
    });
  },

  count(tenant_id?: string): number {
    return withDb((db) => {
      const sql = tenant_id ? `SELECT COUNT(*) FROM outbox WHERE tenant_id = ?` : `SELECT COUNT(*) FROM outbox`;
      const stmt = db.prepare(sql);
      stmt.bind(tenant_id ? [tenant_id] : []);
      stmt.step();
      const c = stmt.get()[0] as number;
      stmt.free();
      return c;
    });
  },

  recordAttempt(batch_id: string, error: string | null): void {
    withDb((db) => {
      db.run(
        `UPDATE outbox
         SET attempts = attempts + 1,
             last_attempt_at = ?,
             last_error = ?
         WHERE batch_id = ?`,
        [new Date().toISOString(), error, batch_id],
      );
    });
  },

  remove(batch_id: string): void {
    withDb((db) => {
      db.run(`DELETE FROM outbox WHERE batch_id = ?`, [batch_id]);
    });
  },

  appendLog(entry: {
    batch_id: string | null;
    direction: "push" | "pull";
    outcome: "ok" | "error";
    items_count?: number;
    message?: string;
  }): void {
    withDb((db) => {
      db.run(
        `INSERT INTO sync_log (batch_id, direction, outcome, items_count, message, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.batch_id,
          entry.direction,
          entry.outcome,
          entry.items_count ?? null,
          entry.message ?? null,
          new Date().toISOString(),
        ],
      );
    });
  },

  recentLog(limit = 10): Array<{
    id: number;
    batch_id: string | null;
    direction: "push" | "pull";
    outcome: "ok" | "error";
    items_count: number | null;
    message: string | null;
    occurred_at: string;
  }> {
    return withDb((db) => {
      const r = db.exec(
        `SELECT id, batch_id, direction, outcome, items_count, message, occurred_at
         FROM sync_log ORDER BY id DESC LIMIT ?`,
        [limit],
      );
      return (r[0]?.values ?? []).map((row) => ({
        id: row[0] as number,
        batch_id: (row[1] as string | null) ?? null,
        direction: row[2] as "push" | "pull",
        outcome: row[3] as "ok" | "error",
        items_count: (row[4] as number | null) ?? null,
        message: (row[5] as string | null) ?? null,
        occurred_at: row[6] as string,
      }));
    });
  },
};
