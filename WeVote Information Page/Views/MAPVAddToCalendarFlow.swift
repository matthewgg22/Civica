import CivicaDesignSystem
import EventKit
import OSLog
import SwiftUI
import UIKit
import UserNotifications

struct MAPVCalendarPlanPayload: Hashable {
    let planID: String
    let electionID: String
    let electionTitle: String
    let startDate: Date
    let endDate: Date
    let location: String
    let notes: String
    let url: URL?

    var reminderBaseID: String {
        let cleanElection = electionID
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return "mapv.\(planID).\(cleanElection)"
    }
}

@MainActor
final class NotificationPermissionManager: ObservableObject {
    @Published private(set) var status: UNAuthorizationStatus = .notDetermined

    func checkStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        let authorizationStatus = settings.authorizationStatus
        status = authorizationStatus
        if [.authorized, .provisional, .ephemeral].contains(authorizationStatus) {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    @discardableResult
    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            await checkStatus()
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
            return granted
        } catch {
            await checkStatus()
            return false
        }
    }

    func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

enum LocalNotificationScheduler {
    private static let logger = Logger(subsystem: "Civica", category: "LocalNotificationScheduler")

    static func scheduleReminders(
        for payload: MAPVCalendarPlanPayload,
        leadMinutes: Int = 60
    ) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }

        await cancelReminders(for: payload)

        let primaryID = payload.reminderBaseID + ".vote"
        let leadID = payload.reminderBaseID + ".lead"
        let now = Date()

        if payload.startDate > now {
            let primaryContent = UNMutableNotificationContent()
            primaryContent.title = "It’s voting time"
            primaryContent.body = "\(payload.electionTitle) starts now. \(payload.location)"
            primaryContent.sound = .default
            if let url = payload.url {
                primaryContent.userInfo = ["deeplink": url.absoluteString]
            }

            let primaryComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: payload.startDate)
            let primaryTrigger = UNCalendarNotificationTrigger(dateMatching: primaryComponents, repeats: false)
            let primaryRequest = UNNotificationRequest(identifier: primaryID, content: primaryContent, trigger: primaryTrigger)
            do {
                try await center.add(primaryRequest)
            } catch {
                logger.error("Failed to schedule primary reminder notification.")
            }
        }

        let leadDate = payload.startDate.addingTimeInterval(-TimeInterval(max(1, leadMinutes)) * 60)
        if leadDate > now {
            let leadContent = UNMutableNotificationContent()
            leadContent.title = "Voting reminder"
            leadContent.body = "\(payload.electionTitle) starts in \(leadMinutes) min at \(payload.location)."
            leadContent.sound = .default
            if let url = payload.url {
                leadContent.userInfo = ["deeplink": url.absoluteString]
            }

            let leadComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: leadDate)
            let leadTrigger = UNCalendarNotificationTrigger(dateMatching: leadComponents, repeats: false)
            let leadRequest = UNNotificationRequest(identifier: leadID, content: leadContent, trigger: leadTrigger)
            do {
                try await center.add(leadRequest)
            } catch {
                logger.error("Failed to schedule lead reminder notification.")
            }
        }
    }

    static func cancelReminders(for payload: MAPVCalendarPlanPayload) async {
        let center = UNUserNotificationCenter.current()
        let ids = [payload.reminderBaseID + ".vote", payload.reminderBaseID + ".lead"]
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
    }
}

struct PrePermissionSheetView: View {
    let onAllow: () -> Void
    let onNotNow: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text("Stay on track")
                .font(CivicaTypography.cardTitle)

            Text("Allow notifications so Civica can remind you on Election Day and if your polling place window changes.")
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.textSecondary)

            HStack(spacing: CivicaSpacing.sm) {
                Button("Not Now", action: onNotNow)
                    .font(CivicaTypography.subheadStrong)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.infoSurfaceBlue)
                    .foregroundStyle(CivicaColors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))

                Button("Allow Reminders", action: onAllow)
                    .font(CivicaTypography.subheadStrong)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.brickPrimary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
            }
        }
        .padding(CivicaSpacing.lg)
        .presentationDetents([.height(250)])
        .presentationDragIndicator(.visible)
    }
}

struct AddToCalendarButtonView: View {
    let payload: MAPVCalendarPlanPayload
    var buttonTitle: String = "Add to My Calendar"

    @StateObject private var permissionManager = NotificationPermissionManager()
    @State private var eventStore = EKEventStore()
    @State private var isWorking = false
    @State private var showSoftAsk = false
    @State private var activeAlert: ActiveAlert?
    @AppStorage("notifications.softAskSeen.v1") private var softAskSeen = false

    enum ActiveAlert: Identifiable {
        case added
        case calendarDenied
        case calendarSaveFailed

        var id: String {
            switch self {
            case .added: return "added"
            case .calendarDenied: return "calendarDenied"
            case .calendarSaveFailed: return "calendarSaveFailed"
            }
        }
    }

    var body: some View {
        Button {
            beginTapFlow()
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                if isWorking {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .scaleEffect(0.85)
                } else {
                    Image(systemName: "calendar.badge.plus")
                }
                Text(buttonTitle)
                    .lineLimit(1)
            }
            .font(CivicaTypography.subheadStrong)
            .frame(maxWidth: .infinity)
            .padding(.vertical, CivicaSpacing.md)
        }
        .buttonStyle(.plain)
        .background(CivicaColors.brickPrimary)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
        .disabled(isWorking)
        .sheet(isPresented: $showSoftAsk) {
            PrePermissionSheetView(
                onAllow: { handleSoftAskAllow() },
                onNotNow: { handleSoftAskNotNow() }
            )
        }
        .alert(item: $activeAlert) { alert in
            switch alert {
            case .added:
                return Alert(title: Text("Added to your calendar!"))
            case .calendarDenied:
                return Alert(
                    title: Text("Calendar Access Needed"),
                    message: Text("Allow calendar access in Settings to add this event."),
                    primaryButton: .default(Text("Open Settings")) {
                        permissionManager.openSettings()
                    },
                    secondaryButton: .cancel(Text("OK"))
                )
            case .calendarSaveFailed:
                return Alert(
                    title: Text("Couldn’t Add Event"),
                    message: Text("Try again in a moment."),
                    dismissButton: .default(Text("OK"))
                )
            }
        }
    }

    private func beginTapFlow() {
        isWorking = true
        Task {
            await permissionManager.checkStatus()
            let status = permissionManager.status

            if status == .notDetermined && !softAskSeen {
                await MainActor.run {
                    isWorking = false
                    showSoftAsk = true
                }
                return
            }
            await addToCalendarDirectly()
        }
    }

    private func handleSoftAskAllow() {
        softAskSeen = true
        showSoftAsk = false
        isWorking = true

        Task {
            let granted = await permissionManager.requestPermission()
            if granted {
                await MainActor.run {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                }
            }
            await addToCalendarDirectly()
        }
    }

    private func handleSoftAskNotNow() {
        softAskSeen = true
        showSoftAsk = false
        isWorking = true
        Task { await addToCalendarDirectly() }
    }

    private func addToCalendarDirectly() async {
        let canWriteCalendar = await ensureCalendarWriteAccess()
        guard canWriteCalendar else {
            await MainActor.run {
                isWorking = false
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                activeAlert = .calendarDenied
            }
            return
        }

        let event = EKEvent(eventStore: eventStore)
        event.title = "Vote: \(payload.electionTitle)"
        event.startDate = payload.startDate
        event.endDate = payload.endDate
        event.location = payload.location
        event.notes = payload.notes
        event.url = payload.url
        event.calendar = eventStore.defaultCalendarForNewEvents
        event.alarms = [EKAlarm(relativeOffset: -3600)]

        do {
            try eventStore.save(event, span: .thisEvent)

            await permissionManager.checkStatus()
            if [.authorized, .provisional, .ephemeral].contains(permissionManager.status) {
                await LocalNotificationScheduler.scheduleReminders(for: payload, leadMinutes: 60)
            } else {
                await LocalNotificationScheduler.cancelReminders(for: payload)
            }

            await MainActor.run {
                isWorking = false
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                activeAlert = .added
            }
        } catch {
            await MainActor.run {
                isWorking = false
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                activeAlert = .calendarSaveFailed
            }
        }
    }

    private func ensureCalendarWriteAccess() async -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        switch status {
        case .fullAccess, .authorized, .writeOnly:
            return true
        case .notDetermined:
            if #available(iOS 17.0, *) {
                return await withCheckedContinuation { continuation in
                    eventStore.requestWriteOnlyAccessToEvents { granted, _ in
                        continuation.resume(returning: granted)
                    }
                }
            } else {
                return await withCheckedContinuation { continuation in
                    eventStore.requestAccess(to: .event) { granted, _ in
                        continuation.resume(returning: granted)
                    }
                }
            }
        case .restricted, .denied:
            return false
        @unknown default:
            return false
        }
    }
}
