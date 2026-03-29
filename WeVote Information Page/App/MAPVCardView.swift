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
    @State private var shareItems: [Any] = []
    @State private var showingShare = false
    @State private var showingVoteConfirmationPrompt = false
    @State private var lastPromptedSnapshotID: String?
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
                        mapvPlanStore.refreshLiveActivity(now: input)
                        maybeShowPostPlanPrompt(for: plan, at: input)
                    }
                    .onDisappear {
                        waterfallController.stop()
                    }
            } else {
                emptyCard
            }
        }
        .confirmationDialog(
            "Did you vote?",
            isPresented: $showingVoteConfirmationPrompt,
            titleVisibility: .visible
        ) {
            Button("Yes, I’m done") {
                mapvPlanStore.markCompleted()
            }
            Button("Not yet") {
                mapvPlanStore.markNotYetVoted()
            }
            Button("Need help") {
                onChangePlanTapped?()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your planned voting time has passed. Confirm your completion status.")
        }
        .sheet(isPresented: $showingShare, onDismiss: {
            shareItems.removeAll()
        }) {
            if !shareItems.isEmpty {
                ShareSheet(items: shareItems)
            }
        }
    }

    private func card(plan: MAPVPlan) -> some View {
        let presentation = MAPVStatusResolver.resolve(plan: plan, now: now, locale: locale)
        let completionStatus = mapvPlanStore.userElectionStatus
        let completionIsTerminal = completionStatus?.completionState.isTerminal == true

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Label {
                    Text(displayElectionHeader(for: plan.electionTitle))
                } icon: {
                    VoteNowLogoIcon(size: 16, shadowColor: .clear)
                        .accessibilityHidden(true)
                }
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

            if completionIsTerminal {
                completionSummaryCard(status: completionStatus, plan: plan)
            } else {
                progressSection(plan: plan)
            }

            if completionIsTerminal == false && !plan.isCompleted {
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

            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    Button {
                        onChangePlanTapped?()
                    } label: {
                        Label(
                            l("app.mapv.card.action.change_plan_to_vote", "Change Plan to Vote"),
                            systemImage: "slider.horizontal.3"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(MAPVPrimaryActionButtonStyle())

                    if plan.mapsURL != nil {
                        Button {
                            mapvPlanStore.markEnRoute(true)
                            if let mapsURL = plan.mapsURL {
                                openURL(mapsURL)
                            }
                        } label: {
                            Label(
                                l("app.mapv.card.action.start_directions", "Start Directions"),
                                systemImage: "location.fill"
                            )
                            .frame(maxWidth: .infinity, alignment: .center)
                        }
                        .buttonStyle(MAPVSecondaryActionButtonStyle(fill: VoteNowColors.primaryCTA.opacity(0.16), border: VoteNowColors.primaryCTA.opacity(0.65)))
                    }
                }

                if completionIsTerminal || plan.isCompleted {
                    completionStatusMenuButton
                } else {
                    HoldToConfirmButton(
                        title: l("app.mapv.card.action.voted", "Voted?"),
                        confirmedTitle: l("app.mapv.card.action.reset", "Reset"),
                        isConfirmed: false,
                        holdDuration: 5.0,
                        onConfirm: {
                            guard mapvPlanStore.plan?.isCompleted != true else { return }
                            mapvPlanStore.markCompleted()
                            waterfallController.trigger(reduceMotion: reduceMotion)
                        }
                    )
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(!isVotedActionEnabled)

                    Text(l("app.mapv.card.action.voted_hint", "Press and hold for 5 seconds to confirm."))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(VoteNowColors.mutedText)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }

            Toggle(isOn: Binding(
                get: { mapvPlanStore.liveActivityEnabled },
                set: { mapvPlanStore.setLiveActivityEnabled($0) }
            )) {
                Text(l("app.mapv.card.live_activity.toggle", "Enable Live Activity"))
                    .font(.subheadline.weight(.semibold))
            }
            .toggleStyle(.switch)
            .disabled(!liveActivitiesAvailable)

            if !liveActivitiesAvailable {
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

    private func progressSection(plan: MAPVPlan) -> some View {
        let dayStart = Calendar.current.startOfDay(for: plan.pollingOpen)
        let dayEnd = dayStart.addingTimeInterval(24 * 60 * 60)
        let openProgress = normalizedProgress(for: plan.pollingOpen, start: dayStart, end: dayEnd)
        let closeProgress = normalizedProgress(for: plan.pollingClose, start: dayStart, end: dayEnd)

        return VStack(spacing: 6) {
            GeometryReader { geo in
                let width = geo.size.width
                let clampedNow = max(0, min(normalizedProgress(for: now, start: dayStart, end: dayEnd), 1))
                let clampedOpen = max(0, min(openProgress, 1))
                let clampedClose = max(clampedOpen, min(closeProgress, 1))
                let nowX = width * clampedNow
                let openX = width * clampedOpen
                let closeX = width * clampedClose

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
                        .frame(width: max(0, closeX - openX), height: 9)
                        .offset(x: openX)

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
                        .offset(x: min(max(closeX - 10.5, 0), width - 21))

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
                Text(shortTime(dayStart))
                Spacer()
                Text(shortTime(dayEnd.addingTimeInterval(-60)))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(VoteNowColors.primaryText)
        }
    }

    private func normalizedProgress(for date: Date, start: Date, end: Date) -> CGFloat {
        let total = end.timeIntervalSince(start)
        guard total > 0 else { return 0 }
        let elapsed = date.timeIntervalSince(start)
        return CGFloat(max(0, min(elapsed / total, 1)))
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

    @ViewBuilder
    private func completionSummaryCard(status: UserElectionStatusRecord?, plan: MAPVPlan) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("You’re done for this election")
                .font(.headline.weight(.bold))
            Text("Completion method: \(completionMethodText(status: status, plan: plan))")
                .font(.subheadline)
            if let completedAt = status?.completedAt ?? plan.completedAt {
                Text("Completion timestamp: \(planDateTime(completedAt))")
                    .font(.subheadline)
            }
            if let source = status?.completionSource, !source.isEmpty {
                Text("Source: \(source)")
                    .font(.caption)
                    .foregroundStyle(VoteNowColors.mutedText)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.green.opacity(0.14))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.green.opacity(0.35), lineWidth: 1)
        )
    }

    private func completionMethodText(status: UserElectionStatusRecord?, plan: MAPVPlan) -> String {
        let state = status?.completionState ?? (plan.isCompleted ? .voted : .notStarted)
        switch state {
        case .voted:
            return "I voted"
        case .ballotReceived:
            return "My ballot is returned"
        case .ballotAccepted:
            return "My ballot was accepted"
        case .notStarted, .inProgress, .ballotMailed, .ballotDelivered, .provisionalPending, .cureNeeded:
            return "In progress"
        }
    }

    private func maybeShowPostPlanPrompt(for plan: MAPVPlan, at now: Date) {
        guard mapvPlanStore.userElectionStatus?.completionState.isTerminal != true else { return }
        guard plan.isCompleted == false else { return }
        guard showingVoteConfirmationPrompt == false else { return }

        let graceSeconds = TimeInterval(max(plan.missedArrivalGraceMinutes, 1) * 60)
        guard now >= plan.plannedArrival.addingTimeInterval(graceSeconds) else { return }

        guard lastPromptedSnapshotID != plan.planSnapshotID else { return }
        lastPromptedSnapshotID = plan.planSnapshotID
        showingVoteConfirmationPrompt = true
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

    private var completionStatusMenuButton: some View {
        Menu {
            Button("I voted") {
                mapvPlanStore.markCompleted()
            }
            Button("My ballot is returned") {
                mapvPlanStore.markBallotReturned()
            }
            Button("My ballot was accepted") {
                mapvPlanStore.markBallotAccepted()
            }
            Button("Undo completion", role: .destructive) {
                mapvPlanStore.resetCompleted()
            }
        } label: {
            HStack(spacing: 8) {
                Label("Update completion status", systemImage: "checkmark.circle")
                    .lineLimit(1)
                Spacer(minLength: 6)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.bold))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(VoteNowColors.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(VoteNowColors.surfaceWhite.opacity(0.92))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .stroke(VoteNowColors.primaryCTA.opacity(0.38), lineWidth: 1)
            )
        }
    }

    private func shareMapv() {
        guard let plan = previewPlan ?? mapvPlanStore.plan else { return }
        let isoDateFormatter: DateFormatter = {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter
        }()

        var details: [URLQueryItem] = [
            URLQueryItem(name: "election", value: plan.electionTitle),
            URLQueryItem(name: "day", value: isoDateFormatter.string(from: plan.electionDate)),
            URLQueryItem(name: "method", value: shareMethodLabel(from: plan))
        ]
        if let stateCode = stateCodeFromAddress(plan.pollingPlaceAddress) {
            details.append(URLQueryItem(name: "state", value: stateCode))
        }

        let payload = VoteNowShareCardPayload(
            cardType: .mapv,
            target: .mapv,
            title: l("app.mapv.share.headline.plan_now", "Make Your Plan to Vote"),
            subtitle: l(
                "app.mapv.share.subtitle.plan_now",
                "Pick your voting method, review deadlines, and get ready now."
            ),
            cta: l("app.mapv.share.cta.plan_now", "Start Your Plan"),
            badge: planDateTime(plan.electionDate),
            campaign: "send-to-friend",
            details: details
        )

        shareItems = VoteNowShareComposer.activityItems(for: payload)
        showingShare = true
    }

    private func shareMethodLabel(from plan: MAPVPlan) -> String {
        switch plan.votingMethodRawValue {
        case "vote_by_mail":
            return "Mail ballot"
        case "early_vote":
            return "Early vote"
        case "election_day":
            return "Election Day"
        default:
            return "Plan to vote"
        }
    }

    private func stateCodeFromAddress(_ address: String) -> String? {
        let parts = address
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard let tail = parts.last else { return nil }
        let tokens = tail.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        if let first = tokens.first, first.count == 2 {
            return first.uppercased()
        }
        return nil
    }

    private func shortTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "HH:mm"
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

}

private struct MAPVPrimaryActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(VoteNowColors.primaryCTA)
                    .opacity(isEnabled ? (configuration.isPressed ? 0.84 : 1) : 0.45)
            )
    }
}

private struct MAPVSecondaryActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    let fill: Color
    let border: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(VoteNowColors.primaryText)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(fill.opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.45))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(border.opacity(isEnabled ? 1 : 0.45), lineWidth: 1)
            )
    }
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
