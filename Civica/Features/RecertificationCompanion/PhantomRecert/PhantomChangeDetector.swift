import Foundation

// Compares the user's live draft against their phantom draft and
// reports which sections have changed. Section-level granularity is
// deliberate — going field-by-field would couple this file to every
// sub-answer struct's internals (and re-couple every time those
// structs evolve). Section-level diffs are what the summary screen
// shows the user anyway.
//
// Pure. No I/O. Unit-tested.

struct PhantomChange: Equatable, Hashable {
    let section: SNAPApplicationSection
    let kind: Kind

    enum Kind: String, Equatable, Hashable, Codable {
        /// Both sides have a value; they differ.
        case modified
        /// Live side has a value, phantom doesn't. Means the user
        /// reset / cleared a section during the dry run.
        case cleared
        /// Phantom side has a value, live side is empty. Means the
        /// user filled in a previously-blank section.
        case filled
    }
}

enum PhantomChangeDetector {
    /// Diff the live and phantom drafts. Result is ordered by
    /// SNAPApplicationSection.allCases so the UI shows changes in
    /// the same order the user walked through them.
    static func diff(
        live: SNAPApplicationDraft,
        phantom: SNAPApplicationDraft
    ) -> [PhantomChange] {
        var changes: [PhantomChange] = []
        for section in SNAPApplicationSection.allCases {
            if let change = diffSection(section, live: live, phantom: phantom) {
                changes.append(change)
            }
        }
        return changes
    }

    private static func diffSection(
        _ section: SNAPApplicationSection,
        live: SNAPApplicationDraft,
        phantom: SNAPApplicationDraft
    ) -> PhantomChange? {
        // Equal sections never show up as changes — happy path.
        // Empty-vs-non-empty distinguishes filled / cleared. We
        // approximate "empty" by comparing against the default-
        // constructed value object.
        switch section {
        case .whereApplying:
            return categorize(
                section: section,
                liveIsEmpty: live.whereApplying == SNAPWhereApplyingAnswers(),
                phantomIsEmpty: phantom.whereApplying == SNAPWhereApplyingAnswers(),
                areEqual: live.whereApplying == phantom.whereApplying
            )
        case .applicantAge:
            return categorize(
                section: section,
                liveIsEmpty: live.applicantAge == SNAPApplicantAgeAnswers(),
                phantomIsEmpty: phantom.applicantAge == SNAPApplicantAgeAnswers(),
                areEqual: live.applicantAge == phantom.applicantAge
            )
        case .household:
            return categorize(
                section: section,
                liveIsEmpty: live.household == SNAPHouseholdAnswers(),
                phantomIsEmpty: phantom.household == SNAPHouseholdAnswers(),
                areEqual: live.household == phantom.household
            )
        case .contact:
            return categorize(
                section: section,
                liveIsEmpty: live.contact == SNAPContactAnswers(),
                phantomIsEmpty: phantom.contact == SNAPContactAnswers(),
                areEqual: live.contact == phantom.contact
            )
        case .income:
            return categorize(
                section: section,
                liveIsEmpty: live.income == SNAPIncomeAnswers(),
                phantomIsEmpty: phantom.income == SNAPIncomeAnswers(),
                areEqual: live.income == phantom.income
            )
        case .studentStatus:
            return categorize(
                section: section,
                liveIsEmpty: live.studentStatus == SNAPStudentStatusAnswers(),
                phantomIsEmpty: phantom.studentStatus == SNAPStudentStatusAnswers(),
                areEqual: live.studentStatus == phantom.studentStatus
            )
        case .expenses:
            return categorize(
                section: section,
                liveIsEmpty: live.expenses == SNAPExpensesAnswers(),
                phantomIsEmpty: phantom.expenses == SNAPExpensesAnswers(),
                areEqual: live.expenses == phantom.expenses
            )
        case .documentsChecklist:
            return categorize(
                section: section,
                liveIsEmpty: live.documentsChecklist == SNAPDocumentsChecklistAnswers(),
                phantomIsEmpty: phantom.documentsChecklist == SNAPDocumentsChecklistAnswers(),
                areEqual: live.documentsChecklist == phantom.documentsChecklist
            )
        }
    }

    private static func categorize(
        section: SNAPApplicationSection,
        liveIsEmpty: Bool,
        phantomIsEmpty: Bool,
        areEqual: Bool
    ) -> PhantomChange? {
        if areEqual { return nil }
        if liveIsEmpty && !phantomIsEmpty {
            return PhantomChange(section: section, kind: .filled)
        }
        if !liveIsEmpty && phantomIsEmpty {
            return PhantomChange(section: section, kind: .cleared)
        }
        return PhantomChange(section: section, kind: .modified)
    }
}
