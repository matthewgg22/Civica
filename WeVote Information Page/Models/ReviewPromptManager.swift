import Foundation
import SwiftUI

@MainActor
final class ReviewPromptManager: ObservableObject {
    enum MeaningfulAction: String, Codable {
        case mapcCompleted
        case reminderCreated
        case pollingPlaceLookupSuccess
        case repLookupSuccess
    }

    enum PromptDecision: String, Codable {
        case notNow
        case rated
        case permanentlyDismissed
    }

    static let shared = ReviewPromptManager()

    @Published private(set) var isPrePromptPresented = false
    @Published private(set) var pendingTrigger: MeaningfulAction?

    private let defaults: UserDefaults

    private var firstOpenDate: Date?
    private var sessionCount: Int
    private var meaningfulActionCount: Int
    private var repLookupSuccessCount: Int
    private var lastPromptDate: Date?
    private var lastPromptDecision: PromptDecision?
    private var didChooseNotNow: Bool
    private var hasRatedAlready: Bool
    private var hasPermanentlyDismissed: Bool
    private var lastSessionRecordedAt: Date?

    private enum Key {
        static let firstOpenDate = "review_prompt.first_open_date"
        static let sessionCount = "review_prompt.session_count"
        static let meaningfulActionCount = "review_prompt.meaningful_action_count"
        static let repLookupSuccessCount = "review_prompt.rep_lookup_success_count"
        static let lastPromptDate = "review_prompt.last_prompt_date"
        static let lastPromptDecision = "review_prompt.last_prompt_decision"
        static let didChooseNotNow = "review_prompt.did_choose_not_now"
        static let hasRatedAlready = "review_prompt.has_rated_already"
        static let hasPermanentlyDismissed = "review_prompt.has_permanently_dismissed"
        static let lastSessionRecordedAt = "review_prompt.last_session_recorded_at"
    }

    init(
        userDefaults: UserDefaults = .standard
    ) {
        self.defaults = userDefaults

        firstOpenDate = userDefaults.object(forKey: Key.firstOpenDate) as? Date
        sessionCount = userDefaults.integer(forKey: Key.sessionCount)
        meaningfulActionCount = userDefaults.integer(forKey: Key.meaningfulActionCount)
        repLookupSuccessCount = userDefaults.integer(forKey: Key.repLookupSuccessCount)
        lastPromptDate = userDefaults.object(forKey: Key.lastPromptDate) as? Date
        if let rawDecision = userDefaults.string(forKey: Key.lastPromptDecision) {
            lastPromptDecision = PromptDecision(rawValue: rawDecision)
        } else {
            lastPromptDecision = nil
        }
        didChooseNotNow = userDefaults.bool(forKey: Key.didChooseNotNow)
        hasRatedAlready = userDefaults.bool(forKey: Key.hasRatedAlready)
        hasPermanentlyDismissed = userDefaults.bool(forKey: Key.hasPermanentlyDismissed)
        lastSessionRecordedAt = userDefaults.object(forKey: Key.lastSessionRecordedAt) as? Date
    }

    // Call on each fresh app launch/session start.
    func onSessionStart(now: Date = Date()) {
        if let lastSessionRecordedAt,
           now.timeIntervalSince(lastSessionRecordedAt) < 60 {
            return
        }

        if firstOpenDate == nil {
            firstOpenDate = now
            defaults.set(now, forKey: Key.firstOpenDate)
        }

        sessionCount += 1
        defaults.set(sessionCount, forKey: Key.sessionCount)

        self.lastSessionRecordedAt = now
        defaults.set(now, forKey: Key.lastSessionRecordedAt)
    }

    func onAppLaunch(now: Date = Date()) {
        onSessionStart(now: now)
    }

    func markMAPCCompleted(
        isInErrorState: Bool = false,
        isFlowInterrupted: Bool = false,
        hasLocationSet: Bool = false,
        now: Date = Date()
    ) {
        registerMeaningfulAction(
            .mapcCompleted,
            isInErrorState: isInErrorState,
            isFlowInterrupted: isFlowInterrupted,
            hasLocationSet: hasLocationSet,
            now: now
        )
    }

    func markReminderCreated(
        isInErrorState: Bool = false,
        isFlowInterrupted: Bool = false,
        hasLocationSet: Bool = false,
        now: Date = Date()
    ) {
        registerMeaningfulAction(
            .reminderCreated,
            isInErrorState: isInErrorState,
            isFlowInterrupted: isFlowInterrupted,
            hasLocationSet: hasLocationSet,
            now: now
        )
    }

    func markPollingPlaceLookupSuccess(
        isInErrorState: Bool = false,
        isFlowInterrupted: Bool = false,
        hasLocationSet: Bool = false,
        now: Date = Date()
    ) {
        registerMeaningfulAction(
            .pollingPlaceLookupSuccess,
            isInErrorState: isInErrorState,
            isFlowInterrupted: isFlowInterrupted,
            hasLocationSet: hasLocationSet,
            now: now
        )
    }

    func markRepLookupSuccess(
        isInErrorState: Bool = false,
        isFlowInterrupted: Bool = false,
        hasLocationSet: Bool = false,
        now: Date = Date()
    ) {
        registerMeaningfulAction(
            .repLookupSuccess,
            isInErrorState: isInErrorState,
            isFlowInterrupted: isFlowInterrupted,
            hasLocationSet: hasLocationSet,
            now: now
        )
    }

    func dismissPrePrompt() {
        isPrePromptPresented = false
        pendingTrigger = nil
    }

    func handleNotNowTapped(now: Date = Date()) {
        didChooseNotNow = true
        defaults.set(true, forKey: Key.didChooseNotNow)
        updatePromptDecision(.notNow)
        defaults.set(now, forKey: Key.lastPromptDate)
        lastPromptDate = now
        dismissPrePrompt()
    }

    func handleRateTapped(now: Date = Date()) {
        hasRatedAlready = true
        defaults.set(true, forKey: Key.hasRatedAlready)
        didChooseNotNow = false
        defaults.set(false, forKey: Key.didChooseNotNow)
        updatePromptDecision(.rated)
        defaults.set(now, forKey: Key.lastPromptDate)
        lastPromptDate = now
        dismissPrePrompt()
    }

    func setPermanentlyDismissed(now: Date = Date()) {
        hasPermanentlyDismissed = true
        defaults.set(true, forKey: Key.hasPermanentlyDismissed)
        updatePromptDecision(.permanentlyDismissed)
        defaults.set(now, forKey: Key.lastPromptDate)
        lastPromptDate = now
        dismissPrePrompt()
    }

    private func registerMeaningfulAction(
        _ action: MeaningfulAction,
        isInErrorState: Bool,
        isFlowInterrupted: Bool,
        hasLocationSet: Bool,
        now: Date
    ) {
        guard hasLocationSet else { return }
        guard !isInErrorState else { return }
        guard !isFlowInterrupted else { return }

        meaningfulActionCount += 1
        defaults.set(meaningfulActionCount, forKey: Key.meaningfulActionCount)
        if action == .repLookupSuccess {
            repLookupSuccessCount += 1
            defaults.set(repLookupSuccessCount, forKey: Key.repLookupSuccessCount)
        }

        evaluatePromptReadiness(
            trigger: action,
            now: now
        )
    }

    private func evaluatePromptReadiness(
        trigger: MeaningfulAction,
        now: Date
    ) {
        let minSecondsSinceSessionStart: TimeInterval = 120
        let promptCooldownDays: Double = 30
        let minRepLookupSuccessesBeforePrompt = 2

        guard !isPrePromptPresented else { return }
        guard !hasRatedAlready else { return }
        guard !hasPermanentlyDismissed else { return }
        guard sessionCount >= 2 else { return }
        guard meaningfulActionCount >= 1 else { return }
        guard let sessionStartedAt = lastSessionRecordedAt else { return }
        guard now.timeIntervalSince(sessionStartedAt) >= minSecondsSinceSessionStart else { return }

        if trigger == .repLookupSuccess {
            guard repLookupSuccessCount >= minRepLookupSuccessesBeforePrompt else { return }
        }

        if let lastPromptDate {
            let daysSincePrompt = now.timeIntervalSince(lastPromptDate) / (24 * 3600)
            guard daysSincePrompt >= promptCooldownDays else { return }
        }

        pendingTrigger = trigger
        isPrePromptPresented = true
    }

    private func updatePromptDecision(_ decision: PromptDecision) {
        lastPromptDecision = decision
        defaults.set(decision.rawValue, forKey: Key.lastPromptDecision)
    }
}
