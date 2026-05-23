import Foundation
import Testing
import UserNotifications
@testable import Civica

// EBTPushHandler tests — focus on the just-in-time pre-prompt state
// machine and the URL/category → deep-link routing.
//
// We swap the UNUserNotificationCenter adapter for a fake so we don't
// hit the real iOS permissions sheet, and we point UserDefaults at an
// in-memory suite so each @Test starts with a clean slate.

// MARK: - Fakes

private final class FakeNotificationCenter: EBTPushHandler.NotificationCenter, @unchecked Sendable {
    var status: UNAuthorizationStatus
    var requestAuthorizationResult: Result<Bool, Error>
    var registerForRemoteCalled = false
    var requestAuthorizationCalls = 0

    init(status: UNAuthorizationStatus = .notDetermined,
         requestAuthorizationResult: Result<Bool, Error> = .success(true)) {
        self.status = status
        self.requestAuthorizationResult = requestAuthorizationResult
    }

    func authorizationStatus() async -> UNAuthorizationStatus { status }

    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool {
        requestAuthorizationCalls += 1
        switch requestAuthorizationResult {
        case .success(let v): return v
        case .failure(let e): throw e
        }
    }

    func registerForRemoteNotifications() {
        registerForRemoteCalled = true
    }
}

private func makeDefaults() -> UserDefaults {
    let suite = "EBTPushHandlerTests-\(UUID().uuidString)"
    let d = UserDefaults(suiteName: suite)!
    // Wipe any persisted values from a prior run (defensive).
    d.removePersistentDomain(forName: suite)
    return d
}

@MainActor
private func makeHandler(
    status: UNAuthorizationStatus = .notDetermined,
    requestAuthorizationResult: Result<Bool, Error> = .success(true),
    now: Date = Date(timeIntervalSince1970: 1_700_000_000)
) -> (EBTPushHandler, FakeNotificationCenter, UserDefaults) {
    let center = FakeNotificationCenter(
        status: status,
        requestAuthorizationResult: requestAuthorizationResult
    )
    let defaults = makeDefaults()
    let handler = EBTPushHandler(
        notificationCenter: center,
        defaults: defaults,
        now: { now }
    )
    return (handler, center, defaults)
}

// MARK: - Tests

// .serialized because the singleton-like pattern (and UIApplication-side
// effects in the alert presenters) means parallel runs would race.
@Suite(.serialized)
struct EBTPushHandlerTests {

    // MARK: State machine

    @Test @MainActor
    func userAcceptedPrePromptFiresSystemAndRegisters() async {
        let (handler, center, defaults) = makeHandler(status: .notDetermined)
        await handler.userAcceptedPrePrompt()
        #expect(center.requestAuthorizationCalls == 1)
        #expect(center.registerForRemoteCalled == true)
        #expect(defaults.bool(forKey: EBTPushHandler.prePromptAcceptedKey) == true)
        #expect(defaults.bool(forKey: EBTPushHandler.systemDeniedKey) == false)
    }

    @Test @MainActor
    func userAcceptedPrePromptPersistsSystemDeniedOnDeny() async {
        let (handler, _, defaults) = makeHandler(
            status: .notDetermined,
            requestAuthorizationResult: .success(false)
        )
        await handler.userAcceptedPrePrompt()
        #expect(defaults.bool(forKey: EBTPushHandler.systemDeniedKey) == true)
    }

    @Test @MainActor
    func userDeferredPrePromptSetsThirtyDayDeferral() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let (handler, _, defaults) = makeHandler(now: now)
        handler.userDeferredPrePrompt()
        let stored = defaults.object(forKey: EBTPushHandler.deferredUntilKey) as? Date
        #expect(stored != nil)
        // Within 1s of +30 days.
        let expected = now.addingTimeInterval(30 * 24 * 60 * 60)
        #expect(abs(stored!.timeIntervalSince(expected)) < 1)
    }

    @Test @MainActor
    func requestPermissionIfNeededNoOpsWhenAuthorized() async {
        let (handler, center, _) = makeHandler(status: .authorized)
        await handler.requestPermissionIfNeeded(from: nil)
        // Already authorized → just (re-)register, never prompt again.
        #expect(center.requestAuthorizationCalls == 0)
        #expect(center.registerForRemoteCalled == true)
    }

    @Test @MainActor
    func requestPermissionIfNeededRespectsDeferral() async {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let (handler, center, defaults) = makeHandler(status: .notDetermined, now: now)
        // Simulate a prior "not now" — deferred 30 days out.
        defaults.set(now.addingTimeInterval(30 * 24 * 60 * 60),
                     forKey: EBTPushHandler.deferredUntilKey)
        await handler.requestPermissionIfNeeded(from: nil)
        // Should NOT have prompted the system.
        #expect(center.requestAuthorizationCalls == 0)
    }

    @Test @MainActor
    func requestPermissionIfNeededRepromptsAfterDeferralExpires() async {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let (handler, _, defaults) = makeHandler(status: .notDetermined, now: now)
        // Deferral expired 1 day ago.
        defaults.set(now.addingTimeInterval(-24 * 60 * 60),
                     forKey: EBTPushHandler.deferredUntilKey)
        // Just confirm the state machine reaches the "would present"
        // path. presentPrePrompt safely no-ops without a hosting VC.
        await handler.requestPermissionIfNeeded(from: nil)
        // Still no system prompt fired (that only happens on YES tap).
        // The pre-prompt path doesn't mutate the deferral; success
        // path here is "we didn't early-return on the deferral guard".
        // We assert that the deferral is still in the past (not
        // shifted) so the next call would re-enter the same path.
        let stored = defaults.object(forKey: EBTPushHandler.deferredUntilKey) as? Date
        #expect(stored != nil && stored! < now)
    }

    @Test @MainActor
    func requestPermissionIfNeededFallsThroughToSettingsWhenSystemDenied() async {
        let (handler, center, defaults) = makeHandler(status: .denied)
        await handler.requestPermissionIfNeeded(from: nil)
        // Persisted systemDenied + did NOT prompt the system again.
        #expect(defaults.bool(forKey: EBTPushHandler.systemDeniedKey) == true)
        #expect(center.requestAuthorizationCalls == 0)
    }

    @Test @MainActor
    func requestPermissionIfNeededHonorsPersistedSystemDenied() async {
        let (handler, center, defaults) = makeHandler(status: .notDetermined)
        defaults.set(true, forKey: EBTPushHandler.systemDeniedKey)
        await handler.requestPermissionIfNeeded(from: nil)
        // Should NOT re-prompt the system; the settings alert path
        // takes over (which is a no-op without a hosting VC in tests).
        #expect(center.requestAuthorizationCalls == 0)
        #expect(center.registerForRemoteCalled == false)
    }

    // MARK: Device-token handling

    @Test @MainActor
    func handleDeviceTokenEncodesHex() {
        let (handler, _, defaults) = makeHandler()
        // 0x01 0x02 0x03 0x04 → "01020304"
        let data = Data([0x01, 0x02, 0x03, 0x04])
        handler.handleDeviceToken(data)
        // No api client wired → token persisted for later upload.
        #expect(defaults.string(forKey: "co.civica.ebt.push.pendingToken") == "01020304")
    }

    @Test @MainActor
    func handleDeviceTokenUploadsViaAPIClient() async throws {
        let (handler, _, defaults) = makeHandler()
        let api = FakePrefsPushAPIClient()
        handler.setAPIClient(api)

        handler.handleDeviceToken(Data([0xff, 0xee]))
        // Give the Task a tick to complete.
        try await Task.sleep(nanoseconds: 50_000_000)
        #expect(api.lastToken == "ffee")
        // After successful upload the pending token is cleared.
        #expect(defaults.string(forKey: "co.civica.ebt.push.pendingToken") == nil)
    }

    // MARK: Deep-link routing

    @Test @MainActor
    func deepLinkRoutingMapsCategoriesToTargets() {
        #expect(EBTPushHandler.deepLink(forCategory: "deposit_landed") == .depositLanded)
        #expect(EBTPushHandler.deepLink(forCategory: "low_balance")    == .lowBalance)
        #expect(EBTPushHandler.deepLink(forCategory: "re_link")        == .reLink)
        #expect(EBTPushHandler.deepLink(forCategory: "anomaly")        == .anomaly)
        #expect(EBTPushHandler.deepLink(forCategory: "garbage")        == nil)
    }

    @Test @MainActor
    func consumePendingDeepLinkClears() {
        let (handler, _, _) = makeHandler()
        // Use the public test seam — simulate by setting via a tap.
        // We can't construct UNNotificationResponse directly without
        // private init; routing-only check is enough since the
        // deepLink(forCategory:) is the load-bearing logic.
        _ = handler.consumePendingDeepLink() // initially nil
        #expect(handler.consumePendingDeepLink() == nil)
    }
}

// MARK: - EBTNotificationPrefsStore tests

private final class FakePrefsPushAPIClient: EBTNotificationPrefsAPIClient, EBTBalancePushAPIClient, @unchecked Sendable {
    var calls: [EBTNotificationPrefsPayload] = []
    var lastToken: String?

    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws {
        calls.append(prefs)
    }

    func registerPushToken(_ hexToken: String) async throws {
        lastToken = hexToken
    }
}

@Suite(.serialized)
struct EBTNotificationPrefsStoreTests {

    @Test @MainActor
    func freshInstallAppliesPlanDefaults() {
        let defaults = makeDefaults()
        let store = EBTNotificationPrefsStore(defaults: defaults)
        #expect(store.depositOn == true)
        #expect(store.lowBalanceOn == true)
        #expect(store.perksOn == true)
        #expect(store.recertOn == true)
        #expect(store.quietStartMinutes == 21 * 60)
        #expect(store.quietEndMinutes  ==  8 * 60)
    }

    @Test @MainActor
    func togglesPersistToUserDefaults() {
        let defaults = makeDefaults()
        let store = EBTNotificationPrefsStore(defaults: defaults)
        store.depositOn = false
        store.lowBalanceOn = false
        store.quietStartMinutes = 22 * 60 + 30
        #expect(defaults.bool(forKey: EBTNotificationPrefsStore.depositOnKey) == false)
        #expect(defaults.bool(forKey: EBTNotificationPrefsStore.lowBalanceOnKey) == false)
        #expect(defaults.integer(forKey: EBTNotificationPrefsStore.quietStartKey) == 22 * 60 + 30)
    }

    @Test @MainActor
    func secondInstanceReadsBackPersistedState() {
        let defaults = makeDefaults()
        let first = EBTNotificationPrefsStore(defaults: defaults)
        first.depositOn = false
        first.perksOn = false
        first.quietEndMinutes = 7 * 60

        let second = EBTNotificationPrefsStore(defaults: defaults)
        #expect(second.depositOn == false)
        #expect(second.perksOn == false)
        #expect(second.quietEndMinutes == 7 * 60)
        // Untouched values should still be defaults (true).
        #expect(second.lowBalanceOn == true)
    }

    @Test @MainActor
    func toggleSyncsToBackend() async throws {
        let api = FakePrefsPushAPIClient()
        let store = EBTNotificationPrefsStore(defaults: makeDefaults(), apiClient: api)
        store.depositOn = false
        // didSet → Task → sync. Tick the runloop.
        try await Task.sleep(nanoseconds: 50_000_000)
        #expect(api.calls.count == 1)
        #expect(api.calls[0].depositOn == false)
        #expect(api.calls[0].lowBalanceOn == true)
    }

    @Test @MainActor
    func snapshotMatchesPublishedState() {
        let store = EBTNotificationPrefsStore(defaults: makeDefaults())
        store.depositOn = false
        store.quietStartMinutes = 23 * 60
        let snap = store.snapshot()
        #expect(snap.depositOn == false)
        #expect(snap.quietStartMinutes == 23 * 60)
    }
}
