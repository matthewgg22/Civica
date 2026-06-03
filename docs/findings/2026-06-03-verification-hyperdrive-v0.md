---
id: 2026-06-03-verification-hyperdrive-v0
date: 2026-06-03
scope: [snap, eligibility-engine, verification, metamorphic-testing, registry]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: packages/snap-rules/src/registry/fy26.yaml
    note: "Layer 3 seed registry — 10 entries: 6 constants (CA SUA tiers + FPL HH1 + max-allot HH1 + min-benefit), 4 citations (lottery DQ at 273.11(r), state proc. 272.17, benefit rounding (e)(2)(ii)(A), min-benefit (e)(2)(ii)(C))."
  - kind: file
    ref: packages/snap-rules/src/registry/lint.ts
    line: 22
    note: "Staleness linter — FAIL on past valid_through, WARN within 30 days. Runs offline; CI gate per acceptance criterion."
  - kind: file
    ref: packages/snap-rules/test/metamorphic.test.ts
    note: "3 metamorphic relations × 4 seed bases = 12 oracle-free assertions: unearned monotonicity, earned vs unearned signature, determinism."
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/272.17"
    note: "Primary-source fetch 2026-06-03 — confirmed 272.17 is state cooperative-agreement procedure; cross-references 273.11(r) verbatim. Lottery DQ citation corrected from prior commit b093ed6e error."
  - kind: url
    ref: "https://www.law.cornell.edu/cfr/text/7/273.11"
    note: "Companion fetch — Cornell mirror truncated at paragraph (k); 272.17's cross-references are dispositive for (r)'s existence + role."
---

## What we found

Shipped verification-hyperdrive v0 — Layer 3 (registry + staleness linter) + Layer 1a (3 metamorphic relations) per the spec at `~/Library/Application Support/Claude/local-agent-mode-sessions/.../VERIFICATION-HYPERDRIVE-spec.md`. Also corrected a real citation bug the spec's review caught: lottery DQ lives at **7 CFR 273.11(r)**, not 272.17 as a prior protective comment claimed.

## Why it matters

Two failure modes the prior session caught only by accident, now caught by standing machinery:

1. **Stale constants slip past `pnpm test`.** The triple-check found the engine's `max_allotment_each_additional: 224` was a $6 over-credit vs FY26 spec. That bug was invisible because tests passed — they tested the wrong constant against itself. The registry + linter give every constant an owner, a primary-source URL, and an expiry. When CY2025 HHS FPL hits its operational end (2026-09-30), CI fails and the maintainer must refetch.

2. **CFR citations propagate wrong claims when not pinned to primary source.** The prior commit `b093ed6e` added a "protective comment" instructing future agents to keep lottery DQ at 272.17 — that comment was wrong. It was based on a fresh-eyes audit that itself had not fetched the live CFR text. This commit fixes the citation and replaces the comment with one that explicitly notes the prior error so the next reviewer doesn't re-introduce it.

The corrections in this finding are themselves verified by live primary-source fetches (Cornell LII URLs, 2026-06-03 11:14 PT). No memory-quoting; no reviewer-on-reviewer adjudication.

## What changed (per the PR scope)

- **Step 1: Lottery citation corrected.** `disqualifications.ts:42` reason string from `[7 CFR 272.17]` → `[7 CFR 273.11(r); state proc. 272.17]`. Cross-references in `benefit-calc.ts` comment and both fixture JSONs (`data-ops/test-scenarios/...` + `data-ops/sample/...`) synced. Harness D06 row now displays the corrected cite. Commit `6ba8ba9a`.
- **Step 2: Registry YAML.** `packages/snap-rules/src/registry/fy26.yaml` — 10 seed entries (6 constants, 4 citations).
- **Step 3: Loader.** `packages/snap-rules/src/registry/load.ts` — Zod-validated YAML parsing, typed lookups (`registryEntry(id)`, `constantValue(id)`, `citationValue(id)`).
- **Step 4: Staleness linter.** `packages/snap-rules/src/registry/lint.ts` — runnable as `pnpm --filter @civica/snap-rules run lint:registry`. FAIL on past `valid_through`, WARN within 30 days. Caught a real issue during testing: the original FPL HH1 entry had `valid_through: 2025-12-31` (calendar-year basis), but SNAP uses CY2025 FPL through FY26 end (2026-09-30). Updated to align registry entry semantics with operational use.
- **Step 5: 3 metamorphic relations.** `packages/snap-rules/test/metamorphic.test.ts` — M1 unearned monotonicity, M2 earned-vs-unearned signature (the 20% EID arithmetic), M3 determinism. 4 hand-authored seed bases × 3 relations = 12 oracle-free assertions per run.
- **Step 6: Twin-consistency CI gate** — deferred to v0.1. Spec's mechanization (commit-message check) requires GitHub Actions changes that may interact with other workflows; safer to ship layered.
- **Step 7: Finding doc** (this file) — scope, what's in/out, deferred items.

## What this proves — and what it doesn't

**Proves:** the engine is self-consistent under the 3 transformations (monotonicity, earned-vs-unearned arithmetic, idempotence) on a small seed corpus. The registry has owners + URLs + expiries for the seeded constants and citations. Lint catches stale entries before they ship.

**Does not prove:** correctness of the engine's outputs against any external truth. Layer 1 is oracle-free by design — an engine using the wrong SUA table can still be monotone. That's what Layer 2 (PolicyEngine pairing in the federal-baseline scope) and worked-example goldens cover; those remain the only real correctness checks for state-specific logic.

## What changes

- [x] Lottery DQ citation corrected end-to-end (engine + comments + fixtures). Verified via Cornell LII fetch.
- [x] Layer 3 registry + loader + linter shipped. 10 seed entries; lint runs in <1s; vitest covers 4 lint behaviors.
- [x] Layer 1a 3 metamorphic relations shipped. 12 assertions per run; <100ms in vitest.
- [x] `lint:registry` + `test:metamorphic` scripts added to snap-rules package.
- [ ] CI wiring — add `pnpm --filter @civica/snap-rules run lint:registry` + `test:metamorphic` to `.github/workflows/ts-typecheck.yml` (next commit; small, doesn't depend on this PR).
- [ ] Twin-consistency mechanization — GitHub Actions check that commits referencing "independence" or "corroboration" must cite a findings/ ID or a pinned `policyengine-us` version. Deferred to v0.1.
- [ ] G1-boundary fuzzer (out-of-model inputs) — deferred to v0.1; pair with `fast-check`.
- [ ] G2 (independent population for Layer 2 differential) — deferred; spec's `DECIDE:` point unresolved.

## Open questions (from the spec)

1. **G2 source schema** — PolicyEngine vars vs neutral schema. Defer until Layer 2 nightly is rebuilt for the federal-baseline scope.
2. **Rounding-bound provenance** — would need an author other than the engine author. Defer; downgrade the rounding assertion to "idempotent" for now (M3 covers it).
3. **Layer 2 thresholds + state calculator** — defer; current PolicyEngine pairing finding is sufficient corroboration in federal-baseline scope.
4. **Per-PR incremental mutation threshold** — defer; the on-demand mutation-score driver remains the model.
5. **Registry review-interval for null `valid_through`** — set at 365 days for constants/booleans; citations exempt (CFR sections don't expire).
6. **Red-team cadence + ledger location** — defer; per the spec, Layer 4 is lead-generation only and doesn't gate.

## Notes for the next reviewer

The lottery citation correction is the spec's most important catch. Specifically, the prior commit `b093ed6e` added a comment that told future agents NOT to fix the citation. That instruction was wrong. The current code now has an inverse protective comment explaining the prior error. If you (a future reviewer) disagree with the current citation: **fetch `https://www.law.cornell.edu/cfr/text/7/272.17` yourself and read the cross-references to `§ 273.11(r)` verbatim before changing anything.** Primary source first; reviewer claims second.
