import Testing
import CoreLocation
@testable import VoteNow

struct WhyVoteDataStoreTests {
    @Test func inferStateCodeMatchesExpectedAddressFormats() {
        #expect(inferStateCode(from: "New York, NY") == "NY")
        #expect(inferStateCode(from: "Brooklyn NY 11201") == "NY")
        #expect(inferStateCode(from: "Los Angeles, California") == "CA")
        #expect(inferStateCode(from: "Miami, FL 33101") == "FL")
    }

    @Test func inferStateCodeHandlesLowercaseSpacesAndMissingCommas() {
        #expect(inferStateCode(from: "  los angeles   california   ") == "CA")
        #expect(inferStateCode(from: "miami fl 33101") == "FL")
        #expect(inferStateCode(from: "  brooklyn    ny   11201 ") == "NY")
        #expect(inferStateCode(from: "") == nil)
    }

    @Test func closeElectionVotesContextUsesFloorBucket() {
        #expect(CloseElectionContextMaker.votesContext(for: 17) == "everyone at a dinner table arguing")
        #expect(CloseElectionContextMaker.votesContext(for: 120) == "everyone at a wedding reception")
        #expect(CloseElectionContextMaker.votesContext(for: 400) == "a high school assembly")
    }

    @Test func closeElectionPercentNormalizationConvertsBothEncodings() {
        let fromPercent = CloseElectionContextMaker.resolve(
            marginVotes: nil,
            marginPercent: 0.2,
            totalVotesCast: 200_000
        )
        #expect(fromPercent.votes == 400)
        #expect(fromPercent.source == "computedFromPercent")

        let fromFraction = CloseElectionContextMaker.resolve(
            marginVotes: nil,
            marginPercent: 0.002,
            totalVotesCast: 200_000
        )
        #expect(fromFraction.votes == 400)
        #expect(fromFraction.source == "computedFromPercent")
    }

    @Test func repsLookupParserRecognizesZipAndAddress() {
        #expect(RepsLookupInputParser.parse("34242") == .zip("34242"))
        #expect(RepsLookupInputParser.parse("877 Siesta Key Cir, Sarasota, FL 34242") == .address("877 Siesta Key Cir, Sarasota, FL 34242"))
        #expect(RepsLookupInputParser.parse("12") == .invalid)
    }

    @Test func usGeoGuardRejectsNonUSCoordinate() {
        let moscow = CLLocationCoordinate2D(latitude: 55.7558, longitude: 37.6173)
        let siestaKey = CLLocationCoordinate2D(latitude: 27.267, longitude: -82.547)
        #expect(USGeoGuard.isAllowedUSCoordinate(moscow) == false)
        #expect(USGeoGuard.isAllowedUSCoordinate(siestaKey) == true)
    }
}
