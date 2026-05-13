import Foundation
import Testing
@testable import Civica

// Locks in the coarse 3-digit-prefix + override map for CalFresh
// county routing. The resolver is intentionally approximate; these
// tests pin the canonical answer for the major metros and the few
// well-known 5-digit overrides so a "tidy" prefix-table edit can't
// silently flip Los Angeles to Riverside or Big Sur back to Kern.

struct CACountyResolverTests {

    // MARK: - Major-metro routing

    @Test func zip90012ResolvesToLosAngeles() {
        // Downtown LA (City Hall area).
        #expect(CACountyResolver.county(forZIP: "90012") == "Los Angeles")
    }

    @Test func zip94102ResolvesToSanFrancisco() {
        // Civic Center / Tenderloin.
        #expect(CACountyResolver.county(forZIP: "94102") == "San Francisco")
    }

    @Test func zip94601ResolvesToAlameda() {
        // East Oakland.
        #expect(CACountyResolver.county(forZIP: "94601") == "Alameda")
    }

    @Test func zip94087ResolvesToSantaClara() {
        // Sunnyvale.
        #expect(CACountyResolver.county(forZIP: "94087") == "Santa Clara")
    }

    @Test func zip95814ResolvesToSacramento() {
        // Downtown Sacramento (state hearings division ZIP).
        #expect(CACountyResolver.county(forZIP: "95814") == "Sacramento")
    }

    @Test func zip92101ResolvesToSanDiego() {
        // Downtown San Diego.
        #expect(CACountyResolver.county(forZIP: "92101") == "San Diego")
    }

    @Test func zip92501ResolvesToRiverside() {
        // Downtown Riverside.
        #expect(CACountyResolver.county(forZIP: "92501") == "Riverside")
    }

    @Test func zip92801ResolvesToOrange() {
        // Anaheim (Northgate Market seed-data anchor).
        #expect(CACountyResolver.county(forZIP: "92801") == "Orange")
    }

    @Test func zip93701ResolvesToFresno() {
        // Downtown Fresno.
        #expect(CACountyResolver.county(forZIP: "93701") == "Fresno")
    }

    @Test func zip94710ResolvesToAlameda() {
        // West Berkeley (Berkeley Bowl West seed-data anchor).
        #expect(CACountyResolver.county(forZIP: "94710") == "Alameda")
    }

    // MARK: - Five-digit overrides

    @Test func zip96150OverridesToElDorado() {
        // South Lake Tahoe — the 961 prefix table says El Dorado;
        // override re-confirms it through the override path so a
        // future edit to the prefix table doesn't silently break.
        #expect(CACountyResolver.county(forZIP: "96150") == "El Dorado")
    }

    @Test func zip93920OverridesToMonterey() {
        // Big Sur — would resolve to Monterey via override; the
        // 939 prefix routes Monterey already, so this guards
        // future prefix-table re-routing.
        #expect(CACountyResolver.county(forZIP: "93920") == "Monterey")
    }

    // MARK: - Edge cases

    @Test func nonCAZipReturnsNil() {
        #expect(CACountyResolver.county(forZIP: "02111") == nil)   // MA
        #expect(CACountyResolver.county(forZIP: "10001") == nil)   // NY
    }

    @Test func nilZipReturnsNil() {
        #expect(CACountyResolver.county(forZIP: nil) == nil)
    }

    @Test func emptyZipReturnsNil() {
        #expect(CACountyResolver.county(forZIP: "") == nil)
        #expect(CACountyResolver.county(forZIP: "    ") == nil)
    }

    @Test func malformedZipReturnsNil() {
        #expect(CACountyResolver.county(forZIP: "9012") == nil)     // 4 digits
        #expect(CACountyResolver.county(forZIP: "9001Z") == nil)    // non-digit
        #expect(CACountyResolver.county(forZIP: "900120") == nil)   // 6 digits
    }

    @Test func zipPlusFourIsTruncatedAndResolved() {
        #expect(CACountyResolver.county(forZIP: "90012-1234") == "Los Angeles")
    }

    @Test func leadingTrailingWhitespaceIsTrimmed() {
        #expect(CACountyResolver.county(forZIP: " 94102 ") == "San Francisco")
    }

    // MARK: - hasCountyMapping

    @Test func hasCountyMappingTrueForCA() {
        #expect(CACountyResolver.hasCountyMapping(forZIP: "94102"))
    }

    @Test func hasCountyMappingFalseForMAZip() {
        #expect(!CACountyResolver.hasCountyMapping(forZIP: "02111"))
    }
}
