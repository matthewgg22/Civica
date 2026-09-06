import type { Event, Breadcrumb } from "@sentry/nextjs";

// PII scrubbing shared by all three apps/web Sentry configs (server, edge,
// client). This is a SNAP intake surface, so more than the request body leaks:
//
//  - query strings carry typed input — next.config.ts documents campaign links
//    of the form /?state=CA&q=..., and /screen/ask, /questions, /chat can carry
//    a user's own words in the URL;
//  - breadcrumbs carry navigation from/to URLs, fetch/xhr URLs, and console
//    output that can echo user input;
//  - with tracing on (tracesSampleRate 0.05), TRANSACTION events ship request
//    data through a pipeline that beforeSend never touches.
//
// So: strip the query string (and the query half of the URL), drop the request
// body/cookies, reduce headers to content-type, reduce the user to an id, scrub
// the same fields off transactions, and drop console breadcrumbs / strip query
// strings from the rest.
//
// apps/dashboard carries the older request-only version of this logic inline;
// it is PARKED, so this intentionally drifts — re-sync when it unparks.

type SentryRequest = NonNullable<Event["request"]>;

const stripQuery = (url?: string): string | undefined =>
  typeof url === "string" ? url.split("?")[0] : url;

function scrubRequest(request: SentryRequest): SentryRequest {
  return {
    ...request,
    url: stripQuery(request.url),
    query_string: undefined,
    data: undefined,
    cookies: undefined,
    headers: { "content-type": request.headers?.["content-type"] ?? "" },
  };
}

/** beforeSend AND beforeSendTransaction — the same scrub applies to both. */
export function scrubEvent<E extends Event>(event: E): E {
  if (event.request) event.request = scrubRequest(event.request);
  if (event.user) event.user = { id: event.user.id };
  return event;
}

/** beforeBreadcrumb — drop console echoes, strip query strings off the rest. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  const d = breadcrumb.data;
  if (d) {
    if (typeof d.from === "string") d.from = stripQuery(d.from);
    if (typeof d.to === "string") d.to = stripQuery(d.to);
    if (typeof d.url === "string") d.url = stripQuery(d.url);
    delete d["http.query"];
  }
  return breadcrumb;
}
