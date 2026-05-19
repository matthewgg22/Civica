import SwiftUI

// MARK: - Navigation destination enum

enum SNAPMarketplaceDestination: Hashable {
    case jobs
    case jobImpact(jobId: UUID)
    case placementUpdate
    case recertRefresh
    case interviewPrep
}

// MARK: - Flow wrapper

/// Root `NavigationStack` for the SNAP student-marketplace flow.
///
/// Owns the single `SNAPMarketplaceViewModel` instance and routes
/// between all 6 screens. Screen 04 (Apply handoff) is a `.sheet`
/// presented from Screen 03.
///
/// Entry point: present `SNAPMarketplaceFlow` from any surface that
/// holds the enrollment-approved state:
///   - push `SNAPMarketplaceFlow()` into an existing NavigationStack, or
///   - present it as a `fullScreenCover`.
///
/// Navigation map:
///   01 Enrolled    → [See jobs]      → 02 Jobs
///   02 Jobs        → [tap row]       → 03 Impact
///   03 Impact      → [Apply]         → 04 Apply (sheet)
///   04 Apply       → [Continue →]    → external URL (Handshake OAuth)
///   05 Update      → [See breakdown] → 03 Impact
///   06 Recertify   → [Interview prep]→ PracticeSessionView
struct SNAPMarketplaceFlow: View {

    @StateObject private var vm = SNAPMarketplaceViewModel()
    @State private var path: [SNAPMarketplaceDestination] = []
    @State private var showApplySheet = false

    /// Injected dismiss closure — used by "I'll come back later" on Screen 01.
    var onDismiss: (() -> Void)?

    var body: some View {
        NavigationStack(path: $path) {
            SNAPEnrolledView(
                vm: vm,
                onSeeJobs: {
                    path.append(.jobs)
                },
                onLater: {
                    onDismiss?()
                }
            )
            .navigationDestination(for: SNAPMarketplaceDestination.self) { dest in
                switch dest {
                case .jobs:
                    SNAPJobsView(vm: vm, onSelectJob: { job in
                        vm.selectedJob = job
                        path.append(.jobImpact(jobId: job.id))
                    })

                case .jobImpact(let jobId):
                    if let job = vm.jobs.first(where: { $0.id == jobId }) {
                        SNAPJobImpactView(
                            vm: vm,
                            job: job,
                            onApply: {
                                showApplySheet = true
                            },
                            onSaveForLater: {
                                // TODO: show toast then pop
                                path.removeLast()
                            }
                        )
                        .sheet(isPresented: $showApplySheet) {
                            SNAPApplyHandoffView(vm: vm)
                        }
                    }

                case .placementUpdate:
                    SNAPPlacementUpdateView(
                        vm: vm,
                        onSeeBreakdown: {
                            // Navigate to impact view with the placed job; fall back to first job
                            if let jobId = vm.placement.jobId {
                                path.append(.jobImpact(jobId: jobId))
                            } else if let firstJob = vm.jobs.first {
                                path.append(.jobImpact(jobId: firstJob.id))
                            }
                        },
                        onReportProblem: {
                            // TODO: wire to support form
                        }
                    )

                case .recertRefresh:
                    SNAPRecertRefreshView(
                        vm: vm,
                        onSubmit: {
                            vm.recertification.status = .submitted
                            path.removeLast()
                        },
                        onSaveForLater: {
                            path.removeLast()
                        },
                        onInterviewPrep: {
                            // PracticeSessionView lives in RecertificationCompanion.
                            // Uses the same pattern as RecertCompanionRoot.interviewCoachEntryTile.
                            path.append(.interviewPrep)
                        }
                    )

                case .interviewPrep:
                    PracticeSessionView()
                }
            }
        }
        .background(Color.civicaPaper.ignoresSafeArea())
    }
}

// MARK: - Convenience entry points

extension SNAPMarketplaceFlow {
    /// Present Screen 05 directly (e.g. from a push notification tap).
    static func placementUpdateEntry(onDismiss: (() -> Void)? = nil) -> some View {
        SNAPMarketplaceFlow(path: [.placementUpdate], onDismiss: onDismiss)
    }

    /// Present Screen 06 directly (e.g. from a scheduled push notification).
    static func recertRefreshEntry(onDismiss: (() -> Void)? = nil) -> some View {
        SNAPMarketplaceFlow(path: [.recertRefresh], onDismiss: onDismiss)
    }

    private init(path: [SNAPMarketplaceDestination], onDismiss: (() -> Void)? = nil) {
        self._path = State(initialValue: path)
        self.onDismiss = onDismiss
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Full flow from Screen 01") {
    SNAPMarketplaceFlow()
}

#Preview("Placement update entry") {
    SNAPMarketplaceFlow.placementUpdateEntry()
}

#Preview("Recert refresh entry") {
    SNAPMarketplaceFlow.recertRefreshEntry()
}
#endif
