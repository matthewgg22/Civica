// TestFlight invite link is filled in once the TestFlight build is published.
// For pilot scaffold, the link points to a placeholder anchor — replace
// NEXT_PUBLIC_TESTFLIGHT_URL in apps/web/.env.local when the build is ready.

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";

export function TestFlightCTA({ label }: { label: string }) {
  return (
    <a
      className="btn btn--secondary"
      href={TESTFLIGHT_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}
