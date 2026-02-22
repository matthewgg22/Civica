import Testing
@testable import VoteNow

struct AbsenteeBallotRequestProviderTests {
    @Test func deadlineRowsUseFallbackWhenMissingValues() {
        let jurisdiction = AbsenteeBallotJurisdiction(
            displayName: "California",
            slug: "california",
            code: "CA",
            officialVoterInfoUrl: "https://www.eac.gov/california-voter-info",
            requestApplyUrl: "https://www.vote.org/absentee-ballot/california/",
            requestDeadlineInPerson: nil,
            requestDeadlineOnlineEmail: "7 days before election",
            requestDeadlineByMail: "",
            deadlineSourceUrl: nil,
            notes: nil
        )

        let rows = jurisdiction.deadlineRows()
        #expect(rows.count == 3)
        #expect(rows[0].label == "In person")
        #expect(rows[0].value == AbsenteeBallotRequestProvider.fallbackDeadlineText)
        #expect(rows[1].label == "Online / Email")
        #expect(rows[1].value == "7 days before election")
        #expect(rows[2].label == "By mail")
        #expect(rows[2].value == AbsenteeBallotRequestProvider.fallbackDeadlineText)
    }

    @Test func jurisdictionMatchSupportsNameAndCodeQueries() {
        let jurisdiction = AbsenteeBallotJurisdiction(
            displayName: "Puerto Rico",
            slug: "puerto-rico",
            code: "PR",
            officialVoterInfoUrl: "https://www.eac.gov/puerto-rico-voter-info",
            requestApplyUrl: "https://example.org/pr",
            requestDeadlineInPerson: nil,
            requestDeadlineOnlineEmail: nil,
            requestDeadlineByMail: nil,
            deadlineSourceUrl: nil,
            notes: nil
        )

        #expect(jurisdiction.matches(search: "puerto"))
        #expect(jurisdiction.matches(search: "pr"))
        #expect(!jurisdiction.matches(search: "california"))
    }

    @Test func resolveDefaultJurisdictionCodeHandlesStateNameAndCode() {
        #expect(
            AbsenteeBallotRequestProvider.resolveDefaultJurisdictionCode(
                userState: "California",
                primaryZip: "",
                fallbackZip: ""
            ) == "CA"
        )

        #expect(
            AbsenteeBallotRequestProvider.resolveDefaultJurisdictionCode(
                userState: "dc",
                primaryZip: "",
                fallbackZip: ""
            ) == "DC"
        )
    }

    @Test func selectedJurisdictionExposesExpectedLinksAndDeadlineRows() {
        let jurisdiction = AbsenteeBallotJurisdiction(
            displayName: "Florida",
            slug: "florida",
            code: "FL",
            officialVoterInfoUrl: "https://www.eac.gov/florida-voter-info",
            requestApplyUrl: "https://www.vote.org/absentee-ballot/florida/",
            requestDeadlineInPerson: "Election Day",
            requestDeadlineOnlineEmail: nil,
            requestDeadlineByMail: "10 days before election",
            deadlineSourceUrl: "https://example.com/deadline-source",
            notes: "Sample note"
        )

        #expect(jurisdiction.requestApplyURL?.absoluteString == "https://www.vote.org/absentee-ballot/florida/")
        #expect(jurisdiction.officialVoterInfoURL?.absoluteString == "https://www.eac.gov/florida-voter-info")
        #expect(jurisdiction.deadlineSourceURL?.absoluteString == "https://example.com/deadline-source")

        let labels = jurisdiction.deadlineRows().map(\\.label)
        #expect(labels == ["In person", "Online / Email", "By mail"])
    }
}
