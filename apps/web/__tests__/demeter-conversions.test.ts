// The conversion half of the funnel (#1049 follow-on).
//
// demeter_events already records every refusal. This is the other end: did
// anyone take the outline away? Saved it, downloaded it, emailed it?
//
// RECORDED SERVER-SIDE, ON ACTUAL SUCCESS. A click that 500s is not a
// conversion, and a client-side beacon would record the intent rather than
// the outcome. It also means no new public write endpoint, which is a surface
// this product does not need.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const api = (...p: string[]) => readFileSync(join(__dirname, "..", "app", "api", ...p), "utf8");
const SAVE = api("demeter", "conversations", "route.ts");
const EMAIL = api("demeter", "email-outline", "route.ts");
const PDF = api("demeter", "outline-pdf", "route.tsx");
const SAVE_UI = readFileSync(join(__dirname, "..", "components", "DemeterSave.tsx"), "utf8");

describe("the three server-side conversions", () => {
  it("records each one where the work actually succeeded", () => {
    expect(SAVE).toContain('event: "saved"');
    expect(EMAIL).toContain('event: "outline_emailed"');
    expect(PDF).toContain('event: "pdf_downloaded"');
  });

  it("records them through after(), so nobody waits on bookkeeping", () => {
    for (const [name, src] of [["save", SAVE], ["email", EMAIL], ["pdf", PDF]] as const) {
      expect(src, `${name} records synchronously`).toMatch(/after\(\(\) =>\s*\n?\s*recordDemeterEvent/);
    }
  });

  it("counts a save ONCE, not once per turn", () => {
    // THE TRAP THIS AVOIDS. Auto-save re-posts after every answered turn once
    // a conversation is saved. Recording the UPDATE path as well would count
    // one decision dozens of times and make the funnel meaningless. The
    // conversion is deciding to keep it, which happens exactly once — so the
    // record sits with the 201 insert and nowhere else.
    const inserts = [...SAVE.matchAll(/status: 201/g)].length;
    expect(inserts, "the insert's success return").toBeGreaterThan(0);
    expect([...SAVE.matchAll(/event: "saved"/g)].length, "saved recorded more than once").toBe(1);
    // And it is anchored to the insert, not the update: the update return
    // ({ conversation: data } with no status) must not precede a record.
    const at = SAVE.indexOf('event: "saved"');
    const updateReturn = SAVE.indexOf("return NextResponse.json({ conversation: data });");
    expect(updateReturn, "the update path still exists").toBeGreaterThan(-1);
    expect(at, "saved is recorded on the update path").toBeGreaterThan(updateReturn);
  });
});

describe("the funnel can actually be joined", () => {
  it("carries the session id from the chat to the save", () => {
    // A conversion count with nothing to tie it to is a much weaker fact than
    // one that joins back to the turns that produced it.
    expect(SAVE_UI, "DemeterSave does not accept a session id").toContain("sessionId");
    expect(SAVE_UI).toMatch(/id: id \?\? undefined, sessionId/);
    // post() closes over it, so it must invalidate with it or a save could
    // carry a stale id and join to the wrong conversation.
    expect(SAVE_UI).toMatch(/\[sessionId\],/);
  });

  it("reads the session id on the server", () => {
    for (const [name, src] of [["save", SAVE], ["email", EMAIL], ["pdf", PDF]] as const) {
      expect(src, `${name} drops the session id`).toMatch(
        /sessionId: typeof body\.sessionId === "string"/,
      );
    }
  });
});
