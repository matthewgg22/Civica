import SwiftUI
import Testing
@testable import VoteNow

@MainActor
struct IssueCallCenterViewSnapshotTests {
    @Test
    func issueCallCenterRendersSnapshotImage() {
        let reps = [
            Official(
                name: "House Test",
                divisionId: "ocd-division/country:us/state:ny/cd:10",
                party: "Independent",
                officeTitle: "U.S. Representative",
                photoURL: nil,
                officialPhone: "(202) 555-1001"
            ),
            Official(
                name: "Senator Test",
                divisionId: "ocd-division/country:us/state:ny",
                party: "Independent",
                officeTitle: "U.S. Senator",
                photoURL: nil,
                officialPhone: "(202) 555-1002"
            )
        ]

        let view = IssueCallCenterView(federalReps: reps, userZip: "10001")
            .frame(width: 390, height: 844)

        let renderer = ImageRenderer(content: view)
        let image = renderer.uiImage
        #expect(image != nil)
        #expect(image?.size.width == 390)
        #expect(image?.size.height == 844)
    }
}
