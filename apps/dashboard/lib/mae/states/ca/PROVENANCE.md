# California pack — provenance

**Created:** 2026-08-04 (Wave 0 of the state-pack refactor — `docs/plans/mae-state-corpus-framework.md`).
**Method:** programmatic extraction from the Mae TS sources (`retrieval.ts`, `citation-verifier.ts`,
`freshness.ts`), byte-faithful — content was NOT retyped or edited in the move. SHA1s of each
supplement text at extraction time are recorded in the Wave 0 commit message.

## Content lineage (who verified what, and when)

| Item | Original authorship | Verification |
|---|---|---|
| `abawd-current-rules` | PR #581 (A1), corrected in #589 (CA fixed 36-month clock ended 2025-12-31; workfare math; unfitness standard; age-65 state fork) | Source: R012680 CPRA production (ABAWD Fact Sheet Mar 2026, CF 886 rev 8/25, CDSS ABAWD policy deck); adversarial fact-check in #589 |
| `verification-limits` | PR #581 (A2), re-anchored in #589 (ACL 21-58 → MPP 63-300 / ACL 20-48 / 20-135 / 21-24 / ACIN I-45-11 after the ME-corpus audit showed ACL 21-58 is a student-exemption cite) | CDSS Management Evaluation corpus (38 county reports, R012681) |
| `cf886-decoder`, `qc-element-glossary`, `negative-action-validity` | PR #593 (A5–A7) | Workflow fact-check against CF 886 rev 8/25 + FNS Handbook 310: **6 errors found and corrected pre-merge** (excused-line section qualifier; waiver "box"→pre-printed paragraph; elements 321/323 are deductions not income; QC samples rather than reviews every action; preferred-language rule is CA MPP law, not FNS 310) |
| `ebt-operational`, `eligible-foods` | pre-#581 curated authorities (CA phone number / AB 942 RMP note) | unchanged since introduction |
| `authorities.json` ACL/ACIN + MPP sets | #581/#589/#593 | ME-corpus citation frequency audit (#589) |
| `freshness.json` ABAWD dates | #581 (P1 A4) | CDSS ACL 25-93 |

## Refresh triggers
- New CDSS ACL/ACIN on ABAWD, verification, or SUA → update the affected supplement + freshness entry.
- ABAWD waiver-window end (2026-10-31) → re-confirm county waiver list.
- Annual October COLA → SUA values (held in engine params, not this pack) + any dollar figure quoted in supplement text.
