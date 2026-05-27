import { describe, expect, it } from "vitest";

import { ConsoleAlertEmitter, InMemoryAlertEmitter } from "./alert-emitter.js";

describe("InMemoryAlertEmitter", () => {
  it("appends alerts and supports byName / bySeverity filters", async () => {
    const e = new InMemoryAlertEmitter();
    await e.emit({ name: "x", severity: "warn", sourceId: "s", message: "m" });
    await e.emit({ name: "y", severity: "page", sourceId: "s", message: "m" });
    await e.emit({ name: "x", severity: "page", sourceId: "s", message: "m" });
    expect(e.alerts).toHaveLength(3);
    expect(e.byName("x")).toHaveLength(2);
    expect(e.bySeverity("page")).toHaveLength(2);
  });
});

describe("ConsoleAlertEmitter", () => {
  it("writes one structured JSON line per alert", async () => {
    const lines: string[] = [];
    const e = new ConsoleAlertEmitter((l) => lines.push(l));
    await e.emit({
      name: "regops.source.fetch_failed",
      severity: "warn",
      sourceId: "federal-register-snap",
      message: "503 Service Unavailable",
      metadata: { retryAfterMs: 60_000 },
    });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed).toEqual({
      $type: "regops.alert",
      name: "regops.source.fetch_failed",
      severity: "warn",
      source_id: "federal-register-snap",
      message: "503 Service Unavailable",
      metadata: { retryAfterMs: 60_000 },
    });
  });

  it("omits metadata when not provided", async () => {
    const lines: string[] = [];
    const e = new ConsoleAlertEmitter((l) => lines.push(l));
    await e.emit({
      name: "x",
      severity: "info",
      sourceId: "s",
      message: "m",
    });
    const parsed = JSON.parse(lines[0]!);
    expect("metadata" in parsed).toBe(false);
  });
});
