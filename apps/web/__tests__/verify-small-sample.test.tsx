// /verify's certainty stat used to lead with a percentage no matter how few
// answers backed it: "16.7%" off 12 real answers, which reads as a measured
// rate when it is really "2 of 12" and could move several points on the very
// next answer. A page whose entire argument is honesty about uncertainty
// cannot open on false precision.
//
// Below SMALL_SAMPLE_THRESHOLD the page shows the raw count plus an explicit
// early-data note; at or above it, the percentage returns unchanged. The
// render tests are the real check — they assert on actual markup, so they
// fail if the branch is deleted, inverted, or wired to the wrong field. The
// source-level test that follows pins the threshold as a NAMED constant,
// which markup cannot show: an inlined `< 50` would pass every render test
// here while being exactly the thing that later drifts unnoticed.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../lib/certainty-stats", async () => {
  const actual = await vi.importActual<typeof import("../lib/certainty-stats")>(
    "../lib/certainty-stats",
  );
  return { ...actual, certaintyStats: vi.fn() };
});

/** A measured window; caller supplies the shape under test. */
const stats = (totalAnswers: number, certainAnswers: number, groundedRate: number) => ({
  measured: true,
  windowDays: 30,
  totalAnswers,
  certainAnswers,
  groundedRate,
  degraded: 0,
  recomposed: 0,
  topReason: "authority_not_retrieved",
  firstAnswerAt: "2026-08-01T00:00:00Z",
  lastAnswerAt: "2026-08-20T00:00:00Z",
});

async function renderVerify(mocked: ReturnType<typeof stats>) {
  const { certaintyStats } = await import("../lib/certainty-stats");
  (certaintyStats as ReturnType<typeof vi.fn>).mockResolvedValue(mocked);
  const { default: VerifyPage } = await import("../app/verify/page");
  return renderToStaticMarkup(await VerifyPage());
}

describe("a tiny sample is reported as a count, not a rate", () => {
  it("shows '2 of 12' and never the percentage it would compute to", async () => {
    const html = await renderVerify(stats(12, 2, 16.7));
    expect(html).toContain("2 of 12");
    expect(html).not.toContain("16.7%");
  });

  it("says why the format changed instead of switching silently", async () => {
    const html = await renderVerify(stats(12, 2, 16.7));
    expect(html).toContain("Early data");
  });

  it("still reports the window size honestly alongside the count", async () => {
    // The count replaces the percentage; it does not hide how few answers there are.
    const html = await renderVerify(stats(12, 2, 16.7));
    expect(html).toContain("of the last 12 answers");
  });
});

describe("a large enough sample returns to a percentage", () => {
  it("shows the rate and drops the early-data note", async () => {
    const html = await renderVerify(stats(240, 218, 90.8));
    expect(html).toContain("90.8%");
    expect(html).not.toContain("Early data");
  });

  it("switches at the threshold, not somewhere near it", async () => {
    // Exactly at the boundary is a percentage — the branch is `< THRESHOLD`.
    const atThreshold = await renderVerify(stats(50, 30, 60));
    expect(atThreshold).toContain("60%");
    expect(atThreshold).not.toContain("Early data");

    const justUnder = await renderVerify(stats(49, 30, 61.2));
    expect(justUnder).toContain("30 of 49");
    expect(justUnder).toContain("Early data");
  });
});

describe("the threshold stays a named constant", () => {
  // Not coverable by rendering: an inlined `< 50` behaves identically here and
  // is precisely the form that drifts later without anyone noticing.
  it("is declared once, with a name", () => {
    const PAGE = readFileSync(new URL("../app/verify/page.tsx", import.meta.url), "utf8");
    expect(PAGE).toMatch(/const SMALL_SAMPLE_THRESHOLD\s*=\s*\d+/);
  });
});
