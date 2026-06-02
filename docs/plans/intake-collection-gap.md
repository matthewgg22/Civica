# SNAP intake — collection gap for the Eligibility & Integrity Engine

**Status:** spec · **Date:** 2026-06-01 · **Companion:** [snap-rules-matrix.md](snap-rules-matrix.md)

The shadow sweep proved the engine runs on live data, but it returns `pending` for **every** real packet because the intake doesn't collect what the engine needs. This is the exact list to add. Source of truth for "what's needed" is the engine's `Household` model ([rules/interfaces.py](../../backend/civic_api/snap/rules/interfaces.py)); source for "what's collected" is the live audit (`packet_answers`) + the adapter's `needs[]`.

## What's collected today

~84 of 322 packets carry any answers; the richest carry **six coarse fields**: `household_size`, `employment_status`, `monthly_income`, `monthly_rent`, `has_children`, `has_disability` (utilities on 1 packet, housing_situation on 2). All aggregate/household-level — nothing per-member.

## What the engine needs — ordered by blocking severity

| # | Field(s) to collect | Engine input | Why | Severity |
|---|---|---|---|---|
| 1 | **Per-member age** (one row per member) | `HouseholdMember.age` (required, no default) | A member can't even be constructed without it → no `Household` at all | **HARD BLOCKER** |
| 2 | **Per-member citizenship** | `HouseholdMember.citizenship` | The citizenship test (7 CFR 273.4); defaults `UNKNOWN` otherwise | High |
| 3 | **Income: earned vs unearned + source type** | `IncomeSource.is_earned`, `source_type`, `member_id` | The 20% earned-income deduction + net-income test depend on it; today only an aggregate gross is collected | High |
| 4 | **Shelter detail: utilities / SUA tier** (+ property tax & insurance for owners) | `ExpenseFacts.utilities_actual` / `sua_tier` | Shelter deduction drives ~44% of dollar-weighted error; near-zero coverage today | High |
| 5 | **Elderly flag (age ≥ 60)** — falls out of #1 | `HouseholdMember.is_elderly` | Unlocks the medical deduction + uncapped shelter; **not collected at all today** (only `has_disability`). Pillar finding [#417](../findings/2026-05-31-per-element-error-regression.md) (elderly × shelter 3.6×) lives here | High |
| 6 | **Deduction inputs:** dependent care, out-of-pocket medical (elderly/disabled), child support paid | `ExpenseFacts.dependent_care` / `medical_*` / `child_support_paid` | Accuracy of the benefit amount | Medium |
| 7 | **Assets / countable resources** | `AssetFacts.countable_resources` | **Not needed for CA/MA** — both waive the asset test under BBCE/MCE (see note). Collect only when expanding beyond BBCE states | Low (for CA/MA) |
| 8 | Student status, ABAWD/work-registration | `HouseholdMember.student_status` / `is_abawd` | Edge determinations; safe defaults exist | Low |

## The minimum viable add (flips packets off `pending` for CA/MA)

Because **both launch states waive the asset test** (CA MCE, MA BBCE — see `asset_limit_waived_*` in the engine), the smallest set that produces real determinations is:

> **Per-member age + per-member citizenship.** (Income and rent are already partially collected.)

With those two, a CA/MA packet has everything the gross-income (200% FPL), net-income, citizenship, and student tests need — the asset test is waived, so assets aren't determinative. Items 3–6 then improve **accuracy** (especially the benefit amount and the shelter/elderly path), not determinability.

## Data-model implication

`packet_answers` is flat key/value with a unique `(packet_id, question_key)` constraint — so **repeated per-member entities** (each member's age + citizenship) need either a JSON-array value under one key (e.g. `household_members`) or a key convention (`member_1_age`, `member_1_citizenship`, …). The adapter must be extended to read whichever shape you choose; today it has no per-member path because there's no per-member data.

## Provenance comes for free

New fields inherit the existing provenance machinery: `packet_answers.answer_source` already distinguishes `applicant_input` / `ocr_extraction` / `navigator_entry`, which the adapter maps to `self_reported` / `extracted` / `verified`. Every new field automatically carries its trust status into the determination's `facts_snapshot`.

## Where the change lands

- Question definitions: `apps/enrollment-api/src/lib/questions.ts` (the TS gateway intake vocabulary).
- iOS intake UI: `Civica/Features/SNAP/…` draft/intake screens.
- Adapter: extend [adapter.py](../../backend/civic_api/snap/shadow/adapter.py) with the per-member construction path (guarded today; activate when per-member rows exist).

## Acceptance

After collection lands, `python -m civic_api.snap.shadow.sweep` (dry-run) should show determinations flipping from `pending` to `eligible` / `ineligible` for packets that now carry per-member ages + citizenship — and the `needs` histogram should shrink to items 6–8.

> Independent of intake: the engine also needs the **FY2026 reference tables loaded** ([poverty_guidelines.py](../../backend/civic_api/snap/rules/poverty_guidelines.py) has FY2025 only) before any 2026-dated determination resolves — see [snap-rules-matrix.md §7](snap-rules-matrix.md) and the FY26 staging note.
