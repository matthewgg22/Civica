// Public barrel for SourceAdapter types.
//
// Downstream packages should import from `@civica/regops-engine/sources`
// rather than the deep path. The fully-typed FetchResult discriminated
// union lives in types.ts and is the contract every SourceAdapter
// implementation must return.

export type {
  FetchResult,
  FetchSuccess,
  FetchNoChange,
  FetchTransientFailure,
  FetchStructuralFailure,
  FetchSourceWedged,
} from "./types.js";

export {
  assertNever,
  hasNewData,
  isNoChange,
  isRetryable,
  isSourceWedged,
  isStructuralFailure,
  isSuccess,
  isTransientFailure,
} from "./types.js";

export type {
  DomainTag,
  FetchContext,
  SourceAdapter,
  SourceAdapterBaseDeps,
  SourceAdapterPolicyOverrides,
} from "./base.js";
export {
  BACKOFF_SCHEDULE_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_WEDGED_THRESHOLD_MS,
  REGOPS_USER_AGENT,
  SourceAdapterBase,
} from "./base.js";

export type { Clock } from "./clock.js";
export { FakeClock, SystemClock } from "./clock.js";
