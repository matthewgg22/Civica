import SwiftUI
import ActivityKit
import UIKit

struct MAPVCardView: View {
    @EnvironmentObject private var mapvPlanStore: MAPVPlanStore
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale

    let waterfallController: EmojiWaterfallController
    var previewPlan: MAPVPlan? = nil
    var isVotedActionEnabled: Bool = true
    var onChangePlanTapped: (() -> Void)? = nil

    @State private var now = Date()
    @State private var shareImage: UIImage?
    @State private var showingShare = false
    private let minuteTicker = Timer.publish(every: 60, on: .main, in: .common).autoconnect()
    private let cardCornerRadius: CGFloat = 14
    private let mapvCardBackground = Color(red: 243 / 255, green: 235 / 255, blue: 203 / 255)

    var body: some View {
        let displayPlan = previewPlan ?? mapvPlanStore.plan
        Group {
            if let plan = displayPlan {
                card(plan: plan)
                    .onReceive(minuteTicker) { input in
                        now = input
                    }
                    .onDisappear {
                        waterfallController.stop()
                    }
            } else {
                emptyCard
            }
        }
        .sheet(isPresented: $showingShare, onDismiss: {
            shareImage = nil
        }) {
            if let shareImage {
                ShareSheet(items: [shareImage])
            }
        }
    }

    private func card(plan: MAPVPlan) -> some View {
        let presentation = MAPVStatusResolver.resolve(plan: plan, now: now, locale: locale)

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(displayElectionHeader(for: plan.electionTitle))
                    .font(.title2.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.58)
                    .allowsTightening(true)
                Spacer(minLength: 8)
                Text(presentation.statusPillText)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(color(for: presentation.statusColorToken))
                    .clipShape(Capsule())
            }

            VStack(spacing: 6) {
                GeometryReader { geo in
                    let width = geo.size.width
                    let clampedNow = max(0, min(presentation.progressNow, 1))
                    let clampedPlan = max(0, min(presentation.progressPlan, 1))
                    let nowX = width * clampedNow
                    let planX = width * clampedPlan

                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.gray.opacity(0.20))
                            .frame(height: 9)

                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.green.opacity(0.85),
                                        Color.yellow.opacity(0.88)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(2, planX), height: 9)

                        Capsule()
                            .fill(Color.orange.opacity(0.92))
                            .frame(width: max(0, width - planX), height: 9)
                            .offset(x: min(max(planX, 0), width))

                        Text("✉️")
                            .font(.system(size: 15))
                            .frame(width: 21, height: 21)
                            .background(
                                Circle()
                                    .fill(VoteNowColors.background.opacity(0.95))
                                    .overlay(
                                        Circle()
                                            .stroke(VoteNowColors.primaryText.opacity(0.7), lineWidth: 0.8)
                                    )
                            )
                            .offset(x: min(max(planX - 10.5, 0), width - 21), y: -4)

                        Circle()
                            .fill(VoteNowColors.surfaceWhite)
                            .frame(width: 14, height: 14)
                            .overlay(
                                Circle()
                                    .stroke(VoteNowColors.primaryText.opacity(0.75), lineWidth: 1.5)
                            )
                            .shadow(color: .black.opacity(0.16), radius: 2, x: 0, y: 1)
                            .offset(x: min(max(nowX - 7, 0), width - 14))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                }
                .frame(height: 16)

                HStack {
                    Text(shortTime(plan.pollingOpen))
                    Spacer()
                    Text(shortTime(plan.pollingClose))
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VoteNowColors.primaryText)
            }

            HStack(spacing: 10) {
                Text(presentation.primaryCountdownText)
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 8)
                if !presentation.secondaryMetaText.isEmpty {
                    Text(presentation.secondaryMetaText)
                        .font(.subheadline)
                        .foregroundStyle(VoteNowColors.mutedText)
                        .lineLimit(1)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(l("app.mapv.card.plan_title_colon", "My Plan to Vote:"))
                    .font(.subheadline.weight(.semibold))
                Text(planDateTime(plan.plannedArrival))
                Text(plan.pollingPlaceName)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                .font(.subheadline)
            }

            HStack(spacing: 10) {
                Button(l("app.mapv.card.action.change_plan", "Change Plan to Vote")) {
                    onChangePlanTapped?()
                }
                .buttonStyle(.borderedProminent)
                .tint(VoteNowColors.primaryCTA)

                if plan.mapsURL != nil {
                    Button(l("app.mapv.card.action.start_directions", "Start Directions")) {
                        mapvPlanStore.markEnRoute(true)
                        if let mapsURL = plan.mapsURL {
                            openURL(mapsURL)
                        }
                    }
                    .buttonStyle(.bordered)
                }

                HoldToConfirmButton(
                    title: l("app.mapv.card.action.voted", "Voted?"),
                    confirmedTitle: l("app.mapv.card.action.reset", "Reset"),
                    isConfirmed: plan.isCompleted,
                    holdDuration: 5.0,
                    onConfirm: {
                        guard mapvPlanStore.plan?.isCompleted != true else { return }
                        mapvPlanStore.markCompleted()
                        waterfallController.trigger(reduceMotion: reduceMotion)
                    },
                    onReset: {
                        mapvPlanStore.resetCompleted()
                    }
                )
                .frame(width: 132)
                .disabled(!isVotedActionEnabled)
            }
            .font(.caption.weight(.semibold))

            Toggle(isOn: Binding(
                get: { mapvPlanStore.liveActivityEnabled },
                set: { mapvPlanStore.setLiveActivityEnabled($0) }
            )) {
                Text(l("app.mapv.card.live_activity.toggle", "Enable Live Activity"))
                    .font(.subheadline.weight(.semibold))
            }
            .toggleStyle(.switch)
            .disabled(!liveActivitiesAvailable)

            if mapvPlanStore.liveActivityEnabled {
                Text(l("app.mapv.card.live_activity.enabled_detail", "Live activity updates around open/close windows and plan changes."))
                    .font(.caption)
                    .foregroundStyle(VoteNowColors.mutedText)
                    .transition(.opacity)
            } else if !liveActivitiesAvailable {
                Text(l("app.mapv.card.live_activity.disabled_detail", "Live Activities are disabled on this device. Enable them in Settings."))
                    .font(.caption)
                    .foregroundStyle(VoteNowColors.mutedText)
            }

        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .fill(mapvCardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(VoteNowColors.richBlue.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: presentation.status)
    }

    private var emptyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(l("app.mapv.card.empty.title", "My Plan to Vote"))
                .font(.headline)
            Text(l("app.mapv.card.empty.body", "No plan saved yet. Build your voting plan to enable a live activity."))
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.mutedText)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.infoSurfaceBlue)
        )
    }

    private func color(for token: MAPVStatusColorToken) -> Color {
        switch token {
        case .blue: return VoteNowColors.richBlue
        case .green: return .green
        case .orange: return .orange
        case .red: return VoteNowColors.richRed
        case .gray: return .gray
        case .indigo: return .indigo
        }
    }

    private var liveActivitiesAvailable: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    private func shareMapv() {
        guard let plan = previewPlan ?? mapvPlanStore.plan else { return }
        let shareSize = CGSize(width: 631, height: 406)
        let shareCard = VStack(spacing: 0) {
            MAPVCardView(
                waterfallController: EmojiWaterfallController(),
                previewPlan: plan,
                isVotedActionEnabled: false
            )
            .environmentObject(mapvPlanStore)
            .environment(\.dynamicTypeSize, .accessibility1)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottomTrailing) {
                VoteNowLogoIcon(size: 53, shadowColor: .clear)
                    .opacity(0.94)
                    .padding(.trailing, 10)
                    .padding(.bottom, 10)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .padding(0)
        .frame(width: shareSize.width, height: shareSize.height, alignment: .top)
        .background(VoteNowColors.appBackground)
        .clipped()

        if let image = ViewSnapshotter.snapshot(shareCard, size: shareSize) {
            shareImage = image
            showingShare = true
        }
    }

    private func shortTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func planDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func displayElectionHeader(for rawTitle: String) -> String {
        let normalized = rawTitle.lowercased()

        if normalized.contains("midterm") && normalized.contains("runoff") {
            return l("app.mapv.election_header.midterm_runoff", "Midterm Primary Runoff Election")
        }
        if normalized.contains("midterm") && normalized.contains("primary") {
            return l("app.mapv.election_header.midterm_primary", "Midterm Primary Election")
        }
        if normalized.contains("midterm") && normalized.contains("general") {
            return l("app.mapv.election_header.midterm_general", "Midterm General Election")
        }
        if normalized.contains("presidential") && normalized.contains("primary") {
            return l("app.mapv.election_header.presidential_primary", "Presidential Primary Election")
        }
        if normalized.contains("presidential") && normalized.contains("general") {
            return l("app.mapv.election_header.presidential_general", "Presidential General Election")
        }
        if normalized.contains("runoff") {
            return l("app.mapv.election_header.midterm_runoff", "Midterm Primary Runoff Election")
        }
        if normalized.contains("primary") {
            return l("app.mapv.election_header.midterm_primary", "Midterm Primary Election")
        }
        if normalized.contains("general") {
            return l("app.mapv.election_header.midterm_general", "Midterm General Election")
        }

        return rawTitle
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private static let shareDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let shareTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()
}

#Preview {
    let store = MAPVPlanStore()
    let waterfallController = EmojiWaterfallController()
    let samplePlan = MAPVPlan(
        electionTitle: "NYC Mayoral Election",
        electionDate: Date(),
        pollingPlaceName: "PS 123 Voting Center",
        pollingPlaceAddress: "100 Main St, New York, NY",
        pollingOpen: Date().addingTimeInterval(-2 * 60 * 60),
        pollingClose: Date().addingTimeInterval(5 * 60 * 60),
        plannedArrival: Date().addingTimeInterval(60 * 60),
        lat: nil,
        lon: nil,
        travelMode: .driving,
        distanceMiles: 2.3,
        etaMinutes: 12,
        lastETAUpdatedAt: Date(),
        isEnRoute: false,
        isCompleted: false,
        completedAt: nil,
        liveActivityEnabled: true,
        createdAt: Date(),
        updatedAt: Date(),
        missedArrivalGraceMinutes: 30
    )
    store.save(samplePlan, shouldSyncLiveActivity: false)
    return MAPVCardView(waterfallController: waterfallController)
        .environmentObject(store)
        .padding()
}
