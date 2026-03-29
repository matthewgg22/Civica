import Testing
@testable import VoteNow

struct RunoffThresholdGateEngineTests {
    @Test func adjustedSharesKeepTotalAtOneHundred() {
        let start = [41.0, 34.0, 25.0]
        let updated = RunoffThresholdGateEngine.adjustedShares(
            currentShares: start,
            updating: 0,
            to: 50
        )

        let total = updated.reduce(0, +)
        #expect(abs(total - 100.0) < 0.000_001)
        #expect(abs(updated[0] - 50.0) < 0.000_001)
    }

    @Test func roundOneSampleProducesNoMajorityAndTopTwo() {
        let result = RunoffThresholdGateEngine.roundOneResult(
            shares: [41, 34, 25],
            threshold: 50
        )

        #expect(result.majorityWinnerIndex == nil)
        #expect(result.topTwoIndices == [0, 1])
    }

    @Test func defaultTransferSplitsProduceSampleRoundTwo() {
        let runoff = RunoffThresholdGateEngine.runoffShares(
            roundOneShares: [41, 34, 25],
            transferToFirstFinalistByCandidateID: RunoffThresholdGateEngine.defaultTransferToFirstFinalistByCandidateID,
            finalists: [0, 1]
        )

        #expect(runoff.count == 2)
        #expect(abs(runoff[0] - 48.0) < 0.000_001)
        #expect(abs(runoff[1] - 52.0) < 0.000_001)
    }

    @Test func majorityWinnerDetectedWhenThresholdMet() {
        let result = RunoffThresholdGateEngine.roundOneResult(
            shares: [52, 30, 18],
            threshold: 50
        )

        #expect(result.majorityWinnerIndex == 0)
        #expect(result.hasMajorityWinner)
    }
}
