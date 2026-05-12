import Foundation

// Central staging area for OBBBA-audit compliance copy. Two things
// live here:
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
    static let pendingCopyRevisions: [PendingCopyRevision] = [
        PendingCopyRevision(
            id: "approval_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.subject",
            currentEnglish: "Approved. ${monthlyBenefit}/mo, starting this month.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3",
            rationale: "Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "decision_approved_headline",
            surfaceFile: "SNAPDecisionApprovedView.swift",
            stringID: "SNAPDecisionApprovedStrings.headline",
            currentEnglish: "You're approved.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3 (boundary)",
            rationale: "Attributes the state agency's determination to Civica. Replace with state-attributed phrasing.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "expedited_banner_almost",
            surfaceFile: "SNAPExpeditedBanner.swift",
            stringID: "almostHeadline",
            currentEnglish: "Almost — one more answer could speed this up",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3 / Q2.4",
            rationale: "Gamification of a regulatory eligibility category. Reframe to attribute expedited criteria to 7 CFR 273.2(i).",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_entry_subtitle",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "entryCardSubtitle",
            currentEnglish: "Five questions. See your monthly dollar amount before you apply.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3 / Q2.3",
            rationale: "Pairs ease cue with incentive cue connected to applying. Reframe as a screening estimate.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_apply_cta",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "applyCTA",
            currentEnglish: "Apply for SNAP",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3 / Q2.3",
            rationale: "Generic 'Apply for SNAP' CTA without official-link attribution; should route via 'Open MA DTA Connect application' or similar neutral path.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "doc_requested_sms_body",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "documentRequestedSMS.body",
            currentEnglish: "DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3",
            rationale: "'Keeps your application moving' is loss-aversion framing. Reframe as factual deadline.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_one_day_sms",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertOneDayBeforeSMS.body",
            currentEnglish: "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3",
            rationale: "Urgency + ease + loss-aversion stacked. Reframe as factual deadline with consequence stated neutrally.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_heads_up_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertHeadsUpEmail.subject",
            currentEnglish: "Recertify in 60 days. Usually 4 minutes.",
            approvedEnglish: nil,
            approvedSpanish: nil,
            auditReference: "Q3",
            rationale: "Ease framing tied to recertification. Reframe to factual deadline only.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "ebt_pin_cta",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.buttonLabel",
            currentEnglish: "Set the EBT PIN",
            approvedEnglish: nil,
            approvedSpanish: nil,
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
