
import Foundation

public enum WhyVoteElectionType: String, Codable, CaseIterable, Sendable {
    case presidential
    case midterm
    case primary
}

public struct USAgeTurnoutDataset: Codable, Sendable {
    public let schemaVersion: String
    public let datasetName: String
    public let units: String
    public let denominatorNote: String
    public let source: Source
    public let sliderStops: [SliderStop]
    public let electionCycles: [ElectionCycle]

    public struct Source: Codable, Sendable {
        public let title: String
        public let publisher: String
        public let uploadedFiles: [String]
        public let notes: [String]
    }

    public struct SliderStop: Codable, Identifiable, Hashable, Sendable {
        public let id: String
        public let sortIndex: Int
        public let label: String
        public let ageStart: Int
        public let ageEnd: Int?
        public let bucketType: BucketType
    }

    public struct ElectionCycle: Codable, Identifiable, Hashable, Sendable {
        public var id: String { "\(year)-\(electionType.rawValue)" }
        public let year: Int
        public let electionType: WhyVoteElectionType
        public let displayName: String
        public let totalPopulationThousands: Int
        public let totalCitizenPopulationThousands: Int
        public let totalRegisteredThousands: Int
        public let totalVotedThousands: Int
        public let registeredRateCitizenPct: Double
        public let turnoutRateCitizenPct: Double
        public let registeredRateTotalPopulationPct: Double
        public let turnoutRateTotalPopulationPct: Double
        public let ages: [AgePoint]
    }

    public struct AgePoint: Codable, Identifiable, Hashable, Sendable {
        public let id: String
        public let sortIndex: Int
        public let label: String
        public let rawSourceLabel: String
        public let ageStart: Int
        public let ageEnd: Int?
        public let bucketType: BucketType
        public let totalPopulationThousands: Int
        public let citizenPopulationThousands: Int
        public let registeredThousands: Int
        public let notRegisteredThousands: Int
        public let noResponseRegistrationThousands: Int
        public let votedThousands: Int
        public let reportedNotVotedThousands: Int
        public let noResponseVotingThousands: Int
        public let registeredRateCitizenPct: Double
        public let turnoutRateCitizenPct: Double
        public let registeredRateTotalPopulationPct: Double
        public let turnoutRateTotalPopulationPct: Double
        public let shareOfTotalCitizenPct: Double
        public let shareOfTotalRegisteredPct: Double
        public let shareOfTotalVotersPct: Double
        public let shareOfTotalCitizenWhoVotedPct: Double
        public let shareOfTotalCitizenRemainingPct: Double
        public let representationIndex: Double
        public let representationGapPctPoints: Double
    }

    public enum BucketType: String, Codable, Sendable {
        case singleYear
        case range
        case openEnded
    }

    public func cycle(for electionType: WhyVoteElectionType) -> ElectionCycle? {
        electionCycles.first(where: { $0.electionType == electionType })
    }

    public static func loadFromBundle(
        resourceName: String = "us_age_turnout_single_year_xcode",
        bundle: Bundle? = nil
    ) throws -> USAgeTurnoutDataset {
        let bundles = [bundle, .main, Bundle(for: BundleToken.self)].compactMap { $0 }
        for candidate in bundles {
            if let url = candidate.url(forResource: resourceName, withExtension: "json") {
                let data = try Data(contentsOf: url)
                return try JSONDecoder().decode(USAgeTurnoutDataset.self, from: data)
            }
        }
        return try loadEmbedded()
    }

    public static func loadEmbedded() throws -> USAgeTurnoutDataset {
        let data = Data(USAgeTurnoutEmbedded.json.utf8)
        return try JSONDecoder().decode(USAgeTurnoutDataset.self, from: data)
    }

    public static var embedded: USAgeTurnoutDataset {
        get throws { try loadEmbedded() }
    }

    private final class BundleToken: NSObject {}
}

public struct WhyVoteAgeSelection: Hashable, Sendable {
    public var electionType: WhyVoteElectionType
    public var sliderIndex: Int

    public init(electionType: WhyVoteElectionType = .presidential, sliderIndex: Int = 0) {
        self.electionType = electionType
        self.sliderIndex = sliderIndex
    }
}

public struct WhyVoteAgeSnapshot: Hashable, Sendable {
    public let cycle: USAgeTurnoutDataset.ElectionCycle
    public let point: USAgeTurnoutDataset.AgePoint

    public var turnoutRatePct: Double { point.turnoutRateCitizenPct }
    public var eligibleSharePct: Double { point.shareOfTotalCitizenPct }
    public var votedShareOfElectoratePct: Double { point.shareOfTotalCitizenWhoVotedPct }
    public var remainingShareOfElectoratePct: Double { point.shareOfTotalCitizenRemainingPct }
    public var voterSharePct: Double { point.shareOfTotalVotersPct }
    public var turnoutVsCycleGapPctPoints: Double { point.turnoutRateCitizenPct - cycle.turnoutRateCitizenPct }

    /// Fractions for a donut whose full circumference equals the whole U.S. citizen electorate.
    public var donutFractions: DonutFractions {
        let voted = normalizedUnitFraction(point.shareOfTotalCitizenWhoVotedPct)
        let selectedButNotShownVoting = normalizedUnitFraction(point.shareOfTotalCitizenRemainingPct)
        let everyoneElse = max(0, 1.0 - voted - selectedButNotShownVoting)
        return DonutFractions(
            votedInSelectedAge: voted,
            remainingSelectedAge: selectedButNotShownVoting,
            restOfElectorate: everyoneElse
        )
    }

    private func normalizedUnitFraction(_ percentValue: Double) -> Double {
        guard percentValue.isFinite else { return 0 }
        return max(0, min(1, percentValue / 100.0))
    }

    public struct DonutFractions: Hashable, Sendable {
        public let votedInSelectedAge: Double
        public let remainingSelectedAge: Double
        public let restOfElectorate: Double
    }
}

public enum WhyVoteAgeTurnoutStore {
    public static func snapshot(
        dataset: USAgeTurnoutDataset,
        selection: WhyVoteAgeSelection
    ) -> WhyVoteAgeSnapshot? {
        guard let cycle = dataset.cycle(for: selection.electionType) else { return nil }
        let index = min(max(selection.sliderIndex, 0), max(cycle.ages.count - 1, 0))
        guard cycle.ages.indices.contains(index) else { return nil }
        return WhyVoteAgeSnapshot(cycle: cycle, point: cycle.ages[index])
    }
}

public enum WhyVoteAgeTurnoutFormatter {
    public static func percent(_ value: Double, digits: Int = 1) -> String {
        guard value.isFinite else { return "0%" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.maximumFractionDigits = digits
        formatter.minimumFractionDigits = digits
        return formatter.string(from: NSNumber(value: value / 100.0)) ?? "\(value)%"
    }

    public static func compactThousands(_ value: Int) -> String {
        let actual = Double(value) * 1_000.0
        if actual >= 1_000_000_000 {
            return String(format: "%.1fB", actual / 1_000_000_000)
        } else if actual >= 1_000_000 {
            return String(format: "%.1fM", actual / 1_000_000)
        } else if actual >= 1_000 {
            return String(format: "%.0fK", actual / 1_000)
        }
        return "\(Int(actual))"
    }
}

#if canImport(SwiftUI)
import SwiftUI

public struct WhyVoteAgeTurnoutSection: View {
    private let dataset: USAgeTurnoutDataset
    @State private var selection: WhyVoteAgeSelection
    @State private var sliderValue: Double

    public init(dataset: USAgeTurnoutDataset) {
        self.dataset = dataset
        let defaultElection: WhyVoteElectionType = dataset.cycle(for: .presidential) != nil ? .presidential : (dataset.electionCycles.first?.electionType ?? .midterm)
        let defaultSelection = WhyVoteAgeSelection(electionType: defaultElection, sliderIndex: 0)
        _selection = State(initialValue: defaultSelection)
        _sliderValue = State(initialValue: 0)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Historical turnout by age")
                .font(.title2.weight(.semibold))

            Picker("Election type", selection: $selection.electionType) {
                ForEach(availableElectionTypes, id: \.self) { type in
                    Text(type.segmentTitle).tag(type)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: selection.electionType) { _, newValue in
                if let cycle = dataset.cycle(for: newValue) {
                    selection.sliderIndex = min(selection.sliderIndex, cycle.ages.count - 1)
                    sliderValue = Double(selection.sliderIndex)
                }
            }

            if let snapshot = WhyVoteAgeTurnoutStore.snapshot(dataset: dataset, selection: selection) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center, spacing: 20) {
                        ElectorateDonut(snapshot: snapshot)
                            .frame(width: 180, height: 180)

                        VStack(alignment: .leading, spacing: 10) {
                            LabelValue(label: "Age", value: snapshot.point.label)
                            LabelValue(label: "Turnout", value: WhyVoteAgeTurnoutFormatter.percent(snapshot.turnoutRatePct))
                            LabelValue(label: "Share of eligible electorate", value: WhyVoteAgeTurnoutFormatter.percent(snapshot.eligibleSharePct))
                            LabelValue(label: "Share of all ballots cast", value: WhyVoteAgeTurnoutFormatter.percent(snapshot.voterSharePct))
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Age")
                            .font(.headline)
                        Slider(
                            value: Binding(
                                get: { sliderValue },
                                set: { newValue in
                                    let snapped = newValue.rounded()
                                    sliderValue = snapped
                                    selection.sliderIndex = Int(snapped)
                                }
                            ),
                            in: 0...Double(max((dataset.cycle(for: selection.electionType)?.ages.count ?? 1) - 1, 0)),
                            step: 1
                        )

                        HStack {
                            Text(dataset.cycle(for: selection.electionType)?.ages.first?.label ?? "")
                            Spacer()
                            Text(dataset.cycle(for: selection.electionType)?.ages.last?.label ?? "")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    Text(summaryLine(for: snapshot))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(uiColor: .secondarySystemBackground))
        )
    }


    private var availableElectionTypes: [WhyVoteElectionType] {
        WhyVoteElectionType.allCases.filter { dataset.cycle(for: $0) != nil }
    }

    private func summaryLine(for snapshot: WhyVoteAgeSnapshot) -> String {
        let turnout = WhyVoteAgeTurnoutFormatter.percent(snapshot.turnoutRatePct)
        let electorateShare = WhyVoteAgeTurnoutFormatter.percent(snapshot.eligibleSharePct)
        let ballotsShare = WhyVoteAgeTurnoutFormatter.percent(snapshot.voterSharePct)
        return "In \(snapshot.cycle.displayName), age \(snapshot.point.label) made up \(electorateShare) of the eligible citizen electorate and \(ballotsShare) of all ballots cast, with \(turnout) reported turnout."
    }
}

private struct ElectorateDonut: View {
    let snapshot: WhyVoteAgeSnapshot

    private var votedTrim: CGFloat { normalizedTrim(snapshot.donutFractions.votedInSelectedAge) }
    private var selectedRemainingTrim: CGFloat { normalizedTrim(snapshot.donutFractions.remainingSelectedAge) }
    private var restTrim: CGFloat { normalizedTrim(snapshot.donutFractions.restOfElectorate) }

    var body: some View {
        ZStack {
            Circle()
                .trim(from: 0, to: restTrim)
                .stroke(Color.gray.opacity(0.18), style: StrokeStyle(lineWidth: 18, lineCap: .butt))
                .rotationEffect(.degrees(-90 + normalizedRotationDegrees))

            Circle()
                .trim(from: 0, to: selectedRemainingTrim)
                .stroke(Color.accentColor.opacity(0.28), style: StrokeStyle(lineWidth: 18, lineCap: .butt))
                .rotationEffect(.degrees(-90 + Double(votedTrim) * 360))

            Circle()
                .trim(from: 0, to: votedTrim)
                .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 18, lineCap: .round))
                .rotationEffect(.degrees(-90))

            VStack(spacing: 4) {
                Text(WhyVoteAgeTurnoutFormatter.percent(snapshot.turnoutRatePct, digits: 0))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                Text("turnout")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: snapshot)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Turnout donut")
        .accessibilityValue(accessibilityValue)
    }

    private var accessibilityValue: String {
        let turnout = WhyVoteAgeTurnoutFormatter.percent(snapshot.turnoutRatePct)
        let electorateShare = WhyVoteAgeTurnoutFormatter.percent(snapshot.eligibleSharePct)
        return "\(snapshot.point.label), turnout \(turnout), representing \(electorateShare) of the eligible electorate."
    }

    private var normalizedRotationDegrees: Double {
        Double(min(1, max(0, votedTrim + selectedRemainingTrim))) * 360
    }

    private func normalizedTrim(_ value: Double) -> CGFloat {
        guard value.isFinite else { return 0 }
        return CGFloat(max(0, min(1, value)))
    }
}

private struct LabelValue: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
    }
}

private extension WhyVoteElectionType {
    var segmentTitle: String {
        switch self {
        case .presidential: return "Presidential"
        case .midterm: return "Midterm"
        case .primary: return "Primary"
        }
    }
}
#endif
