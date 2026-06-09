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

  it("pilot with a zip URL → 'Download the build (.zip)' (download attr)", () => {
    render(<ExtensionInstallCard installUrl={null} zipUrl="/downloads/civica-submitter.zip" />);
    const dl = screen.getByRole("link", { name: /download the build/i });
    expect(dl).toHaveAttribute("href", "/downloads/civica-submitter.zip");
    expect(dl).toHaveAttribute("download");
    expect(screen.getByText(/pilot build/i)).toBeInTheDocument();
  });

  it("preview variant: explainer only — no auth-gated links", () => {
    render(<ExtensionInstallCard installUrl="https://chrome.google.com/webstore/detail/abc" variant="preview" />);
    // No CTAs or /cbo/setup links a public visitor can't use.
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/pilot build/i)).toBeNull();
    // Still explains what it is + how officers get it + the usage steps.
    expect(screen.getByText(/install this from their Civica workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/pick the case you're working on/i)).toBeInTheDocument();
  });

  it("preview variant WITH a zip URL → exposes the (usable) download link", () => {
    render(<ExtensionInstallCard installUrl={null} zipUrl="/downloads/civica-submitter.zip" variant="preview" />);
    const dl = screen.getByRole("link", { name: /download the build/i });
    expect(dl).toHaveAttribute("href", "/downloads/civica-submitter.zip");
    // Still no auth-gated /cbo/setup link in preview.
    expect(screen.queryByRole("link", { name: /set up the helper|step-by-step/i })).toBeNull();
  });

  it("always lists the post-install usage steps + a setup link", () => {
    render(<ExtensionInstallCard installUrl={null} />);
    expect(screen.getByText(/pick the case you're working on/i)).toBeInTheDocument();
    expect(screen.getByText(/click next \/ accept yourself/i)).toBeInTheDocument();
    // Civica-never-submits reassurance is present (appears in the blurb + step 4).
    expect(screen.getAllByText(/never submits for you/i).length).toBeGreaterThan(0);
  });
});
