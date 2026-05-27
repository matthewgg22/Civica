import { describe, expect, it } from "vitest";

import { loadPrompt, promptFilename } from "./loader.js";

describe("promptFilename", () => {
  it("formats name + version", () => {
    expect(promptFilename("extract-eligibility-change", 1)).toBe(
      "extract-eligibility-change.v1.md",
    );
  });

  it("rejects invalid names", () => {
    expect(() => promptFilename("Bad Name", 1)).toThrow(/Invalid prompt name/);
    expect(() => promptFilename("../etc/passwd", 1)).toThrow(/Invalid prompt name/);
  });

  it("rejects non-positive versions", () => {
    expect(() => promptFilename("ok", 0)).toThrow(/Invalid prompt version/);
    expect(() => promptFilename("ok", -1)).toThrow(/Invalid prompt version/);
    expect(() => promptFilename("ok", 1.5)).toThrow(/Invalid prompt version/);
  });
});

describe("loadPrompt", () => {
  it("loads the registered extract-eligibility-change v1 template", () => {
    const p = loadPrompt("extract-eligibility-change", 1);
    expect(p.name).toBe("extract-eligibility-change");
    expect(p.version).toBe(1);
    expect(p.template).toContain("<<<SOURCE_TEXT>>>");
    expect(p.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws a descriptive error for a missing prompt", () => {
    expect(() => loadPrompt("does-not-exist", 1)).toThrow(/Failed to load prompt/);
  });
});
