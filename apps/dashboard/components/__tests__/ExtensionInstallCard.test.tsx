/**
 * ExtensionInstallCard unit tests — the "Install the BenefitsCal autofill
 * helper" surface. Branches on whether the unlisted Chrome Web Store URL is set:
 * published → "Add to Chrome" (external link); pilot → "Set up the helper"
 * (→ /cbo/setup) + a Pilot-build badge.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import ExtensionInstallCard from "../cbo/ExtensionInstallCard";

describe("ExtensionInstallCard", () => {
  it("published: shows Add to Chrome pointing at the store URL", () => {
    const url = "https://chrome.google.com/webstore/detail/abc123";
    render(<ExtensionInstallCard installUrl={url} />);
    const cta = screen.getByRole("link", { name: /add to chrome/i });
    expect(cta).toHaveAttribute("href", url);
    expect(cta).toHaveAttribute("target", "_blank");
    expect(screen.queryByText(/pilot build/i)).toBeNull();
  });

  it("pilot: no URL → routes to the setup guide + shows the Pilot badge", () => {
    render(<ExtensionInstallCard installUrl={null} />);
    expect(screen.queryByRole("link", { name: /add to chrome/i })).toBeNull();
    expect(screen.getByRole("link", { name: /set up the helper/i })).toHaveAttribute("href", "/cbo/setup");
    expect(screen.getByText(/pilot build/i)).toBeInTheDocument();
  });

  it("always lists the post-install usage steps + a setup link", () => {
    render(<ExtensionInstallCard installUrl={null} />);
    expect(screen.getByText(/pick the case you're working on/i)).toBeInTheDocument();
    expect(screen.getByText(/click next \/ accept yourself/i)).toBeInTheDocument();
    // Civica-never-submits reassurance is present (appears in the blurb + step 4).
    expect(screen.getAllByText(/never submits for you/i).length).toBeGreaterThan(0);
  });
});
