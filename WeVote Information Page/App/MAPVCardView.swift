import ActivityKit
import CivicaDesignSystem
import SwiftUI
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
    private let cardCornerRadius: CGFloat = CivicaRadius.card

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

        return VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                Label {
                    Text(displayElectionHeader(for: plan.electionTitle))
                } icon: {
                    CivicaLogoIcon(size: 16, shadowColor: .clear)
                        .accessibilityHidden(true)
                }
                    .font(.title2.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.58)
                    .allowsTightening(true)
                Spacer(minLength: 8)
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: statusIcon(for: presentation.status))
                        .font(CivicaTypography.captionBold)
                    Text(presentation.statusPillText)
                        .font(CivicaTypography.captionBold)
                }
                .foregroundStyle(CivicaColors.onPrimaryText)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, CivicaSpacing.xs)
                .background(color(for: presentation.statusColorToken))
                .clipShape(Capsule())
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Status: \(presentation.statusPillText)")
            }

            if completionIsTerminal {
                completionSummaryCard(status: completionStatus, plan: plan)
            } else {
                progressSection(plan: plan)
            }

            if completionIsTerminal == false && !plan.isCompleted {
                HStack(spacing: CivicaSpacing.sm) {
                    Text(presentation.primaryCountdownText)
                        .font(CivicaTypography.subheadStrong)
                    Spacer(minLength: 8)
                    if !presentation.secondaryMetaText.isEmpty {
                        Text(presentation.secondaryMetaText)
                            .font(CivicaTypography.subhead)
                            .foregroundStyle(CivicaColors.graphite)
                            .lineLimit(1)
                    }
                }
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(l("app.mapv.card.plan_title_colon", "My Plan to Vote:"))
                    .font(CivicaTypography.subheadStrong)
                Text(planDateTime(plan.plannedArrival))
                Text(plan.pollingPlaceName)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .font(CivicaTypography.subhead)
            }

            VStack(spacing: CivicaSpacing.sm) {
                HStack(spacing: CivicaSpacing.sm) {
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
                        .buttonStyle(
                            MAPVSecondaryActionButtonStyle(
                                fill: CivicaColors.secondaryButtonFill,
                                border: CivicaColors.secondaryButtonBorder
                            )
                        )
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
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }

            Toggle(isOn: Binding(
                get: { mapvPlanStore.liveActivityEnabled },
                set: { mapvPlanStore.setLiveActivityEnabled($0) }
            )) {
                Text(l("app.mapv.card.live_activity.toggle", "Enable Live Activity"))
                    .font(CivicaTypography.subheadStrong)
            }
            .toggleStyle(.switch)
            .disabled(!liveActivitiesAvailable)

            if !liveActivitiesAvailable {
                Text(l("app.mapv.card.live_activity.disabled_detail", "Live Activities are disabled on this device. Enable them in Settings."))
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .fill(CivicaColors.mapvCardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(CivicaColors.brickPrimary.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
        .animation(reduceMotion ? nil : CivicaAnimation.standard, value: presentation.status)
    }

    private func progressSection(plan: MAPVPlan) -> some View {
        let dayStart = Calendar.current.startOfDay(for: plan.pollingOpen)
        let dayEnd = dayStart.addingTimeInterval(24 * 60 * 60)
        let openProgress = normalizedProgress(for: plan.pollingOpen, start: dayStart, end: dayEnd)
        let closeProgress = normalizedProgress(for: plan.pollingClose, start: dayStart, end: dayEnd)

        return VStack(spacing: CivicaSpacing.xs) {
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
                        .fill(CivicaColors.neutralStatus.opacity(0.24))
                        .frame(height: 9)

                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    CivicaColors.accentTeal.opacity(0.88),
                                    CivicaColors.warningAmber.opacity(0.88)
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
                                .fill(CivicaColors.paper.opacity(0.95))
                                .overlay(
                                    Circle()
                                        .stroke(CivicaColors.ink.opacity(0.7), lineWidth: 0.8)
                                )
                        )
                        .offset(x: min(max(closeX - 10.5, 0), width - 21))

                    Circle()
                        .fill(CivicaColors.surfacePrimary)
                        .frame(width: 14, height: 14)
                        .overlay(
                            Circle()
                                .stroke(CivicaColors.ink.opacity(0.75), lineWidth: 1.5)
                        )
                        .shadow(color: CivicaColors.shadowSoft, radius: 2, x: 0, y: 1)
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
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.ink)
        }
    }

    private func normalizedProgress(for date: Date, start: Date, end: Date) -> CGFloat {
        let total = end.timeIntervalSince(start)
        guard total > 0 else { return 0 }
        let elapsed = date.timeIntervalSince(start)
        return CGFloat(max(0, min(elapsed / total, 1)))
    }

    private var emptyCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.mapv.card.empty.title", "My Plan to Vote"))
                .font(CivicaTypography.sectionHeader)
            Text(l("app.mapv.card.empty.body", "No plan saved yet. Build your voting plan to enable a live activity."))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .fill(CivicaColors.tealSurface)
        )
    }

    @ViewBuilder
    private func completionSummaryCard(status: UserElectionStatusRecord?, plan: MAPVPlan) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Label("Completed", systemImage: "checkmark.circle.fill")
                .font(CivicaTypography.captionBold)
                .foregroundStyle(CivicaColors.accentTeal)
            Text("You’re done for this election")
                .font(CivicaTypography.sectionHeaderBold)
            Text("Completion method: \(completionMethodText(status: status, plan: plan))")
                .font(CivicaTypography.subhead)
            if let completedAt = status?.completedAt ?? plan.completedAt {
                Text("Completion timestamp: \(planDateTime(completedAt))")
                    .font(CivicaTypography.subhead)
            }
            if let source = status?.completionSource, !source.isEmpty {
                Text("Source: \(source)")
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .padding(CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.statusSuccessSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.accentTeal.opacity(0.58), lineWidth: 1)
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
        case .blue: return CivicaColors.brickPrimary
        case .green: return CivicaColors.accentTeal
        case .orange: return CivicaColors.warningAmber
        case .red: return CivicaColors.destructive
        case .gray: return CivicaColors.neutralStatus
        case .indigo: return CivicaColors.indigoStatus
        }
    }

    private func statusIcon(for status: MAPVDisplayStatus) -> String {
        switch status {
        case .scheduled:
            return "calendar"
        case .open:
            return "checkmark.circle"
        case .enRoute:
            return "location.fill"
        case .closingSoon:
            return "exclamationmark.circle"
        case .closed:
            return "lock.fill"
        case .completed:
            return "checkmark.circle.fill"
        case .missed:
            return "xmark.circle.fill"
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
            HStack(spacing: CivicaSpacing.sm) {
                Label("Update completion status", systemImage: "checkmark.circle")
                    .lineLimit(1)
                Spacer(minLength: 6)
                Image(systemName: "chevron.down")
                    .font(CivicaTypography.captionBold)
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.ink)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(CivicaColors.surfacePrimary.opacity(0.92))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(CivicaColors.brickPrimary.opacity(0.38), lineWidth: 1)
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

        let payload = CivicaShareCardPayload(
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

        shareItems = CivicaShareComposer.activityItems(for: payload)
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
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(CivicaColors.brickPrimary.opacity(0.24), lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.brickPrimaryDisabled }
        return isPressed ? CivicaColors.brickPrimaryPressed : CivicaColors.brickPrimary
    }
}

private struct MAPVSecondaryActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    let fill: Color
    let border: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(isEnabled ? CivicaColors.ink : CivicaColors.graphite)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        guard isEnabled else { return CivicaColors.secondaryButtonFillDisabled }
        return isPressed ? CivicaColors.secondaryButtonFillPressed : fill
    }

    private var borderColor: Color {
        isEnabled ? border : CivicaColors.secondaryButtonDisabledBorder
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
