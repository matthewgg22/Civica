/**
 * @civica/benefitscal-cbo — root entrypoint.
 *
 * Re-exports the full package surface (core + driver) for back-compat with
 * existing consumers (notably `apps/enrollment-api`, which imports types +
 * `submitToBenefitsCal` from the root). New, bundle-sensitive consumers
 * should import from the narrower subpaths instead:
 *   - `@civica/benefitscal-cbo/core`   — browser-safe pure compute
 *   - `@civica/benefitscal-cbo/driver` — server-only portal automation
 */

export * from "./core";
export * from "./driver";
