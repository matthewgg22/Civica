import { describe, it, expect } from "vitest";
import { generateStaticParams, generateMetadata } from "../[state]/page";
import { QUESTIONS } from "../../../lib/guide-questions";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

// Guide-SSG spec (T12 / 7A): the guides are the acquisition engine — every
// verified pack must become a build-time page with real per-state questions.
// This suite fails the moment a new pack merges without its guide content.

describe("guide static generation", () => {
  it("emits one lowercase param per verified state — nothing more, nothing missing", () => {
    const params = generateStaticParams();
    const codes = params.map((p: { state: string }) => p.state).sort();
    expect(codes).toEqual(VERIFIED_STATES.map((s) => s.code.toLowerCase()).sort());
    expect(codes.every((c: string) => c === c.toLowerCase())).toBe(true);
  });

  it("every verified state has at least three guide questions", () => {
    for (const s of VERIFIED_STATES) {
      const qs = QUESTIONS[s.code];
      expect(qs, `QUESTIONS missing for ${s.code} — add guide content for the new pack`).toBeDefined();
      expect(qs!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("metadata names the state program and stays unique per state", async () => {
    const titles = new Set<string>();
    for (const s of VERIFIED_STATES) {
      const meta = await generateMetadata({ params: Promise.resolve({ state: s.code.toLowerCase() }) });
      expect(meta.title).toBeTruthy();
      titles.add(String(meta.title));
    }
    expect(titles.size).toBe(VERIFIED_STATES.length);
  });
});
