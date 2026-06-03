import Foundation
import Sentry

/// Civica's Sentry-Cocoa wiring.
///
/// The DSN is read from Info.plist key `CIVICA_SENTRY_DSN`, which is substituted
/// at build time from the xcconfig variable of the same name. Operators set the
/// value in `Civica/Configuration/Secrets.xcconfig` (gitignored). When the DSN
/// is empty — local dev with no Secrets.xcconfig, CI without injection — the
/// init is skipped and no events are captured.
///
/// PII discipline mirrors the web dashboard's `beforeSend` scrubber:
/// strip request body / cookies / headers (keep only content-type), reduce
/// `user` to its `userId` only, and drop free-form `extra` payloads. This is a
/// SNAP app — eligibility data, addresses, and household composition must never
/// reach Sentry.
enum CivicaSentry {
    /// Starts Sentry if a non-empty DSN is configured. Idempotent: if
    /// `SentrySDK.isEnabled` is already true, returns without re-initializing.
    static func startIfConfigured() {
        guard !SentrySDK.isEnabled else { return }
        guard let dsn = configuredDSN(), !dsn.isEmpty else { return }
        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = currentEnvironment()
            options.releaseName = bundleRelease()
            options.tracesSampleRate = 0.05
            options.profilesSampleRate = 0
            options.attachScreenshot = false
            options.attachViewHierarchy = false
            options.sendDefaultPii = false
            options.beforeSend = { event in scrub(event) }
        }
    }

    /// Pure scrubber: takes an `Event`, mutates PII-bearing fields, returns it.
    /// Exposed for unit tests; production callers go through `startIfConfigured`.
    @discardableResult
    static func scrub(_ event: Event) -> Event {
        if let request = event.request {
            // Sentry-Cocoa 8.x SentryRequest carries `bodySize` (NSNumber) but
            // no `bodyString` / `data` — the body is metadata-only, never the
            // actual payload. Privacy-positive by default; nothing to scrub
            // here for body content. We still clear cookies, queryString, and
            // non-content-type headers since they routinely carry tokens /
            // user-IDs / session cookies.
            request.cookies = nil
            request.queryString = nil
            request.fragment = nil
            if let contentType = request.headers?["content-type"] {
                request.headers = ["content-type": contentType]
            } else {
                request.headers = nil
            }
        }
        if let user = event.user {
            user.email = nil
            user.ipAddress = nil
            user.username = nil
            user.name = nil
            user.data = nil
        }
        event.extra = nil
        return event
    }

    private static func configuredDSN() -> String? {
        Bundle.main.object(forInfoDictionaryKey: "CIVICA_SENTRY_DSN") as? String
    }

    private static func bundleRelease() -> String {
        let version = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0"
        let build = (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? "0"
        return "civica-ios@\(version)+\(build)"
    }

    private static func currentEnvironment() -> String {
        #if DEBUG
        return "debug"
        #else
        return "release"
        #endif
    }
}
