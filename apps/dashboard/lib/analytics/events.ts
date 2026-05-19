/**
 * Lightweight page-view analytics event emitter.
 *
 * Current implementation: structured console.log consumed by Vercel Log Drains
 * or Datadog. This interface is the stable integration point for PostHog /
 * Segment / Amplitude post-MVP — swap the body without touching call sites.
 */
export function trackPageView(event: {
  page: string;
  actorId: string;
  orgId?: string;
  meta?: Record<string, unknown>;
}): void {
  console.log("[analytics:pageview]", { ...event, ts: new Date().toISOString() });
}
