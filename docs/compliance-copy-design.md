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

---

# EBT cookie-handoff posture

**Status:** DRAFT pending counsel review (Phase 1 Lane E, plan `docs/plans/ebt-tracker-propel-parity.md` §4.3 / D4)
**Added:** 2026-05-22
**Scope:** EBT balance tracker only. Does NOT alter OBBBA compliance copy posture above.

This section documents the credential / session model Civica uses to retrieve real-time EBT balance + transaction data from `ebt.ca.gov` on a recipient's behalf. It is the in-tree companion to the standalone counsel briefing at `docs/snap/ebt-credential-posture-2026-05.md`.

## What we built (technical model)

1. **In-app WKWebView at `ebt.ca.gov`.** When a CalFresh recipient links their card, the iOS app opens an embedded WebView pointed at the official California EBT Client Web Portal (`www.ebt.ca.gov`). The recipient sees the real state portal chrome, URL bar, and TLS lock.
2. **Card + PIN entered locally.** The recipient types their 16-digit card number and 4-digit PIN directly into the portal's login form rendered inside the WebView. **The card and PIN never leave the device.** No Civica process, server, library, or log line touches them. The fields are not intercepted, key-logged, or persisted.
3. **Session cookie intercepted post-login.** On successful authentication, `ebt.ca.gov` issues a session cookie (and optionally a longer-lived "remember me" cookie). iOS captures these via `WKHTTPCookieStore` — the standard Apple API for reading cookies a web view receives.
4. **Cookie (NOT credential) shipped to Civica gateway.** iOS POSTs the captured cookie payload — and only the cookie — to `apps/enrollment-api/src/routes/ebt/link.ts`. The card number is hashed for de-duplication; the PIN is not transmitted.
5. **Cookie stored encrypted in Supabase Vault.** The gateway stores the cookie in the `ebt_cards.session_cookie_encrypted` column, encrypted at rest via Supabase Vault (KMS-backed). The decryption key lives in a Fly secret accessible only to the scraper machine.
6. **Fly scraper replays cookie until expiry.** A separate `fly/ebt-scraper/` service (Playwright in a Fly machine, auto-stopped between runs) loads the cookie into a headless browser, fetches the recipient's balance + transactions page, parses, and emits typed events to `/webhooks/ebt-scraper`.
7. **On cookie expiry: re-link push.** When the cookie returns an expired-session response, the scraper emits `sessionExpired`. The gateway fans out an APNs push: "Your EBT card link has expired — tap to re-connect." The recipient taps, the WebView opens, they log in again, and we capture a fresh cookie. **At no point do we store, transmit, or replay their PIN.**

## Why this differs from "credential storage"

This posture is materially different from the model most consumers of recipient-facing EBT data have historically used, including (per `docs/plans/ebt-tracker-propel-parity.md` CMT-1) Propel's earlier-generation product:

- **We hold an expiring session token, not a credential.** A session cookie is an authentication artifact, not the authentication factor. It auto-expires (hours to days, depending on portal policy — Phase 1 Lane B PoC measures the exact lifetime). A PIN is permanent until the recipient changes it via the state portal.
- **Session tokens are the standard pattern in modern web auth.** OAuth bearer tokens, OIDC refresh tokens, and conventional web session cookies all follow this "token, not password" pattern. Terms-of-service treatment of expiring tokens differs from treatment of stored passwords/PINs in most case law and consumer-protection guidance we've reviewed.
- **ATO blast radius is bounded.** If Civica's Supabase Vault is fully compromised (worst-case ATO), the attacker obtains expiring cookies — not PINs. The cookies expire on the portal's own timer; the attacker cannot use them to log in again after expiry, cannot change the recipient's PIN, and cannot drain the EBT card balance directly (the portal is read-only on balance data).
- **User retains direct revocation control.** A recipient who suspects compromise can sign out at `ebt.ca.gov` directly, which invalidates our cookie server-side immediately. They do not need to delete the Civica app or contact Civica support to cut access.
- **Civica cannot impersonate at the credential layer.** Because we never see the PIN, Civica engineers, support staff, and any compromised Civica system cannot log in as the recipient from scratch. We can only replay the active cookie we already hold.

## State portal ToS analysis

We acknowledge:

- `ebt.ca.gov`'s terms of service likely contain general prohibitions on "automated access" and "scripting." Most state benefit portals do.
- Cookie-handoff is a meaningfully different posture than the "scrape with stored credentials" pattern those terms were typically written to prevent. The recipient initiated authentication in the official portal UI; we replay the resulting session on their explicit, in-app-disclosed behalf.
- Some state portal ToS distinguish between "user-agent automation" (e.g., browser extensions assisting the logged-in user) and "credential-based automation" (e.g., a third party logging in unattended). Cookie replay sits closer to the former.

**Action items for counsel:**

1. Review CDSS / California EBT portal ToS (current at `ebt.ca.gov/terms` or as referenced by CDSS public materials) specifically.
2. Identify whether cookie-replay-on-user's-behalf falls under any accessibility / user-agent / personal-representative provisions.
3. Identify whether CDSS / state agency notification is required before launch.
4. Identify any benefit-recipient-specific ToS overlays (CA EBT recipient handbook, CalFresh program rules) that elevate the standard above generic state-portal ToS.

Counsel guidance gates production rollout, not Phase 1 development work. Lane B's PoC may surface facts (e.g., portal explicitly blesses or explicitly forbids cookie replay) that reshape the analysis.

## First-link consent disclosure copy

The iOS app's first-link screen — the screen the recipient sees before the WebView opens — must explicitly disclose the model. The following draft copy is the engineering proposal; counsel sign-off on the EN + ES wording lands in the dedicated counsel briefing (`docs/snap/ebt-credential-posture-2026-05.md` §6). Final approved copy will be wired into `Strings/EBTBalanceStrings.swift` once counsel returns.

### Draft consent text — English

> **Connect your CalFresh EBT card**
>
> You're about to sign in to California's official EBT portal (`ebt.ca.gov`) inside Civica. Your card number and PIN stay on this device — Civica never sees them and never stores them.
>
> When you sign in, Civica saves a short-lived session token so we can refresh your balance and transactions for you in the background. Your token expires automatically. When it does, we'll send you a notification to re-connect — you'll enter your card and PIN again, and the same protections apply.
>
> You can disconnect at any time by signing out at `ebt.ca.gov`, by turning off card link in Civica settings, or by uninstalling the app. Disconnecting at `ebt.ca.gov` stops Civica from refreshing your balance immediately.

### Draft consent text — Spanish

> **Conecte su tarjeta EBT de CalFresh**
>
> Está a punto de iniciar sesión en el portal oficial de EBT de California (`ebt.ca.gov`) dentro de Civica. Su número de tarjeta y su PIN se quedan en este dispositivo — Civica nunca los ve ni los guarda.
>
> Cuando inicie sesión, Civica guarda un token de sesión de corta duración para poder actualizar su saldo y sus transacciones por usted en segundo plano. Su token caduca automáticamente. Cuando esto suceda, le enviaremos una notificación para volver a conectarse — ingresará su tarjeta y su PIN nuevamente, y aplican las mismas protecciones.
>
> Puede desconectarse en cualquier momento cerrando sesión en `ebt.ca.gov`, desactivando la conexión de la tarjeta en la configuración de Civica, o desinstalando la aplicación. Cerrar sesión en `ebt.ca.gov` detiene inmediatamente que Civica actualice su saldo.

Each paragraph maps to a required disclosure:

1. **Paragraph 1** — We never see the PIN. (Distinguishes us from credential-storage products.)
2. **Paragraph 2** — We periodically refresh balance on your behalf using a session token that expires. (Discloses the automation; sets expectation for re-link prompts.)
3. **Paragraph 3** — You control revocation by three independent paths (`ebt.ca.gov` sign-out, in-app toggle, uninstall). (CCPA-style disclosure of access controls.)

The two-language requirement (EN + ES at parity) follows the EBT module convention: every CivicaString in EBT* namespaces must populate both `.en` and `.es`, and `EBTStringParityTests` will block merge if either is missing.

## Cross-references

- Full counsel briefing: `docs/snap/ebt-credential-posture-2026-05.md`
- Technical plan: `docs/plans/ebt-tracker-propel-parity.md` §4.3 (decision D4) and §16.2 (scrape-error wire format)
- iOS layering conventions: root `CLAUDE.md` § "EBT module conventions"
- TODO: ongoing counsel batch reference is `TODOS.md` TODO-10
