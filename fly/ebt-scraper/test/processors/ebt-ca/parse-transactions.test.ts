import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseTransactionsFromHtml,
  parsePostedAt,
  parseTxAmountCents,
  stripTags,
  deriveExternalId,
} from "../../../src/processors/ebt-ca/parse-transactions.js";
import { ScrapeErrorException } from "../../../src/errors.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../src/processors/ebt-ca/fixtures");
const fx = (name: string): string => readFileSync(join(fixtureDir, name), "utf8");

describe("parsePostedAt", () => {
  it("parses date+time", () => {
    const iso = parsePostedAt("5/22/2026 3:42 PM");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-05-22")).toBe(true);
  });

  it("parses date-only", () => {
    const iso = parsePostedAt("5/22/2026");
    expect(iso).not.toBeNull();
  });

  it("returns null on unparseable input", () => {
    expect(parsePostedAt("not a date")).toBeNull();
  });
});

describe("parseTxAmountCents", () => {
  it("parses negative (debit) with leading minus", () => {
    expect(parseTxAmountCents("-$42.18")).toBe(-4218);
  });

  it("parses positive (deposit) with leading plus", () => {
    expect(parseTxAmountCents("+$232.00")).toBe(23200);
  });

  it("defaults unsigned amounts to negative (most rows are debits)", () => {
    expect(parseTxAmountCents("$10.00")).toBe(-1000);
  });

  it("handles thousands separators", () => {
    expect(parseTxAmountCents("-$1,234.56")).toBe(-123456);
  });

  it("returns null on no parseable amount", () => {
    expect(parseTxAmountCents("no money here")).toBeNull();
  });
});

describe("stripTags", () => {
  it("removes HTML tags + collapses whitespace", () => {
    expect(stripTags("<b>SAFEWAY</b>&nbsp;&nbsp;<i>OAKLAND</i>")).toBe("SAFEWAY OAKLAND");
  });

  it("decodes &amp;", () => {
    expect(stripTags("AT&amp;T")).toBe("AT&T");
  });
});

describe("deriveExternalId", () => {
  it("produces a stable id from postedAt+amount+merchant", () => {
    const id1 = deriveExternalId("2026-05-22T22:42:00.000Z", -4218, "SAFEWAY #1872");
    const id2 = deriveExternalId("2026-05-22T22:42:00.000Z", -4218, "safeway #1872");
    expect(id1).toBe(id2); // case-insensitive merchant
  });
});

describe("parseTransactionsFromHtml", () => {
  it("extracts 4 transactions from the balance-page fixture", () => {
    const page = parseTransactionsFromHtml(fx("balance-page.html"), null);
    expect(page.items.length).toBe(4);

    const purchase = page.items.find((t) => t.rawDescription.includes("SAFEWAY"));
    expect(purchase).toBeDefined();
    expect(purchase!.amountCents).toBe(-4218);
    expect(purchase!.postedAt.startsWith("2026-05-21")).toBe(true);

    const deposit = page.items.find((t) => t.rawDescription.includes("SNAP DEPOSIT"));
    expect(deposit).toBeDefined();
    expect(deposit!.amountCents).toBe(23200);
  });

  it("returns null nextCursor when fewer than pageSize rows present", () => {
    const page = parseTransactionsFromHtml(fx("balance-page.html"), null);
    expect(page.nextCursor).toBeNull();
  });

  it("computes a non-null nextCursor when page is full", () => {
    const fullPage = `<table><tbody>${Array.from({ length: 20 })
      .map(
        (_, i) =>
          `<tr><td>5/${i + 1}/2026</td><td>STORE #${i}</td><td>-$1.00</td></tr>`,
      )
      .join("")}</tbody></table>`;
    const page = parseTransactionsFromHtml(fullPage, null, 20);
    expect(page.items.length).toBe(20);
    expect(page.nextCursor).toBe("20");
  });

  it("offsets the next cursor by the existing offset + rows seen", () => {
    const fullPage = `<table><tbody>${Array.from({ length: 20 })
      .map(
        (_, i) =>
          `<tr><td>5/${i + 1}/2026</td><td>STORE #${i}</td><td>-$1.00</td></tr>`,
      )
      .join("")}</tbody></table>`;
    const page = parseTransactionsFromHtml(fullPage, "20", 20);
    expect(page.nextCursor).toBe("40");
  });

  it("skips rows that don't have a parseable date or amount", () => {
    const noisyPage = `<table><tbody>
      <tr><td>header row</td><td>desc</td><td>amount</td></tr>
      <tr><td>5/22/2026</td><td>SAFEWAY</td><td>-$10.00</td></tr>
      <tr><td>5/23/2026</td><td>only two cells</td></tr>
    </tbody></table>`;
    const page = parseTransactionsFromHtml(noisyPage, null);
    expect(page.items.length).toBe(1);
    expect(page.items[0]!.rawDescription).toBe("SAFEWAY");
  });

  it("throws ScrapeErrorException(captcha) when captcha page given", () => {
    expect(() => parseTransactionsFromHtml(fx("captcha.html"), null)).toThrow(ScrapeErrorException);
  });

  it("throws ScrapeErrorException(sessionExpired) on login-redirect page", () => {
    try {
      parseTransactionsFromHtml(fx("login-expired.html"), null);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScrapeErrorException);
      expect((e as ScrapeErrorException).code).toBe("sessionExpired");
    }
  });
});
