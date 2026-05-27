import { describe, expect, it } from "vitest";

import { checksumPromptTemplate, normalizeTemplate } from "./checksum.js";

describe("checksumPromptTemplate", () => {
  it("is deterministic", () => {
    const a = checksumPromptTemplate("hello world\n");
    const b = checksumPromptTemplate("hello world\n");
    expect(a).toBe(b);
  });

  it("changes when content changes", () => {
    const a = checksumPromptTemplate("hello\n");
    const b = checksumPromptTemplate("hello!\n");
    expect(a).not.toBe(b);
  });

  it("normalizes CRLF to LF before hashing", () => {
    const lf = checksumPromptTemplate("line1\nline2\n");
    const crlf = checksumPromptTemplate("line1\r\nline2\r\n");
    expect(lf).toBe(crlf);
  });

  it("returns a 64-char hex SHA-256", () => {
    const h = checksumPromptTemplate("anything");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeTemplate", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeTemplate("a\r\nb\r\n")).toBe("a\nb\n");
  });

  it("leaves LF alone", () => {
    expect(normalizeTemplate("a\nb\n")).toBe("a\nb\n");
  });
});
