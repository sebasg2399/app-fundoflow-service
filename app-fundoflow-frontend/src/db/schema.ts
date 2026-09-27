// Schema SQLite local (sql.js). Idéntico al backend pero vive en el browser.
// PKs siempre UUIDs generados en cliente (offline-first).

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS tenants (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     region TEXT,
     updated_at TEXT NOT NULL
   );`,

  `CREATE TABLE IF NOT EXISTS workers (
     id TEXT PRIMARY KEY,
     tenant_id TEXT NOT NULL,
     qr_code TEXT NOT NULL,
     full_name TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted_at TEXT,
     synced_at TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_workers_tenant ON workers(tenant_id);`,
  `CREATE INDEX IF NOT EXISTS idx_workers_qr ON workers(qr_code);`,

  `CREATE TABLE IF NOT EXISTS harvest_logs (
     id TEXT PRIMARY KEY,
     tenant_id TEXT NOT NULL,
     worker_id TEXT NOT NULL,
     crop_type TEXT NOT NULL,
     quantity REAL NOT NULL,
     scanned_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted_at TEXT,
     synced_at TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_harvest_tenant_scanned ON harvest_logs(tenant_id, scanned_at);`,
  `CREATE INDEX IF NOT EXISTS idx_harvest_worker ON harvest_logs(worker_id);`,

  `CREATE TABLE IF NOT EXISTS outbox (
     batch_id TEXT PRIMARY KEY,
     tenant_id TEXT NOT NULL,
     payload TEXT NOT NULL,
     created_at TEXT NOT NULL,
     last_attempt_at TEXT,
     attempts INTEGER DEFAULT 0,
     last_error TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON outbox(tenant_id);`,

  `CREATE TABLE IF NOT EXISTS sync_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     batch_id TEXT,
     direction TEXT NOT NULL,
     outcome TEXT NOT NULL,
     items_count INTEGER,
     message TEXT,
     occurred_at TEXT NOT NULL
   );`,
];

export const SEED_TENANTS = [
  { id: "tenant-a", name: "Fundo La Viña", region: "Catemu" },
  { id: "tenant-b", name: "Fundo El Olivar", region: "Casablanca" },
];

export const SEED_WORKERS = [
  {
    id: "seed-w-1",
    tenant_id: "tenant-a",
    qr_code: "QR-0001",
    full_name: "Juan Ramírez",
  },
  {
    id: "seed-w-2",
    tenant_id: "tenant-a",
    qr_code: "QR-0002",
    full_name: "María López",
  },
  {
    id: "seed-w-3",
    tenant_id: "tenant-a",
    qr_code: "QR-0003",
    full_name: "Pedro Soto",
  },
];
