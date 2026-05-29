/**
 * @civica/benefitscal-cbo/driver — server-only surface.
 *
 * Drives the BenefitsCal CBO Manager portal end-to-end. `submitter.ts`
 * dynamically imports `playwright` (Node driver) and `browserless.ts` is a
 * fetch-only Worker-safe BrowserDriver. NEITHER is safe to pull into a
 * browser/extension bundle — import the pure compute pieces from `../core`
 * instead.
 */

export {
  submitToBenefitsCal,
  nodePlaywrightDriverFactory,
  navigateToApplicationHub,
  startSection,
  acceptUnvalidatedAddress,
} from "./submitter";
export type {
  SubmitterOptions,
  SubmitterResult,
  TranscriptStep,
  BrowserDriver,
  BrowserDriverPage,
  BrowserDriverLocator,
  BrowserDriverFactory,
  SectionName,
} from "./submitter";
export { browserlessDriverFactory } from "./browserless";
export type {
  BrowserlessDriverOptions,
  BrowserlessFunctionResponse,
} from "./browserless";
