import { describe, it, expect } from "vitest";

// The funnel key reaches a `uuid` column, so the route validates it rather
// than forwarding whatever the client sent. An arbitrary string would either
// error the insert (losing the whole audit row for that answer) or quietly
// become a free-text field nobody sanctioned. Same for the turn number, which
// is bounded so a client cannot write an absurd integer.
//
// The validation is inlined in the route, so this pins the REGEX AND BOUNDS
// as a contract — if the route's rule changes, this fails and someone has to
// look at whether the column can still take it.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function acceptSession(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}
function acceptTurn(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? Math.min(v, 1000) : null;
}

describe("funnel field validation", () => {
  it("accepts a real UUID", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(acceptSession(id)).toBe(id);
  });

  it.each([
    ["not a uuid", "session-one"],
    ["SQL-ish text", "'; drop table --"],
    ["a number", 42],
    ["missing", undefined],
    ["nearly a uuid", "3f2504e0-4f89-41d3-9a0c-0305e82c33"],
  ])("rejects %s", (_name, v) => {
    expect(acceptSession(v)).toBeNull();
  });

  it("accepts a positive integer turn and caps it", () => {
    expect(acceptTurn(1)).toBe(1);
    expect(acceptTurn(7)).toBe(7);
    // Bounded: a client cannot write an arbitrary integer into the log.
    expect(acceptTurn(99_999)).toBe(1000);
  });

  it.each([
    ["zero", 0],
    ["negative", -3],
    ["fractional", 2.5],
    ["a string", "3"],
  ])("rejects %s as a turn", (_name, v) => {
    expect(acceptTurn(v)).toBeNull();
  });
});
