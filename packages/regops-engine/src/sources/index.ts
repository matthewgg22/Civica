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
