import Foundation

// Central staging area for OBBBA-audit compliance copy. Two things
// live here.
//
// Launch-state note (2026-05-13): California is the launch state.
// Banned-phrase rules and pending-revision rationales originally
// authored against MA DTA apply equally to CA's CDSS / BenefitsCal
// equivalents — the registry must hold the CA bar before any
// CA-portal-naming string ships in user-visible copy. Counsel
// sign-off for the 9 pending revisions below is expected to cover
// both states in one batch rather than landing en/CA-en first.
//
//   1. `bannedPhrases` — substrings that must not appear anywhere
//      in SNAP user-facing strings. Authoritative list with audit
//      references so future PRs can add new rows in one place
//      instead of sprinkling phrases through test files.
//
//   2. `pendingCopyRevisions` — the Revision 2 §6 string-by-string
//      table. Each row records the current production copy, the
//      proposed approved replacement (nil until counsel signs),
//      and the audit reference. When counsel signs row N, that
//      row's `approved` slot is filled and the production view
//      can opt in by reading from `approvedCopy(for:)`.
//
// Per OBBBA audit Q3 (Revision 2): central registry so swapping in
// approved strings is a config flip, not a sweep across many files.

enum SNAPComplianceCopyRegistry {

    // MARK: - Banned phrases (audit-blocked substrings)

    struct BannedPhrase: Equatable {
        /// Stable identifier; never renamed once landed so audit
        /// reports can cross-reference it.
        let id: String
        /// Case-insensitive substring that must not appear in any
        /// SNAP user-facing string. The match check should lowercase
        /// both sides; the stored phrase is the canonical form.
        let phrase: String
        /// OBBBA audit reference (e.g. "Q14", "Q2").
        let auditReference: String
        /// Why this phrase is banned — non-empty so a reviewer can
        /// understand the rule without leaving this file.
        let rationale: String
    }

    /// Authoritative list. Tests iterate this; production code
    /// doesn't read it directly.
    ///
    /// Scope rule: a phrase lands here only when it has zero
    /// legitimate use anywhere in the SNAP feature tree -- doc
    /// comments, technical strings, cost annotations, and
    /// localized help text all count as "anywhere." Narrower
    /// per-surface rules (e.g. "WIC teaser must not foreground
    /// a dollar amount") live in dedicated tests rather than
    /// here, since they only forbid the phrase in a single file.
    static let bannedPhrases: [BannedPhrase] = [
        BannedPhrase(
            id: "submit_to_dta",
            phrase: "Submit to DTA Connect",
            auditReference: "Q14",
            rationale: "Implies a Civica->DTA write integration that does not exist without written MA DTA authorization. Use 'Open MA DTA Connect to submit' until authorization is confirmed and an integration ships."
        ),
        BannedPhrase(
            id: "submit_to_benefitscal",
            phrase: "Submit to BenefitsCal",
            auditReference: "Q14 (CA launch parallel)",
            rationale: "Implies a Civica->BenefitsCal/CDSS write integration that does not exist without written authorization from CDSS or the user's county welfare department. Use 'Open BenefitsCal to submit' until authorization is confirmed and an integration ships. Parallels the MA DTA Connect ban; CA is the launch state so the bar applies before user-visible surfaces ship."
        )
    ]

    // MARK: - Pending copy revisions (Revision 2 §6 table)

    /// Lifecycle of a copy row staged for counsel review.
    enum RevisionStatus: Equatable {
        /// Counsel has not yet signed the proposed replacement. The
        /// production string remains in use; tests assert the
        /// current copy still matches what's in production.
        case pendingSignoff
        /// Counsel has approved the replacement. The production
        /// view should be wired to read from this registry, and
        /// the test asserts the production string equals `approved`.
        case approved
    }

    struct PendingCopyRevision: Equatable {
        /// Stable identifier for the row.
        let id: String
        /// File where the affected string lives (display only;
        /// makes the registry human-scannable).
        let surfaceFile: String
        /// The string constant name within that file.
        let stringID: String
        /// The current production copy (English).
        let currentEnglish: String
        /// Proposed replacement (English). Nil until counsel signs.
        let approvedEnglish: String?
        /// Proposed replacement (Spanish). Nil until counsel signs.
        /// Spanish parity is required before flipping to `.approved`.
        let approvedSpanish: String?
        /// OBBBA audit reference.
        let auditReference: String
        /// What's wrong with the current copy.
        let rationale: String
        /// Status — toggled to `.approved` by the PR that lands the
        /// signed strings.
        let status: RevisionStatus
    }

    /// Each row from Revision 2 §6 table. Until counsel signs, all
    /// rows are `.pendingSignoff` and `approvedEnglish`/`approvedSpanish`
    /// are nil. When a row is signed, the PR that fills the approved
    /// strings also flips status to `.approved`.
    // Draft replacements sourced from civica_compliance_outreach.xlsx (2026-05-18).
    // All rows remain .pendingSignoff — production views return nil until counsel
    // fills column F of the spreadsheet and the PR flips status to .approved.
    // When counsel signs a row, the only change needed is: status: .approved.
    static let pendingCopyRevisions: [PendingCopyRevision] = [
        PendingCopyRevision(
            id: "approval_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.subject",
            currentEnglish: "Approved. ${monthlyBenefit}/mo, starting this month.",
            approvedEnglish: "Your SNAP application: eligibility determination complete",
            approvedSpanish: "Su solicitud de SNAP: determinación de elegibilidad completada",
            auditReference: "Q3",
            rationale: "Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "decision_approved_headline",
            surfaceFile: "SNAPDecisionApprovedView.swift",
            stringID: "SNAPDecisionApprovedStrings.headline",
            currentEnglish: "You're approved.",
            approvedEnglish: "You have been determined eligible for SNAP benefits.",
            approvedSpanish: "Se ha determinado que usted es elegible para recibir beneficios de SNAP.",
            auditReference: "Q3 (boundary)",
            rationale: "Attributes the state agency's determination to Civica. Replace with state-attributed phrasing.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "expedited_banner_almost",
            surfaceFile: "SNAPExpeditedBanner.swift",
            stringID: "almostHeadline",
            currentEnglish: "Almost — one more answer could speed this up",
            approvedEnglish: "You may qualify for expedited SNAP benefits — answer one more question to check.",
            approvedSpanish: "Es posible que califique para beneficios expeditados de SNAP. Responda una pregunta más para verificar.",
            auditReference: "Q3 / Q2.4",
            rationale: "Gamification of a regulatory eligibility category. Reframe to attribute expedited criteria to 7 CFR 273.2(i).",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_entry_subtitle",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "entryCardSubtitle",
            currentEnglish: "Five questions. See your monthly dollar amount before you apply.",
            // [Agency] is substituted at runtime: CalFresh (CA) or DTA (MA).
            approvedEnglish: "Answer a few questions to estimate your potential SNAP eligibility. Results are estimates only — actual eligibility is determined by [Agency].",
            approvedSpanish: "Responda algunas preguntas para estimar su posible elegibilidad para SNAP. Los resultados son estimaciones únicamente; la elegibilidad real es determinada por [Agencia].",
            auditReference: "Q3 / Q2.3",
            rationale: "Pairs ease cue with incentive cue connected to applying. Reframe as a screening estimate.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_apply_cta",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "applyCTA",
            currentEnglish: "Apply for SNAP",
            // State-parameterized: CA → "Apply on BenefitsCal", MA → "Apply on DTA Connect".
            // Call site must select the correct value via SNAPAgencyDirectory.state.
            approvedEnglish: "Apply on BenefitsCal",
            approvedSpanish: "Solicitar en BenefitsCal",
            auditReference: "Q3 / Q2.3",
            rationale: "Generic 'Apply for SNAP' CTA without official-link attribution; should route via the state apply portal (e.g. 'Open BenefitsCal application' for CA, 'Open MA DTA Connect application' for MA) or similar neutral path. CA-portal naming requires the same counsel sign-off MA's did.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "doc_requested_sms_body",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "documentRequestedSMS.body",
            currentEnglish: "DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.",
            approvedEnglish: "Your SNAP application requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app.",
            approvedSpanish: "Su solicitud de SNAP requiere documentación adicional. Envíe un talón de pago reciente antes del {deadline}. Puede responder a este mensaje con una foto o cargarlo en la aplicación.",
            auditReference: "Q3",
            rationale: "'Keeps your application moving' is loss-aversion framing. Reframe as factual deadline.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_one_day_sms",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertOneDayBeforeSMS.body",
            currentEnglish: "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time.",
            // [Portal] is substituted at runtime: BenefitsCal (CA) or DTA Connect (MA).
            approvedEnglish: "Your SNAP recertification is due {recertDate}. To recertify, visit [Portal] or text RECERT for a link.",
            approvedSpanish: "Su recertificación de SNAP vence el {recertDate}. Para recertificar, visite [Portal] o escriba RECERT para recibir un enlace.",
            auditReference: "Q3",
            rationale: "Urgency + ease + loss-aversion stacked. Reframe as factual deadline with consequence stated neutrally.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_heads_up_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertHeadsUpEmail.subject",
            currentEnglish: "Recertify in 60 days. Usually 4 minutes.",
            approvedEnglish: "SNAP recertification required — deadline in 60 days",
            approvedSpanish: "Recertificación de SNAP requerida — fecha límite en 60 días",
            auditReference: "Q3",
            rationale: "Ease framing tied to recertification. Reframe to factual deadline only.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "ebt_pin_cta",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.buttonLabel",
            currentEnglish: "Set the EBT PIN",
            // State-parameterized: CA → ebt.ca.gov, MA → ebtedge.com.
            // Call site must select the correct value via SNAPAgencyDirectory.state.
            approvedEnglish: "Set your EBT PIN at ebt.ca.gov",
            approvedSpanish: "Establezca su PIN de EBT en ebt.ca.gov",
            auditReference: "Q3",
            rationale: "Implies Civica performs the PIN action. Reframe as 'Learn how to set your EBT card PIN' linking to official EBT/DTA instructions.",
            status: .pendingSignoff
        )
    ]

    /// Lookup helper for production views opting into the registry.
    /// Returns the counsel-approved English replacement when the
    /// row's status is `.approved`; nil otherwise. Production code
    /// can use `?? <current production string>` to fall back to
    /// the in-tree copy until counsel signs.
    static func approvedEnglish(for id: String) -> String? {
        guard let row = pendingCopyRevisions.first(where: { $0.id == id }),
              row.status == .approved else { return nil }
        return row.approvedEnglish
    }

    /// Spanish-parity companion to `approvedEnglish`.
    static func approvedSpanish(for id: String) -> String? {
        guard let row = pendingCopyRevisions.first(where: { $0.id == id }),
              row.status == .approved else { return nil }
        return row.approvedSpanish
    }
}
