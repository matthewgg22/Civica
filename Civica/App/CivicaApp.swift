import CivicaDesignSystem
import SwiftUI

// Civica — SNAP (and CalFresh, eventually) enrollment app.
//
// Separate iOS target from VoteNow (the democracy / civic-engagement app).
// Shares the CivicaDesignSystem package; nothing else. The SNAP/Find Help
// surfaces live under `Civica/Features/SNAP/` and `Civica/Features/SNAP/FindHelp/`.

@main
struct CivicaApp: App {
    init() {
        // Ensure Hanken Grotesk + Atkinson Hyperlegible are registered before
        // any view tries to render text. Same pattern as the existing app.
        CivicaFonts.register()

        // Run launch-time data hygiene in order: drop retired
        // UserDefaults keys, migrate the eligibility result into
        // Keychain (Q11), and invalidate any Keychain verdict tied
        // to an out-of-scope state code (Q7). Idempotent, cheap.
        MainActor.assumeIsolated {
            CivicaUserData.runLaunchTimeMigrations()
        }

        // Session A follow-up: refresh the LPIE feature flag on cold
        // launch. Best-effort; failures are silent and fall through to
        // the cached / default value. The flag drives CA student-
        // exemption copy + decisions in CAStateRules.
        Task.detached(priority: .background) {
            await LPIEFeatureFlag.refresh(
                baseURL: Self.enrollmentAPIBaseURL,
                session: .shared
            )
        }
    }

    private static let isMarketplaceUITest =
        CommandLine.arguments.contains("--marketplace-ui-test")

    /// Enrollment API origin. Matches the URL used by EnrollmentAPIClient
    /// in production; kept here as a small explicit constant rather
    /// than threading it through CivicaApp's environment.
    private static let enrollmentAPIBaseURL: URL? =
        URL(string: "https://civica-enrollment-api.civica-api.workers.dev")

    @Environment(\.scenePhase) private var scenePhase

    // EBT push wiring (Lane C ↔ D bridge).
    //
    // A single EBTNotificationPrefsStore instance is created here so
    // the same object receives both the wired API client (from
    // EBTPushWiring.install) and is vended to EBTNotificationPrefsView
    // via the environment. Without a shared instance, prefs written in
    // the UI would not reach the API client, and push settings would
    // be silently dropped.
    //
    // The auth object reads the Keychain session written by the
    // CivicaEnrollmentAuth instance owned by CivicaRootView; both
    // share the same Keychain service key so token reads are consistent.
    @StateObject private var ebtPrefsStore = EBTNotificationPrefsStore()
    @StateObject private var ebtAuth = CivicaEnrollmentAuth()

    var body: some Scene {
        WindowGroup {
            if Self.isMarketplaceUITest {
                MarketplaceUITestHarness()
            } else {
                CivicaRootView()
                    .task {
                        // Pre-warm large FindHelp fixtures from Supabase Storage.
                        // No-op if already cached; runs once per install in the background.
                        await FindHelpFixtureDownloader.shared.prefetchIfNeeded()
                    }
                    .task {
                        // Wire Lane C's HTTPEBTBalanceAPIClient to Lane D's push
                        // handler + prefs store. Runs once when the root view
                        // appears. Without this call APNs push notifications
                        // never fire even after secrets are provisioned in
                        // production.
                        guard let baseURL = HTTPEBTBalanceAPIClient.resolveBaseURL() else { return }
                        let apiClient = HTTPEBTBalanceAPIClient(
                            baseURL: baseURL,
                            tokenProvider: { [weak ebtAuth] in await ebtAuth?.currentAccessToken() }
                        )
                        EBTPushWiring.install(client: apiClient, prefsStore: ebtPrefsStore)
                    }
                    .environmentObject(ebtPrefsStore)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            // Mirror applicationDidBecomeActive — refresh the flag
            // each time the app comes to the foreground so users in
            // long-lived sessions still pick up server-side flips.
            if newPhase == .active {
                Task.detached(priority: .background) {
                    await LPIEFeatureFlag.refresh(
                        baseURL: Self.enrollmentAPIBaseURL,
                        session: .shared
                    )
                }
            }
        }
    }
}
