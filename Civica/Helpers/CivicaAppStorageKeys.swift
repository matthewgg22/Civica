import Foundation

/// Single source of truth for cross-cutting `UserDefaults` keys read or written
/// via `@AppStorage` (or directly) from more than one feature.
///
/// Surfaced by CQ-10 in `docs/audits/civica-ios-product-audit-2026-05-29.md` —
/// before T15, several keys (`co.civica.hasCompletedOnboarding`,
/// `co.civica.recertInProgress`, `co.civica.language`) appeared as bare string
/// literals in 4-5 files each, with no compile-time check against drift.
///
/// Scope: keys that span features. Per-store private keys (EBT cache keys,
/// application draft keys, feature-flag keys with their own owning type) stay
/// local — they're already centralized at the right altitude inside their
/// owning module.
enum CivicaAppStorageKeys {
    static let hasCompletedOnboarding = "co.civica.hasCompletedOnboarding"
    static let recertInProgress       = "co.civica.recertInProgress"

    /// Aliases `CivicaLanguage.defaultStorageKey` for grep visibility from the
    /// app-shell side. Existing call sites that already reference
    /// `CivicaLanguage.defaultStorageKey` remain valid.
    static let language               = CivicaLanguage.defaultStorageKey

    // Buddy (apply-flow trusted contact) — written from `CivicaSNAPFlowView`,
    // surfaced for grep visibility from anywhere else that needs to read them.
    static let buddyHasSeenApplyIntro = "co.civica.buddy.hasSeenApplyIntro"
    static let buddyName              = "co.civica.buddy.name"
    static let buddyContact           = "co.civica.buddy.contact"

    static let recertCompanionPermissionDismissed = "co.civica.recertCompanion.permissionDismissed"

    /// Find Help onboarding card has been dismissed.
    /// Note the `find_help.` prefix is intentional — it predates the
    /// `co.civica.` convention and is preserved to avoid invalidating
    /// existing user state.
    static let findHelpHasSeenOnboarding = "find_help.has_seen_onboarding"
}
