# BenefitsCal Form-Knowledge Tree — schema + capture protocol

`form-tree.json` is the **canonical, machine-readable representation of the entire
California BenefitsCal SNAP/CalFresh application** as the state presents it:
every question, its answer options, the help/explainer text the portal shows,
validation errors, and branch logic. It is the single source of truth that four
consumers derive from — do not maintain parallel copies:

1. **Extension autofill** — `selector` + `source` (packet path) + `options` per field.
2. **Agentic error recovery** — `errors[]` + `branches[]` let an agent understand and recover from a stuck page.
3. **iOS survey accuracy audit** — diff Civica's iOS intake questions/options against `questionText` + `options` + `helpText` here (does our intake match what the state asks? anything inaccurate/missing?).
4. **On-page AI chatbot grounding** (separate session) — `questionText` + `helpText` + `options` are the foundational prompt context: "here is how the state itself defines/explains this question, and what it recommends."

## Schema (`form-tree.json`)

```jsonc
{
  "meta": {
    "state": "CA", "program": "CalFresh", "portal": "BenefitsCal",
    "captured_at": "2026-05-29", "captured_via": "production CBO walk (VoteNow)",
    "step_count_snap_only": 8,            // 9 minus Assets (BBCE bypass)
    "navigation": "hub ABNAV -> Start (first enabled) -> section pages -> 'START THE NEXT SECTION' (section-complete page) -> hub -> next section unlocks"
  },
  "sections": [
    {
      "code": "your-information", "name": "Your Information", "order": 1,
      "pages": [ /* PageNode[] */ ]
    }
  ]
}
```

### PageNode
```jsonc
{
  "pageCode": "ABNMI",                    // 5-letter URL code, /ApplyForBenefits/ABNMI
  "urlPattern": "\\/ApplyForBenefits\\/ABNMI",
  "title": "What's your name?",           // page heading / primary prompt, verbatim
  "repeating": false,                     // true for per-member / per-income loops
  "repeatsOver": null,                    // e.g. "household_members" | "income_sources"
  "advanceButton": "Next",                // Next | CONTINUE | START THE NEXT SECTION | USE THIS ADDRESS
  "fields": [ /* FieldNode[] */ ],
  "helpLinks": [ /* HelpNode[] */ ],      // the explainer popovers — chatbot grounding
  "errors": [ /* ErrorNode[] */ ],
  "branches": [ /* BranchEdge[] */ ],
  "status": "captured",                   // captured | partial | discovered (needs capture)
  "notes": ""
}
```

### FieldNode
```jsonc
{
  "key": "first_name",                    // logical name (stable across walks)
  "questionText": "First Name (required)",// label verbatim
  "type": "text",                         // text | date-password | select | radio | checkbox | button
  "selector": { "label": "First Name (required)", "fallbackSelector": "#text1" },
  "required": true,
  "options": [ { "value": "34", "label": "Sacramento" } ],  // select/radio options verbatim
  "source": "first_name",                 // packet/BenefitsCalPayload path (autofill); null = human-fills
  "transform": null,                      // "ca-county-ordinal" | "phone-10digit" | null
  "notes": "positional id text1; prefer label"
}
```

### HelpNode (the explainer — capture verbatim)
```jsonc
{
  "trigger": "What is homelessness?",     // the visible link/'?' text that opens it
  "text": "<full popover/expander text, verbatim>",
  "kind": "popover"                       // popover | inline-expander | modal | video-link
}
```

### ErrorNode
```jsonc
{ "field": "mail", "message": "Please make sure the Email is a valid email format.", "trigger": "advance with invalid/empty value" }
```

### BranchEdge (page graph)
```jsonc
{ "whenField": "hshld_radiogrp", "whenValue": "Yes", "targetPage": "ABNMI(member)" }
```

## Capture protocol (per page, for every future walk)
For each page reached:
1. Record `pageCode` + `urlPattern` + `title` (verbatim heading/prompt).
2. Inventory every field → `FieldNode` (type, selector label + fallback id, required, full `options` verbatim for selects/radios).
3. **Open EVERY help link** on the page (`?`, "What is X?", "Why are we asking?", "How does … define …?") and capture its full text → `HelpNode`. This is mandatory (chatbot grounding).
4. Trigger validation (advance empty/invalid) to capture `errors[]` where they gate advancement.
5. Record `branches[]`: for each answer that changes the next page, note the edge. Capture each distinct page once; do not walk permutations.
6. Set `status`: `captured` (fields+help+branches done) / `partial` / `discovered` (URL known, content TODO).

## Honest coverage (2026-05-29): ~15% of the full tree
- `status: captured` with help-text: almost none (explainers not yet opened).
- Step 1: pages + most fields known (`partial` — missing help-text, errors, full options).
- People: gate + member sub-form template (`partial`).
- Household Details, Income, Expenses, Other Situations, Document Upload, Review: `discovered`/absent.

The seeded `form-tree.json` reflects this — captured nodes filled, known-but-unwalked pages stubbed `discovered`, help-text marked TODO so the gaps are explicit and the remaining walks have a checklist.
