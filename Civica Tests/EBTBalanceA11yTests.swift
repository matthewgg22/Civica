import Foundation
import SwiftUI
import Testing
@testable import Civica

// Plan T11 / D12: Phase-1 A11y coverage. Blind + elderly recipients
// are a core SNAP demographic; we ship the moment the basics are
// proven.
//
// Civica does not currently link a snapshot-testing or ViewInspector
// package, so this suite focuses on assertions that don't require
// rendering a real UIView hierarchy:
//
//   1. Every CivicaText surfaced via an EBT* string is non-empty in
//      EN+ES (covered by EBTStringParityTests; we re-assert here for
//      the specific surfaces a screen reader walks).
//   2. Every interactive entry has a non-empty accessibilityLabel
//      surrogate string (the value that EBTAccountServicesView and
//      EBTBalanceDashboardView pass into .accessibilityLabel).
//   3. The standalone views can be instantiated at xxxLarge Dynamic
//      Type without crashing — proxy for the "snapshot test at xxxLarge"
//      requirement.
//
// When SnapshotTesting is added (DX retro item per §16.10 / T20),
// replace assertions in `xxxLargeDynamicTypeRenders*` with real
// snapshot recordings.

@MainActor
@Suite("EBT a11y coverage (Phase 1)")
struct EBTBalanceA11yTests {

    // MARK: - VoiceOver label coverage

    @Test("Every account services entry has a non-empty a11y label in EN")
    func accountServicesA11yLabelsEN() {
        for entry in EBTAccountServicesDirectory.all {
            let title = entry.title.value(in: .english)
            let label: String
            switch entry.action {
            case .call:
                label = EBTAccountServicesStrings.callActionA11y(rowTitle: title, language: .english)
            case .openURL:
                label = EBTAccountServicesStrings.openLinkA11y(rowTitle: title, language: .english)
            }
            #expect(!label.isEmpty, "EN a11y label empty for \(entry.id)")
            #expect(label.contains(title), "EN a11y label for \(entry.id) doesn't reference the row title")
        }
    }

    @Test("Every account services entry has a non-empty a11y label in ES")
    func accountServicesA11yLabelsES() {
        for entry in EBTAccountServicesDirectory.all {
            let title = entry.title.value(in: .spanish)
            let label: String
            switch entry.action {
            case .call:
                label = EBTAccountServicesStrings.callActionA11y(rowTitle: title, language: .spanish)
            case .openURL:
                label = EBTAccountServicesStrings.openLinkA11y(rowTitle: title, language: .spanish)
            }
            #expect(!label.isEmpty, "ES a11y label empty for \(entry.id)")
        }
    }

    @Test("Every EBTScrapeError banner copy is non-empty in EN+ES (screen reader)")
    func scrapeErrorBannerCoverage() {
        let variants: [EBTScrapeError] = [
            .networkTimeout, .portalDown, .sessionExpired, .captcha,
            .pinLocked, .cardClosed, .parseError, .cardLockUnsupported,
        ]
        for v in variants {
            #expect(!v.banner.en.isEmpty, "EN banner empty for \(v)")
            #expect(!v.banner.es.isEmpty, "ES banner empty for \(v)")
            #expect(v.cta != nil, "No CTA → VoiceOver has nothing to announce as the action for \(v)")
            if let cta = v.cta {
                #expect(!cta.label.en.isEmpty, "EN CTA label empty for \(v)")
                #expect(!cta.label.es.isEmpty, "ES CTA label empty for \(v)")
            }
        }
    }

    // MARK: - xxxLarge Dynamic Type rendering

    @Test("EBTAccountServicesView renders at xxxLarge Dynamic Type")
    func accountServicesRendersAtXXXLarge() {
        // Render into a UIHostingController to ensure no crashes on
        // bind. Layout pass is not asserted — a true snapshot would
        // assert pixel diff. Failure here means a SwiftUI binding
        // error, not a layout regression.
        let view = EBTAccountServicesView()
            .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
        let host = UIHostingController(rootView: view)
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        #expect(host.view.bounds.width == 390)
    }

    @Test("EBTLinkCardView renders at xxxLarge Dynamic Type")
    func linkCardRendersAtXXXLarge() {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        let view = EBTLinkCardView(store: store, language: .english)
            .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
        let host = UIHostingController(rootView: view)
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        #expect(host.view.bounds.width == 390)
    }

    @Test("EBTBalanceDashboardView with linked fixture renders at xxxLarge")
    func dashboardRendersAtXXXLarge() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        await store.link()
        // Provide a fixture-backed anomaly store with no transactions → no alerts.
        let repo = EBTBalanceRepository(
            apiClient: MockEBTBalanceAPIClient(),
            defaults: UserDefaults(suiteName: "a11y-test-\(UUID())")!
        )
        let anomalyStore = EBTAnomalyStore(repository: repo)
        let view = EBTBalanceDashboardView(store: store, anomalyStore: anomalyStore, language: .english)
            .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
        let host = UIHostingController(rootView: NavigationStack { view })
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        #expect(host.view.bounds.width == 390)
    }
}
