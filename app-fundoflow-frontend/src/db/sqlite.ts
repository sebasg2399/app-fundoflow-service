import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA_STATEMENTS, SEED_TENANTS, SEED_WORKERS } from "./schema";

const DB_STATE_KEY = "fundoflow.db.v1";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

async function loadSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file) => (file === "sql-wasm.wasm" ? sqlWasmUrl : file),
  });
  return SQL;
}

function persist(db: Database): void {
  const data = db.export();
  const buffer = new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  localStorage.setItem(DB_STATE_KEY, btoa(binary));
}

function restore(sql: SqlJsStatic): Database {
  const stored = localStorage.getItem(DB_STATE_KEY);
  if (!stored) return new sql.Database();
  try {
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new sql.Database(bytes);
  } catch {
    return new sql.Database();
  }
}

function seedIfEmpty(database: Database): void {
  const r = database.exec("SELECT COUNT(*) AS c FROM tenants");
  const count = r[0]?.values[0]?.[0] as number;
  if (count > 0) return;

  const now = new Date().toISOString();
  database.run("BEGIN");
  for (const t of SEED_TENANTS) {
    database.run(
      "INSERT INTO tenants (id, name, region, updated_at) VALUES (?, ?, ?, ?)",
      [t.id, t.name, t.region, now],
    );
  }
  for (const w of SEED_WORKERS) {
    database.run(
      `INSERT INTO workers (id, tenant_id, qr_code, full_name, updated_at, deleted_at, synced_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      [w.id, w.tenant_id, w.qr_code, w.full_name, now],
    );
  }
  database.run("COMMIT");
}

export async function openDb(): Promise<Database> {
  if (db) return db;
  const sql = await loadSql();
  db = restore(sql);

  for (const stmt of SCHEMA_STATEMENTS) {
    db.run(stmt);
  }
  seedIfEmpty(db);
  persist(db);
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error("DB not initialized — call openDb() first");
  return db;
}

export function withDb<T>(fn: (d: Database) => T): T {
  const result = fn(getDb());
  persist(getDb());
  return result;
}

export function resetDb(): void {
  localStorage.removeItem(DB_STATE_KEY);
  if (db) db.close();
  db = null;
}
