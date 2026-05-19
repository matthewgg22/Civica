import Foundation
import Testing
@testable import Civica

// Covers the MHD (Marketplace Hardcoded Defaults) fix: confirms that
// MarketplaceBenefit and MarketplaceHousehold start with nil fields
// (no misleading $292 / household-2 demo values leaking to users)
// and that the derived display helpers gate cleanly on nil.

@MainActor
struct MarketplaceViewModelTests {

    // MARK: - Struct defaults

    @Test func benefitDefaultsAreAllNil() {
        let b = MarketplaceBenefit()
        #expect(b.amount == nil)
        #expect(b.effectiveDate == nil)
        #expect(b.recertifyBy == nil)
    }

    @Test func householdDefaultsAreAllNil() {
        let h = MarketplaceHousehold()
        #expect(h.size == nil)
        #expect(h.shelterCost == nil)
    }

    @Test func viewModelStartsWithNilBenefitAndHousehold() {
        let vm = SNAPMarketplaceViewModel()
        #expect(vm.benefit.amount == nil)
        #expect(vm.benefit.effectiveDate == nil)
        #expect(vm.benefit.recertifyBy == nil)
        #expect(vm.household.size == nil)
        #expect(vm.household.shelterCost == nil)
    }

    // MARK: - Derived display helpers

    @Test func benefitAmountFormattedIsNilWhenAmountIsNil() {
        let vm = SNAPMarketplaceViewModel()
        #expect(vm.benefitAmountFormatted == nil)
    }

    @Test func benefitAmountFormattedRendersOnceAmountIsSet() {
        let vm = SNAPMarketplaceViewModel()
        vm.benefit.amount = 214
        #expect(vm.benefitAmountFormatted == "$214")
    }

    @Test func depositDateFormattedIsNilWhenEffectiveDateIsNil() {
        let vm = SNAPMarketplaceViewModel()
        #expect(vm.depositDateFormatted == nil)
    }

    @Test func depositDateFormattedRendersOnceEffectiveDateIsSet() {
        let vm = SNAPMarketplaceViewModel()
        var comps = DateComponents()
        comps.year = 2026; comps.month = 5; comps.day = 25
        let date = Calendar.current.date(from: comps)!
        vm.benefit.effectiveDate = date
        #expect(vm.depositDateFormatted == "First deposit by May 25")
    }

    // MARK: - Transition nil → populated

    @Test func benefitFieldsTransitionFromNilToPopulated() {
        let vm = SNAPMarketplaceViewModel()

        // Pre: all nil (loading state)
        #expect(vm.benefit.amount == nil)
        #expect(vm.benefitAmountFormatted == nil)
        #expect(vm.depositDateFormatted == nil)

        // Simulate API populating the fields
        var comps = DateComponents()
        comps.year = 2026; comps.month = 5; comps.day = 25
        let effective = Calendar.current.date(from: comps)!
        comps.month = 7; comps.day = 18
        let recert = Calendar.current.date(from: comps)!

        vm.benefit.amount = 292
        vm.benefit.effectiveDate = effective
        vm.benefit.recertifyBy = recert

        #expect(vm.benefit.amount == 292)
        #expect(vm.benefit.effectiveDate == effective)
        #expect(vm.benefit.recertifyBy == recert)
        #expect(vm.benefitAmountFormatted == "$292")
        #expect(vm.depositDateFormatted == "First deposit by May 25")
    }
}
