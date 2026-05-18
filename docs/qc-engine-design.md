# QC Engine Package Design

**Status:** LOCKED 2026-05-18 via /plan-eng-review T2 design pass
**Pattern:** Pure-logic TypeScript package; adapters injected; prototype becomes demo wrapper
**Owner:** Coordinator session (claude/clever-albattani-816917)

## Summary

`apps/snap-verification-prototype/` is a Next.js + SQLite demo with substantial QC logic (defensibility scoring, evidence package building, 7 CFR citation generation) that no one else can import today. Extract the pure logic into a typed package `@civica/snap-qc-engine` and convert the prototype into a thin demo wrapper that imports it. This unblocks T4 (defensibility test suite), T5 (state-facing surface), T8 (pilot instrumentation), and any future enrollment-api integration.

The engine is the single source of truth for QC decisions across the product.

## Scope

**In scope (extract to package):**
- Rule logic for the four flows: utility-SUA, shared-lease, gig-income, assets
- Defensibility scoring (`strong | moderate | weak`) and the factor breakdown
- Evidence package builder (the JSON shape that gets handed to a PDF generator or persisted)
- Citation generator (7 CFR, MA OLGT, CA ACL/ACIN references)
- Type definitions for inputs, outputs, all intermediate shapes
- The four flow inputs as typed contracts

**Out of scope (stays in prototype or moves to T9):**
- Next.js app shell + UI pages
- SQLite demo store
- Sandbox adapters for Plaid / Argyle / UtilityAPI (stay in prototype for now; production versions land in T9)
- PDF rendering (separate concern; engine returns JSON evidence package; renderer is its own package or job)

## Engine API

```typescript
import { qcEngine, type FlowKind, type FlowInput, type QcResult } from '@civica/snap-qc-engine';

const result: QcResult = await qcEngine.evaluate({
  flow: 'utility-sua',                    // FlowKind
  state: 'CA',                            // 'CA' | 'MA' for MVP
  inputs: { /* TypedInputFor<'utility-sua'> */ },
});
```

Return shape:

```typescript
type QcResult = {
  defensibility_score: 'strong' | 'moderate' | 'weak';
  defensibility_factors: DefensibilityFactor[];
  evidence_package: EvidencePackage;        // JSON; not a PDF
  citations: Citation[];                    // 7 CFR + state references
  warnings: Warning[];                      // e.g., Plaid/Argyle gap >25%
  computed_at: string;                      // ISO 8601
  engine_version: string;                   // semver of the engine
  flow: FlowKind;
  state: 'CA' | 'MA';
};
```

This output shape **becomes the persisted event in T8** (shadow-mode pilot instrumentation). T8 wraps `evaluate()`, adds `org_id` + `packet_id` + `evaluation_id`, persists to operational DB + analytical tier.

## Adapter contract (engine doesn't fetch; consumers normalize)

Engine never makes a network call. Consumers normalize their source data into the typed input contract before calling `evaluate()`.

```typescript
// Contract that adapter packages implement (later, in T9 or stays in prototype)
type Adapter<TConfig, TFlow extends FlowKind> = {
  fetchAndNormalize(config: TConfig, params: AdapterParams): Promise<FlowInput<TFlow>>;
  name: string;        // 'plaid' | 'argyle' | 'utilityapi' | 'manual'
};
```

Adapter packages depend on `@civica/snap-qc-engine` (for types) but the engine never imports adapters. One-way dependency.

## Package layout

```
packages/snap-qc-engine/
├── src/
│   ├── index.ts                          # public API (evaluate, types)
│   ├── version.ts                        # exports ENGINE_VERSION
│   ├── flows/
│   │   ├── utility-sua/
│   │   │   ├── rules.ts                  # SUA tier determination, exclusions
│   │   │   ├── scoring.ts                # defensibility factors for this flow
│   │   │   ├── package-builder.ts        # evidence JSON shape
│   │   │   └── types.ts
│   │   ├── shared-lease/
│   │   ├── gig-income/
│   │   └── assets/
│   ├── citations/
│   │   ├── cfr-273.ts                    # imports @civica/cfr-273 (T10 reference pkg)
│   │   ├── ma-olgt.ts
│   │   └── ca-acl-acin.ts
│   ├── scoring/
│   │   └── defensibility.ts              # cross-flow scoring helpers
│   └── schemas.ts                        # Zod for FlowInput, QcResult
├── test/
│   ├── flows/
│   │   ├── utility-sua.test.ts           # existing + new fixture tests
│   │   ├── shared-lease.test.ts
│   │   ├── gig-income.test.ts
│   │   └── assets.test.ts
│   ├── golden/                           # fixture inputs + expected outputs (T4 builds out)
│   └── parity.test.ts                    # asserts engine output matches prototype's pre-extraction output
└── package.json
```

## Prototype conversion (apps/snap-verification-prototype/)

After extraction:
- All logic in `lib/package-builder/`, `lib/defensibility/`, etc. → moved to package
- `app/verify/*/page.tsx` files import `qcEngine.evaluate()` directly
- Existing `lib/package-builder/package-builder.test.ts` and similar relocate to `packages/snap-qc-engine/test/`
- Sandbox adapters (Plaid/Argyle/UtilityAPI) stay in prototype as `lib/adapters/` — they implement the Adapter contract
- SQLite demo store stays — it's the prototype's persistence
- UI pages keep working; backing logic is now the package

The prototype keeps its purpose: live demo URL that a CBO or CDSS contact can be walked through. Now it's also a reference integration of the engine.

## Migration plan (PR-level)

1. **Scaffold package** with empty `src/` and a passing build.
2. **Move types first** — `types/verification.ts` → `packages/snap-qc-engine/src/schemas.ts` (as Zod) + types.
3. **Move one flow end-to-end** — start with utility-SUA (simplest, well-tested). Move rules, scoring, builder, citations. Add parity test asserting output matches prototype's pre-extraction outputs on existing test fixtures.
4. **Wire prototype to package** for that flow. Verify UI works unchanged.
5. **Repeat for shared-lease, gig-income, assets.**
6. **Move shared utilities** (defensibility scoring helpers, citation generators).
7. **Remove duplicated code** from prototype.
8. **CI gate:** existing prototype tests still pass + new engine tests pass.

This is a refactor, not a rewrite. Output behavior is preserved byte-for-byte.

## Multi-tenant note

Engine is tenant-agnostic — pure logic, no concept of org. Org context belongs to the caller (T8 wrapper, enrollment-api routes). See [docs/multi-tenant-design.md](./multi-tenant-design.md).

## Versioning

`engine_version` (semver) emitted in every `QcResult`. Bump rules:
- Patch: bug fixes, no output shape changes, no scoring deltas
- Minor: new flows, new optional fields, scoring improvements that don't change strong→weak transitions on existing fixtures
- Major: any change that flips a defensibility score on existing golden fixtures

T4's golden fixtures are pinned to a specific version. Bumping major requires regenerating goldens (with review).

## Dependencies

- `zod` (runtime validation)
- `@civica/cfr-273` (Tier 2 reference data; T10 owns this; T2 imports types only, falls back to stub if not yet available)
- No framework deps (no Next.js, no Hono, no React)
- Runs in Node, browser, Workers, Deno — pure TS

## What this design does NOT include (deferred)

- **PDF rendering.** Engine emits JSON evidence package; PDF generation is a separate concern (could be a render package, or remain in the prototype where docx-js + headless soffice already work).
- **Adapter implementations.** Plaid/Argyle/UtilityAPI sandbox adapters stay in prototype. Production adapters land in T9.
- **Real-time evaluation streaming.** `evaluate()` is request/response. Streaming defensibility-as-you-type is post-MVP.
- **Cross-state engine support.** Only CA + MA for MVP. Adding NY/FL/etc. is data + rules work, not engine architecture work.

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T2 design deliverable complete. Spawned T2 build session consumes this document as authoritative spec.
