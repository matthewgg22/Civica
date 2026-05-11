import Foundation

// Single source of truth for what Civica stores on the user, and the
// canonical "wipe everything" routine the data-deletion screen runs.
// Keeping this in one file makes the privacy surface verifiable: an
// auditor (or a curious user, or you in six months) can read this
// file end-to-end and know exactly what's persisted.
//
// Inventory shape mirrors the MobilePrivacyBoard canvas spec:
//   • Application answers — orchestrator draft (count of completed
//     sections, not the answers themselves)
//   • Documents — captured photos via SNAPCapturedDocumentStore
//   • Status — current SNAPApplicationStatus + milestones
//   • Eligibility result — local verdict from the evaluator
//   • Language preference
//   • Onboarding completion flag

@MainActor
enum CivicaUserData {

    struct Inventory: Equatable {
        let completedSections: Int
        let totalSections: Int
        let capturedDocumentCount: Int
        let status: SNAPApplicationStatus
        let hasEligibilityResult: Bool
        let languageRaw: String
        let hasCompletedOnboarding: Bool

        /// True when DTA Connect has the user's submission. Civica
        /// can't pull it back from the state agency; the privacy
        /// screen surfaces this honestly.
        var hasBeenSubmittedToState: Bool {
            status.isPostSubmission
        }
    }

    // UserDefaults keys we own. Kept here so the delete routine
    // can wipe the exact set without any stragglers, and so
    // the inventory function can be trivially audited.
    private static let userDefaultsKeys: [String] = [
        "co.civica.hasCompletedOnboarding",
        "co.civica.language",
        "co.civica.applicationStatus",
        "co.civica.applicationMilestones",
        "co.civica.eligibilityResult",
        "co.civica.applicationDraft",
        "co.civica.recertInProgress"
    ]

    /// Read-only snapshot of what's currently stored. Used to render
    /// the inventory cards on the privacy screen.
    static func currentInventory() -> Inventory {
        let defaults = UserDefaults.standard
        let store = SNAPApplicationStatusStore()
        let draftStore = SNAPApplicationDraftStore()

        // Count completed sections from the persisted draft, if any.
        // Each section has its own completeness predicate exposed
        // via SNAPReviewDraftFlowView's section-status logic; here we
        // approximate by counting non-empty sections (any answer set).
        var completed = 0
        if let saved = draftStore.load() {
            let d = saved.draft
            if d.whereApplying.stateCode != nil && d.whereApplying.housingStatus != nil { completed += 1 }
            if d.applicantAge.isComplete { completed += 1 }
            if d.household.isComplete { completed += 1 }
            if d.contact.hasAnyContact { completed += 1 }
            if d.income.anyoneEarning != nil { completed += 1 }
            if d.studentStatus.enrolledInHigherEd != nil { completed += 1 }
            if d.expenses.monthlyRentOrHousing != nil || d.expenses.monthlyUtilities != nil { completed += 1 }
            if !d.documentsChecklist.documentsAvailable.isEmpty { completed += 1 }
        }

        // Captured documents — count files on disk under the
        // CivicaCapturedDocuments folder, not the in-memory set
        // (covers the case where the index drifted from disk).
        let capturedCount = SNAPDocumentType.allCases
            .filter { SNAPCapturedDocumentStore.hasCapture(for: $0) }
            .count

        return Inventory(
            completedSections: completed,
            totalSections: SNAPApplicationSection.allCases.count,
            capturedDocumentCount: capturedCount,
            status: store.status,
            hasEligibilityResult: store.eligibilityResult != nil,
            languageRaw: defaults.string(forKey: "co.civica.language") ?? CivicaLanguage.english.rawValue,
            hasCompletedOnboarding: defaults.bool(forKey: "co.civica.hasCompletedOnboarding")
        )
    }

    /// Wipe every byte Civica has stored on the user, then reset
    /// hasCompletedOnboarding so the next launch starts at the
    /// language picker. Idempotent — safe to call repeatedly.
    ///
    /// What this does NOT do (because Civica doesn't have a backend
    /// yet): notify a server, revoke an OAuth token, send a deletion
    /// confirmation email. When the backend lands, those side effects
    /// hook in here.
    static func deleteEverything() {
        let defaults = UserDefaults.standard

        // 1. Captured documents — delete every JPEG on disk.
        SNAPCapturedDocumentStore.clearAll()

        // 2. Application draft — clear the draft store (which clears
        //    the orchestrator's mode + section + answers).
        SNAPApplicationDraftStore().clear()

        // 3. Status store — reset to .notStarted, clear milestones +
        //    eligibilityResult. Uses the store's own reset routine so
        //    persistence stays consistent.
        SNAPApplicationStatusStore().reset()

        // 4. Direct UserDefaults wipe of every key Civica owns. The
        //    store resets above already touch most of these; the
        //    explicit removal catches drift and the keys that aren't
        //    owned by a store (language, hasCompletedOnboarding,
        //    recertInProgress).
        for key in userDefaultsKeys {
            defaults.removeObject(forKey: key)
        }
        defaults.synchronize()
    }
}
