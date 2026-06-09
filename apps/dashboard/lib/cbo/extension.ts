// Civica Submitter (BenefitsCal autofill) extension — install metadata.
//
// The install URL is env-driven so it flips from the pilot (load-unpacked dev
// build) to the published unlisted Chrome Web Store listing WITHOUT a code change:
//   NEXT_PUBLIC_SUBMITTER_EXTENSION_URL=https://chrome.google.com/webstore/detail/<id>
// When unset, the UI shows the pilot path (manual load-unpacked via /cbo/setup).

/** The unlisted Chrome Web Store URL, or null while piloting (load-unpacked). */
export function submitterExtensionUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUBMITTER_EXTENSION_URL;
  return url && url.trim().length > 0 ? url.trim() : null;
}

/** What the officer does once the extension is installed + connected. */
export const SUBMITTER_USE_STEPS: readonly string[] = [
  "Connect the extension to your Civica account (one time).",
  "Pick the case you're working on.",
  "Open that applicant's BenefitsCal application.",
  "Review the yellow autofilled fields, then click Next / Accept yourself — Civica never submits for you.",
];
