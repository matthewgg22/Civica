import CivicaDesignSystem
import SwiftUI

// Lightweight harness mounted only when the app is launched with
// --marketplace-ui-test. Injects known fixture data so the UI tests
// can walk Screens 2–5 deterministically without network calls.
// Not compiled into release builds (launch arg is never set in prod).
struct MarketplaceUITestHarness: View {
    @State private var showPostPlacement = false

    private let fixtureState = MarketplaceState(
        canvasConnected: true,
        argyleConnected: true,
        currentBenefitUSD: 292,
        incomeCap: 1580,
        jobs: [
            MarketplaceJob(
                id: "fws-1",
                title: "Library Assistant",
                employerName: "University Library",
                type: .fws,
                scheduleDescription: "10 hr/wk",
                monthlyAmountUSD: 480,
                pillText: "FWS — not counted",
                handshakeJobURL: nil,
                fallbackCareerURL: URL(string: "https://careers.example.edu"),
                projectedBenefitUSD: 292,
                currentBenefitUSD: 292
            ),
            MarketplaceJob(
                id: "w2-1",
                title: "Dining Services",
                employerName: "Campus Dining",
                type: .w2,
                scheduleDescription: "16 hr/wk",
                monthlyAmountUSD: 612,
                pillText: "Counts as income",
                handshakeJobURL: URL(string: "https://app.joinhandshake.com/jobs/1"),
                fallbackCareerURL: nil,
                projectedBenefitUSD: 214,
                currentBenefitUSD: 292
            ),
        ],
        confirmedJobID: nil,
        confirmedPaycheckDate: nil,
        obbbaHoursCompleted: 32,
        obbbaHoursRequired: 80,
        currentMonth: "May"
    )

    private let fixtureCliffJob = MarketplaceJob(
        id: "ft-1",
        title: "Full-Time Role",
        employerName: "Tech Corp",
        type: .w2,
        scheduleDescription: "40 hr/wk",
        monthlyAmountUSD: 3_200,
        pillText: "Counts as income",
        handshakeJobURL: nil,
        fallbackCareerURL: nil,
        projectedBenefitUSD: 0,
        currentBenefitUSD: 292
    )

    var body: some View {
        VStack(spacing: 0) {
            MarketplaceFlowView(state: fixtureState)

            // Toggle button so the UI test can reach Screen 5 (PostPlacementView)
            // without a real Argyle webhook. Positioned off-screen via padding so
            // it doesn't overlap the marketplace UI but is still tappable.
            Button("Show post-placement") { showPostPlacement = true }
                .accessibilityIdentifier("marketplace.test.show_post_placement")
                .opacity(0.01)
                .padding(.bottom, 1)
        }
        .sheet(isPresented: $showPostPlacement) {
            NavigationStack {
                PostPlacementView(
                    state: fixtureState,
                    confirmedJob: fixtureCliffJob,
                    confirmedPaycheckDate: Date(),
                    previousBenefitUSD: 292,
                    onReportProblem: {},
                    onSeeBreakdown: {},
                    navigatorOutreachScheduled: true
                )
            }
        }
    }
}
