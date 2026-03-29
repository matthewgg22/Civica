import Foundation

enum PrimaryDemoParty: String, CaseIterable, Identifiable, Codable {
    case partyA
    case partyB

    var id: String { rawValue }

    var label: String {
        switch self {
        case .partyA:
            return "Party A"
        case .partyB:
            return "Party B"
        }
    }
}

struct PrimaryDemoCandidate: Identifiable, Equatable, Codable {
    let id: Int
    let label: String
    let party: PrimaryDemoParty
}

struct PrimaryNomineeResult: Equatable {
    let candidate: PrimaryDemoCandidate
    let voteShare: Double
    let rank: Int

    var isNominee: Bool {
        rank == 1
    }
}

struct PrimaryNomineeOutcome: Equatable {
    let party: PrimaryDemoParty
    let ranked: [PrimaryNomineeResult]
    let totalVotes: Double

    var nominee: PrimaryNomineeResult? {
        ranked.first
    }
}

enum PrimaryNomineeSimulationEngine {
    static func makeMockCandidates(count: Int = 8) -> [PrimaryDemoCandidate] {
        let boundedCount = min(8, max(6, count))
        let partyACount = (boundedCount + 1) / 2

        var partyAIndex = 1
        var partyBIndex = 1

        return (0..<boundedCount).map { idx in
            if idx < partyACount {
                defer { partyAIndex += 1 }
                return PrimaryDemoCandidate(id: idx, label: "Candidate A\(partyAIndex)", party: .partyA)
            }
            defer { partyBIndex += 1 }
            return PrimaryDemoCandidate(id: idx, label: "Candidate B\(partyBIndex)", party: .partyB)
        }
    }

    static func defaultVoteWeights(for candidates: [PrimaryDemoCandidate]) -> [Int: Double] {
        var byPartyIndex: [PrimaryDemoParty: Int] = [.partyA: 0, .partyB: 0]
        var weights: [Int: Double] = [:]

        for candidate in candidates {
            let index = byPartyIndex[candidate.party, default: 0]
            let base = max(10.0, 70.0 - Double(index * 12))
            weights[candidate.id] = base
            byPartyIndex[candidate.party] = index + 1
        }

        return weights
    }

    static func outcome(
        for party: PrimaryDemoParty,
        candidates: [PrimaryDemoCandidate],
        voteWeights: [Int: Double]
    ) -> PrimaryNomineeOutcome {
        let partyCandidates = candidates.filter { $0.party == party }
        guard !partyCandidates.isEmpty else {
            return PrimaryNomineeOutcome(party: party, ranked: [], totalVotes: 0)
        }

        let rawRows: [(candidate: PrimaryDemoCandidate, weight: Double)] = partyCandidates.map { candidate in
            (candidate, max(0, voteWeights[candidate.id, default: 0]))
        }

        let totalWeight = rawRows.reduce(0) { $0 + $1.weight }
        let normalizedRows: [(candidate: PrimaryDemoCandidate, share: Double)]

        if totalWeight > 0 {
            normalizedRows = rawRows.map { row in
                (row.candidate, row.weight / totalWeight)
            }
        } else {
            let equalShare = 1.0 / Double(rawRows.count)
            normalizedRows = rawRows.map { row in
                (row.candidate, equalShare)
            }
        }

        let sorted = normalizedRows.sorted { lhs, rhs in
            if lhs.share == rhs.share {
                return lhs.candidate.id < rhs.candidate.id
            }
            return lhs.share > rhs.share
        }

        let ranked = sorted.enumerated().map { index, row in
            PrimaryNomineeResult(candidate: row.candidate, voteShare: row.share, rank: index + 1)
        }

        return PrimaryNomineeOutcome(party: party, ranked: ranked, totalVotes: totalWeight)
    }

    static func simulateVotes(
        for party: PrimaryDemoParty,
        candidates: [PrimaryDemoCandidate],
        existingWeights: [Int: Double],
        randomValues: [Double]? = nil
    ) -> [Int: Double] {
        let partyCandidates = candidates.filter { $0.party == party }
        guard !partyCandidates.isEmpty else { return existingWeights }

        var next = existingWeights
        var index = 0

        for candidate in partyCandidates {
            let random: Double
            if let randomValues, !randomValues.isEmpty {
                random = clamped(randomValues[index % randomValues.count], min: 0, max: 1)
            } else {
                random = Double.random(in: 0...1)
            }

            let candidateBias = max(0, 10 - (index * 2))
            next[candidate.id] = 20 + (random * 80) + Double(candidateBias)
            index += 1
        }

        return next
    }

    private static func clamped(_ value: Double, min lowerBound: Double, max upperBound: Double) -> Double {
        Swift.max(lowerBound, Swift.min(upperBound, value))
    }
}
