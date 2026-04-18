import Foundation
import ActivityKit
import MapKit
import OSLog

@MainActor
final class MAPVLiveActivityManager: ObservableObject {
    static let shared = MAPVLiveActivityManager()
    private let logger = Logger(subsystem: "Civica", category: "MAPVLiveActivity")

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
        let liveRouteMetrics = await resolveLiveRouteMetrics(for: plan)
        let contentState = makeContentState(
            plan: plan,
            presentation: presentation,
            now: now,
            liveRouteMetrics: liveRouteMetrics
        )
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
            logger.error("Failed to start MAPV Live Activity.")
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
            let liveRouteMetrics = await resolveLiveRouteMetrics(for: finalPlan)
            let finalState = makeContentState(
                plan: finalPlan,
                presentation: presentation,
                now: now,
                liveRouteMetrics: liveRouteMetrics
            )
            let content = ActivityContent(
                state: finalState,
                staleDate: now.addingTimeInterval(60),
                relevanceScore: 0.1
            )
            await activity.end(content, dismissalPolicy: dismissalPolicy)
            return
        }

        await activity.end(nil, dismissalPolicy: dismissalPolicy)
    }

    func endAll(immediate: Bool = false) async {
        let dismissal: ActivityUIDismissalPolicy = immediate ? .immediate : .default
        for activity in Activity<MAPVLiveActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: dismissal)
        }
    }

    private func activity(for planID: String) -> Activity<MAPVLiveActivityAttributes>? {
        Activity<MAPVLiveActivityAttributes>.activities.first { $0.attributes.planID == planID }
    }

    private func makeContentState(
        plan: MAPVPlan,
        presentation: MAPVStatusPresentation,
        now: Date,
        liveRouteMetrics: (distanceMiles: Double?, etaMinutes: Int?)?
    ) -> MAPVLiveActivityAttributes.ContentState {
        let distanceMiles = liveRouteMetrics?.distanceMiles ?? plan.distanceMiles
        let etaMinutes = liveRouteMetrics?.etaMinutes ?? plan.etaMinutes

        return MAPVLiveActivityAttributes.ContentState(
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
            distanceMiles: distanceMiles,
            etaMinutes: etaMinutes,
            pollingPlaceShortName: shortLocationName(from: plan.pollingPlaceName),
            deepLinkURL: plan.appDeepLinkURL?.absoluteString ?? "votenow://mapv",
            directionsURL: plan.mapsURL?.absoluteString
        )
    }

    private func shortLocationName(from fullName: String) -> String {
        let trimmed = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Polling Place" }
        if trimmed.count <= 24 { return trimmed }
        return String(trimmed.prefix(24)) + "…"
    }

    private func resolveLiveRouteMetrics(for plan: MAPVPlan) async -> (distanceMiles: Double?, etaMinutes: Int?)? {
        if Task.isCancelled { return nil }
        guard let destination = await destinationMapItem(for: plan) else { return nil }
        if Task.isCancelled { return nil }

        let request = MKDirections.Request()
        request.source = MKMapItem.forCurrentLocation()
        request.destination = destination
        request.transportType = transportType(for: plan.travelMode)
        request.requestsAlternateRoutes = false

        do {
            let response = try await MKDirections(request: request).calculate()
            if Task.isCancelled { return nil }
            guard let route = response.routes.first else { return nil }
            let miles = route.distance / 1609.34
            let etaMinutes = max(1, Int(route.expectedTravelTime / 60))
            return (distanceMiles: miles, etaMinutes: etaMinutes)
        } catch {
            return nil
        }
    }

    private func destinationMapItem(for plan: MAPVPlan) async -> MKMapItem? {
        if Task.isCancelled { return nil }
        if let coordinate = plan.coordinate {
            return MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        }

        let query = plan.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? plan.pollingPlaceName
            : plan.pollingPlaceAddress

        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        do {
            let response = try await MKLocalSearch(request: request).start()
            if Task.isCancelled { return nil }
            return response.mapItems.first
        } catch {
            return nil
        }
    }

    private func transportType(for travelMode: MAPVTravelMode?) -> MKDirectionsTransportType {
        switch travelMode {
        case .walking:
            return .walking
        case .transit:
            return .transit
        case .driving, .none:
            return .automobile
        }
    }

    private func preferredLocale() -> Locale {
        let code = UserDefaults.standard.string(forKey: "my_info.preferred_language_code") ?? "en"
        let normalized = PreferredLanguageCode.normalizeStoredCode(code)
        return Locale(identifier: normalized)
    }
}
