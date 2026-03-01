import Foundation
import ActivityKit

@MainActor
final class MAPVLiveActivityManager: ObservableObject {
    static let shared = MAPVLiveActivityManager()

    private init() {}

    var areLiveActivitiesAuthorized: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    func startOrUpdate(with plan: MAPVPlan, now: Date = Date()) async {
        guard areLiveActivitiesAuthorized else { return }

        let attributes = MAPVLiveActivityAttributes(
            planID: plan.id.uuidString,
            electionTitle: plan.electionTitle,
            pollingPlaceName: plan.pollingPlaceName,
            pollingPlaceAddress: plan.pollingPlaceAddress
        )

        let presentation = MAPVStatusResolver.resolve(plan: plan, now: now, locale: preferredLocale())
        let contentState = makeContentState(plan: plan, presentation: presentation, now: now)
        let content = ActivityContent(
            state: contentState,
            staleDate: presentation.staleDate,
            relevanceScore: presentation.relevanceScore
        )

        if let existing = activity(for: plan.id.uuidString) {
            await existing.update(content)
            return
        }

        do {
            _ = try Activity<MAPVLiveActivityAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
        } catch {
            print("MAPV Live Activity start failed: \(error.localizedDescription)")
        }
    }

    func refresh(using plan: MAPVPlan?, enabled: Bool, now: Date = Date()) async {
        guard enabled, let plan else {
            await endAll(immediate: false)
            return
        }
        await startOrUpdate(with: plan, now: now)
    }

    func end(
        with plan: MAPVPlan,
        finalStatus: MAPVDisplayStatus? = nil,
        dismissalPolicy: ActivityUIDismissalPolicy = .default,
        now: Date = Date()
    ) async {
        guard let activity = activity(for: plan.id.uuidString) else { return }

        if let finalStatus {
            var finalPlan = plan
            switch finalStatus {
            case .completed:
                finalPlan.isCompleted = true
                finalPlan.completedAt = now
            case .enRoute:
                finalPlan.isEnRoute = true
            default:
                break
            }
            let presentation = MAPVStatusResolver.resolve(plan: finalPlan, now: now, locale: preferredLocale())
            let finalState = makeContentState(plan: finalPlan, presentation: presentation, now: now)
            let content = ActivityContent(
                state: finalState,
                staleDate: now.addingTimeInterval(60),
                relevanceScore: 0.1
            )
            await activity.end(content, dismissalPolicy: dismissalPolicy)
            return
        }

        await activity.end(dismissalPolicy: dismissalPolicy)
    }

    func endAll(immediate: Bool = false) async {
        let dismissal: ActivityUIDismissalPolicy = immediate ? .immediate : .default
        for activity in Activity<MAPVLiveActivityAttributes>.activities {
            await activity.end(dismissalPolicy: dismissal)
        }
    }

    private func activity(for planID: String) -> Activity<MAPVLiveActivityAttributes>? {
        Activity<MAPVLiveActivityAttributes>.activities.first { $0.attributes.planID == planID }
    }

    private func makeContentState(
        plan: MAPVPlan,
        presentation: MAPVStatusPresentation,
        now: Date
    ) -> MAPVLiveActivityAttributes.ContentState {
        MAPVLiveActivityAttributes.ContentState(
            status: presentation.status,
            statusPillText: presentation.statusPillText,
            statusColorToken: presentation.statusColorToken,
            primaryCountdownText: presentation.primaryCountdownText,
            secondaryMetaText: presentation.secondaryMetaText,
            now: now,
            pollingOpen: plan.pollingOpen,
            pollingClose: plan.pollingClose,
            plannedArrival: plan.plannedArrival,
            nowProgress: presentation.progressNow,
            plannedProgress: presentation.progressPlan,
            distanceMiles: plan.distanceMiles,
            etaMinutes: plan.etaMinutes,
            pollingPlaceShortName: shortLocationName(from: plan.pollingPlaceName),
            deepLinkURL: plan.appDeepLinkURL?.absoluteString ?? "votenow://mapv",
            directionsURL: plan.mapsURL?.absoluteString
        )
    }

    private func shortLocationName(from fullName: String) -> String {
        let trimmed = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Polling Place" }
        if trimmed.count <= 30 { return trimmed }
        return String(trimmed.prefix(30)) + "…"
    }

    private func preferredLocale() -> Locale {
        let code = UserDefaults.standard.string(forKey: "my_info.preferred_language_code") ?? "en"
        let normalized: String
        switch code.lowercased() {
        case "tl", "tagalog", "fil-ph":
            normalized = "fil"
        case "zh", "zh-cn", "zh-hans", "zh-hans-cn":
            normalized = "zh-Hans"
        case "vi-vn":
            normalized = "vi"
        case "es-es", "es-mx":
            normalized = "es"
        case "en-us", "en-gb":
            normalized = "en"
        default:
            normalized = code
        }
        return Locale(identifier: normalized)
    }
}
