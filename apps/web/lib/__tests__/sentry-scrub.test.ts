import { describe, it, expect } from "vitest";
import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "../sentry-scrub";

// A SNAP intake surface: a user's typed question rides the URL (/?q=...), their
// household data can land in the request body, and breadcrumbs/transactions
// carry both. These pin that none of it reaches Sentry.

describe("sentry PII scrub", () => {
  it("strips query strings, body, and cookies; reduces user to id", () => {
    const ev = {
      request: {
        url: "https://demeter.ai/screen/ask?state=CA&q=am%20i%20eligible",
        query_string: "state=CA&q=am%20i%20eligible",
        data: { income: 1800 },
        cookies: "sb-access-token=secret",
        headers: { "content-type": "application/json", authorization: "Bearer x", cookie: "sb=1" },
      },
      user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
    } as unknown as ErrorEvent;

    const out = scrubEvent(ev);
    expect(out.request?.url).toBe("https://demeter.ai/screen/ask");
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toEqual({ "content-type": "application/json" });
    expect(out.user).toEqual({ id: "u1" });
  });

  it("scrubs transaction-shaped events too (the tracing pipeline beforeSend never sees)", () => {
    const tx = {
      type: "transaction",
      request: { url: "https://demeter.ai/x?q=secret", query_string: "q=secret" },
    } as unknown as ErrorEvent;
    const out = scrubEvent(tx);
    expect(out.request?.url).toBe("https://demeter.ai/x");
    expect(out.request?.query_string).toBeUndefined();
  });

  it("drops console breadcrumbs (they can echo user input)", () => {
    expect(scrubBreadcrumb({ category: "console", message: "user typed: 1234" } as Breadcrumb)).toBeNull();
  });

  it("strips query strings from navigation/http breadcrumbs", () => {
    const bc = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/a?q=x", to: "/b?state=CA", url: "https://d/c?q=y", "http.query": "q=y" },
    } as Breadcrumb);
    expect(bc?.data).toEqual({ from: "/a", to: "/b", url: "https://d/c" });
  });

  it("passes a dataless breadcrumb through unchanged", () => {
    const bc = { category: "ui.click", message: "button" } as Breadcrumb;
    expect(scrubBreadcrumb(bc)).toBe(bc);
  });
});
