import { cookies } from "next/headers";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { createServerClientFromCookies } from "../lib/supabase";
import { NOT_FOUND_COPY } from "../lib/error-copy";

// Root 404 — inherited by every notFound() call in the app (currently 9 sites).
// Auth-aware: logged-in users get navigator-flavored wayfinding (⌘K hint,
// Findings). Anonymous users get only the public-safe destinations.
// Per /plan-eng-review D10: don't leak IA to unauthenticated visitors.

export default async function NotFound() {
  // Guard against auth failure: a Supabase outage during 404 render must not
  // recursive-throw into error.tsx. Per /plan-ceo-review D10 / Section 2.2:
  // treat any error here as "anonymous user."
  let user: { id: string } | null = null;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClientFromCookies(cookieStore);
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }

  // Sentry custom event so we can track wayfinding-gap signal (per
  // /plan-ceo-review D11). Pathname isn't reliably available in a server
  // component without dynamic-import workarounds; the event still gives
  // count + auth-state.
  Sentry.captureMessage("dashboard.not_found_viewed", {
    level: "info",
    tags: { authed: user ? "true" : "false" },
  });

  const isAuthed = user !== null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8 py-16">
      <div className="max-w-lg w-full bg-surface border border-hairline rounded-[4px] p-8 space-y-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-graphite">
          {NOT_FOUND_COPY.status}
        </p>
        <h1 className="text-[22px] font-bold tracking-tight leading-tight text-ink">
          {NOT_FOUND_COPY.title}
        </h1>
        <p className="text-[14px] text-graphite leading-relaxed">
          {isAuthed ? NOT_FOUND_COPY.loggedInPrompt : NOT_FOUND_COPY.anonymousPrompt}
        </p>
        <ul className="space-y-2.5 pt-2">
          <li>
            <Link
              href={isAuthed ? "/dashboard" : "/"}
              className="text-[14px] font-semibold text-pine hover:underline"
            >
              {NOT_FOUND_COPY.dashboardCta} →
            </Link>
          </li>
          {isAuthed && (
            <li>
              <Link
                href="/packets"
                className="text-[14px] font-semibold text-pine hover:underline"
              >
                {NOT_FOUND_COPY.packetsCta} →
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/findings"
              className="text-[14px] font-semibold text-pine hover:underline"
            >
              {NOT_FOUND_COPY.findingsCta} →
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
