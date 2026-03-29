import Testing
@testable import VoteNow

struct RankedChoiceEngineTests {
    @Test func majorityWinnerCanBeDetectedInRoundOne() {
        let candidates = [
            RankedChoiceCandidate(id: 0, label: "Candidate A1"),
            RankedChoiceCandidate(id: 1, label: "Candidate A2"),
            RankedChoiceCandidate(id: 2, label: "Candidate A3")
        ]
        let ballots = [
            RankedChoiceBallot(id: 0, ranking: [0, 1, 2]),
            RankedChoiceBallot(id: 1, ranking: [0, 2, 1]),
            RankedChoiceBallot(id: 2, ranking: [0, 1, 2]),
            RankedChoiceBallot(id: 3, ranking: [1, 0, 2]),
            RankedChoiceBallot(id: 4, ranking: [2, 1, 0])
        ]

        let plan = RankedChoiceEngine.buildSimulation(candidates: candidates, ballots: ballots)

        #expect(plan.winnerCandidateID == 0)
        #expect(plan.rounds.count == 1)
        #expect(plan.rounds[0].winnerCandidateID == 0)
    }

    @Test func eliminationTransferCanExhaustBallots() {
        let candidates = [
            RankedChoiceCandidate(id: 0, label: "Candidate A1"),
            RankedChoiceCandidate(id: 1, label: "Candidate A2"),
            RankedChoiceCandidate(id: 2, label: "Candidate A3")
        ]
        let ballots = [
            RankedChoiceBallot(id: 0, ranking: [0]),
            RankedChoiceBallot(id: 1, ranking: [1, 2]),
            RankedChoiceBallot(id: 2, ranking: [1, 2]),
            RankedChoiceBallot(id: 3, ranking: [2, 1]),
            RankedChoiceBallot(id: 4, ranking: [2, 1])
        ]

        let plan = RankedChoiceEngine.buildSimulation(candidates: candidates, ballots: ballots)
        let firstRound = try #require(plan.rounds.first)
        let exhaustedTransfer = firstRound.transfers.first(where: { $0.ballotID == 0 })

        #expect(firstRound.eliminatedCandidateID == 0)
        #expect(exhaustedTransfer?.toAssignment == .exhausted)
        #expect(plan.winnerCandidateID == 2)
    }

    @Test func lowestVoteTieUsesDeterministicRule() {
        let candidates = [
            RankedChoiceCandidate(id: 0, label: "Candidate A1"),
            RankedChoiceCandidate(id: 1, label: "Candidate A2"),
            RankedChoiceCandidate(id: 2, label: "Candidate A3")
        ]
        let ballots = [
            RankedChoiceBallot(id: 0, ranking: [0, 2]),
            RankedChoiceBallot(id: 1, ranking: [1, 2]),
            RankedChoiceBallot(id: 2, ranking: [2, 0]),
            RankedChoiceBallot(id: 3, ranking: [2, 1])
        ]

        let plan = RankedChoiceEngine.buildSimulation(candidates: candidates, ballots: ballots)
        let firstRound = try #require(plan.rounds.first)

        #expect(firstRound.tieCandidateIDs == [0, 1])
        #expect(firstRound.eliminatedCandidateID == 0)
        #expect(plan.tieBreakNotes.isEmpty == false)
    }

    @Test func assignmentsAreTrackedForEveryBallotEachRound() throws {
        let plan = RankedChoiceEngine.makeDemoPlan(
            voterCount: 120,
            candidateCount: 6,
            seed: 12_345
        )
        let ballotIDs = Set(plan.ballots.map(\.id))

        #expect(plan.rounds.isEmpty == false)
        for round in plan.rounds {
            let assignedIDs = Set(round.assignmentByBallotID.keys)
            #expect(assignedIDs == ballotIDs)
        }
    }
}
