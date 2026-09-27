import { withDb } from "./sqlite";
import type { Tenant } from "../types";

export const tenantRepo = {
  list(): Tenant[] {
    return withDb((db) => {
      const r = db.exec(`SELECT id, name, region FROM tenants ORDER BY name`);
      return (r[0]?.values ?? []).map((row) => ({
        id: row[0] as string,
        name: row[1] as string,
        region: (row[2] as string | null) ?? null,
      }));
    });
  },

  get(id: string): Tenant | null {
    return withDb((db) => {
      const stmt = db.prepare(`SELECT id, name, region FROM tenants WHERE id = ? LIMIT 1`);
      stmt.bind([id]);
      if (stmt.step()) {
        const row = stmt.get() as unknown[];
        stmt.free();
        return { id: row[0] as string, name: row[1] as string, region: (row[2] as string | null) ?? null };
      }
      stmt.free();
      return null;
    });
  },
};
