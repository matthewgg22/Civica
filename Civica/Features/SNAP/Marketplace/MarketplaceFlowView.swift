import CivicaDesignSystem
import SwiftUI

// DEPRECATED — use SNAPMarketplaceFlow instead.
// This family (MarketplaceFlowView / JobMatchListView / BenefitImpactView /
// ApplyHandoffSheet / PostPlacementView) is the prior implementation and is
// retained only because MarketplaceUITestHarness + MarketplaceFlowUITests still
// exercise it. Consolidation into the SNAPMarketplace* family is tracked as a
// separate follow-on PR.
struct MarketplaceFlowView: View {
    let state: MarketplaceState
    @State private var path = NavigationPath()
    @State private var applySheetJob: MarketplaceJob?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack(path: $path) {
            JobMatchListView(
                state: state,
                incomeCap: state.incomeCap,
                onSelectJob: { job in path.append(job) },
                onShowMore: {},
                onFilter: {}
            )
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .accessibilityLabel(Text("Close"))
                    }
                }
            }
            .accessibilityIdentifier("marketplace.job_list")
            .navigationDestination(for: MarketplaceJob.self) { job in
                BenefitImpactView(
                    job: job,
                    onApply: { applySheetJob = job },
                    onBack: { path.removeLast() }
                )
                .accessibilityIdentifier("marketplace.benefit_impact")
            }
        }
        .sheet(item: $applySheetJob) { job in
            NavigationStack {
                ApplyHandoffSheet(
                    job: job,
                    onHandoffLogged: { applySheetJob = nil }
                )
                .accessibilityIdentifier("marketplace.handoff_sheet")
            }
        }
    }
}

#Preview {
    MarketplaceFlowView(
        state: MarketplaceState(
            canvasConnected: true,
            argyleConnected: true,
            currentBenefitUSD: 292,
            incomeCap: 1580,
            jobs: [
                MarketplaceJob(
                    id: "1", title: "Campus Dining", employerName: "Campus Dining",
                    type: .fws, scheduleDescription: "12 hr/wk",
                    monthlyAmountUSD: 600, pillText: "FWS — not counted",
                    handshakeJobURL: nil, fallbackCareerURL: nil,
                    projectedBenefitUSD: 292, currentBenefitUSD: 292
                ),
                MarketplaceJob(
                    id: "2", title: "Dining Services", employerName: "Dining Services",
                    type: .w2, scheduleDescription: "16 hr/wk",
                    monthlyAmountUSD: 612, pillText: "Counts as income",
                    handshakeJobURL: nil, fallbackCareerURL: nil,
                    projectedBenefitUSD: 214, currentBenefitUSD: 292
                ),
            ],
            confirmedJobID: nil,
            confirmedPaycheckDate: nil,
            obbbaHoursCompleted: 0,
            obbbaHoursRequired: 0,
            currentMonth: "May"
        )
    )
}
