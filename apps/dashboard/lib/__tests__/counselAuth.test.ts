import { describe, expect, it, vi } from "vitest";

import {
  CounselDomainDeniedError,
  COUNSEL_DOMAINS,
  assertCounselForDomain,
  getActiveCounselDomains,
  isActiveCounselUser,
  isCounselDomain,
  type CounselAssignment,
  type CounselDomain,
} from "../counselAuth";

/**
 * Tiny mock-builder that mimics the chained Supabase query the helper
 * actually uses: schema().from().select().eq().is(). Reflects only the
 * shape the helper depends on, not the full SupabaseClient surface.
 */
function makeMockClient(rows: CounselAssignment[] | { error: string }) {
  const result =
    "error" in rows && Array.isArray(rows) === false
      ? Promise.resolve({ data: null, error: { message: rows.error } })
      : Promise.resolve({ data: rows as CounselAssignment[], error: null });

  return {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => result),
          })),
        })),
      })),
    })),
  };
}

const USER_ID = "11111111-2222-3333-4444-555555555555";
const baseRow = (domain: CounselDomain): CounselAssignment => ({
  assignment_id: `aid-${domain}`,
  user_id: USER_ID,
  domain,
  assigned_at: "2026-05-27T12:00:00Z",
  revoked_at: null,
});

describe("isCounselDomain", () => {
  it("accepts the four known domains", () => {
    for (const d of COUNSEL_DOMAINS) {
      expect(isCounselDomain(d)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isCounselDomain("ftc")).toBe(false); // case-sensitive
    expect(isCounselDomain("ca")).toBe(false);
    expect(isCounselDomain("federal " /* trailing space */)).toBe(false);
    expect(isCounselDomain("NY")).toBe(false);
    expect(isCounselDomain("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isCounselDomain(null)).toBe(false);
    expect(isCounselDomain(undefined)).toBe(false);
    expect(isCounselDomain(123)).toBe(false);
    expect(isCounselDomain({ domain: "CA" })).toBe(false);
  });
});

describe("getActiveCounselDomains", () => {
  it("returns the set of distinct active domains for the user", async () => {
    const client = makeMockClient([baseRow("CA"), baseRow("federal")]);
    const domains = await getActiveCounselDomains(client as never, USER_ID);
    expect(new Set(domains)).toEqual(new Set(["CA", "federal"]));
  });

  it("returns empty array when no assignments exist", async () => {
    const client = makeMockClient([]);
    const domains = await getActiveCounselDomains(client as never, USER_ID);
    expect(domains).toEqual([]);
  });

  it("dedupes duplicate domains defensively", async () => {
    const client = makeMockClient([baseRow("CA"), baseRow("CA")]);
    const domains = await getActiveCounselDomains(client as never, USER_ID);
    expect(domains).toEqual(["CA"]);
  });

  it("filters out unknown domain values (future schema drift safety)", async () => {
    // Domain enum on the DB should prevent this, but the type guard
    // is the second line of defense if a column gets reshaped.
    const tainted = [
      baseRow("CA"),
      { ...baseRow("federal"), domain: "Atlantis" as unknown as CounselDomain },
    ];
    const client = makeMockClient(tainted);
    const domains = await getActiveCounselDomains(client as never, USER_ID);
    expect(domains).toEqual(["CA"]);
  });

  it("throws when the Supabase call returns an error", async () => {
    const client = makeMockClient({ error: "RLS policy violation" });
    await expect(getActiveCounselDomains(client as never, USER_ID)).rejects.toThrow(
      /RLS policy violation/,
    );
  });
});

describe("isActiveCounselUser", () => {
  it("is true when at least one active assignment exists", async () => {
    const client = makeMockClient([baseRow("MA")]);
    expect(await isActiveCounselUser(client as never, USER_ID)).toBe(true);
  });

  it("is false when no active assignment exists", async () => {
    const client = makeMockClient([]);
    expect(await isActiveCounselUser(client as never, USER_ID)).toBe(false);
  });
});

describe("assertCounselForDomain", () => {
  it("resolves silently when the user is active for the requested domain", async () => {
    const client = makeMockClient([baseRow("federal"), baseRow("FTC")]);
    await expect(
      assertCounselForDomain(client as never, USER_ID, "federal"),
    ).resolves.toBeUndefined();
  });

  it("throws CounselDomainDeniedError naming the granted domains when access mismatches", async () => {
    const client = makeMockClient([baseRow("CA")]);
    try {
      await assertCounselForDomain(client as never, USER_ID, "MA");
      expect.fail("expected assertCounselForDomain to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CounselDomainDeniedError);
      if (!(err instanceof CounselDomainDeniedError)) return;
      expect(err.requestedDomain).toBe("MA");
      expect([...err.grantedDomains]).toEqual(["CA"]);
      expect(err.message).toContain("CA");
      expect(err.message).toContain("MA");
    }
  });

  it("throws when the user has no assignments at all", async () => {
    const client = makeMockClient([]);
    await expect(
      assertCounselForDomain(client as never, USER_ID, "federal"),
    ).rejects.toThrow(/active assignments only for \[none\]/);
  });
});
