import Foundation
import Testing
@testable import Civica

// Surface-level tests for RecertCompanionRoot + StatusSummaryCard.
//
// RecertCompanionRoot is a SwiftUI view — most of its behavior is
// only observable by rendering it. What we CAN verify cheaply:
//
//   * The default `stateCode` is the current launch state (CA).
//   * The pure `StatusSummaryCard` copy/CTA state machine produces
//     the right labels for each combination of (days, actions).
//   * RecertCompanionFeatureFlag round-trips through UserDefaults.

struct RecertCompanionRootTests {

    // MARK: - Default state code (Session D — CA switch)

    @Test
    func defaultStateCodeIsCA() {
        let root = RecertCompanionRoot()
        #expect(root.stateCode == "CA")
    }

    @Test
    func explicitStateCodeIsPreserved() {
        let root = RecertCompanionRoot(stateCode: "MA")
        #expect(root.stateCode == "MA")
    }

    // MARK: - StatusSummaryCard hero copy

    @Test
    func heroShowsDaysUntilRecert() {
        let card = StatusSummaryCard(
            daysUntilRecert: 30,
            actionsNeeded: 2,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "Recert in 30 days")
        #expect(card.actionsLine == "2 actions needed")
    }

    @Test
    func heroSingularDay() {
        let card = StatusSummaryCard(
            daysUntilRecert: 1,
            actionsNeeded: 1,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "Recert tomorrow")
        #expect(card.actionsLine == "1 action needed")
    }

    @Test
    func heroToday() {
        let card = StatusSummaryCard(
            daysUntilRecert: 0,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "Recert is today")
        #expect(card.actionsLine == "Nothing to do right now")
    }

    @Test
    func heroOverdue() {
        let card = StatusSummaryCard(
            daysUntilRecert: -5,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "5 days overdue")
    }

    @Test
    func heroOverdueOneDay() {
        let card = StatusSummaryCard(
            daysUntilRecert: -1,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "1 day overdue")
    }

    @Test
    func heroUnscheduled() {
        let card = StatusSummaryCard(
            daysUntilRecert: nil,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "Recert isn't scheduled yet")
    }

    // MARK: - StatusSummaryCard CTA routing

    @Test
    func ctaContactNavigatorWhenOverdue() {
        let card = StatusSummaryCard(
            daysUntilRecert: -3,
            actionsNeeded: 1,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.primaryActionKind == .contactNavigator)
        #expect(card.ctaLabel == "Contact your navigator")
    }

    @Test
    func ctaStartPhantomWithinWindow() {
        let card = StatusSummaryCard(
            daysUntilRecert: 30,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.primaryActionKind == .startPhantom)
        #expect(card.ctaLabel == "Start phantom recert")
    }

    @Test
    func ctaViewCalendarOutsideWindow() {
        let card = StatusSummaryCard(
            daysUntilRecert: 90,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.primaryActionKind == .viewCalendar)
        #expect(card.ctaLabel == "View expiration calendar")
    }

    @Test
    func ctaViewCalendarWhenUnscheduled() {
        let card = StatusSummaryCard(
            daysUntilRecert: nil,
            actionsNeeded: 0,
            language: .english,
            onPrimaryAction: {}
        )
        #expect(card.primaryActionKind == .viewCalendar)
    }

    // MARK: - Spanish parity smoke test

    @Test
    func spanishHero() {
        let card = StatusSummaryCard(
            daysUntilRecert: 30,
            actionsNeeded: 2,
            language: .spanish,
            onPrimaryAction: {}
        )
        #expect(card.heroLine == "Recert en 30 días")
        #expect(card.actionsLine == "2 acciones necesarias")
    }

    // MARK: - Feature flag sanity

    @Test
    func featureFlagRoundTrip() {
        let originalValue = RecertCompanionFeatureFlag.isEnabled
        defer { RecertCompanionFeatureFlag.setEnabled(originalValue) }

        RecertCompanionFeatureFlag.setEnabled(true)
        #expect(RecertCompanionFeatureFlag.isEnabled == true)

        RecertCompanionFeatureFlag.setEnabled(false)
        #expect(RecertCompanionFeatureFlag.isEnabled == false)
    }
}
