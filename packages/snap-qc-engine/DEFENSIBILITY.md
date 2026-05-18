# Defensibility scoring — contract and operational definitions

The defensibility score is the product. Every `QcResult` emitted by
`qcEngine.evaluate()` carries one of three values — `strong`, `moderate`,
`weak` — and the §10105 pitch to CDSS depends on those values being stable
over time: "Civica reduced application error rate from X% to Y% with
provably stronger defensibility on these cases."

This document explains what the score means, what governs it, and the
contract that keeps it from drifting silently.

For implementation details and the per-flow scoring code, see
[../../docs/qc-engine-design.md](../../docs/qc-engine-design.md).

## What the score means

The score answers the question *"how well could an eligibility worker, an
auditor, or counsel defend this verification packet if challenged?"*

| Score | Operational definition |
| --- | --- |
| **strong** | Multiple independent third-party sources agree. The reviewer can sign off without follow-up. Example: a utility account name matches the applicant via UtilityAPI, **and** the applicant declared the relevant utilities — no contradictions, no missing evidence. |
| **moderate** | One sound source plus self-attestation, or all required signals present but verification is partial. The packet is defensible but a careful reviewer would expect at least one follow-up artifact (signed attestation, document, or callback). |
| **weak** | A required signal is missing, two sources actively conflict, or only self-declared statements support the claim. The packet is **not** ready to be acted on without remediation. The engine emits a `warning` of severity `critical` or `warning` whenever it returns `weak`. |

These thresholds are deliberately operational — they map to actions a
reviewer would take, not to internal confidence scores. The QcResult that
arrives in the navigator dashboard is meant to be the answer to "what
should I do with this packet?", not a number to interpret.

## `defensibility_factors`

Every score is accompanied by a list of `defensibility_factors`. Each
factor is an enumerated reason — `name`, `weight` (positive / negative /
neutral), and a human-readable `detail`. Factors are the **why** behind a
score. Today's flow modules emit factors covering:

- **utility-sua** — `utility_account_name_match`, `utility_account_name_mismatch`, `utility_self_declared`, `no_qualifying_utility`.
- **shared-lease** — `lease_document_uploaded`, `no_lease_document`, `bank_payment_pattern_high`, `bank_payment_pattern_medium`, `bank_payment_pattern_low`, `no_bank_evidence`, `address_invalid`.
- **gig-income** — `argyle_payroll_verified`, `plaid_deposits_corroborated`, `cash_self_declared`, `reconciliation_gap`.
- **assets** — `no_assets_declared`, `all_assets_verified`, `partial_asset_verification`, `self_declared_assets`, `asset_test_exceeded`.

The factor list is part of the frozen contract — golden fixtures lock the
exact factors a given input produces. Adding, removing, or renaming a
factor is a breaking change.

## Citations

Every QcResult includes a `citations` array. Each citation has an
`authority` (e.g. `7 CFR Part 273`, `CA CDSS`, `MA DTA`) and a `reference`
(the exact section). Citations are pulled from the per-state rules in
`@civica/snap-calculator` (`STATE_SUA_RULES`, `STATE_ASSET_RULES`,
`SHELTER_CITATIONS`, `INCOME_CITATIONS`) and from the `@civica/cfr-273`
package once it is wired up by T10.

Citations are part of the frozen contract. If a regulation changes and we
update a `reference` string, the golden fixture for any case that touches
that regulation must be regenerated and reviewed.

## The contract: golden fixtures + engine versioning

Scoring is frozen via golden fixtures under
`test/golden/<flow>/<id>/`. Each fixture contains:

- `input.json` — the `EvaluateRequest` payload
- `expected.json` — the full `QcResult` the engine produced when the
  fixture was generated, including `engine_version`
- `notes.md` — a one-paragraph description of who this case represents
  and why it scores the way it does

`test/golden.test.ts` runs the current engine against every `input.json`
and asserts that `defensibility_score`, `defensibility_factors`,
`citations`, `warnings`, and the body of `evidence_package` exactly match
the frozen `expected.json`. The only fields excluded from comparison are
`computed_at` and `generated_at` (non-deterministic timestamps) — and
`engine_version`, which is asserted separately against the version-bump
rules below.

### Versioning rules (per [qc-engine-design.md §Versioning](../../docs/qc-engine-design.md))

`ENGINE_VERSION` is semver:

- **Patch** — bug fixes, no output shape changes, no scoring deltas. All
  existing fixtures must still pass.
- **Minor** — new flows, new optional fields, scoring improvements that
  don't change strong→weak transitions on existing fixtures. All
  existing fixtures must still pass.
- **Major** — any change that flips a defensibility score on an existing
  fixture. Requires regenerating goldens with PR-level review.

The golden test asserts that `expected.engine_version` and the current
`ENGINE_VERSION` share the same major version. Cross-major drift fails CI
loudly until somebody intentionally runs `regenerate:goldens` and
reviewers sign off on the new baselines.

### Regenerating goldens

```sh
pnpm --filter @civica/snap-qc-engine regenerate:goldens
```

This script walks every fixture directory, re-runs the engine, and
rewrites `expected.json`. **CI never runs this.** It is invoked
intentionally by a human after a major bump, and the resulting diff is
expected to be reviewed line-by-line in the PR.

If you add a new fixture, write its `input.json` and `notes.md`
by hand, then run the regenerator once to create the initial
`expected.json`.

### What you must NOT do

- **Never hand-author `expected.json`.** It is always machine-generated.
  Hand-editing it lies about what the engine produces.
- **Never "fix" a failing fixture by regenerating it** unless the
  underlying change was an intentional, reviewed major bump. If a
  fixture fails and the engine change was not intentional, the engine
  has a bug — fix the engine.
- **Never delete a fixture without explicit review.** The fixture set
  describes the cases we promise §10105 reviewers we can defend.

## For reviewers (counsel, CDSS analysts)

If you're asking "how does Civica decide whether a SNAP case is
defensible?":

1. The score (`strong` / `moderate` / `weak`) is a deterministic function
   of the inputs. There is no model, no probability — every score traces
   back to a finite set of rules in
   `packages/snap-qc-engine/src/flows/<flow>/`.
2. Every score carries a list of `defensibility_factors` that name the
   exact reasons.
3. Every score carries `citations` pointing to the federal regulation
   (`7 CFR Part 273`) and state authority (`CA CDSS`, `MA DTA`) that
   govern the decision.
4. The scoring is frozen via 24+ canonical example cases. CI fails any
   PR that changes a score on a frozen case without intentional
   regeneration.

That last point is what makes the §10105 pitch survivable: the demo
numbers do not move between sprints unless somebody explicitly decides
they should.
