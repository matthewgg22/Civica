# SNAP "What I can do today" checklist — content brief

## Goal
Replace JR-1's placeholder copy (shipped in PR #392) with CBO-advisor-validated content. Each item must reduce anxiety + give the user something concrete to do during the highest-anxiety stretch of the SNAP application lifecycle (days 5-30 post-submission).

## Reviewers requested
- A CalFresh navigator at Project Bread (or equivalent CA CBO)
- A reviewer familiar with Dave Guarino's GetCalFresh work (memory: reference_dave_guarino)
- Bilingual reviewer for Spanish parity (every item must work in EN + ES; reviewer flags clunky translations)

## Constraints (set by the audit, non-negotiable)
- Max 5 items per status. Audit doc: "keep the checklist UNDER 5 items."
- Title is "Things you can do today" — never "Things you must do." No urgency framing per DESIGN.md §10.3.
- Each item is a tap-to-toggle checkbox; checked state persists via @AppStorage.
- Items are non-blocking — checking them all isn't required for anything.
- Each item must be specific + concrete (not "Stay informed" or "Take care of yourself").

## Draft items per status (PLACEHOLDER — review needed)

### .submittedToState (Day 1-7)

| # | Item (EN) | Item (ES) | Rationale | Reviewer notes |
|---|-----------|-----------|-----------|----------------|
| 1 | Gather a backup pay stub (PDF or photo) | Reúne un comprobante de pago de respaldo (PDF o foto) | Counties often ask for income docs after submission; having one ready cuts the documents-requested delay | |
| 2 | Save your county SNAP number to your phone | Guarda el número de SNAP de tu condado en tu teléfono | If the case stalls, the user can call directly | |
| 3 | Look up your case's expected timeline | Busca el cronograma esperado de tu caso | Reduces "is anything happening?" anxiety; links to CA's typical 30-day standard | |
| 4 | Set a calendar reminder for day 30 | Programa un recordatorio en el calendario para el día 30 | If no decision by then, the user knows to follow up vs. silently wait | |
| 5 | Save the BenefitsCal login on your phone | Guarda el inicio de sesión de BenefitsCal en tu teléfono | When the county asks for docs, faster upload = faster decision | |

### .documentsRequested

| # | Item (EN) | Item (ES) | Rationale | Reviewer notes |
|---|-----------|-----------|-----------|----------------|
| 1 | Open your inbox to see what's needed | Abre tu bandeja de entrada para ver lo necesario | Action: read the request before deciding what to do | |
| 2 | Gather every requested document, even drafts | Reúne todos los documentos solicitados, incluso borradores | Bundling beats one-at-a-time | |
| 3 | Upload via the state portal — counties accept clear photos | Sube por el portal estatal — los condados aceptan fotos claras | Photos are valid; reduces "I need to scan" friction | |
| 4 | Save your county case number | Guarda el número de caso de tu condado | For follow-up calls | |
| 5 | If you can't find a doc, message a navigator | Si no encuentras un documento, contacta un asesor | Most missing docs have workarounds; navigators know them | |

### .interviewScheduled

| # | Item (EN) | Item (ES) | Rationale | Reviewer notes |
|---|-----------|-----------|-----------|----------------|
| 1 | Test your phone audio | Prueba el audio de tu teléfono | Interview-by-phone is most common; bad audio = re-schedule = delay | |
| 2 | Have your documents nearby (you can read from them) | Ten tus documentos cerca (puedes leerlos en voz alta) | You're allowed to have notes; reduces interview anxiety | |
| 3 | Charge your phone the night before | Carga tu teléfono la noche anterior | Interviews can run 30+ min; mid-call cutoffs require re-scheduling | |
| 4 | Set an alarm for 15 minutes before | Programa una alarma 15 minutos antes | Better than missing the window | |
| 5 | Have a quiet space planned | Planea un lugar tranquilo | Interviewers ask follow-ups; you'll need to think clearly | |

### .interviewCompleted

| # | Item (EN) | Item (ES) | Rationale | Reviewer notes |
|---|-----------|-----------|-----------|----------------|
| 1 | Save your case number — you'll need it for any follow-up | Guarda el número de caso — lo necesitarás para seguimiento | Reduces "where did I see that number" friction | |
| 2 | Set a calendar reminder for day 30 | Programa un recordatorio en el calendario para el día 30 | Standard decision window — if nothing arrives by then, time to call | |
| 3 | Look up your county's appeal window (90 days in CA) | Busca el plazo de apelación de tu condado (90 días en CA) | If denied, knowing the window in advance preserves the option | |
| 4 | Keep the BenefitsCal login on your phone | Mantén el inicio de sesión de BenefitsCal en tu teléfono | Decision letter posts there | |
| 5 | Note when you can re-apply if denied | Anota cuándo puedes volver a solicitar si te niegan | Most denials are appealable + re-applicable; knowing the timeline reduces despair | |

## Reviewer instructions

For each item:
- **Approve as-is** (initials + date)
- **Revise** (red-line below the item with the new copy)
- **Cut** (strike-through + reason: not applicable to CA / wrong tone / not actionable enough)
- **Add** (write the proposed item in the same format)

For Spanish parity:
- Does the ES match the EN in tone + specificity? (not just literal translation)
- Any clunky phrasing? Native speakers flag.
- Verb forms — "tú" form is set; verify each item.

Return signed brief to: `docs/specs/daily-checklist-content-approved.md` (delete the unchecked draft items + only commit approved + revised items).

## Out of scope for this brief
- Adding new statuses (the audit's checklist is per-status; new statuses get new items)
- Changing the visual design (PR #392 owns the layout)
- Adding interaction patterns (link-outs to specific actions, deep-links, etc.) — that's a future enhancement

## References
- Audit: `docs/audits/civica-ios-product-audit-2026-05-29.md` (Pass 7 UD-2 + Pass 3 JR-1)
- Shipped component: PR #392 (placeholder copy lives in `SNAPDailyChecklistCard.swift`)
- Dave Guarino reference: memory `reference_dave_guarino`
- Project Bread reference: memory note about MA-first CBO partnership
- DESIGN.md §10.3: no urgency framing rule
