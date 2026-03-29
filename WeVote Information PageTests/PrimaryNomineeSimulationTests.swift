import Testing
@testable import VoteNow

struct PrimaryNomineeSimulationTests {
    @Test func outcomeRanksCandidatesAndAdvancesTopNominee() {
        let candidates = PrimaryNomineeSimulationEngine.makeMockCandidates(count: 8)
        var weights = PrimaryNomineeSimulationEngine.defaultVoteWeights(for: candidates)

        let partyA = candidates.filter { $0.party == .partyA }
        #expect(partyA.count == 4)

        weights[partyA[0].id] = 12
        weights[partyA[1].id] = 40
        weights[partyA[2].id] = 28
        weights[partyA[3].id] = 20

        let outcome = PrimaryNomineeSimulationEngine.outcome(
            for: .partyA,
            candidates: candidates,
            voteWeights: weights
        )

        #expect(outcome.ranked.count == 4)
        #expect(outcome.nominee?.candidate.id == partyA[1].id)
        #expect(outcome.ranked.map(\.rank) == [1, 2, 3, 4])
    }

    @Test func outcomeNormalizesVoteSharesToOneHundredPercent() {
        let candidates = PrimaryNomineeSimulationEngine.makeMockCandidates(count: 6)
        var weights = PrimaryNomineeSimulationEngine.defaultVoteWeights(for: candidates)

        let partyB = candidates.filter { $0.party == .partyB }
        #expect(!partyB.isEmpty)

        for candidate in partyB {
            weights[candidate.id] = 25
        }

        let outcome = PrimaryNomineeSimulationEngine.outcome(
            for: .partyB,
            candidates: candidates,
            voteWeights: weights
        )

        let shareTotal = outcome.ranked.reduce(0.0) { partial, row in
            partial + row.voteShare
        }

        #expect(abs(shareTotal - 1.0) < 0.000_001)
    }

    @Test func tiesBreakByCandidateIdForDeterministicNominee() {
        let candidates = PrimaryNomineeSimulationEngine.makeMockCandidates(count: 8)
        var weights = PrimaryNomineeSimulationEngine.defaultVoteWeights(for: candidates)

        let partyA = candidates.filter { $0.party == .partyA }
        #expect(partyA.count == 4)

        for candidate in partyA {
            weights[candidate.id] = 50
        }

        let outcome = PrimaryNomineeSimulationEngine.outcome(
            for: .partyA,
            candidates: candidates,
            voteWeights: weights
        )

        let expectedLowestID = partyA.map(\.id).min()
        #expect(outcome.nominee?.candidate.id == expectedLowestID)
    }

    @Test func simulateVotesOnlyMutatesSelectedPartyWeights() {
        let candidates = PrimaryNomineeSimulationEngine.makeMockCandidates(count: 8)
        let baseline = PrimaryNomineeSimulationEngine.defaultVoteWeights(for: candidates)

        let updated = PrimaryNomineeSimulationEngine.simulateVotes(
            for: .partyA,
            candidates: candidates,
            existingWeights: baseline,
            randomValues: [0.1, 0.2, 0.3, 0.4]
        )

        let partyAIDs = Set(candidates.filter { $0.party == .partyA }.map(\.id))
        let partyB = candidates.filter { $0.party == .partyB }

        for candidate in partyB {
            #expect(updated[candidate.id] == baseline[candidate.id])
        }

        for candidateID in partyAIDs {
            #expect(updated[candidateID] != nil)
            #expect(updated[candidateID]! > 0)
        }
    }
}
