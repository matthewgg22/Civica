// Public barrel for the polling layer.

export type {
  Alert,
  AlertEmitter,
  AlertSeverity,
  PerSourcePollResult,
  PollTickResult,
  PollableAdapter,
  SnapshotRecord,
  SnapshotStore,
} from "./types.js";

export { pollOnce } from "./orchestrator.js";
export type { PollOnceOptions } from "./orchestrator.js";

export { ConsoleAlertEmitter, InMemoryAlertEmitter } from "./alert-emitter.js";
export type { ErrLineWriter } from "./alert-emitter.js";

export { SentryAlertEmitter } from "./sentry-alert-emitter.js";
export type {
  SentryAlertEmitterOptions,
  SentryCaptureContext,
  SentryLike,
} from "./sentry-alert-emitter.js";

export {
  InMemorySnapshotStore,
  JsonlSnapshotStore,
  SupabaseSnapshotStore,
} from "./snapshot-store.js";
export type { LineWriter } from "./snapshot-store.js";

export { defaultAdapters } from "./registry.js";
export type { DefaultAdaptersDeps } from "./registry.js";

export { runCli } from "./cli.js";
export type { RunCliOptions } from "./cli.js";
