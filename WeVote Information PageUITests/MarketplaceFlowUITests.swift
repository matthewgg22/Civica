import XCTest

// T-DR3-13 — Single E2E UI test walking the employer marketplace Screens 2–5.
// Launched with --marketplace-ui-test so the app mounts MarketplaceUITestHarness
// instead of CivicaRootView, injecting deterministic fixture data.
final class MarketplaceFlowUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--marketplace-ui-test"]
        app.launch()
    }

    // ── Screen 2 → Screen 3 → Sheet (Screen 4) ───────────────────────────

    @MainActor
    func testMarketplaceJobBrowseToApplyFlow() throws {
        // Screen 2: Job list loads with fixture jobs
        let jobList = app.otherElements["marketplace.job_list"]
        XCTAssertTrue(jobList.waitForExistence(timeout: 8), "marketplace.job_list should be visible")

        // First job row (FWS — benefit-ranked first)
        let fwsRow = app.otherElements["marketplace.job_row.fws-1"]
        XCTAssertTrue(fwsRow.waitForExistence(timeout: 6), "FWS job row should appear in Screen 2")
        fwsRow.tap()

        // Screen 3: BenefitImpactView for the FWS job
        let benefitImpact = app.otherElements["marketplace.benefit_impact"]
        XCTAssertTrue(benefitImpact.waitForExistence(timeout: 6), "BenefitImpactView should appear after tapping job")

        // FWS job has a fallback URL — apply button is fallback, not Handshake
        // Navigate back and try the W-2 job which has a Handshake URL
        app.navigationBars.buttons.firstMatch.tap()   // Back

        let w2Row = app.otherElements["marketplace.job_row.w2-1"]
        XCTAssertTrue(w2Row.waitForExistence(timeout: 6), "W-2 job row should appear in Screen 2")
        w2Row.tap()

        // Screen 3: BenefitImpactView for the W-2 job
        XCTAssertTrue(benefitImpact.waitForExistence(timeout: 6))

        // Screen 3 CTA: "Apply via Handshake"
        let applyButton = app.buttons["marketplace.benefit_impact.apply_button"]
        XCTAssertTrue(applyButton.waitForExistence(timeout: 6), "Apply button should be visible on BenefitImpactView")
        applyButton.tap()

        // Screen 4: ApplyHandoffSheet slides up
        let handshakeButton = app.buttons["marketplace.handoff.apply_handshake"]
        XCTAssertTrue(handshakeButton.waitForExistence(timeout: 6), "Handshake apply button should appear in sheet")
    }

    // ── Screen 5: PostPlacementView cliff event ───────────────────────────

    @MainActor
    func testPostPlacementCliffBannerVisible() throws {
        // Trigger Screen 5 via the harness toggle
        let trigger = app.buttons["marketplace.test.show_post_placement"]
        XCTAssertTrue(trigger.waitForExistence(timeout: 8), "Harness post-placement trigger must exist")
        trigger.tap()

        // Screen 5: cliff banner
        let cliffBanner = app.otherElements["marketplace.post_placement.cliff_banner"]
        XCTAssertTrue(cliffBanner.waitForExistence(timeout: 6), "Cliff event banner should appear on PostPlacementView")

        // Screen 5: see breakdown button
        let breakdownButton = app.buttons["marketplace.post_placement.see_breakdown"]
        XCTAssertTrue(breakdownButton.waitForExistence(timeout: 4), "See breakdown button should be visible")
    }
}
