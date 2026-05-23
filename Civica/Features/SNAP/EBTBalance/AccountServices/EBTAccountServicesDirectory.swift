import Foundation

// CA state directory data layer for EBTAccountServicesView (T13). Per
// plan §16.6 (new state launch recipe), adding another state means
// adding another `EBTAccountServicesDirectory` entry — copy in
// EBTAccountServicesStrings stays state-agnostic.
//
// Why a dedicated data type vs. inlining in the view? Because (a)
// the same tel: + URL targets are also referenced by EBTScrapeError
// (.pinLocked dials the same CA EBT customer service number) and
// (b) tests assert the values without firing UIApplication.

/// A single account-services entry. The view groups these into
/// sections; each renders the same way (icon, title, help text,
/// CTA).
struct EBTAccountServicesEntry: Identifiable, Equatable, Sendable {
    enum Action: Equatable, Sendable {
        /// Dials a phone number via a `tel:` URL.
        case call(number: String)
        /// Opens a URL in Safari.
        case openURL(URL)
    }

    let id: String
    let iconName: String
    let title: CivicaText
    let help: CivicaText
    let action: Action

    /// URL the SwiftUI Link should resolve to.
    var url: URL? {
        switch action {
        case .call(let number):
            // Strip non-digit chars defensively; `tel:` requires
            // digits only (and optional leading +).
            let digits = number.filter { $0.isNumber || $0 == "+" }
            return URL(string: "tel:\(digits)")
        case .openURL(let url):
            return url
        }
    }
}

/// California EBT account-services data. Static — no network, no
/// async, no flag-gating. Numbers + URLs sourced from:
/// - 1-877-328-9677 (CA EBT customer service, per state SNAP page)
/// - benefitscal.com (CDSS official portal)
/// - cdss.ca.gov county-office finder
/// - 1-800-229-3114 (USDA OIG fraud hotline)
enum EBTAccountServicesDirectory {
    /// Entries shown under the "Urgent" section.
    static let urgent: [EBTAccountServicesEntry] = [
        EBTAccountServicesEntry(
            id: "ca-lost-or-stolen-card",
            iconName: "lock.shield.fill",
            title: EBTAccountServicesStrings.lostOrStolenCardTitle,
            help: EBTAccountServicesStrings.lostOrStolenCardHelp,
            action: .call(number: "18773289677")
        ),
    ]

    /// Entries shown under "Benefits & application".
    static let benefits: [EBTAccountServicesEntry] = [
        EBTAccountServicesEntry(
            id: "ca-apply-benefitscal",
            iconName: "doc.text.fill",
            title: EBTAccountServicesStrings.applyForSNAPTitle,
            help: EBTAccountServicesStrings.applyForSNAPHelp,
            action: .openURL(URL(string: "https://benefitscal.com/")!)
        ),
        EBTAccountServicesEntry(
            id: "ca-county-office-finder",
            iconName: "mappin.and.ellipse",
            title: EBTAccountServicesStrings.countyOfficeFinderTitle,
            help: EBTAccountServicesStrings.countyOfficeFinderHelp,
            action: .openURL(URL(string: "https://www.cdss.ca.gov/inforesources/county-offices")!)
        ),
    ]

    /// Entries shown under "Report a problem".
    static let reporting: [EBTAccountServicesEntry] = [
        EBTAccountServicesEntry(
            id: "ca-report-fraud-usda",
            iconName: "exclamationmark.triangle.fill",
            title: EBTAccountServicesStrings.reportFraudTitle,
            help: EBTAccountServicesStrings.reportFraudHelp,
            action: .call(number: "18002293114")
        ),
    ]

    /// Flat list of all entries — used by tests + a11y label
    /// coverage. Section order matches the view.
    static var all: [EBTAccountServicesEntry] {
        urgent + benefits + reporting
    }
}
