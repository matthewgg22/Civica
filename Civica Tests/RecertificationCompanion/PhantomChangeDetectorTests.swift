import Foundation
import Testing
@testable import Civica

// Section-level diff between live and phantom drafts. Pure
// functions, no I/O.

struct PhantomChangeDetectorTests {

    private func liveDraft() -> SNAPApplicationDraft {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 2000
        draft.income.anyoneEarning = .yes
        return draft
    }

    @Test func identicalDrafts_returnNoChanges() {
        let live = liveDraft()
        let phantom = live
        #expect(PhantomChangeDetector.diff(live: live, phantom: phantom) == [])
    }

    @Test func incomeChange_returnsModified() {
        var phantom = liveDraft()
        phantom.income.grossMonthlyIncome = 2400

        let changes = PhantomChangeDetector.diff(live: liveDraft(), phantom: phantom)
        #expect(changes == [PhantomChange(section: .income, kind: .modified)])
    }

    @Test func newlyFilledExpenses_returnsFilled() {
        let live = liveDraft()
        var phantom = live
        phantom.expenses.monthlyRentOrHousing = 1200

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        #expect(changes == [PhantomChange(section: .expenses, kind: .filled)])
    }

    @Test func clearedIncome_returnsCleared() {
        let live = liveDraft()
        var phantom = live
        phantom.income = SNAPIncomeAnswers()

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        #expect(changes == [PhantomChange(section: .income, kind: .cleared)])
    }

    @Test func multipleChanges_returnedInSectionEnumOrder() {
        let live = liveDraft()
        var phantom = live
        phantom.contact.email = "user@example.com"
        phantom.income.grossMonthlyIncome = 2400
        phantom.expenses.monthlyRentOrHousing = 1200

        let changes = PhantomChangeDetector.diff(live: live, phantom: phantom)
        let sections = changes.map(\.section)
        let expected: [SNAPApplicationSection] = [.contact, .income, .expenses]
        #expect(sections == expected)
    }
}
