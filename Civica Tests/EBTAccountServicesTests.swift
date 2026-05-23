import Foundation
import Testing
@testable import Civica

// Covers T13: CA state directory data is correct, URL synthesis
// produces valid tel: + https URLs, every entry has both EN+ES, and
// every entry has a unique id (the SwiftUI ForEach depends on it).

@Suite("EBTAccountServicesDirectory (CA)")
struct EBTAccountServicesDirectoryTests {

    @Test("Lost or stolen card dials the CA EBT customer service number")
    func lostCardDialsCorrectNumber() throws {
        let entry = try #require(
            EBTAccountServicesDirectory.urgent.first { $0.id == "ca-lost-or-stolen-card" }
        )
        guard case .call(let number) = entry.action else {
            Issue.record("Expected .call action")
            return
        }
        #expect(number == "18773289677")
        #expect(entry.url?.absoluteString == "tel:18773289677")
    }

    @Test("Apply via BenefitsCal opens the official CDSS portal")
    func applyOpensBenefitsCal() throws {
        let entry = try #require(
            EBTAccountServicesDirectory.benefits.first { $0.id == "ca-apply-benefitscal" }
        )
        guard case .openURL(let url) = entry.action else {
            Issue.record("Expected .openURL action")
            return
        }
        #expect(url.absoluteString == "https://benefitscal.com/")
    }

    @Test("County office finder opens the CDSS county-offices page")
    func countyFinderOpensCDSS() throws {
        let entry = try #require(
            EBTAccountServicesDirectory.benefits.first { $0.id == "ca-county-office-finder" }
        )
        guard case .openURL(let url) = entry.action else {
            Issue.record("Expected .openURL action")
            return
        }
        #expect(url.absoluteString == "https://www.cdss.ca.gov/inforesources/county-offices")
    }

    @Test("Report fraud dials the USDA OIG hotline")
    func reportFraudDialsUSDA() throws {
        let entry = try #require(
            EBTAccountServicesDirectory.reporting.first { $0.id == "ca-report-fraud-usda" }
        )
        guard case .call(let number) = entry.action else {
            Issue.record("Expected .call action")
            return
        }
        #expect(number == "18002293114")
        #expect(entry.url?.absoluteString == "tel:18002293114")
    }

    @Test("All ids are unique (ForEach stability)")
    func idsAreUnique() {
        let ids = EBTAccountServicesDirectory.all.map(\.id)
        let unique = Set(ids)
        #expect(unique.count == ids.count, "Duplicate ids in directory: \(ids)")
    }

    @Test("Every entry has EN+ES title + help copy")
    func enEsCoverage() {
        for entry in EBTAccountServicesDirectory.all {
            #expect(!entry.title.en.isEmpty, "EN title missing for \(entry.id)")
            #expect(!entry.title.es.isEmpty, "ES title missing for \(entry.id)")
            #expect(!entry.help.en.isEmpty, "EN help missing for \(entry.id)")
            #expect(!entry.help.es.isEmpty, "ES help missing for \(entry.id)")
        }
    }

    @Test("Every entry has a non-empty SF Symbol name")
    func everyIconNonEmpty() {
        for entry in EBTAccountServicesDirectory.all {
            #expect(!entry.iconName.isEmpty, "Icon missing for \(entry.id)")
        }
    }

    @Test("Tel: URL strips formatting characters defensively")
    func telURLDigitsOnly() {
        let withDashes = EBTAccountServicesEntry(
            id: "test",
            iconName: "phone",
            title: CivicaText("T", es: "T"),
            help: CivicaText("H", es: "H"),
            action: .call(number: "1-877-328-9677")
        )
        #expect(withDashes.url?.absoluteString == "tel:18773289677")
    }
}
