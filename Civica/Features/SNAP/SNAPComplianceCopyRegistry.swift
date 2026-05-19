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
//
// T6 (2026-05-18): the data rows themselves were extracted to
// packages/snap-compliance-copy/data/ as the single source of truth
// for iOS + web. The Swift literals are codegenned into
// Generated/SNAPComplianceCopyRegistry+Generated.swift. This file
// remains the public type surface (struct/enum declarations + lookup
// helpers); the data lists below are just thin aliases over the
// generated arrays so all existing call sites continue to work.

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
    static let bannedPhrases: [BannedPhrase] = bannedPhrasesGenerated

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
        /// Optional per-state English override. Keys are USPS state
        /// codes (e.g. "CA", "MA"). When the surface knows the user's
        /// state, the state-aware lookup prefers this map; otherwise
        /// the flat `approvedEnglish` slot is the default fallback.
        let approvedEnglishByState: [String: String]
        /// Spanish-parity companion to `approvedEnglishByState`.
        let approvedSpanishByState: [String: String]
        /// OBBBA audit reference.
        let auditReference: String
        /// What's wrong with the current copy.
        let rationale: String
        /// Status — toggled to `.approved` by the PR that lands the
        /// signed strings.
        let status: RevisionStatus
        /// True until the Session K Spanish reviewer validates the
        /// Spanish strings. Surfaces in the launch preflight so that
        /// "9 approved" can still flag remaining native-review debt.
        let spanishParityReviewPending: Bool
    }

    /// Each row from Revision 2 §6 table. Until counsel signs, all
    /// rows are `.pendingSignoff` and `approvedEnglish`/`approvedSpanish`
    /// are nil. When a row is signed, the PR that fills the approved
    /// strings also flips status to `.approved`.
    static let pendingCopyRevisions: [PendingCopyRevision] = pendingCopyRevisionsGenerated

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

    /// State-aware English lookup. When the row carries a per-state
    /// override map (e.g. CalFresh CA / SNAP MA), returns the variant
    /// for `stateCode`; otherwise falls back to the flat
    /// `approvedEnglish`. Returns nil if the row isn't `.approved`.
    static func approvedEnglish(for id: String, stateCode: String?) -> String? {
        guard let row = pendingCopyRevisions.first(where: { $0.id == id }),
              row.status == .approved else { return nil }
        if let code = stateCode, let variant = row.approvedEnglishByState[code] {
            return variant
        }
        return row.approvedEnglish
    }

    /// Spanish-parity companion to `approvedEnglish(for:stateCode:)`.
    static func approvedSpanish(for id: String, stateCode: String?) -> String? {
        guard let row = pendingCopyRevisions.first(where: { $0.id == id }),
              row.status == .approved else { return nil }
        if let code = stateCode, let variant = row.approvedSpanishByState[code] {
            return variant
        }
        return row.approvedSpanish
    }

    // MARK: - Preflight helpers

    /// Counts of rows by status. Surfaced to the launch preflight
    /// (and tests) so a single grep doesn't have to walk the file.
    static var approvedRevisionCount: Int {
        pendingCopyRevisions.filter { $0.status == .approved }.count
    }

    static var pendingRevisionCount: Int {
        pendingCopyRevisions.filter { $0.status == .pendingSignoff }.count
    }

    /// IDs of rows whose Spanish strings still need the Session K
    /// reviewer's sign-off. Useful for surfacing native-review debt
    /// alongside counsel sign-off in the launch preflight.
    static var spanishParityReviewPendingIDs: [String] {
        pendingCopyRevisions
            .filter { $0.spanishParityReviewPending }
            .map { $0.id }
    }
}
