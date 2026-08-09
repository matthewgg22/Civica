import { describe, it, expect, vi, beforeEach } from "vitest";

// 2026-08-09: /screen no longer shows the "Screen a household" pitch/sign-in
// landing to new visitors — the sharpened pivot ("Demeter AI is a simplified
// B2C chatbot") moved that org/case-file flow out of the default path.
// Anonymous visitors go straight to /screen/ask, same destination as root's
// own redirect (next.config.ts). Already-signed-in org members are
// unaffected — they still land on /screen/session, an existing shortcut for
// a real (if now-secondary) user, not new surface area.

const mockRedirect = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const mockResolveOrgIdentity = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("../../../lib/screening-auth", () => ({
  resolveOrgIdentity: mockResolveOrgIdentity,
}));

import ScreenLandingPage from "../page";

beforeEach(() => {
  mockRedirect.mockClear();
  mockResolveOrgIdentity.mockReset();
});

describe("ScreenLandingPage", () => {
  it("redirects an anonymous visitor straight to /screen/ask", async () => {
    mockResolveOrgIdentity.mockResolvedValue(null);
    await expect(ScreenLandingPage()).rejects.toThrow("REDIRECT:/screen/ask");
    expect(mockRedirect).toHaveBeenCalledWith("/screen/ask");
  });

  it("still sends an already-signed-in org member to /screen/session", async () => {
    mockResolveOrgIdentity.mockResolvedValue({ orgId: "org_123" });
    await expect(ScreenLandingPage()).rejects.toThrow("REDIRECT:/screen/session");
    expect(mockRedirect).toHaveBeenCalledWith("/screen/session");
  });
});
