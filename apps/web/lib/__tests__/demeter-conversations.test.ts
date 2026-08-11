import { describe, it, expect } from "vitest";
import {
  deriveTitle,
  normalizeLang,
  normalizeMessages,
  normalizeStateCode,
  normalizeTitle,
  MAX_MESSAGES,
  MAX_BYTES,
  type SavedMsg,
} from "../demeter-conversations";

// The shape rules for a saved conversation. The RLS half — who can read what —
// is a property of the database and lives in demeter-conversations.pg.test.ts;
// this file is the half that IS the code.

const turn = (role: SavedMsg["role"], content: string): SavedMsg => ({ role, content });

function unwrap(result: ReturnType<typeof normalizeMessages>): SavedMsg[] {
  if ("error" in result) throw new Error(`expected messages, got: ${result.error}`);
  return result.messages;
}

describe("normalizeMessages", () => {
  it("keeps a normal conversation exactly as it was", async () => {
    const input = [turn("user", "Do I have to do a phone interview?"), turn("assistant", "No —")];
    expect(unwrap(normalizeMessages(input))).toEqual(input);
  });

  it("drops the empty assistant bubble a mid-stream save would capture", () => {
    // The chat appends an empty assistant message as a streaming placeholder
    // and fills it chunk by chunk. Saving one resumes into a blank answer that
    // never completes.
    const kept = unwrap(
      normalizeMessages([turn("user", "hi"), turn("assistant", "answer"), turn("assistant", "")]),
    );
    expect(kept).toEqual([turn("user", "hi"), turn("assistant", "answer")]);
  });

  it("keeps the state-change dividers, which are part of reading the thread", () => {
    // A divider marks where answers stopped applying to the previous state.
    // Dropping it on save would leave two contradictory answers sitting next to
    // each other on resume with nothing explaining why.
    const input = [
      turn("user", "limit?"),
      turn("assistant", "In CA…"),
      turn("divider", "Now answering for Washington — earlier answers may not apply."),
      turn("user", "and now?"),
      turn("assistant", "In WA…"),
    ];
    expect(unwrap(normalizeMessages(input))).toEqual(input);
  });

  it("keeps the most recent turns when a conversation runs past the cap", () => {
    const long = Array.from({ length: MAX_MESSAGES + 30 }, (_, i) => turn("user", `q${i}`));
    const kept = unwrap(normalizeMessages(long));
    expect(kept).toHaveLength(MAX_MESSAGES);
    // Newest kept, oldest dropped: resume is about continuing.
    expect(kept[kept.length - 1]).toEqual(turn("user", `q${MAX_MESSAGES + 29}`));
    expect(kept[0]).toEqual(turn("user", "q30"));
  });

  it("trims oldest turns rather than refusing an oversized transcript", () => {
    const fat = Array.from({ length: 40 }, (_, i) => turn("assistant", `${i}`.repeat(10_000)));
    const kept = unwrap(normalizeMessages(fat));
    expect(new TextEncoder().encode(JSON.stringify(kept)).length).toBeLessThanOrEqual(MAX_BYTES);
    expect(kept.length).toBeGreaterThan(0);
    // What survived is the tail, not the head.
    expect(kept[kept.length - 1]).toEqual(fat[fat.length - 1]);
  });

  it("refuses only when a SINGLE turn is bigger than the whole budget", () => {
    const monster = [turn("user", "x".repeat(MAX_BYTES + 10))];
    expect(normalizeMessages(monster)).toEqual({ error: "conversation is too large to save" });
  });

  it("refuses an empty conversation instead of saving a blank row", () => {
    expect(normalizeMessages([])).toEqual({ error: "nothing to save yet" });
    // Only a streaming placeholder present — nothing has actually been said.
    expect(normalizeMessages([turn("assistant", "")])).toEqual({ error: "nothing to save yet" });
  });

  it("rejects malformed payloads", () => {
    expect(normalizeMessages("nope")).toEqual({ error: "messages must be an array" });
    expect(normalizeMessages([null])).toEqual({ error: "each message must be an object" });
    expect(normalizeMessages([{ role: "system", content: "x" }])).toEqual({
      error: "each message needs role user|assistant|divider",
    });
    expect(normalizeMessages([{ role: "user", content: 42 }])).toEqual({
      error: "each message needs string content",
    });
  });
});

describe("deriveTitle", () => {
  it("uses the first question, so the list reads like what they asked", () => {
    expect(deriveTitle([turn("user", "Do I qualify with no income?")])).toBe(
      "Do I qualify with no income?",
    );
  });

  it("skips a leading divider and finds the real first question", () => {
    expect(
      deriveTitle([turn("divider", "Now answering for Texas"), turn("user", "Am I eligible?")]),
    ).toBe("Am I eligible?");
  });

  it("cuts a long question on a word boundary", () => {
    const long =
      "I live with my mother and my two children and I want to know whether all of us count as one household for SNAP";
    const title = deriveTitle([turn("user", long)]);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(73);
    // Cut between words, not through one.
    expect(title.slice(0, -1)).toBe(title.slice(0, -1).trimEnd());
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("collapses newlines so a pasted question stays one line in the list", () => {
    expect(deriveTitle([turn("user", "my rent\nis high\n\nam I eligible")])).toBe(
      "my rent is high am I eligible",
    );
  });

  it("falls back rather than titling a conversation with an answer", () => {
    expect(deriveTitle([turn("assistant", "Here is the federal rule…")])).toBe(
      "Saved conversation",
    );
  });
});

describe("field normalizers", () => {
  it("keeps a verified state and drops anything else to the federal floor", () => {
    expect(normalizeStateCode("ca")).toBe("CA");
    // Refusing the save over an unverified scope would punish the wrong thing:
    // the answers already exist, the scope is just how they were framed.
    expect(normalizeStateCode("ZZ")).toBeNull();
    expect(normalizeStateCode(null)).toBeNull();
  });

  it("falls back to English for an unknown language", () => {
    expect(normalizeLang("es")).toBe("es");
    expect(normalizeLang("klingon")).toBe("en");
    expect(normalizeLang(undefined)).toBe("en");
  });

  it("treats a blank rename as no title at all", () => {
    expect(normalizeTitle("  Rent question  ")).toBe("Rent question");
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle(undefined)).toBeNull();
  });
});
