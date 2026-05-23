import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation's notFound so the test can assert it gets called
// instead of letting it bubble up as a NEXT_NOT_FOUND throw.
const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    // Mimic Next.js's behavior: notFound() throws to short-circuit the
    // render. Tests can `expect(() => render(...)).toThrow()` or just
    // assert the mock was called.
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import CountyCompliancePage, {
  generateMetadata,
  generateStaticParams,
} from "../page";
import { listSupportedCounties } from "../../../../../lib/countyExposure";

describe("CountyCompliancePage", () => {
  beforeEach(() => {
    mocks.notFound.mockClear();
  });

  it("renders for a known slug (los-angeles)", async () => {
    // Server components return a Promise<JSX>. Resolve before render.
    const ui = await CountyCompliancePage({
      params: Promise.resolve({ slug: "los-angeles" }),
    });
    render(ui);

    // The county displayName lands in the H1 + header eyebrow + footer.
    expect(screen.getAllByText(/Los Angeles County/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Los Angeles County/,
    );
    // Estimated exposure label from countyExposure.ts.
    expect(screen.getAllByText("$134M").length).toBeGreaterThanOrEqual(1);
    // Caseload share label appears in the KPI card.
    expect(screen.getAllByText(/~26\.3%/).length).toBeGreaterThanOrEqual(1);
    // notFound MUST NOT have been called for a real slug.
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("renders for a long-tail slug (alpine)", async () => {
    const ui = await CountyCompliancePage({
      params: Promise.resolve({ slug: "alpine" }),
    });
    render(ui);
    expect(
      screen.getByRole("heading", { level: 1 }).textContent,
    ).toMatch(/Alpine County/);
    // Alpine's tiny exposure label.
    expect(screen.getAllByText("$10K").length).toBeGreaterThanOrEqual(1);
  });

  it("appends the county's own row when it is outside the top 20", async () => {
    // Alpine is the smallest county, far outside the top 20 leaderboard.
    const ui = await CountyCompliancePage({
      params: Promise.resolve({ slug: "alpine" }),
    });
    const { container } = render(ui);
    // The "(this brief)" eyebrow marks the appended single-row block.
    expect(
      container.textContent?.toLowerCase().includes("(this brief)"),
    ).toBe(true);
  });

  it("calls notFound() for an unknown slug", async () => {
    await expect(
      CountyCompliancePage({
        params: Promise.resolve({ slug: "nonexistent-county" }),
      }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("renders the procurement CTA mailto with the county-specific subject", async () => {
    const ui = await CountyCompliancePage({
      params: Promise.resolve({ slug: "san-diego" }),
    });
    const { container } = render(ui);
    const cta = container.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.href).toContain(
      "subject=" + encodeURIComponent("Civica review for San Diego County"),
    );
  });
});

describe("generateStaticParams", () => {
  it("returns one param object per supported county", async () => {
    const params = await generateStaticParams();
    expect(params.length).toBe(listSupportedCounties().length);
    expect(params.length).toBe(58);
    // Every entry should have a non-empty slug string.
    for (const p of params) {
      expect(typeof p.slug).toBe("string");
      expect(p.slug.length).toBeGreaterThan(0);
    }
    // Should include both the largest and the smallest counties.
    const slugs = params.map((p) => p.slug);
    expect(slugs).toContain("los-angeles");
    expect(slugs).toContain("alpine");
  });
});

describe("generateMetadata", () => {
  it("populates title + description for a known slug", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "los-angeles" }),
    });
    expect(meta.title).toMatch(/Los Angeles County/);
    expect(typeof meta.description).toBe("string");
    expect(meta.description).toMatch(/Los Angeles County/);
    expect(meta.openGraph?.title).toMatch(/Los Angeles County/);
    expect(meta.twitter).toBeTruthy();
  });

  it("returns a fallback title for an unknown slug instead of throwing", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "nope-not-real" }),
    });
    expect(meta.title).toMatch(/County not found/i);
  });
});
