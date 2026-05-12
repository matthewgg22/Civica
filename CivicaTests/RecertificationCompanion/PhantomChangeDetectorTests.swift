import XCTest
@testable import Civica

// Unit tests for PhantomChangeDetector. Section-level diff between
// the user's live draft and their phantom draft. Pure functions, no
// I/O.

final class PhantomChangeDetectorTests: XCTestCase {

    private func liveDraft() -> SNAPApplicationDraft {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 2000
        draft.income.anyoneEarning = .yes
        return draft
    }

    // MARK: - No changes → no diff

    func test_identicalDrafts_returnNoChanges() {
        let live = liveDraft()
        let phantom = live
        XCTAssertEqual(PhantomChangeDetector.diff(live: live, phantom: phantom), [])
    }

    // MARK: - Modified

    func test_incomeChange_returnsModified() {
        var phantom = liveDraft()
        phantom.income.grossMonthlyIncome = 2400

        let changes = PhantomChangeDetector.diff(live: liveDraft(), phantom: phantom)
        XCTAssertEqual(changes, [PhantomChange(section: .income, kind: .modified)])
    }

    // MARK: - Filled

    func test_newlyFilledExpenses_returnsFilled() {
        let live = liveDraft()
        var phantom = live
        phantom.expenses.monthlyRentOrHousing = 1200

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        XCTAssertEqual(changes, [PhantomChange(section: .expenses, kind: .filled)])
    }

    // MARK: - Cleared

    func test_clearedIncome_returnsCleared() {
        let live = liveDraft()
        var phantom = live
        phantom.income = SNAPIncomeAnswers()

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        XCTAssertEqual(changes, [PhantomChange(section: .income, kind: .cleared)])
    }

    // MARK: - Sort order matches enum cases

    func test_multipleChanges_returnedInSectionEnumOrder() {
        let live = liveDraft()
        var phantom = live
        phantom.contact.email = "user@example.com"
        phantom.income.grossMonthlyIncome = 2400
        phantom.expenses.monthlyRentOrHousing = 1200

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        let sections = changes.map(\.section)
        // contact, income, expenses → must be in that enum order
        let expected: [SNAPApplicationSection] = [.contact, .income, .expenses]
        XCTAssertEqual(sections, expected)
    }
}
