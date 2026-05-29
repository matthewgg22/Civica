// Shared copy for branded error + 404 + global-error boundaries. Single source
// of truth so the technical-tone voice (per /plan-design-review D10) stays
// consistent across error.tsx, global-error.tsx, and not-found.tsx.

export const ERROR_COPY = {
  status: "500 Internal Server Error",
  title: "Something went wrong on our end.",
  errorIdLabel: "Error ID",
  errorIdFallback: "not available",
  notified: "The Civica team has been notified.",
  retryCta: "Try again",
  backCta: "Back to dashboard",
} as const;

export const NOT_FOUND_COPY = {
  status: "404 Not Found",
  title: "We couldn't find that page.",
  // Multi-link wayfinding per design review D6 — three exits cover navigator,
  // partner, and anonymous audiences without leaking IA to unauthenticated users.
  loggedInPrompt: "Looking for something?",
  anonymousPrompt: "Looking for a public surface?",
  dashboardCta: "Back to dashboard",
  packetsCta: "Search applications with ⌘K",
  findingsCta: "View findings ledger",
} as const;

export const GLOBAL_ERROR_COPY = {
  status: "500 Internal Server Error",
  title: "Civica couldn't load.",
  notified:
    "We can't render the usual layout. The Civica team has been notified.",
  retryCta: "Try again",
} as const;
