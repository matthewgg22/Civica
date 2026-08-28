// #1051 shipped the observability columns and the sink mapping; nothing
// populated them, so every row carried nulls — caught by the launch audit's
// live probe (lang, worksheet_mode, ttft_ms, total_ms all null on a real
// answered row). These pin the population end of the pipe.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORCH = readFileSync(join(__dirname, "..", "orchestrator.ts"), "utf8");

describe("the audit record is actually populated (#1051 follow-through)", () => {
  it("sets lang, worksheetMode and both clocks on the record", () => {
    const at = ORCH.indexOf("const record: MaeAuditRecord = {");
    expect(at, "the record construction").toBeGreaterThan(-1);
    const block = ORCH.slice(at, ORCH.indexOf("};", at));
    for (const field of ["lang,", "worksheetMode:", "ttftMs:", "totalMs:"]) {
      expect(block, `${field} missing from the record — the column stays null`).toContain(field);
    }
  });

  it("stamps first-token time at every delta yield site", () => {
    // A single stamped site would report the pipeline's OTHER paths (retry,
    // non-streaming) as never having produced a first token.
    const yields = [...ORCH.matchAll(/yield \{ type: "delta"/g)].length;
    const guards = [...ORCH.matchAll(/if \(firstTokenAt === null\) firstTokenAt = Date\.now\(\);/g)].length;
    expect(yields).toBeGreaterThan(0);
    expect(guards, "a delta path exists that never stamps ttft").toBe(yields);
  });

  it("is honest that `stopped` is not populated, and why", () => {
    // A reader pressing Stop aborts the request, which tears the generator
    // down before the audit runs — the row does not exist at all. Claiming
    // the field works would repeat #1051's exact mistake.
    expect(ORCH).toMatch(/NOT populated, deliberately/);
    expect(ORCH).toMatch(/tears this generator down before the audit runs/);
  });
});
