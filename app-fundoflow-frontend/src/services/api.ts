import type { SyncBatchPayload, Worker } from "../types";

const DEFAULT_API_BASE = "http://localhost:3001";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ApiClientConfig = {
  baseUrl: string;
};

export function createApiClient(cfg: ApiClientConfig = { baseUrl: DEFAULT_API_BASE }) {
  const base = cfg.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
    if (!res.ok) {
      let body: { error?: { code?: string; message?: string } } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(
        body.error?.message ?? `HTTP ${res.status}`,
        res.status,
        body.error?.code ?? "HTTP_ERROR",
      );
    }
    return res.json() as Promise<T>;
  }

  return {
    health(): Promise<{ status: string; service: string }> {
      return request("/health");
    },
    syncBatch(payload: SyncBatchPayload): Promise<{ status: string; batch_id: string; messageId: string }> {
      return request("/api/v1/sync", { method: "POST", body: JSON.stringify(payload) });
    },
    pullWorkers(params: { tenantId: string; since: string }): Promise<{ workers: Worker[] }> {
      const q = new URLSearchParams(params).toString();
      return request(`/api/v1/workers/changes?${q}`);
    },
  };
}

export const api = createApiClient();
