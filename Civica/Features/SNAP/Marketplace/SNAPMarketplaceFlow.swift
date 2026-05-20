import CivicaDesignSystem
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

    // Task 1: "Save for later" toast
    @State private var savedJobTitle: String? = nil
    @State private var bannerDismissTask: Task<Void, Never>? = nil

    // Task 2: "Report a problem" sheet
    @State private var showReportSheet = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

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
                                if let matchedJob = vm.jobs.first(where: { $0.id == jobId }) {
                                    savedJobTitle = matchedJob.title
                                }
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
                            showReportSheet = true
                        },
                        onNavigatorEscalate: {
                            // TODO: open NavigatorInboxView pre-filled with vm.navigatorPreFillMessage
                            // Example: path.append(.navigatorInbox(prefill: vm.navigatorPreFillMessage))
                            // Wiring blocked until navigator inbox deep-link API is confirmed.
                            showReportSheet = true
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
        .task { await vm.refreshArgyleStatus() }
        .overlay(alignment: .bottom) {
            if savedJobTitle != nil {
                SavedForLaterBanner(language: language)
                    .padding(.bottom, CivicaSpacing.xxl)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: savedJobTitle)
        .onChange(of: savedJobTitle) { _, newValue in
            guard newValue != nil else { return }
            bannerDismissTask?.cancel()
            bannerDismissTask = Task { @MainActor in
                try? await Task.sleep(for: .seconds(2.5))
                guard !Task.isCancelled else { return }
                savedJobTitle = nil
            }
        }
        .sheet(isPresented: $showReportSheet) {
            SNAPReportProblemView()
        }
    }
}

// MARK: - Save for later banner

private struct SavedForLaterBanner: View {
    let language: CivicaLanguage

    private var label: String {
        language == .spanish ? "Guardado para después" : "Saved for later"
    }

    var body: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(CivicaColors.onPrimaryText)
            Text(label)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.onPrimaryText)
        }
        .padding(.vertical, CivicaSpacing.sm)
        .padding(.horizontal, CivicaSpacing.lg)
        .background(CivicaColors.accentTeal)
        .clipShape(Capsule())
        .shadow(color: CivicaColors.shadowSoft, radius: 4, x: 0, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
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
