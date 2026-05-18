# Compliance Copy Package Design

**Status:** LOCKED 2026-05-18 via /plan-eng-review T6 design pass
**Pattern:** Custom JSON source-of-truth + codegen to Swift + typed TS import
**Owner:** Coordinator session (claude/clever-albattani-816917)
**Scope:** OBBBA compliance copy ONLY (Q1–Q19 + banned phrases + status). NOT full-app i18n.

## Summary

OBBBA compliance copy currently lives only in `Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`. Extract to a typed package `@civica/snap-compliance-copy` whose source of truth is JSON files. Codegen produces Swift literals for iOS at build time; web surfaces (dashboard, future state-audit) import as typed TS. Compliance metadata (CFR citations, OBBBA section, counsel review status, banned phrases) lives alongside the strings — same file, one source.

## JSON shape (one file per question)

`packages/snap-compliance-copy/data/q01-abawd-exemption.json`:

```json
{
  "id": "Q1",
  "topic": "ABAWD tribal exemption",
  "obbba_section": "§10102(a)",
  "cfr_citation": "7 CFR 273.7(s)",
  "status": "approved",
  "counsel_review": {
    "reviewer": "name or org",
    "date": "2026-05-12",
    "notes": "any nuances"
  },
  "copy": {
    "intro": {
      "en": "...",
      "es": "..."
    },
    "detail": {
      "en": "...",
      "es": "..."
    },
    "source_citation_display": {
      "en": "7 CFR 273.7(s) — Tribal exemption",
      "es": "7 CFR 273.7(s) — Exención tribal"
    }
  },
  "banned_phrases": ["public charge", "deportation risk"],
  "last_reviewed": "2026-05-12"
}
```

Plus shared registries:
- `packages/snap-compliance-copy/data/_banned-phrases.json` — global list, status flags
- `packages/snap-compliance-copy/data/_pending-revisions.json` — items awaiting counsel sign-off

## Package layout

```
packages/snap-compliance-copy/
├── data/                                       # source of truth (JSON)
│   ├── q01-abawd-exemption.json
│   ├── q02-...
│   ├── ...
│   ├── q19-...
│   ├── _banned-phrases.json
│   └── _pending-revisions.json
├── src/
│   ├── index.ts                                # exports typed registry + helpers
│   ├── schemas.ts                              # Zod schemas; CI-validates every JSON file
│   └── types.ts                                # exported TS types
├── scripts/
│   ├── generate-swift.ts                       # JSON → SNAPComplianceCopyRegistry+Generated.swift
│   └── validate-all.ts                         # CI: parse every JSON against schema
├── test/
│   ├── schema-validation.test.ts               # asserts every data/*.json parses
│   ├── swift-codegen-stability.test.ts         # snapshot of generated Swift
│   └── parity.test.ts                          # asserts current Swift literals match JSON
└── package.json
```

## Build pipeline

```
data/q01.json ──┐
data/q02.json ──┤
...             ├─▶ scripts/generate-swift.ts ──▶ Civica/Features/SNAP/Generated/
data/q19.json ──┤                                  SNAPComplianceCopyRegistry+Generated.swift
                │                                  (git-tracked; CI verifies up-to-date)
                │
                └─▶ src/index.ts (typed TS export for web consumers)
```

- Build script runs in pre-commit + CI.
- Generated Swift is git-tracked (so Xcode builds don't depend on the codegen runtime).
- CI test asserts `git diff` is clean after running the generator — catches drift.

## iOS consumption

After T6 lands, `Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift` becomes a thin wrapper that imports the generated file:

```swift
// SNAPComplianceCopyRegistry.swift — thin wrapper
public enum SNAPComplianceCopyRegistry {
    public static let all = SNAPComplianceCopyRegistry_Generated.all
    public static func copy(for id: String, locale: SNAPLocale) -> ComplianceCopy? {
        all[id]?.localized(locale)
    }
}
```

All iOS call sites continue to work unchanged. The original hand-authored strings become test fixtures in `parity.test.ts` (asserts JSON output matches what was there before).

## Web consumption

Dashboard + future state-audit surface:

```typescript
import { complianceCopy } from '@civica/snap-compliance-copy';

const q1 = complianceCopy.get('Q1');
// { id: 'Q1', obbba_section: '§10102(a)', cfr_citation: '7 CFR 273.7(s)', ... }

<ComplianceNarrative
  text={q1.copy.detail[locale]}
  citation={q1.copy.source_citation_display[locale]}
  status={q1.status}
/>
```

State-audit dashboard (T5) renders the same narrative + citation chain that iOS shows applicants — single source guarantees parity.

## Migration plan

1. **Inventory.** Parse current `SNAPComplianceCopyRegistry.swift`. Extract each Q's strings + metadata into a draft JSON per question.
2. **Validate.** Zod schema parses every draft JSON. Fix any structural inconsistencies (some questions may have fields others don't — normalize).
3. **Codegen.** Write `generate-swift.ts`. Run it. Diff generated output against current Swift literal-by-literal.
4. **Parity test.** Snapshot test asserts byte-identical output (or semantically equivalent — e.g., escape-sequence normalization).
5. **Wire iOS to generated file.** Update `SNAPComplianceCopyRegistry.swift` to wrap generated. Xcode build still passes.
6. **Wire web consumer (proof-of-life).** Add a `ComplianceNarrative` component to dashboard rendering Q1. Behind a feature flag.

## Constraints & conventions

- One JSON file per question (`qNN-{slug}.json`); shared registries prefixed `_`.
- IDs (`Q1`, `Q2`, ...) match the Swift constants exactly.
- Locale keys: `en`, `es`. Adding a locale = adding a key; no schema change.
- All strings UTF-8. Apple-curly-quotes / em-dashes preserved literally.
- Generated Swift goes in `Civica/Features/SNAP/Generated/` — added to .gitignore? **No.** Track in git so Xcode and CI don't need Node available. Add CI step that re-runs generator and asserts no diff.
- Status enum: `approved | pending_counsel | needs_revision`. Surfaces can color-code or gate display on this.

## What this design does NOT include (deferred)

- **Full-app i18n.** Only compliance copy. Other Swift strings stay in iOS.
- **Per-tenant copy overrides.** No tenant flavoring of compliance narrative in MVP (and probably ever — compliance copy is federally regulated, not per-tenant).
- **Editorial workflow UI.** Counsel reviews JSON files via PRs for MVP; CMS UI deferred.
- **Pluralization / ICU MessageFormat.** Not needed for static narrative; promote if interpolation needs arise.
- **Runtime locale switching with hot-reload.** Build-time bake is fine; iOS doesn't need it.

## Sign-off

Locked in `/plan-eng-review` coordinator session 2026-05-18. T6 design deliverable complete. Spawned T6 build session consumes this document as authoritative spec.
