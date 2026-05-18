import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const COMMITTED = resolve(
  REPO_ROOT,
  "Civica/Features/SNAP/Generated/SNAPComplianceCopyRegistry+Generated.swift",
);
const SCRIPT = resolve(PACKAGE_ROOT, "scripts/generate-swift.ts");

const TMP = mkdtempSync(resolve(tmpdir(), "snap-compliance-copy-"));
afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("swift codegen", () => {
  it("is deterministic: regenerating matches the committed file byte-for-byte", () => {
    const out = resolve(TMP, "Generated.swift");
    execFileSync("npx", ["tsx", SCRIPT, out], {
      cwd: PACKAGE_ROOT,
      stdio: ["ignore", "ignore", "inherit"],
    });
    const fresh = readFileSync(out, "utf8");
    const committed = readFileSync(COMMITTED, "utf8");
    expect(fresh).toBe(committed);
  });

  it("is idempotent: running twice produces the same output", () => {
    const a = resolve(TMP, "A.swift");
    const b = resolve(TMP, "B.swift");
    execFileSync("npx", ["tsx", SCRIPT, a], { cwd: PACKAGE_ROOT, stdio: "ignore" });
    execFileSync("npx", ["tsx", SCRIPT, b], { cwd: PACKAGE_ROOT, stdio: "ignore" });
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
  });
});
