import XCTest

final class IssueCallCenterFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOpenIssueCallCenterFromMyReps() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["myreps.call_on_issue_button"]
        XCTAssertTrue(button.waitForExistence(timeout: 6))
        button.tap()

        let tabs = app.segmentedControls["issue_call.tabs"]
        XCTAssertTrue(tabs.waitForExistence(timeout: 6))
    }
}
