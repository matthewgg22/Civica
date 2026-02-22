//
//
//  MultiStepFormView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/23/25.
//  Updated by ChatGPT on 05/25/25 (pinned mail-in link)

import SwiftUI
import MapKit
import Foundation
import UIKit


// MARK: - Enum for Voting Method

enum VotingMethod: String {
    case early    = "Vote Early"
    case mail     = "Vote by Mail"
    case election = "Vote on Election Day"
}

// MARK: - MultiStepFormView: Four-Step Flow

struct MultiStepFormView: View {
    @EnvironmentObject var planVM: PlanViewModel
    private let mapvPlanStore = MAPVPlanStore.shared
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var flowModel = MAPVFlowModel()

    private var nextTimelineElection: Election? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let sorted = planVM.upcomingElections.sorted { $0.electionDay < $1.electionDay }
        if let upcoming = sorted.first(where: { calendar.startOfDay(for: $0.electionDay) >= today }) {
            return upcoming
        }
        return sorted.first
    }

    private var timelineEarlyVotingLine: String {
        guard let election = nextTimelineElection else { return "Early Voting: Date TBD" }
        let text = election.earlyVotingText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let value = text.isEmpty ? Self.timelineDateFormatter.string(from: election.startDate) : text
        return "Early Voting: \(value)"
    }

    private var timelineElectionDayLine: String {
        guard let election = nextTimelineElection else { return "Election Day: Date TBD" }
        return "Election Day: \(Self.timelineDateFormatter.string(from: election.electionDay))"
    }

    var body: some View {
        MAPVFlowView(
            flowModel: flowModel,
            lockPulse: false,
            reduceMotion: reduceMotion,
            timeSliderValue: Binding(
                get: { flowModel.timeOfDayProgress },
                set: { flowModel.setTimeOfDayProgress($0) }
            ),
            stepContent: viewForStep(index:),
            onBack: {
                flowModel.goBack(reduceMotion: reduceMotion)
            },
            onNext: {
                flowModel.goNext(reduceMotion: reduceMotion)
            },
            onFinish: handleFinish
        )
        .onChange(of: flowModel.currentStepIndex) { _ in
            MAPVFlowHaptics.stepChanged()
        }
    }

    private func viewForStep(index: Int) -> AnyView {
        switch index {
        case 0:
            return AnyView(
                ScrollView {
                    StepOneView(selectedMethod: Binding(
                        get: { flowModel.selectedMethod },
                        set: { flowModel.setMethod($0) }
                    ),
                    earlyVotingLine: timelineEarlyVotingLine,
                    electionDayLine: timelineElectionDayLine)
                    .padding(.vertical, 6)
                }
                .scrollIndicators(.hidden)
            )

        case 1:
            if flowModel.selectedMethod == .mail {
                return AnyView(AbsenteeView())
            }
            return AnyView(
                VStack(spacing: 16) {
                    Text("Choose a polling location near you.")
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal)
                    PollingLocationsView(selectedPlace: Binding(
                        get: { flowModel.selectedPollingPlace },
                        set: { flowModel.setPollingPlace($0) }
                    ), isActive: flowModel.currentStepIndex == 1)
                }
                .padding(.vertical, 6)
            )

        case 2:
            return AnyView(
                StepThreeView(
                    selectedMethod: flowModel.selectedMethod,
                    selectedPollingPlace: flowModel.selectedPollingPlace,
                    earliestVotingDate: nextTimelineElection?.startDate,
                    isActive: flowModel.currentStepIndex == 2,
                    hasExplicitlyPickedVotingDay: Binding(
                        get: { flowModel.hasExplicitlyPickedVotingDay },
                        set: { flowModel.setVotingDayPicked($0) }
                    ),
                    chosenVotingTime: Binding(
                        get: { flowModel.chosenVotingTime },
                        set: { flowModel.setVotingTime($0) }
                    )
                )
                .environmentObject(planVM)
            )

        case 3:
            return AnyView(
                StepFourView(
                    selectedMethod: flowModel.selectedMethod,
                    selectedPollingPlace: flowModel.selectedPollingPlace,
                    chosenVotingTime: flowModel.chosenVotingTime
                )
            )

        default:
            return AnyView(Text("Invalid Step"))
        }
    }

    private func handleFinish() {
        planVM.savePlan(
            method: flowModel.selectedMethod,
            place: flowModel.selectedPollingPlace,
            time: flowModel.chosenVotingTime
        )
        mapvPlanStore.saveFromWizard(
            planVM: planVM,
            selectedMethod: flowModel.selectedMethod,
            selectedPollingPlace: flowModel.selectedPollingPlace,
            chosenVotingTime: flowModel.chosenVotingTime
        )
        MAPVFlowHaptics.finished()
        dismiss()
    }

    private static let timelineDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMM d, yyyy"
        return formatter
    }()
}

private enum MAPVStepNavDirection {
    case forward
    case backward
}

private struct MAPVStep: Identifiable {
    let id: String
    let title: String
    let icon: String
}

@MainActor
private final class MAPVFlowModel: ObservableObject {
    @Published var currentStepIndex = 0
    @Published var navDirection: MAPVStepNavDirection = .forward
    @Published var selectedMethod: VotingMethod? = nil
    @Published var selectedPollingPlace: PollingPlace? = nil
    @Published var hasExplicitlyPickedVotingDay = false
    @Published var chosenVotingTime: Date = Date()

    let steps: [MAPVStep] = [
        MAPVStep(id: "method", title: "Method to Vote", icon: "checklist"),
        MAPVStep(id: "location", title: "Logistics", icon: "mappin.and.ellipse"),
        MAPVStep(id: "time", title: "When I'm Voting", icon: "calendar.badge.clock"),
        MAPVStep(id: "review", title: "Commit and Bring a Friend", icon: "checkmark.seal")
    ]

    func isStepComplete(_ step: Int) -> Bool {
        switch step {
        case 0: return selectedMethod != nil
        case 1: return selectedMethod == .mail || selectedPollingPlace != nil
        case 2: return hasExplicitlyPickedVotingDay
        case 3: return isStepComplete(0) && isStepComplete(1) && isStepComplete(2)
        default: return false
        }
    }

    func arePriorStepsComplete(for targetStep: Int) -> Bool {
        guard targetStep > 0 else { return true }
        for idx in 0..<targetStep where !isStepComplete(idx) {
            return false
        }
        return true
    }

    func canAdvance(from step: Int) -> Bool {
        guard step >= 0 && step < steps.count else { return false }
        if step == steps.count - 1 {
            return arePriorStepsComplete(for: step)
        }
        return isStepComplete(step)
    }

    func canJump(to step: Int) -> Bool {
        guard step >= 0 && step < steps.count else { return false }
        return arePriorStepsComplete(for: step)
    }

    func setMethod(_ method: VotingMethod?) {
        let changed = selectedMethod?.rawValue != method?.rawValue
        selectedMethod = method
        guard changed else { return }

        selectedPollingPlace = nil
        hasExplicitlyPickedVotingDay = false
        if currentStepIndex > 1 {
            navDirection = .backward
            currentStepIndex = 1
        }
    }

    func setPollingPlace(_ place: PollingPlace?) {
        let changed = selectedPollingPlace?.id != place?.id
        selectedPollingPlace = place
        guard changed else { return }

        hasExplicitlyPickedVotingDay = false
        if currentStepIndex > 2 {
            navDirection = .backward
            currentStepIndex = 2
        }
    }

    func setVotingDayPicked(_ value: Bool) {
        hasExplicitlyPickedVotingDay = value
    }

    func setVotingTime(_ value: Date) {
        chosenVotingTime = value
    }

    var timeOfDayProgress: Double {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: chosenVotingTime)
        let minute = calendar.component(.minute, from: chosenVotingTime)
        let totalMinutes = max(0, min((hour * 60) + minute, 24 * 60))
        return Double(totalMinutes) / Double(24 * 60)
    }

    func setTimeOfDayProgress(_ progress: Double) {
        let clamped = min(max(progress, 0), 1)
        let minutesOfDay = Int((clamped * Double(24 * 60)).rounded())
        let hour = min(max(minutesOfDay / 60, 0), 23)
        let minute = min(max(minutesOfDay % 60, 0), 59)
        chosenVotingTime = Calendar.current.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: chosenVotingTime
        ) ?? chosenVotingTime
    }

    func goNext(reduceMotion: Bool) {
        guard currentStepIndex < steps.count - 1 else { return }
        guard canAdvance(from: currentStepIndex) else { return }
        navDirection = .forward
        currentStepIndex += 1
    }

    func goBack(reduceMotion: Bool) {
        guard currentStepIndex > 0 else { return }
        navDirection = .backward
        currentStepIndex -= 1
    }

    func jump(to step: Int, reduceMotion: Bool) {
        guard canJump(to: step), step != currentStepIndex else { return }
        navDirection = step > currentStepIndex ? .forward : .backward
        currentStepIndex = step
    }

}

private enum MAPVFlowHaptics {
    private static let impact = UIImpactFeedbackGenerator(style: .light)
    private static let completion = UINotificationFeedbackGenerator()

    static func stepChanged() {
        impact.prepare()
        impact.impactOccurred(intensity: 0.75)
    }

    static func stepCompleted() {
        impact.prepare()
        impact.impactOccurred(intensity: 1.0)
    }

    static func finished() {
        completion.notificationOccurred(.success)
    }
}

private struct MAPVFlowView: View {
    @ObservedObject var flowModel: MAPVFlowModel
    let lockPulse: Bool
    let reduceMotion: Bool
    @Binding var timeSliderValue: Double
    let stepContent: (Int) -> AnyView
    let onBack: () -> Void
    let onNext: () -> Void
    let onFinish: () -> Void

    var body: some View {
        let theme = TimeOfDayTheme.theme(for: timeSliderValue)

        ZStack {
            TimeReactiveBackground(sliderValue: $timeSliderValue)
                .ignoresSafeArea()

            VStack(spacing: 14) {
                header

                MAPVStepPager(
                    currentIndex: $flowModel.currentStepIndex,
                    stepCount: flowModel.steps.count,
                    direction: $flowModel.navDirection,
                    reduceMotion: reduceMotion,
                    canSwipeForward: { flowModel.canAdvance(from: flowModel.currentStepIndex) },
                    onStepChanged: { _ in MAPVFlowHaptics.stepChanged() },
                    content: stepContent
                )
                .scaleEffect(lockPulse ? 1.01 : 1)
                .animation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.68), value: lockPulse)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(
                    ZStack {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(VoteNowColors.background.opacity(0.92))
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(theme.cardScrimColor.opacity(theme.cardScrimOpacity))
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.10 + (theme.ambientOverlayOpacity * 0.18)), radius: 14, x: 0, y: 8)

                controls
            }
            .padding()
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: flowModel.steps[flowModel.currentStepIndex].icon)
                .font(.title2.weight(.bold))
                .foregroundStyle(VoteNowColors.richBlue)
                .frame(width: 36, height: 36)
                .background(Circle().fill(VoteNowColors.richBlue.opacity(0.13)))
            Text(flowModel.steps[flowModel.currentStepIndex].title)
                .font(.title3.weight(.bold))
                .lineLimit(2)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(flowModel.currentStepIndex + 1) of \(flowModel.steps.count): \(flowModel.steps[flowModel.currentStepIndex].title)")
    }

    private var controls: some View {
        HStack(spacing: 12) {
            Button("Back") {
                onBack()
            }
            .buttonStyle(.bordered)
            .frame(minWidth: 78)
            .disabled(flowModel.currentStepIndex == 0)

            MAPVStepIndicator(
                steps: flowModel.steps,
                currentStep: flowModel.currentStepIndex,
                isStepComplete: flowModel.isStepComplete,
                canTapStep: flowModel.canJump(to:),
                compact: true,
                onTap: { idx in
                    withAnimation(reduceMotion ? .easeInOut(duration: 0.12) : .easeInOut(duration: 0.24)) {
                        flowModel.jump(to: idx, reduceMotion: reduceMotion)
                    }
                }
            )
            .frame(maxWidth: 210)

            if flowModel.currentStepIndex < flowModel.steps.count - 1 {
                Button("Next") {
                    onNext()
                }
                .buttonStyle(.borderedProminent)
                .tint(VoteNowColors.primaryCTA)
                .frame(minWidth: 78)
                .disabled(!flowModel.canAdvance(from: flowModel.currentStepIndex))
                .accessibilityHint(flowModel.canAdvance(from: flowModel.currentStepIndex) ? "Move to next step" : "Complete this step first")
            } else {
                Button("Finish") {
                    onFinish()
                }
                .buttonStyle(.borderedProminent)
                .tint(VoteNowColors.primaryCTA)
                .frame(minWidth: 78)
                .disabled(!flowModel.canAdvance(from: flowModel.currentStepIndex))
                .accessibilityHint("Build your final voter plan card")
            }
        }
    }
}

private struct MAPVStepPager: View {
    @Binding var currentIndex: Int
    let stepCount: Int
    @Binding var direction: MAPVStepNavDirection
    let reduceMotion: Bool
    let canSwipeForward: () -> Bool
    let onStepChanged: (Int) -> Void
    let content: (Int) -> AnyView

    @State private var dragOffset: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                ForEach(0..<stepCount, id: \.self) { idx in
                    content(idx)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            }
            .offset(x: (-CGFloat(currentIndex) * geo.size.width) + dragOffset)
            .animation(reduceMotion ? .easeInOut(duration: 0.12) : .easeInOut(duration: 0.24), value: currentIndex)
            .clipped()
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 14)
                    .onChanged { value in
                        dragOffset = value.translation.width
                    }
                    .onEnded { value in
                        let threshold = min(160, geo.size.width * 0.22)
                        let predicted = value.predictedEndTranslation.width
                        let moveForward = value.translation.width < -threshold || predicted < -(threshold * 1.2)
                        let moveBackward = value.translation.width > threshold || predicted > (threshold * 1.2)

                        if moveForward, currentIndex < stepCount - 1, canSwipeForward() {
                            direction = .forward
                            withAnimation(reduceMotion ? .easeInOut(duration: 0.12) : .easeInOut(duration: 0.24)) {
                                currentIndex += 1
                            }
                            onStepChanged(currentIndex)
                        } else if moveBackward, currentIndex > 0 {
                            direction = .backward
                            withAnimation(reduceMotion ? .easeInOut(duration: 0.12) : .easeInOut(duration: 0.24)) {
                                currentIndex -= 1
                            }
                            onStepChanged(currentIndex)
                        }

                        withAnimation(reduceMotion ? .easeOut(duration: 0.1) : .spring(response: 0.25, dampingFraction: 0.82)) {
                            dragOffset = 0
                        }
                    }
            )
        }
    }
}

private struct MAPVStepIndicator: View {
    let steps: [MAPVStep]
    let currentStep: Int
    let isStepComplete: (Int) -> Bool
    let canTapStep: (Int) -> Bool
    let compact: Bool
    let onTap: (Int) -> Void

    var body: some View {
        HStack(spacing: compact ? 6 : 12) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { idx, step in
                Button {
                    guard canTapStep(idx) else { return }
                    onTap(idx)
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: symbolName(for: idx))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(color(for: idx))
                            .frame(width: 30, height: 30)
                            .background(
                                Circle()
                                    .fill(background(for: idx))
                            )
                    }
                    .frame(maxWidth: compact ? nil : .infinity)
                }
                .buttonStyle(.plain)
                .disabled(!canTapStep(idx))
                .accessibilityLabel("Step \(idx + 1): \(step.title)")
                .accessibilityHint(canTapStep(idx) ? "Jump to this step" : "Complete earlier steps first")
            }
        }
        .padding(.horizontal, 2)
    }

    private func symbolName(for index: Int) -> String {
        if index == currentStep { return "circle.fill" }
        if isStepComplete(index) { return "circle.inset.filled" }
        return "circle"
    }

    private func color(for index: Int) -> Color {
        if index == currentStep { return VoteNowColors.richBlue }
        if isStepComplete(index) { return .green }
        return .secondary
    }

    private func background(for index: Int) -> Color {
        if index == currentStep { return Color.blue.opacity(0.14) }
        if isStepComplete(index) { return Color.green.opacity(0.12) }
        return VoteNowColors.borderWarm.opacity(0.10)
    }
}

// MARK: - Step 1: Method to Vote

struct StepOneView: View {
    @Binding var selectedMethod: VotingMethod?
    let earlyVotingLine: String
    let electionDayLine: String

    var body: some View {
        VStack(spacing: 16) {
            Text("How would you like to vote?")
                .font(.title3.weight(.bold))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            VotingMethodCard(
                methodTitle: VotingMethod.early.rawValue,
                emoji: "⏰",
                accentColor: VoteNowColors.warningAmber,
                isSelected: selectedMethod == .early,
                action: { selectedMethod = .early }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    (Text("Pros:").bold() + Text(" Flexibility, Shorter Wait Times, Avoids Last-Minute Issues"))
                    Text(earlyVotingLine)
                        .bold()
                }
            }

            VotingMethodCard(
                methodTitle: VotingMethod.mail.rawValue,
                emoji: "✉️",
                accentColor: VoteNowColors.primaryCTA,
                isSelected: selectedMethod == .mail,
                action: { selectedMethod = .mail }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    (Text("Pros:").bold() + Text(" Convenience, Extended Time, Accessibility"))
                    Text("Request by: June 14, 2025")
                        .bold()
                }
            }

            VotingMethodCard(
                methodTitle: VotingMethod.election.rawValue,
                emoji: "🗳️",
                accentColor: VoteNowColors.successGreen,
                isSelected: selectedMethod == .election,
                action: { selectedMethod = .election }
            ) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(electionDayLine)
                        .bold()
                    Text("Polls 6 AM – 9 PM")
                        .bold()
                }
            }
        }
        .padding(.horizontal, 8)
    }
}


// MARK: - VotingMethodCard

struct VotingMethodCard<Details: View>: View {
    let methodTitle    : String
    let emoji          : String
    let accentColor    : Color
    let isSelected     : Bool
    let action         : () -> Void
    private let detailsContent: Details

    init(
        methodTitle: String,
        emoji: String,
        accentColor: Color,
        isSelected: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder details: () -> Details
    ) {
        self.methodTitle     = methodTitle
        self.emoji           = emoji
        self.accentColor     = accentColor
        self.isSelected      = isSelected
        self.action          = action
        self.detailsContent  = details()
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                ZStack {
                    Text(methodTitle)
                        .font(.title3.weight(.bold))
                        .foregroundColor(accentColor)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, alignment: .center)

                    HStack {
                        Text(emoji)
                            .font(.title2)
                        Spacer()
                        Text(emoji)
                            .font(.title2)
                    }
                }

                detailsContent
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 150, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? accentColor.opacity(0.20) : accentColor.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        isSelected ? accentColor : accentColor.opacity(0.45),
                        lineWidth: isSelected ? 1.6 : 1
                    )
            )
            .shadow(color: VoteNowColors.primaryText.opacity(0.1), radius: 3, x: 0, y: 2)
        }
        .foregroundColor(VoteNowColors.primaryText)
        .buttonStyle(.plain)
    }
}


// MARK: - Step 2: Mail Voting Logistics

struct AbsenteeView: View {
    @EnvironmentObject private var planVM: PlanViewModel

    @State private var jurisdictions: [AbsenteeBallotJurisdiction] = []
    @State private var selectedJurisdictionID: String?

    private var selectedJurisdiction: AbsenteeBallotJurisdiction? {
        guard let selectedJurisdictionID else { return nil }
        return jurisdictions.first(where: { $0.id == selectedJurisdictionID })
    }

    private var addressLine: String {
        let parts = [
            planVM.userAddress.street.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines),
            planVM.userAddress.zip.trimmingCharacters(in: .whitespacesAndNewlines)
        ].filter { !$0.isEmpty }

        if !parts.isEmpty {
            return parts.joined(separator: ", ")
        }

        let zip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if zip.count == 5 {
            return zip
        }

        return "Set your address in My Reps"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("📬 Request Your Mail-in Ballot")
                    .font(.title2.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryText)
                    .padding(.top, 8)

                Text(addressLine)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 8) {
                    Text("What is mail-in voting?")
                        .font(.headline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("Mail-in voting lets eligible voters receive a ballot and return it by mail or approved drop-off methods. Some states mail ballots automatically, while others require a request.")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .background(VoteNowColors.surfaceWhite)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text("What is absentee voting?")
                        .font(.headline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("Absentee voting is a mail-ballot process typically used when you cannot vote in person. Rules and eligibility vary by jurisdiction.")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .background(VoteNowColors.surfaceWhite)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )

                if let jurisdiction = selectedJurisdiction {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .center, spacing: 10) {
                            if let flagAsset = StateFlagCatalog.assetName(for: jurisdiction.code) {
                                Image(flagAsset)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 62.4, height: 40.8)
                                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                                    )
                            }

                            Text("Jurisdiction: \(jurisdiction.displayName)")
                                .font(.title3.weight(.bold))
                                .foregroundColor(VoteNowColors.primaryText)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        if let requestURL = jurisdiction.requestApplyURL {
                            Link(destination: requestURL) {
                                Text("Request / Apply for a mail ballot")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 11)
                                    .background(VoteNowColors.primaryCTA)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .accessibilityLabel("Request or apply for a mail ballot in \(jurisdiction.displayName)")
                        }

                        if let officialURL = jurisdiction.officialVoterInfoURL {
                            Link(destination: officialURL) {
                                Text("Official voter info")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryCTA)
                            }
                            .accessibilityLabel("Open official voter info for \(jurisdiction.displayName)")
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Request deadlines")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.primaryText)

                            ForEach(jurisdiction.deadlineRows(), id: \.label) { row in
                                HStack(alignment: .top, spacing: 12) {
                                    Text(row.label)
                                        .font(.caption.weight(.semibold))
                                        .foregroundColor(VoteNowColors.mutedText)
                                        .frame(width: 108, alignment: .leading)

                                    Text(row.value)
                                        .font(.subheadline)
                                        .foregroundColor(VoteNowColors.primaryText)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(VoteNowColors.infoSurfaceBlue)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(VoteNowColors.primaryCTA.opacity(0.18), lineWidth: 1)
                        )

                        if let sourceURL = jurisdiction.deadlineSourceURL {
                            Link(destination: sourceURL) {
                                Text("Deadline source")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryCTA)
                            }
                            .accessibilityLabel("Open deadline source for \(jurisdiction.displayName)")
                        }

                        if let notes = jurisdiction.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.footnote)
                                .foregroundColor(VoteNowColors.mutedText)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Text("This section is for absentee/mail ballot requests. Early-voting deadlines can be different.")
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Deadlines can change. Confirm details with your official election office site.")
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14)
                    .background(VoteNowColors.surfaceWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text("We could not detect your jurisdiction yet. Enter your address in My Reps to auto-load absentee and mail-ballot request details.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding()
        }
        .background(VoteNowColors.appBackground)
        .navigationTitle("Request Mail-in Ballot")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if jurisdictions.isEmpty {
                jurisdictions = AbsenteeBallotRequestProvider.loadJurisdictions()
            }
            syncJurisdictionFromMyReps()
        }
        .onChange(of: planVM.userAddress.state) { _ in
            syncJurisdictionFromMyReps()
        }
        .onChange(of: planVM.userAddress.zip) { _ in
            syncJurisdictionFromMyReps()
        }
        .onChange(of: planVM.zip) { _ in
            syncJurisdictionFromMyReps()
        }
    }

    private func syncJurisdictionFromMyReps() {
        guard !jurisdictions.isEmpty else { return }
        guard let code = AbsenteeBallotRequestProvider.resolveDefaultJurisdictionCode(
            userState: planVM.userAddress.state,
            primaryZip: planVM.zip,
            fallbackZip: planVM.userAddress.zip
        ) else {
            selectedJurisdictionID = nil
            return
        }

        selectedJurisdictionID = jurisdictions.first {
            $0.code?.caseInsensitiveCompare(code) == .orderedSame
        }?.id
    }
}


// MARK: - Step 3: When I’m Voting

struct StepThreeView: View {
    @EnvironmentObject var planVM: PlanViewModel
    var selectedMethod: VotingMethod?
    var selectedPollingPlace: PollingPlace?
    var earliestVotingDate: Date?
    var isActive: Bool = true
    @Binding var hasExplicitlyPickedVotingDay: Bool
    @Binding var chosenVotingTime: Date

    private var scheduleWindow: PollingScheduleWindow {
        PollingScheduleWindow.resolve(for: selectedMethod, hoursText: selectedPollingPlace?.hours)
    }

    private var openDateForSelectedDay: Date {
        Self.updatingTime(of: chosenVotingTime, toMinuteOfDay: Int(scheduleWindow.openMinutes.rounded()))
    }

    private var closeDateForSelectedDay: Date {
        Self.updatingTime(of: chosenVotingTime, toMinuteOfDay: Int(scheduleWindow.closeMinutes.rounded()))
    }

    private var dayRailStartDate: Date {
        if let earliestVotingDate {
            return Calendar.current.startOfDay(for: earliestVotingDate)
        }
        return Calendar.current.startOfDay(for: Date())
    }

    private var dayRailMonthLabel: String {
        Self.monthFormatter.string(from: dayRailStartDate)
    }

    private var selectedTimeProgress: Double {
        mapProgress(selectedDate: chosenVotingTime, openDate: openDateForSelectedDay, closeDate: closeDateForSelectedDay)
    }

    private var selectedTimeColor: Color {
        colorForTimeProgress(selectedTimeProgress)
    }

    var body: some View {
        VStack(spacing: 16) {
            Text("Pick your voting time")
                .font(.title.weight(.bold))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)

            Text("Drag the slider to set your planned arrival time.")
                .font(.caption)
                .foregroundColor(VoteNowColors.mutedText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)

            Text(dayRailMonthLabel)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)

            MAPVDayRailSelector(
                selectedDate: $chosenVotingTime,
                startDate: dayRailStartDate,
                isActive: isActive,
                onUserSelectedDay: {
                    hasExplicitlyPickedVotingDay = true
                }
            )
            .padding(.horizontal)

            MAPVTimeSlider(
                selectedDate: $chosenVotingTime,
                openDate: openDateForSelectedDay,
                closeDate: closeDateForSelectedDay,
                isActive: isActive
            )
            .padding(.horizontal)

            HStack(spacing: 10) {
                Text("Selected Time")
                    .font(.headline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Spacer()
                Text(Self.timeFormatter.string(from: chosenVotingTime))
                    .font(.title3.monospacedDigit().weight(.bold))
                    .foregroundColor(VoteNowColors.primaryText)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(selectedTimeColor.opacity(0.18))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(selectedTimeColor.opacity(0.48), lineWidth: 1)
            )
            .padding(.horizontal)
        }
        .padding(.vertical)
        .onAppear {
            guard isActive else { return }
            let clamped = clampDate(chosenVotingTime, min: openDateForSelectedDay, max: closeDateForSelectedDay)
            guard clamped != chosenVotingTime else { return }
            deferToNextRunLoop {
                if chosenVotingTime != clamped {
                    chosenVotingTime = clamped
                }
            }
        }
        .onChange(of: chosenVotingTime) { newValue in
            guard isActive else { return }
            let clamped = clampDate(newValue, min: openDateForSelectedDay, max: closeDateForSelectedDay)
            guard clamped != newValue else { return }
            deferToNextRunLoop {
                if chosenVotingTime != clamped {
                    chosenVotingTime = clamped
                }
            }
        }
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMMM yyyy"
        return formatter
    }()

    private static func updatingTime(of date: Date, toMinuteOfDay minuteOfDay: Int) -> Date {
        let calendar = Calendar.current
        let clampedMinute = min(max(minuteOfDay, 0), 23 * 60 + 59)
        let hour = clampedMinute / 60
        let minute = clampedMinute % 60
        return calendar.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: date
        ) ?? date
    }

    private func colorForTimeProgress(_ progress: Double) -> Color {
        let p = min(max(progress, 0), 1)
        let morning = UIColor(red: 0.72, green: 0.85, blue: 1.00, alpha: 1)
        let midday = UIColor(red: 1.00, green: 0.78, blue: 0.38, alpha: 1)
        let evening = UIColor(red: 0.69, green: 0.61, blue: 0.96, alpha: 1)

        if p <= 0.5 {
            return Color(interpolateColor(from: morning, to: midday, t: p / 0.5))
        }
        return Color(interpolateColor(from: midday, to: evening, t: (p - 0.5) / 0.5))
    }

    private func interpolateColor(from: UIColor, to: UIColor, t: Double) -> UIColor {
        let clampedT = min(max(t, 0), 1)
        var r1: CGFloat = 0
        var g1: CGFloat = 0
        var b1: CGFloat = 0
        var a1: CGFloat = 0
        var r2: CGFloat = 0
        var g2: CGFloat = 0
        var b2: CGFloat = 0
        var a2: CGFloat = 0
        from.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        to.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)

        let r = r1 + (r2 - r1) * CGFloat(clampedT)
        let g = g1 + (g2 - g1) * CGFloat(clampedT)
        let b = b1 + (b2 - b1) * CGFloat(clampedT)
        let a = a1 + (a2 - a1) * CGFloat(clampedT)
        return UIColor(red: r, green: g, blue: b, alpha: a)
    }

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }
}

private enum MAPVDayRailConstants {
    static let visibleDays = 7
    static let controlSize: CGFloat = 30
    static let cellCornerRadius: CGFloat = 12
}

private struct MAPVDayRailSelector: View {
    @Binding var selectedDate: Date
    let startDate: Date
    var isActive: Bool = true
    var calendar: Calendar = .current
    var onUserSelectedDay: (() -> Void)? = nil

    @State private var weekOffset = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var normalizedStartDate: Date {
        normalizeToStartOfDay(startDate)
    }

    private var pageStartDate: Date {
        addDays(normalizedStartDate, days: weekOffset * MAPVDayRailConstants.visibleDays)
    }

    private var displayedDates: [Date] {
        (0..<MAPVDayRailConstants.visibleDays).map { addDays(pageStartDate, days: $0) }
    }

    var body: some View {
        HStack(spacing: 8) {
            if weekOffset > 0 {
                Button {
                    if reduceMotion {
                        weekOffset -= 1
                    } else {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            weekOffset -= 1
                        }
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(width: MAPVDayRailConstants.controlSize, height: MAPVDayRailConstants.controlSize)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous week")
            }

            HStack(spacing: 4) {
                ForEach(displayedDates, id: \.self) { day in
                    dayCell(for: day)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                if reduceMotion {
                    weekOffset += 1
                } else {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        weekOffset += 1
                    }
                }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: MAPVDayRailConstants.controlSize, height: MAPVDayRailConstants.controlSize)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next week")
        }
        .padding(8)
        .background(VoteNowColors.infoSurfaceBlue.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onAppear {
            guard isActive else { return }
            if selectedDate < normalizedStartDate {
                let merged = mergeDate(normalizedStartDate, withTimeFrom: selectedDate)
                deferToNextRunLoop {
                    if selectedDate != merged {
                        selectedDate = merged
                    }
                }
            }
        }
        .onChange(of: startDate) { newValue in
            guard isActive else { return }
            let normalized = normalizeToStartOfDay(newValue)
            if selectedDate < normalized {
                let merged = mergeDate(normalized, withTimeFrom: selectedDate)
                deferToNextRunLoop {
                    if selectedDate != merged {
                        selectedDate = merged
                    }
                }
            }
        }
        .onChange(of: selectedDate) { newValue in
            guard isActive else { return }
            if newValue < normalizedStartDate {
                let merged = mergeDate(normalizedStartDate, withTimeFrom: newValue)
                deferToNextRunLoop {
                    if selectedDate != merged {
                        selectedDate = merged
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func dayCell(for day: Date) -> some View {
        let isSelected = calendar.isDate(day, inSameDayAs: selectedDate)

        Button {
            let updated = mergeDate(day, withTimeFrom: selectedDate)
            selectedDate = max(updated, mergeDate(normalizedStartDate, withTimeFrom: updated))
            onUserSelectedDay?()
        } label: {
            VStack(spacing: 2) {
                Text(formatDayAbbrev(day))
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(formatDayNumber(day))
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 42)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: MAPVDayRailConstants.cellCornerRadius, style: .continuous)
                    .fill(isSelected ? VoteNowColors.richBlue.opacity(0.20) : VoteNowColors.surfaceWhite.opacity(0.65))
            )
            .overlay(
                RoundedRectangle(cornerRadius: MAPVDayRailConstants.cellCornerRadius, style: .continuous)
                    .stroke(isSelected ? VoteNowColors.richBlue : VoteNowColors.primaryText.opacity(0.08), lineWidth: isSelected ? 1.2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel(for: day))
    }

    private func normalizeToStartOfDay(_ date: Date) -> Date {
        calendar.startOfDay(for: date)
    }

    private func addDays(_ date: Date, days: Int) -> Date {
        calendar.date(byAdding: .day, value: days, to: date) ?? date
    }

    private func formatDayAbbrev(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = calendar.locale ?? .current
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).uppercased()
    }

    private func formatDayNumber(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = calendar.locale ?? .current
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private func accessibilityLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = calendar.locale ?? .current
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return "Select \(formatter.string(from: date))"
    }

    private func mergeDate(_ targetDay: Date, withTimeFrom source: Date) -> Date {
        let sourceComps = calendar.dateComponents([.hour, .minute, .second], from: source)
        let dayComps = calendar.dateComponents([.year, .month, .day], from: targetDay)
        var merged = DateComponents()
        merged.calendar = calendar
        merged.timeZone = calendar.timeZone
        merged.year = dayComps.year
        merged.month = dayComps.month
        merged.day = dayComps.day
        merged.hour = sourceComps.hour ?? 9
        merged.minute = sourceComps.minute ?? 0
        merged.second = sourceComps.second ?? 0
        return calendar.date(from: merged) ?? targetDay
    }

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }
}

private struct PollingScheduleWindow {
    let openMinutes: Double
    let closeMinutes: Double

    static func resolve(for method: VotingMethod?, hoursText: String?) -> PollingScheduleWindow {
        if let parsed = parse(from: hoursText) {
            return parsed
        }

        switch method {
        case .election:
            return PollingScheduleWindow(openMinutes: 6 * 60, closeMinutes: 21 * 60)
        case .early:
            return PollingScheduleWindow(openMinutes: 8 * 60, closeMinutes: 20 * 60)
        case .mail:
            return PollingScheduleWindow(openMinutes: 0, closeMinutes: 23 * 60 + 59)
        case nil:
            return PollingScheduleWindow(openMinutes: 6 * 60, closeMinutes: 21 * 60)
        }
    }

    private static func parse(from hoursText: String?) -> PollingScheduleWindow? {
        guard let hoursText, !hoursText.isEmpty, hoursText != "--" else { return nil }

        let pattern = #"(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let nsRange = NSRange(hoursText.startIndex..<hoursText.endIndex, in: hoursText)
        let matches = regex.matches(in: hoursText, options: [], range: nsRange)
        guard matches.count >= 2 else { return nil }

        func minuteValue(from match: NSTextCheckingResult) -> Int? {
            guard
                let hourRange = Range(match.range(at: 1), in: hoursText),
                let meridiemRange = Range(match.range(at: 3), in: hoursText)
            else { return nil }

            let hourValue = Int(hoursText[hourRange]) ?? 0
            let minuteValue: Int = {
                guard let minuteRange = Range(match.range(at: 2), in: hoursText) else { return 0 }
                return Int(hoursText[minuteRange]) ?? 0
            }()
            let meridiem = hoursText[meridiemRange].lowercased()

            var hour24 = hourValue % 12
            if meridiem == "pm" {
                hour24 += 12
            }
            return max(0, min(23, hour24)) * 60 + max(0, min(59, minuteValue))
        }

        guard
            let open = minuteValue(from: matches[0]),
            let close = minuteValue(from: matches[1]),
            close > open
        else { return nil }

        return PollingScheduleWindow(openMinutes: Double(open), closeMinutes: Double(close))
    }
}

// MARK: - MAPV Time Slider + Visual Overlay

private enum MAPVTimeVisualConstants {
    static let arcCount = 5
    static let arcSpacing: CGFloat = 7
    static let maxRadius: CGFloat = 46
    static let glowRadius: CGFloat = 44
    static let sunSize: CGFloat = 22
    static let trackHeight: CGFloat = 14
    static let thumbSize: CGFloat = 26
    static let snapInterval: TimeInterval = 15 * 60
    static let overlayHeight: CGFloat = 86
    static let emojiStripHeight: CGFloat = 38
}

private enum MAPVTimeContextConstants {
    static let allEmojis = ["😴", "☕️", "🚇", "💻", "🥪", "🛒", "🌆", "🏠"]
    static let mediumEmojis = ["😴", "☕️", "💻", "🥪", "🛒", "🌆"]
    static let compactEmojis = ["😴", "☕️", "💻", "🛒", "🌆"]
}

private enum CrowdCue: String {
    case good
    case busy
    case neutral

    var headline: String {
        switch self {
        case .good: return "Usually quieter"
        case .busy: return "Often busiest"
        case .neutral: return "Mixed"
        }
    }

    var tint: Color {
        switch self {
        case .good: return VoteNowColors.primaryCTA
        case .busy: return VoteNowColors.warningAmber
        case .neutral: return VoteNowColors.mutedText
        }
    }

    var symbolName: String {
        switch self {
        case .good: return "checkmark.circle.fill"
        case .busy: return "exclamationmark.triangle.fill"
        case .neutral: return "clock.fill"
        }
    }
}

private enum CrowdReason: String {
    case openingRush
    case lunchRush
    case afterWorkRush
    case midMorning
    case midAfternoon
    case neutral

    var detail: String {
        switch self {
        case .openingRush: return "Before work rush"
        case .lunchRush: return "Lunch break rush"
        case .afterWorkRush: return "After work rush"
        case .midMorning: return "Between rushes"
        case .midAfternoon: return "Between rushes"
        case .neutral: return "Lines vary"
        }
    }
}

private enum CrowdCueEvaluator {
    private struct WindowSpec {
        let reason: CrowdReason
        let interval: DateInterval
    }

    static func evaluate(open: Date, close: Date, selected: Date) -> (cue: CrowdCue, reason: CrowdReason) {
        guard close > open else { return (.neutral, .neutral) }

        let clampedSelected = clampDate(selected, min: open, max: close)
        let bounds = DateInterval(start: open, end: close)
        let calendar = Calendar.current

        var busyWindows: [WindowSpec] = []
        if let opening = clamped(DateInterval(start: open, end: min(open.addingTimeInterval(90 * 60), close)), to: bounds) {
            busyWindows.append(WindowSpec(reason: .openingRush, interval: opening))
        }
        if let lunch = clampedDailyWindow(on: clampedSelected, startHour: 11, startMinute: 0, endHour: 14, endMinute: 0, bounds: bounds, calendar: calendar) {
            busyWindows.append(WindowSpec(reason: .lunchRush, interval: lunch))
        }
        if let afterWork = clampedDailyWindow(on: clampedSelected, startHour: 16, startMinute: 0, endHour: 19, endMinute: 0, bounds: bounds, calendar: calendar) {
            busyWindows.append(WindowSpec(reason: .afterWorkRush, interval: afterWork))
        }

        for item in busyWindows where contains(date: clampedSelected, in: item.interval) {
            return (.busy, item.reason)
        }

        var goodWindows: [WindowSpec] = []
        if let midMorning = clampedDailyWindow(on: clampedSelected, startHour: 9, startMinute: 30, endHour: 11, endMinute: 0, bounds: bounds, calendar: calendar) {
            goodWindows.append(WindowSpec(reason: .midMorning, interval: midMorning))
        }
        if let midAfternoon = clampedDailyWindow(on: clampedSelected, startHour: 14, startMinute: 0, endHour: 16, endMinute: 0, bounds: bounds, calendar: calendar) {
            goodWindows.append(WindowSpec(reason: .midAfternoon, interval: midAfternoon))
        }

        for item in goodWindows where contains(date: clampedSelected, in: item.interval) {
            return (.good, item.reason)
        }

        return (.neutral, .neutral)
    }

    private static func contains(date: Date, in interval: DateInterval) -> Bool {
        date >= interval.start && date <= interval.end
    }

    private static func clamped(_ interval: DateInterval, to bounds: DateInterval) -> DateInterval? {
        let start = max(interval.start, bounds.start)
        let end = min(interval.end, bounds.end)
        guard end > start else { return nil }
        return DateInterval(start: start, end: end)
    }

    private static func clampedDailyWindow(
        on dayReference: Date,
        startHour: Int,
        startMinute: Int,
        endHour: Int,
        endMinute: Int,
        bounds: DateInterval,
        calendar: Calendar
    ) -> DateInterval? {
        var startComps = calendar.dateComponents([.year, .month, .day], from: dayReference)
        startComps.hour = startHour
        startComps.minute = startMinute
        startComps.second = 0

        var endComps = calendar.dateComponents([.year, .month, .day], from: dayReference)
        endComps.hour = endHour
        endComps.minute = endMinute
        endComps.second = 0

        guard
            let startDate = calendar.date(from: startComps),
            let endDate = calendar.date(from: endComps)
        else { return nil }

        return clamped(DateInterval(start: startDate, end: endDate), to: bounds)
    }
}

private struct CrowdCueBubble: View {
    let cue: CrowdCue
    let headline: String
    let detail: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: cue.symbolName)
                .font(.caption2.weight(.bold))
            VStack(alignment: .leading, spacing: 1) {
                Text(headline)
                    .font(.caption.weight(.bold))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Text(detail)
                    .font(.caption2)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(cue.tint.opacity(0.96))
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            Capsule(style: .continuous)
                .fill(cue.tint.opacity(0.16))
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(cue.tint.opacity(0.55), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.10), radius: 3, x: 0, y: 1)
        .allowsHitTesting(false)
    }
}

private struct MAPVTimeSlider: View {
    @Binding var selectedDate: Date
    let openDate: Date
    let closeDate: Date
    var isActive: Bool = true

    @State private var isDragging = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var progress: Double {
        mapProgress(selectedDate: selectedDate, openDate: openDate, closeDate: closeDate)
    }

    private var cueState: (cue: CrowdCue, reason: CrowdReason) {
        CrowdCueEvaluator.evaluate(open: openDate, close: closeDate, selected: selectedDate)
    }

    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                let width = max(geo.size.width, 1)
                let thumbX = width * progress
                let highlightWidth: CGFloat = 60

                VStack(spacing: 8) {
                    MAPVTimeVisualOverlay(
                        progress: progress,
                        isDragging: isDragging,
                        openDate: openDate,
                        closeDate: closeDate,
                        selectedDate: selectedDate
                    )
                    .frame(height: MAPVTimeVisualConstants.overlayHeight)

                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(VoteNowColors.infoSurfaceBlue)
                            .frame(height: MAPVTimeVisualConstants.trackHeight)

                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.72, green: 0.85, blue: 1.00),
                                        Color(red: 1.00, green: 0.78, blue: 0.38),
                                        Color(red: 0.69, green: 0.61, blue: 0.96)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: MAPVTimeVisualConstants.trackHeight)

                        Capsule()
                            .fill(VoteNowColors.primaryCTA.opacity(0.16))
                            .frame(width: highlightWidth, height: MAPVTimeVisualConstants.trackHeight + 6)
                            .offset(x: min(max(thumbX - (highlightWidth / 2), 0), width - highlightWidth))

                        Circle()
                            .fill(VoteNowColors.surfaceWhite)
                            .frame(width: MAPVTimeVisualConstants.thumbSize, height: MAPVTimeVisualConstants.thumbSize)
                            .overlay(
                                Circle()
                                    .stroke(VoteNowColors.richBlue.opacity(0.75), lineWidth: 3)
                            )
                            .shadow(color: .black.opacity(0.20), radius: 4, x: 0, y: 2)
                            .offset(x: thumbX - (MAPVTimeVisualConstants.thumbSize / 2))
                    }
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isDragging = true
                                updateSelectedDate(dragX: value.location.x, width: width)
                            }
                            .onEnded { _ in
                                isDragging = false
                            }
                    )
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Voting time selector")
                    .accessibilityValue("\(Self.timeFormatter.string(from: selectedDate)). \(cueState.cue.headline). \(cueState.reason.detail).")
                    .accessibilityHint("Drag left or right to choose your voting time.")

                    MAPVTimeContextEmojiStrip(progress: progress, isDragging: isDragging)
                        .frame(height: MAPVTimeVisualConstants.emojiStripHeight)
                }
                .transaction { transaction in
                    if reduceMotion {
                        transaction.animation = nil
                    }
                }
            }
            .frame(height: MAPVTimeVisualConstants.overlayHeight + MAPVTimeVisualConstants.trackHeight + MAPVTimeVisualConstants.emojiStripHeight + 18)

            HStack(spacing: 8) {
                Text(Self.timeFormatter.string(from: openDate))
                    .font(.caption)
                    .foregroundStyle(VoteNowColors.mutedText)
                    .frame(width: 52, alignment: .leading)

                Spacer(minLength: 4)

                CrowdCueBubble(
                    cue: cueState.cue,
                    headline: cueState.cue.headline,
                    detail: cueState.reason.detail
                )
                .frame(maxWidth: 208)

                Spacer(minLength: 4)

                Text(Self.timeFormatter.string(from: closeDate))
                    .font(.caption)
                    .foregroundStyle(VoteNowColors.mutedText)
                    .frame(width: 52, alignment: .trailing)
            }
        }
        .onAppear {
            guard isActive else { return }
            let clamped = clampDate(selectedDate, min: openDate, max: closeDate)
            guard clamped != selectedDate else { return }
            deferToNextRunLoop {
                if selectedDate != clamped {
                    selectedDate = clamped
                }
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.20), value: progress)
    }

    private func updateSelectedDate(dragX: CGFloat, width: CGFloat) {
        guard closeDate > openDate else {
            selectedDate = openDate
            return
        }

        let safeWidth = width.isFinite ? width : 0
        guard safeWidth > 0 else {
            selectedDate = clampDate(selectedDate, min: openDate, max: closeDate)
            return
        }

        let safeDragX = dragX.isFinite ? dragX : 0
        let rawProgress = Double(min(max(safeDragX, 0), safeWidth) / safeWidth)
        guard rawProgress.isFinite else {
            selectedDate = clampDate(selectedDate, min: openDate, max: closeDate)
            return
        }
        let total = closeDate.timeIntervalSince(openDate)
        let rawDate = openDate.addingTimeInterval(rawProgress * total)
        let snappedDate = snapDate(rawDate, interval: MAPVTimeVisualConstants.snapInterval, anchor: openDate)
        selectedDate = clampDate(snappedDate, min: openDate, max: closeDate)
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }
}

private struct MAPVTimeContextEmojiStrip: View {
    let progress: Double
    let isDragging: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let width = max(geo.size.width, 1)
            let clampedProgress = min(max(progress, 0), 1)
            let displayed = emojis(for: width)
            let count = max(displayed.count, 1)
            let nearest = nearestIndex(for: clampedProgress, count: count)
            let thumbX = width * CGFloat(clampedProgress)
            let liveEmoji = displayed[min(max(nearest, 0), displayed.count - 1)]
            let nextIndex = min(nearest + 1, displayed.count - 1)
            let nextEmoji = displayed[nextIndex]
            let nextX = min(width - 12, thumbX + 24)

            ZStack(alignment: .topLeading) {
                Text(liveEmoji)
                    .font(.system(size: isDragging ? 24 : 22))
                    .position(x: thumbX, y: 15)
                    .opacity(1.0)

                if nextIndex != nearest {
                    Text(nextEmoji)
                        .font(.system(size: 20))
                        .position(x: nextX, y: 15)
                        .opacity(0.32)
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: nearest)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: clampedProgress)
        }
        .allowsHitTesting(false)
    }

    private func emojis(for width: CGFloat) -> [String] {
        if width < 260 { return MAPVTimeContextConstants.compactEmojis }
        if width < 340 { return MAPVTimeContextConstants.mediumEmojis }
        return MAPVTimeContextConstants.allEmojis
    }

    func emojiForProgress(_ p: Double) -> String {
        let clamped = min(max(p, 0), 1)
        switch clamped {
        case ..<0.12: return "😴"
        case ..<0.24: return "☕️"
        case ..<0.40: return "🚇"
        case ..<0.56: return "💻"
        case ..<0.68: return "🥪"
        case ..<0.82: return "🛒"
        case ..<0.93: return "🌆"
        default: return "🏠"
        }
    }

    func nearestIndex(for p: Double, count: Int) -> Int {
        guard count > 1 else { return 0 }
        let clamped = min(max(p, 0), 1)
        let raw = Int((clamped * Double(count - 1)).rounded())
        return min(max(raw, 0), count - 1)
    }
}

private struct MAPVTimeVisualOverlay: View {
    let progress: Double
    let isDragging: Bool
    let openDate: Date
    let closeDate: Date
    let selectedDate: Date

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let width = max(geo.size.width, 1)
            let computedProgress = mapProgress(selectedDate: selectedDate, openDate: openDate, closeDate: closeDate)
            let passedProgress = min(max(progress, 0), 1)
            let clampedP = min(max((computedProgress + passedProgress) * 0.5, 0), 1)
            let centerX = width * clampedP
            let baselineY = geo.size.height - 10
            let sunLift = sunYOffset(progress: clampedP, maxLift: geo.size.height * 0.48)
            let sunY = baselineY - sunLift
            let middayStrength = 1 - abs((clampedP * 2) - 1)
            let phase = reduceMotion ? 0 : (isDragging ? clampedP * 8 * .pi : clampedP * 3 * .pi)

            ZStack {
                // Subtle time-of-day gradient along the overlay region.
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.72, green: 0.85, blue: 1.00),
                                Color(red: 1.00, green: 0.78, blue: 0.38),
                                Color(red: 0.69, green: 0.61, blue: 0.96)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .opacity(0.16)
                    .frame(height: geo.size.height * 0.62)
                    .frame(maxHeight: .infinity, alignment: .bottom)

                // Sun glow (stronger around midday).
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1.00, green: 0.83, blue: 0.38).opacity(0.14 + (0.30 * middayStrength)),
                                Color(red: 1.00, green: 0.80, blue: 0.35).opacity(0.08),
                                .clear
                            ],
                            center: .center,
                            startRadius: 2,
                            endRadius: MAPVTimeVisualConstants.glowRadius
                        )
                    )
                    .frame(width: MAPVTimeVisualConstants.glowRadius * 2, height: MAPVTimeVisualConstants.glowRadius * 2)
                    .position(x: centerX, y: sunY)
                    .blur(radius: 2.5)
                    .blendMode(.screen)

                // Semi-circular wavefronts (half-circles above track).
                ForEach(0..<MAPVTimeVisualConstants.arcCount, id: \.self) { idx in
                    let wave = waveArcStyle(index: idx, phase: phase, isDragging: isDragging)
                    HalfCircleWaveArc(centerX: centerX, baselineY: baselineY, radius: wave.radius)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    VoteNowColors.surfaceWhite.opacity(0.60),
                                    Color(red: 0.95, green: 0.67, blue: 0.37).opacity(0.75),
                                    Color(red: 0.70, green: 0.58, blue: 0.92).opacity(0.60)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            style: StrokeStyle(lineWidth: wave.lineWidth, lineCap: .round)
                        )
                        .opacity(wave.opacity)
                }

                Image(systemName: "sun.max.fill")
                    .font(.system(size: MAPVTimeVisualConstants.sunSize, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(red: 1.00, green: 0.90, blue: 0.48), Color(red: 1.00, green: 0.67, blue: 0.28)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: Color.orange.opacity(0.30 + (0.20 * middayStrength)), radius: 6, x: 0, y: 2)
                    .position(x: centerX, y: sunY)
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: clampedP)
        }
        .allowsHitTesting(false)
    }
}

private struct HalfCircleWaveArc: Shape {
    var centerX: CGFloat
    var baselineY: CGFloat
    var radius: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let safeRadius = max(2, radius)
        path.addArc(
            center: CGPoint(x: centerX, y: baselineY),
            radius: safeRadius,
            startAngle: .degrees(180),
            endAngle: .degrees(0),
            clockwise: false
        )
        return path
    }
}

private struct WaveArcStyle {
    let radius: CGFloat
    let opacity: Double
    let lineWidth: CGFloat
}

private func mapProgress(selectedDate: Date, openDate: Date, closeDate: Date) -> Double {
    let total = closeDate.timeIntervalSince(openDate)
    guard total > 0 else { return 0 }
    let clamped = min(max(selectedDate.timeIntervalSince(openDate), 0), total)
    return clamped / total
}

// Parabola-shaped sun trajectory: highest at midday, lower near open/close.
private func sunYOffset(progress: Double, maxLift: CGFloat) -> CGFloat {
    let p = min(max(progress, 0), 1)
    let arch = 1 - pow((2 * p) - 1, 2)
    return CGFloat(arch) * maxLift
}

private func waveArcStyle(index: Int, phase: Double, isDragging: Bool) -> WaveArcStyle {
    let base = CGFloat(8 + (index * Int(MAPVTimeVisualConstants.arcSpacing)))
    let pulse = CGFloat((sin(phase + (Double(index) * 0.9)) + 1) * 0.5)
    let amplitude: CGFloat = isDragging ? 4.0 : 2.0
    let radius = min(base + (pulse * amplitude), MAPVTimeVisualConstants.maxRadius)
    let opacity = max(0.18, 0.62 - (Double(index) * 0.10))
    let lineWidth = max(1.1, 2.2 - (CGFloat(index) * 0.22))
    return WaveArcStyle(radius: radius, opacity: opacity, lineWidth: lineWidth)
}

private func clampDate(_ date: Date, min: Date, max: Date) -> Date {
    guard max > min else { return min }
    if date < min { return min }
    if date > max { return max }
    return date
}

private func snapDate(_ date: Date, interval: TimeInterval, anchor: Date) -> Date {
    guard interval > 0 else { return date }
    let delta = date.timeIntervalSince(anchor)
    let snapped = (delta / interval).rounded() * interval
    return anchor.addingTimeInterval(snapped)
}

// Demo integration harness for previews/tests.
private struct MAPVTimeSliderDemo: View {
    @State private var selected: Date
    private let open: Date
    private let close: Date

    init() {
        let calendar = Calendar.current
        let now = Date()
        self.open = calendar.date(bySettingHour: 6, minute: 0, second: 0, of: now) ?? now
        self.close = calendar.date(bySettingHour: 21, minute: 0, second: 0, of: now) ?? now.addingTimeInterval(60 * 60 * 15)
        _selected = State(initialValue: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: now) ?? now)
    }

    var body: some View {
        MAPVTimeSlider(selectedDate: $selected, openDate: open, closeDate: close)
            .padding()
    }
}


// MARK: - Step 4: Commit and Bring a Friend

struct StepFourView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var mapvPlanStore: MAPVPlanStore
    @StateObject private var previewWaterfallController = EmojiWaterfallController()

    var selectedMethod: VotingMethod?
    var selectedPollingPlace: PollingPlace?
    var chosenVotingTime: Date

    private var formattedDate: String {
        Self.dateFormatter.string(from: previewPlan.plannedArrival)
    }

    private var formattedTime: String {
        Self.timeFormatter.string(from: previewPlan.plannedArrival)
    }

    private var resolvedElection: (title: String, date: Date) {
        mapvPlanStore.resolvedElectionForMAPV(planVM: planVM, chosenVotingTime: chosenVotingTime)
    }

    private var previewPlan: MAPVPlan {
        let election = resolvedElection
        let normalizedArrival = mapvPlanStore.normalizePlannedArrivalForMAPV(
            chosenVotingTime: chosenVotingTime,
            electionDate: election.date
        )
        return MAPVPlan.fromWizard(
            electionTitle: election.title,
            electionDate: election.date,
            selectedMethod: selectedMethod,
            selectedPollingPlace: selectedPollingPlace,
            plannedArrival: normalizedArrival,
            distanceETAString: planVM.plan.distanceETA,
            liveActivityEnabled: mapvPlanStore.liveActivityEnabled,
            travelMode: .driving
        )
    }

    private var shareSummaryText: String {
        var lines: [String] = [
            "My Plan to Vote",
            "Election: \(previewPlan.electionTitle)",
            "Method: \(selectedMethod?.rawValue ?? "Plan to Vote")",
            "Date: \(formattedDate)",
            "Time: \(formattedTime)"
        ]
        if selectedMethod == .mail || previewPlan.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            lines.append("Plan: Request Absentee / Mail-in Ballot")
        } else {
            lines.append("Location: \(previewPlan.pollingPlaceName)")
            lines.append("Address: \(previewPlan.pollingPlaceAddress)")
            lines.append("Polls: \(formattedPollWindow)")
        }
        return lines.joined(separator: "\n")
    }

    private var formattedPollWindow: String {
        "\(Self.timeFormatter.string(from: previewPlan.pollingOpen)) - \(Self.timeFormatter.string(from: previewPlan.pollingClose))"
    }

    private var calendarPayload: MAPVCalendarPlanPayload {
        let baseLocation = previewPlan.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? previewPlan.pollingPlaceName
            : previewPlan.pollingPlaceAddress

        return MAPVCalendarPlanPayload(
            planID: "wizard-\(previewPlan.id.uuidString)",
            electionID: previewPlan.electionTitle,
            electionTitle: previewPlan.electionTitle,
            startDate: previewPlan.plannedArrival,
            endDate: previewPlan.plannedArrival.addingTimeInterval(60 * 60),
            location: baseLocation,
            notes: shareSummaryText,
            url: URL(string: "votenow://mapv")
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("You're almost done.")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                    Text("Review your card before you finish.")
                        .font(.subheadline)
                        .foregroundColor(.secondary.opacity(0.85))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                MAPVCardView(
                    waterfallController: previewWaterfallController,
                    previewPlan: previewPlan,
                    isVotedActionEnabled: false
                )

                HStack(spacing: 10) {
                    AddToCalendarButtonView(
                        payload: calendarPayload,
                        buttonTitle: "Add to Calendar"
                    )

                    ShareLink(
                        item: shareSummaryText,
                        subject: Text("My Plan to Vote"),
                        message: Text("Here is my voting plan.")
                    ) {
                        Label("Share Plan", systemImage: "square.and.arrow.up")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                    .background(VoteNowColors.infoSurfaceBlue)
                    .foregroundColor(VoteNowColors.primaryText)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                Text("Share via text, WhatsApp, or any app in your share sheet.")
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal)
            .padding(.vertical, 6)
        }
        .onDisappear {
            previewWaterfallController.stop()
        }
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

}

// MARK: - Full Plan Detail Sheet

struct FullPlanDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let method    : VotingMethod?
    let place     : PollingPlace?
    let votingTime: Date

    private var formattedTime: String {
        let df = DateFormatter()
        df.dateStyle = .full; df.timeStyle = .short
        return df.string(from: votingTime)
    }

    var body: some View {
        NavigationView {
            List {
                if let m = method {
                    Label(m.rawValue, systemImage: "checkmark.circle")
                }
                if let p = place {
                    Label(p.address, systemImage: "mappin.and.ellipse")
                }
                Label(formattedTime, systemImage: "calendar")
            }
            .navigationTitle("Your Voting Plan")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
