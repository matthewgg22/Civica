// Production adapter registry.
//
// Centralizes the list of source adapters the polling loop should run.
// Adding a new adapter = construct it here and add it to the array.
// The CLI imports this; tests use their own adapters and never touch
// this module (so test failures don't cascade through the production
// registry).

import { FederalRegisterAdapter } from "../sources/index.js";
import type { AuditLogWriter } from "../audit/index.js";

import type { PollableAdapter } from "./types.js";

export interface DefaultAdaptersDeps {
  readonly auditLog: AuditLogWriter;
}

/**
 * Build the production set of adapters. Each construction is explicit
 * (rather than auto-discovered) so adding/removing a source is a code
 * change visible in PR review.
 *
 * Today: just FederalRegisterAdapter (E10). Forthcoming:
 *   - UsdaFnsColaAdapter
 *   - UsdaFnsMemosAdapter
 *   - CaCdssAclAdapter
 *   - MaDtaChartsAdapter
 *   - FtcActionsAdapter
 */
export function defaultAdapters(deps: DefaultAdaptersDeps): readonly PollableAdapter[] {
  return [new FederalRegisterAdapter({ auditLog: deps.auditLog })];
}
