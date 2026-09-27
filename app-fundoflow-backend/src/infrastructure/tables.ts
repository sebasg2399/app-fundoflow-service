import type { AppConfig } from "../config.js";

export type TableNames = {
  tenants: string;
  workers: string;
  harvestLogs: string;
  syncBatches: string;
};

export function getTableNames(cfg: AppConfig): TableNames {
  return {
    tenants: cfg.dynamodbTableTenants,
    workers: cfg.dynamodbTableWorkers,
    harvestLogs: cfg.dynamodbTableHarvestLogs,
    syncBatches: cfg.dynamodbTableSyncBatches,
  };
}
