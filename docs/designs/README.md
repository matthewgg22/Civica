# `docs/designs/` — Locked product + engineering + UI specs

This directory is the team-visible source of truth for major product and engineering decisions that have cleared CEO + Eng + Design review. Each file is the locked output of one (or more) review pipeline runs.

## What's here

| File | Type | Status |
|---|---|---|
| `cbo-saas-repositioning.md` | CEO plan — strategic positioning, sequencing, buyer, B2G timing | CLEAR (CEO review, 2026-05-26) |
| `dryrun-engine-spec.md` | Engineering design doc — architecture, IA, state matrix, semantic palette, async/cure/override specs, accessibility contracts | CLEAR (CEO + Eng + Design, 2026-05-27) |
| `dryrun-panel-mockups/` | iOS DryRunPanel mockups — 10 states × 3 visual directions + 1 transition sequence + `_shared.css` token defs + per-state pairing rationale in `approved.json` | CLEAR (Design review, browser-render audit) |
| `dryrun-panel-design-audit.md` | Browser-render audit report against the mockup set (`/design-review` output) | A / A grades, zero violations |
| `dryrun-panel-design-baseline.json` | Audit baseline for future `/design-review --regression` comparisons | — |

## How to consume

If you're implementing **T7 (iOS DryRunPanel)**: read `dryrun-engine-spec.md` for the full state behavior + semantic palette + a11y contracts, then open `dryrun-panel-mockups/index.html` in a browser for visual reference. Per-state V1/V2/V3 pairings are locked in `dryrun-panel-mockups/approved.json`.

If you're implementing **T1–T6 (engine core)**: `dryrun-engine-spec.md` has the architecture diagram + file layout + task list. The 10-task breakdown is in the spec doc under "Implementation Tasks."

If you're aligning **strategically**: `cbo-saas-repositioning.md` is the CEO plan with the 8 locked positioning decisions (sequencing, buyer, vs GetCalFresh, B2G timing, etc.).

If you're evaluating **whether design quality is regressing**: re-run `/design-review` against the mockups (or against a live impl when one exists) and compare against `dryrun-panel-design-baseline.json`.

## What's NOT here (intentionally)

Session-local artifacts that don't need to enter git history live in `~/.gstack/projects/matthewgg22-Civica/`:
- Per-skill task JSONLs (`tasks-eng-review-*.jsonl`, `tasks-design-review-*.jsonl`) — consumed by `/autoplan`
- Review log entries — consumed by `/ship` and the review readiness dashboard
- Checkpoints (`/context-save` outputs)
- Design audit screenshots (8 PNGs, ~2MB)

These are personal session state and survive across conversations without needing the team to review them.
