export type Worker = {
  id: string;
  tenant_id: string;
  qr_code: string;
  full_name: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HarvestLog = {
  id: string;
  tenant_id: string;
  worker_id: string;
  crop_type: string;
  quantity: number;
  scanned_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SyncBatchStatus = "pending" | "processed" | "failed" | "dlq";

export type SyncBatch = {
  id: string;
  tenant_id: string;
  device_id: string;
  workers_count: number;
  harvest_logs_count: number;
  status: SyncBatchStatus;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
};

export type SyncBatchPayload = {
  batch_id: string;
  tenant_id: string;
  device_id: string;
  generated_at: string;
  workers: Worker[];
  harvest_logs: HarvestLog[];
};

export type SyncBatchMessage = {
  payload: SyncBatchPayload;
  enqueued_at: string;
};
