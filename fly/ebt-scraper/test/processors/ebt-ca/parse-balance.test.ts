import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseBalanceFromHtml,
  parseDollarAmountCents,
  findBalanceNearLabel,
  parseLastUpdated,
} from "../../../src/processors/ebt-ca/parse-balance.js";
import { ScrapeErrorException } from "../../../src/errors.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../src/processors/ebt-ca/fixtures");
const fx = (name: string): string => readFileSync(join(fixtureDir, name), "utf8");

describe("parseDollarAmountCents", () => {
  it("parses simple amounts", () => {
    expect(parseDollarAmountCents("$12.34")).toBe(1234);
    expect(parseDollarAmountCents("$0.00")).toBe(0);
  });

  it("handles thousands separators", () => {
    expect(parseDollarAmountCents("$1,234.56")).toBe(123456);
    expect(parseDollarAmountCents("$1,000,000.00")).toBe(100000000);
  });

  it("handles whitespace between $ and digits", () => {
    expect(parseDollarAmountCents("$ 50.25")).toBe(5025);
  });

  it("returns null when no amount found", () => {
    expect(parseDollarAmountCents("no money here")).toBeNull();
    expect(parseDollarAmountCents("$12")).toBeNull(); // missing cents
  });
});

describe("findBalanceNearLabel", () => {
  it("finds an amount within the window after a label", () => {
    const html = `<div>Food Benefits</div><div>$232.45</div>`;
    expect(findBalanceNearLabel(html, [/food\s+benefits/i])).toBe(23245);
  });

  it("returns null if no label matches", () => {
    const html = `<div>Cash</div><div>$10.00</div>`;
    expect(findBalanceNearLabel(html, [/food\s+benefits/i])).toBeNull();
  });

  it("returns null if label matches but amount is too far away", () => {
    const html = `<div>Food Benefits</div>${"x".repeat(600)}<div>$10.00</div>`;
    expect(findBalanceNearLabel(html, [/food\s+benefits/i])).toBeNull();
  });
});

describe("parseLastUpdated", () => {
  it("parses date+time", () => {
    const iso = parseLastUpdated("Last updated: 5/22/2026 9:42 AM");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-05-22")).toBe(true);
  });

  it("parses date-only", () => {
    const iso = parseLastUpdated("Last updated: 5/22/2026");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-05-22")).toBe(true);
  });

  it("returns null on unparseable input", () => {
    expect(parseLastUpdated("no date here")).toBeNull();
  });
});

describe("parseBalanceFromHtml", () => {
  it("extracts food + cash + lastUpdated from the balance-page fixture", () => {
    const balance = parseBalanceFromHtml(fx("balance-page.html"));
    expect(balance.foodBalanceCents).toBe(18750);
    expect(balance.cashBalanceCents).toBe(5025);
    expect(balance.lastUpdatedAt).not.toBeNull();
    expect(balance.lastUpdatedAt!.startsWith("2026-05-22")).toBe(true);
  });

  it("defaults cashBalanceCents to 0 when only food balance present", () => {
    const html = `<html><body>
      <h1>Available Balance</h1>
      <p>Food Benefits $42.00</p>
      <p>Last updated: 1/1/2026</p>
    </body></html>`;
    const balance = parseBalanceFromHtml(html);
    expect(balance.foodBalanceCents).toBe(4200);
    expect(balance.cashBalanceCents).toBe(0);
  });

  it("throws ScrapeErrorException(captcha) when captcha page is given", () => {
    expect(() => parseBalanceFromHtml(fx("captcha.html"))).toThrow(ScrapeErrorException);
  });

  it("throws ScrapeErrorException(sessionExpired) on login-redirect page", () => {
    try {
      parseBalanceFromHtml(fx("login-expired.html"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScrapeErrorException);
      expect((e as ScrapeErrorException).code).toBe("sessionExpired");
    }
  });

  it("throws parseError when balance markers missing and no error signal", () => {
    const html = `<html><body><p>Random page with $99.99 but no markers.</p></body></html>`;
    try {
      parseBalanceFromHtml(html);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScrapeErrorException);
      expect((e as ScrapeErrorException).code).toBe("parseError");
    }
  });

  it("throws parseError when food balance is missing", () => {
    // Has expected balance markers but no dollar amount within window of food label.
    // We pad the food label out with >500 chars of filler before any amount, so the
    // window heuristic in findBalanceNearLabel can't reach it.
    const padding = "x".repeat(600);
    const html = `<html><body>
      <h1>available balance</h1>
      <p>food benefits</p>${padding}
      <p>cash benefits $0.00</p>
    </body></html>`;
    try {
      parseBalanceFromHtml(html);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScrapeErrorException);
      expect((e as ScrapeErrorException).code).toBe("parseError");
    }
  });
});
