import { describe, expect, it } from "vitest";
import { resolveLWW } from "../src/domain/conflict-resolver.js";
import type { Worker } from "../src/domain/types.js";

const baseWorker = (overrides: Partial<Worker> = {}): Worker => ({
  id: "00000000-0000-0000-0000-000000000001",
  tenant_id: "tenant-a",
  qr_code: "QR-1",
  full_name: "Juan",
  updated_at: "2026-09-27T10:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("resolveLWW", () => {
  it("returns incoming when there is no existing record", () => {
    const incoming = baseWorker();
    const result = resolveLWW(incoming, null);
    expect(result.winner).toBe("incoming");
    expect(result.merged).toEqual(incoming);
  });

  it("returns incoming when incoming is strictly newer", () => {
    const existing = baseWorker({ updated_at: "2026-09-27T10:00:00.000Z", full_name: "Old" });
    const incoming = baseWorker({ updated_at: "2026-09-27T11:00:00.000Z", full_name: "New" });
    const result = resolveLWW(incoming, existing);
    expect(result.winner).toBe("incoming");
    expect(result.merged.full_name).toBe("New");
  });

  it("returns existing when incoming is strictly older", () => {
    const existing = baseWorker({ updated_at: "2026-09-27T11:00:00.000Z", full_name: "New" });
    const incoming = baseWorker({ updated_at: "2026-09-27T10:00:00.000Z", full_name: "Stale" });
    const result = resolveLWW(incoming, existing);
    expect(result.winner).toBe("existing");
    expect(result.merged.full_name).toBe("New");
  });

  it("is idempotent on equal timestamps (existing wins on tie)", () => {
    const ts = "2026-09-27T10:00:00.000Z";
    const existing = baseWorker({ updated_at: ts, full_name: "Server" });
    const incoming = baseWorker({ updated_at: ts, full_name: "Client" });
    const result = resolveLWW(incoming, existing);
    expect(result.winner).toBe("existing");
    expect(result.merged.full_name).toBe("Server");
  });

  it("preserves soft-deletes when the deleted record is newer", () => {
    const existing = baseWorker({
      updated_at: "2026-09-27T12:00:00.000Z",
      full_name: "Deleted User",
      deleted_at: "2026-09-27T12:00:00.000Z",
    });
    const incoming = baseWorker({
      updated_at: "2026-09-27T11:00:00.000Z",
      full_name: "Stale Insert",
      deleted_at: null,
    });
    const result = resolveLWW(incoming, existing);
    expect(result.winner).toBe("existing");
    expect(result.merged.deleted_at).toBe("2026-09-27T12:00:00.000Z");
  });
});
