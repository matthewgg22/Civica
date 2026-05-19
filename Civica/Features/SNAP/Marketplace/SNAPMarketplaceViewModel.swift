import Foundation
import SwiftUI

// MARK: - State Models

struct MarketplaceBenefit {
    var amount: Int = 292
    var effectiveDate: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 5; c.day = 25
        return Calendar.current.date(from: c) ?? Date()
    }()
    var recertifyBy: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 7; c.day = 18
        return Calendar.current.date(from: c) ?? Date()
    }()
}

struct MarketplaceHousehold {
    var size: Int = 2
    var shelterCost: Int = 800
}

struct MarketplaceSchedule {
    var source: ScheduleSource = .canvas
    /// Indices 0–6 for M T W T F S S. True = class block (shows teal bar).
    var classBlocks: [Bool] = [false, true, false, true, false, false, false]
    var openSummary: String = "M/W/F afternoons, T/Th evenings, weekends"

    enum ScheduleSource {
        case canvas, manual
    }
}

enum JobClassification {
    case fws            // Federal Work Study — excluded from SNAP income calc
    case countedIncome  // Counts toward benefit reduction
    case obbbaHours     // Counts as OBBBA work hours
}

struct SNAPMarketplaceJob: Identifiable {
    let id: UUID
    let title: String
    let employer: String
    let hours: Int            // per week
    let wage: Decimal         // per hour
    let schedule: String
    let classification: JobClassification
    let projectedBenefitLabel: String
    let projectedBenefitColor: BenefitLabelColor
    let pillText: String
    let pillColor: PillColor
    let pillDotColor: PillDotColor
    let applyURL: String

    enum BenefitLabelColor { case teal, ink }
    enum PillColor         { case teal, graphite }
    enum PillDotColor      { case teal, amber, graphite, none }
}

struct MarketplacePlacement {
    var jobId: UUID?
    var employer: String = "Dining Services"
    var firstPaycheckAmount: Int = 612
    var confirmedAt: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 5; c.day = 15
        return Calendar.current.date(from: c) ?? Date()
    }()
    var confirmationSource: String = "Argyle"
    var oldBenefit: Int = 292
    var newBenefit: Int = 214
    var countyNotified: Bool = true
    var obbbaHoursLogged: Int = 32
    var obbbaHoursRequired: Int = 80
    var obbbaMonth: String = "May"
}

enum DataSourceStatus {
    case connected, disconnected, pending
}

struct MarketplaceDataSources {
    var argyle: DataSourceStatus = .connected
    var canvas: DataSourceStatus = .connected
    var plaidConnected: Bool = true
    var plaidLastVerified: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 5; c.day = 12
        return Calendar.current.date(from: c) ?? Date()
    }()
}

struct RecertPulledItem: Identifiable {
    let id = UUID()
    let label: String
    let source: String
}

struct RecertInputItem: Identifiable {
    let id = UUID()
    let label: String
    let subLabel: String?
}

struct MarketplaceRecertification {
    var dueBy: Date = {
        var c = DateComponents(); c.year = 2026; c.month = 7; c.day = 18
        return Calendar.current.date(from: c) ?? Date()
    }()
    var pulled: [RecertPulledItem] = [
        RecertPulledItem(label: "Income (from Dining Services job)", source: "Argyle · since May 15"),
        RecertPulledItem(label: "Class schedule",                    source: "Canvas · synced today"),
        RecertPulledItem(label: "Household + shelter cost",          source: "From your last packet"),
    ]
    var needsInput: [RecertInputItem] = [
        RecertInputItem(label: "Confirm anyone moved in or out", subLabel: nil),
        RecertInputItem(label: "Upload latest utility bill",     subLabel: "(optional)"),
    ]
    var status: RecertStatus = .draft

    enum RecertStatus { case draft, submitted }
}

// MARK: - ViewModel

@MainActor
final class SNAPMarketplaceViewModel: ObservableObject {

    // MARK: Dependencies
    private let enrollmentClient: EnrollmentAPIClient

    init(enrollmentClient: EnrollmentAPIClient = MockEnrollmentAPIClient()) {
        self.enrollmentClient = enrollmentClient
    }

    // MARK: State surface
    @Published var benefit      = MarketplaceBenefit()
    @Published var household    = MarketplaceHousehold()
    @Published var schedule     = MarketplaceSchedule()
    @Published var incomeCap: Int = 1_580
    @Published var jobs: [SNAPMarketplaceJob] = SNAPMarketplaceViewModel.demoJobs
    @Published var placement    = MarketplacePlacement()
    @Published var dataSources  = MarketplaceDataSources()
    @Published var recertification = MarketplaceRecertification()

    @Published var argyleConnectError: String? = nil

    // MARK: UI selection state
    @Published var selectedJob: SNAPMarketplaceJob? = nil
    @Published var showApplySheet: Bool = false

    // MARK: Argyle connection lifecycle

    /// Called on view appear — refreshes the live Argyle connection status.
    func refreshArgyleStatus() async {
        do {
            let status = try await enrollmentClient.fetchArgyleConnectionStatus()
            dataSources.argyle = status.linked ? .connected : .disconnected
        } catch {
            // Non-fatal — marketplace still works with demo data
        }
    }

    /// Called by the iOS Argyle SDK completion handler with the new user ID.
    func handleArgyleSDKLink(argyleUserId: String, packetId: String?) async {
        dataSources.argyle = .pending
        argyleConnectError = nil
        do {
            let status = try await enrollmentClient.connectArgyle(argyleUserId: argyleUserId, packetId: packetId)
            dataSources.argyle = status.linked ? .connected : .disconnected
        } catch {
            dataSources.argyle = .disconnected
            argyleConnectError = error.localizedDescription
        }
    }

    /// Called from Settings > Connections to revoke the Argyle link.
    func disconnectArgyle() async {
        do {
            try await enrollmentClient.disconnectArgyle()
            dataSources.argyle = .disconnected
        } catch {
            // Ignore — stale local state is acceptable
        }
    }

    // MARK: Demo jobs
    private static var demoJobs: [SNAPMarketplaceJob] {
        let id1 = UUID(), id2 = UUID(), id3 = UUID()
        return [
            SNAPMarketplaceJob(
                id: id1,
                title: "Library Assistant",
                employer: "University Library",
                hours: 12,
                wage: 18,
                schedule: "M/W/F afternoons",
                classification: .fws,
                projectedBenefitLabel: "Benefit stays $292",
                projectedBenefitColor: .teal,
                pillText: "Work-study · doesn't count",
                pillColor: .teal,
                pillDotColor: .teal,
                applyURL: "https://handshake.com"
            ),
            SNAPMarketplaceJob(
                id: id2,
                title: "Dining Services",
                employer: "Campus Dining",
                hours: 16,
                wage: 17,
                schedule: "T/Th evenings",
                classification: .countedIncome,
                projectedBenefitLabel: "Benefit becomes $214",
                projectedBenefitColor: .ink,
                pillText: "Counts as income",
                pillColor: .graphite,
                pillDotColor: .amber,
                applyURL: "https://handshake.com"
            ),
            SNAPMarketplaceJob(
                id: id3,
                title: "DoorDash · flexible hours",
                employer: "DoorDash",
                hours: 0,
                wage: 0,
                schedule: "Flexible",
                classification: .obbbaHours,
                projectedBenefitLabel: "Benefit varies $180–$240",
                projectedBenefitColor: .ink,
                pillText: "Counts as OBBBA hours",
                pillColor: .graphite,
                pillDotColor: .graphite,
                applyURL: "https://doordash.com"
            ),
        ]
    }

    // MARK: Derived display helpers

    var benefitAmountFormatted: String { "$\(benefit.amount)" }

    var depositDateFormatted: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return "First deposit by \(f.string(from: benefit.effectiveDate))"
    }

    var recertByFormatted: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return "RECERTIFY BY · \(f.string(from: recertification.dueBy).uppercased())"
    }

    var placementConfirmedDateFormatted: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return "PAYCHECK CONFIRMED · \(f.string(from: placement.confirmedAt).uppercased())"
    }

    var obbbaProgress: Double {
        guard placement.obbbaHoursRequired > 0 else { return 0 }
        return Double(placement.obbbaHoursLogged) / Double(placement.obbbaHoursRequired)
    }
}
