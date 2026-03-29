import Foundation

typealias RankedChoiceCandidateID = Int

struct RankedChoiceCandidate: Identifiable, Hashable {
    let id: RankedChoiceCandidateID
    let label: String
}

struct RankedChoiceBallot: Identifiable, Hashable {
    let id: Int
    let ranking: [RankedChoiceCandidateID]
}

enum RankedChoiceAssignment: Hashable {
    case candidate(RankedChoiceCandidateID)
    case exhausted

    var candidateID: RankedChoiceCandidateID? {
        guard case let .candidate(id) = self else { return nil }
        return id
    }

    var isExhausted: Bool {
        if case .exhausted = self {
            return true
        }
        return false
    }
}

struct RankedChoiceTransfer: Hashable {
    let ballotID: Int
    let fromCandidateID: RankedChoiceCandidateID
    let toAssignment: RankedChoiceAssignment
}

struct RankedChoiceRound: Identifiable, Hashable {
    let id: Int
    let activeCandidateIDs: [RankedChoiceCandidateID]
    let assignmentByBallotID: [Int: RankedChoiceAssignment]
    let countsByCandidateID: [RankedChoiceCandidateID: Int]
    let exhaustedBallotIDs: [Int]
    let eliminatedCandidateID: RankedChoiceCandidateID?
    let tieCandidateIDs: [RankedChoiceCandidateID]
    let transfers: [RankedChoiceTransfer]
    let explanation: String

    var totalActiveVotes: Int {
        countsByCandidateID.values.reduce(0, +)
    }

    var winnerCandidateID: RankedChoiceCandidateID? {
        let needed = (totalActiveVotes / 2) + 1
        guard needed > 0 else { return nil }
        return countsByCandidateID.first { $0.value >= needed }?.key
    }
}

struct RankedChoiceSimulationPlan: Hashable {
    let candidates: [RankedChoiceCandidate]
    let ballots: [RankedChoiceBallot]
    let rounds: [RankedChoiceRound]
    let winnerCandidateID: RankedChoiceCandidateID?
    let tieBreakNotes: [String]

    var isComplete: Bool {
        winnerCandidateID != nil && !rounds.isEmpty
    }
}

enum RankedChoiceEngine {
    static func makeDemoCandidates(count: Int) -> [RankedChoiceCandidate] {
        let capped = min(8, max(3, count))
        return (0..<capped).map { idx in
            RankedChoiceCandidate(id: idx, label: "Candidate A\(idx + 1)")
        }
    }

    static func makeDemoBallots(
        voterCount: Int,
        candidates: [RankedChoiceCandidate],
        seed: UInt64 = 2_026_032_500
    ) -> [RankedChoiceBallot] {
        guard !candidates.isEmpty else { return [] }

        let totalVoters = min(100, max(100, voterCount))
        var rng = SeededGenerator(seed: seed)
        let candidateIDs = candidates.map(\.id)

        // Keep first-choice shares more conceptual and less lopsided so viewers see transfers.
        let descendingWeights = (0..<candidateIDs.count).map { index -> Double in
            if candidateIDs.count == 4 {
                let conceptual: [Double] = [34, 27, 22, 17]
                return conceptual[index]
            }
            let rankBias = Double(candidateIDs.count - index)
            return max(1.0, rankBias * 1.35)
        }

        return (0..<totalVoters).map { ballotID in
            let firstChoicePosition = weightedIndex(from: descendingWeights, rng: &rng)
            let firstChoice = candidateIDs[firstChoicePosition]

            var remaining = candidateIDs.filter { $0 != firstChoice }
            remaining.shuffle(using: &rng)

            let fullRanking = [firstChoice] + remaining
            let ranking: [RankedChoiceCandidateID]

            if candidateIDs.count == 4 {
                // Intentionally include more short rankings so inactive/exhausted ballots are visible
                // and materially affect later rounds in the demo.
                let depthWeights: [Double]
                switch firstChoicePosition {
                case 0:
                    depthWeights = [8, 18, 30, 44]   // strong frontrunner voters rank deeper
                case 1:
                    depthWeights = [12, 24, 32, 32]
                case 2:
                    depthWeights = [24, 33, 26, 17]
                default:
                    depthWeights = [34, 34, 20, 12]  // trailing voters more often rank short
                }

                let depthIndex = weightedIndex(from: depthWeights, rng: &rng)
                let depth = max(1, min(fullRanking.count, depthIndex + 1))
                ranking = Array(fullRanking.prefix(depth))
            } else {
                let minimumDepth = min(fullRanking.count, 2)
                let maxDepth = max(minimumDepth, fullRanking.count)
                let depthCap = Int.random(in: minimumDepth...maxDepth, using: &rng)
                let shouldTruncate = Double.random(in: 0...1, using: &rng) < 0.22
                ranking = shouldTruncate ? Array(fullRanking.prefix(depthCap)) : fullRanking
            }

            return RankedChoiceBallot(id: ballotID, ranking: ranking)
        }
    }

    static func makeDemoPlan(
        voterCount: Int = 180,
        candidateCount: Int = 6,
        seed: UInt64 = 2_026_032_500
    ) -> RankedChoiceSimulationPlan {
        let candidates = makeDemoCandidates(count: candidateCount)
        let ballots = makeDemoBallots(voterCount: voterCount, candidates: candidates, seed: seed)
        return buildSimulation(candidates: candidates, ballots: ballots)
    }

    static func buildSimulation(
        candidates: [RankedChoiceCandidate],
        ballots: [RankedChoiceBallot]
    ) -> RankedChoiceSimulationPlan {
        guard !candidates.isEmpty, !ballots.isEmpty else {
            return RankedChoiceSimulationPlan(
                candidates: candidates,
                ballots: ballots,
                rounds: [],
                winnerCandidateID: nil,
                tieBreakNotes: []
            )
        }

        let validCandidateIDs = Set(candidates.map(\.id))
        let normalizedBallots = ballots.map { ballot -> RankedChoiceBallot in
            var seen = Set<RankedChoiceCandidateID>()
            let cleaned = ballot.ranking.filter { candidateID in
                validCandidateIDs.contains(candidateID) && seen.insert(candidateID).inserted
            }
            return RankedChoiceBallot(id: ballot.id, ranking: cleaned)
        }

        var activeCandidates = Set(candidates.map(\.id))
        var rounds: [RankedChoiceRound] = []
        var tieBreakNotes: [String] = []
        var winnerCandidateID: RankedChoiceCandidateID?
        var safetyCounter = 0

        while !activeCandidates.isEmpty, safetyCounter < 16 {
            safetyCounter += 1
            let orderedActive = activeCandidates.sorted()
            let assignments = assignBallots(normalizedBallots, activeCandidates: activeCandidates)

            var counts = Dictionary(uniqueKeysWithValues: orderedActive.map { ($0, 0) })
            var exhaustedBallotIDs: [Int] = []
            for ballot in normalizedBallots {
                let assignment = assignments[ballot.id] ?? .exhausted
                if case let .candidate(candidateID) = assignment {
                    counts[candidateID, default: 0] += 1
                } else {
                    exhaustedBallotIDs.append(ballot.id)
                }
            }

            let totalActiveVotes = counts.values.reduce(0, +)
            let majorityNeeded = max(1, (totalActiveVotes / 2) + 1)
            if let majorityWinner = orderedActive.first(where: { counts[$0, default: 0] >= majorityNeeded }) {
                winnerCandidateID = majorityWinner
                let round = RankedChoiceRound(
                    id: rounds.count + 1,
                    activeCandidateIDs: orderedActive,
                    assignmentByBallotID: assignments,
                    countsByCandidateID: counts,
                    exhaustedBallotIDs: exhaustedBallotIDs.sorted(),
                    eliminatedCandidateID: nil,
                    tieCandidateIDs: [],
                    transfers: [],
                    explanation: "🏁 \(label(for: majorityWinner, in: candidates)) wins with \(counts[majorityWinner, default: 0]) active votes."
                )
                rounds.append(round)
                break
            }

            if orderedActive.count == 1, let only = orderedActive.first {
                winnerCandidateID = only
                let round = RankedChoiceRound(
                    id: rounds.count + 1,
                    activeCandidateIDs: orderedActive,
                    assignmentByBallotID: assignments,
                    countsByCandidateID: counts,
                    exhaustedBallotIDs: exhaustedBallotIDs.sorted(),
                    eliminatedCandidateID: nil,
                    tieCandidateIDs: [],
                    transfers: [],
                    explanation: "🏁 \(label(for: only, in: candidates)) is the last remaining candidate."
                )
                rounds.append(round)
                break
            }

            let lowestCount = orderedActive.map { counts[$0, default: 0] }.min() ?? 0
            let lowestCandidates = orderedActive.filter { counts[$0, default: 0] == lowestCount }
            let eliminated = lowestCandidates.first ?? orderedActive.first!
            let tieCandidates = lowestCandidates.count > 1 ? lowestCandidates : []

            if tieCandidates.count > 1 {
                let tieNames = tieCandidates.map { label(for: $0, in: candidates) }.joined(separator: ", ")
                let tieNote = "Tie detected for elimination among \(tieNames). Deterministic rule applied: lowest candidate ID is eliminated."
                tieBreakNotes.append(tieNote)
            }

            let activeAfterElimination = activeCandidates.subtracting([eliminated])
            let transfers = normalizedBallots.compactMap { ballot -> RankedChoiceTransfer? in
                guard assignments[ballot.id] == .candidate(eliminated) else { return nil }
                let nextCandidate = ballot.ranking.first(where: { activeAfterElimination.contains($0) })
                let destination: RankedChoiceAssignment = nextCandidate.map { .candidate($0) } ?? .exhausted
                return RankedChoiceTransfer(
                    ballotID: ballot.id,
                    fromCandidateID: eliminated,
                    toAssignment: destination
                )
            }
            .sorted { $0.ballotID < $1.ballotID }

            let round = RankedChoiceRound(
                id: rounds.count + 1,
                activeCandidateIDs: orderedActive,
                assignmentByBallotID: assignments,
                countsByCandidateID: counts,
                exhaustedBallotIDs: exhaustedBallotIDs.sorted(),
                eliminatedCandidateID: eliminated,
                tieCandidateIDs: tieCandidates,
                transfers: transfers,
                explanation: explanation(
                    eliminated: eliminated,
                    tieCandidates: tieCandidates,
                    candidates: candidates,
                    transferCount: transfers.count
                )
            )
            rounds.append(round)
            activeCandidates.remove(eliminated)
        }

        return RankedChoiceSimulationPlan(
            candidates: candidates,
            ballots: normalizedBallots,
            rounds: rounds,
            winnerCandidateID: winnerCandidateID,
            tieBreakNotes: tieBreakNotes
        )
    }

    private static func assignBallots(
        _ ballots: [RankedChoiceBallot],
        activeCandidates: Set<RankedChoiceCandidateID>
    ) -> [Int: RankedChoiceAssignment] {
        var assignments: [Int: RankedChoiceAssignment] = [:]
        assignments.reserveCapacity(ballots.count)

        for ballot in ballots {
            if let choice = ballot.ranking.first(where: { activeCandidates.contains($0) }) {
                assignments[ballot.id] = .candidate(choice)
            } else {
                assignments[ballot.id] = .exhausted
            }
        }
        return assignments
    }

    private static func explanation(
        eliminated: RankedChoiceCandidateID,
        tieCandidates: [RankedChoiceCandidateID],
        candidates: [RankedChoiceCandidate],
        transferCount: Int
    ) -> String {
        let eliminatedLabel = label(for: eliminated, in: candidates)
        if tieCandidates.count > 1 {
            return "🤝 Tie at the bottom. \(eliminatedLabel) is eliminated by tie-break rule. 🔁 \(transferCount) ballot(s) move to next choices."
        }
        return "⬇️ \(eliminatedLabel) has the fewest votes and is eliminated. 🔁 \(transferCount) ballot(s) move to next choices."
    }

    private static func label(
        for candidateID: RankedChoiceCandidateID,
        in candidates: [RankedChoiceCandidate]
    ) -> String {
        candidates.first(where: { $0.id == candidateID })?.label ?? "Candidate \(candidateID + 1)"
    }

    private static func weightedIndex<R: RandomNumberGenerator>(
        from weights: [Double],
        rng: inout R
    ) -> Int {
        let total = weights.reduce(0, +)
        guard total > 0 else { return Int.random(in: 0..<max(1, weights.count), using: &rng) }

        let target = Double.random(in: 0...total, using: &rng)
        var running = 0.0
        for (index, weight) in weights.enumerated() {
            running += max(0, weight)
            if target <= running {
                return index
            }
        }
        return max(0, weights.count - 1)
    }
}

private struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed == 0 ? 0x9E3779B97F4A7C15 : seed
    }

    mutating func next() -> UInt64 {
        state ^= state >> 12
        state ^= state << 25
        state ^= state >> 27
        return state &* 2_685_821_657_736_338_717
    }
}
