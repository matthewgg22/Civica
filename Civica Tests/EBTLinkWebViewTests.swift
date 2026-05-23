import Foundation
import Testing
@testable import Civica

// Covers T7: the cookie-extractor pure-fn. The full WKWebView path
// isn't unit-testable (no headless WKHTTPCookieStore in CI), but the
// extractor + URL-pattern logic are pure functions over [HTTPCookie]
// and URL — those carry all the bug-prone logic.

@Suite("EBTLinkWebView cookie capture")
struct EBTLinkWebViewTests {

    // MARK: - Post-login URL detection

    @Test("Post-login URL: /cardholder path on ebt.ca.gov matches")
    func cardholderPathMatches() {
        let url = URL(string: "https://www.ebt.ca.gov/cardholder/dashboard")!
        #expect(EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    @Test("Post-login URL: /dashboard path on ebt.ca.gov matches")
    func dashboardPathMatches() {
        let url = URL(string: "https://www.ebt.ca.gov/dashboard")!
        #expect(EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    @Test("Post-login URL: /account path on ebt.ca.gov matches")
    func accountPathMatches() {
        let url = URL(string: "https://www.ebt.ca.gov/account/balance")!
        #expect(EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    @Test("Pre-login URL: home page does not match")
    func homeDoesNotMatch() {
        let url = URL(string: "https://www.ebt.ca.gov/")!
        #expect(!EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    @Test("Pre-login URL: login form does not match")
    func loginDoesNotMatch() {
        let url = URL(string: "https://www.ebt.ca.gov/login")!
        #expect(!EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    @Test("Non-portal URL is rejected even if path looks right")
    func nonPortalRejected() {
        let url = URL(string: "https://malicious.example.com/cardholder/dashboard")!
        #expect(!EBTLinkCookieExtractor.isPostLoginURL(url))
    }

    // MARK: - Cookie extraction

    @Test("Capture: JSESSIONID present → extracted")
    func extractsJSessionId() throws {
        let session = try makeCookie(name: "JSESSIONID", value: "abc-123-xyz", expires: nil)
        let capture = EBTLinkCookieExtractor.capture(from: [session])
        #expect(capture?.cookie == "JSESSIONID=abc-123-xyz")
        #expect(capture?.rememberCookie == nil)
    }

    @Test("Capture: ASP.NET fallback session cookie also matches")
    func extractsASPNetSession() throws {
        let session = try makeCookie(name: "ASP.NET_SessionId", value: "deadbeef", expires: nil)
        let capture = EBTLinkCookieExtractor.capture(from: [session])
        #expect(capture?.cookie == "ASP.NET_SessionId=deadbeef")
    }

    @Test("Capture: remember-me cookie included when present")
    func extractsRememberMe() throws {
        let session = try makeCookie(name: "JSESSIONID", value: "s1", expires: nil)
        let remember = try makeCookie(name: "ebt_remember", value: "r1",
                                      expires: Date().addingTimeInterval(86400 * 30))
        let capture = EBTLinkCookieExtractor.capture(from: [session, remember])
        #expect(capture?.cookie == "JSESSIONID=s1")
        #expect(capture?.rememberCookie == "ebt_remember=r1")
    }

    @Test("Capture: no session cookie → nil")
    func noSessionReturnsNil() throws {
        // Only the remember cookie present — without a session
        // cookie, the recipient isn't actually logged in yet.
        let remember = try makeCookie(name: "ebt_remember", value: "r1", expires: nil)
        let capture = EBTLinkCookieExtractor.capture(from: [remember])
        #expect(capture == nil)
    }

    @Test("Capture: empty session value → nil")
    func emptySessionValueReturnsNil() throws {
        let session = try makeCookie(name: "JSESSIONID", value: "", expires: nil)
        let capture = EBTLinkCookieExtractor.capture(from: [session])
        #expect(capture == nil)
    }

    @Test("Capture: session cookie expiry used when present")
    func usesSessionExpiry() throws {
        let exact = Date(timeIntervalSince1970: 1_900_000_000)
        let session = try makeCookie(name: "JSESSIONID", value: "abc", expires: exact)
        let capture = EBTLinkCookieExtractor.capture(from: [session])
        #expect(capture?.expiresAt == exact)
    }

    @Test("Capture: falls back to remember cookie expiry when session has none")
    func fallsBackToRememberExpiry() throws {
        let rememberExpiry = Date(timeIntervalSince1970: 2_000_000_000)
        let session = try makeCookie(name: "JSESSIONID", value: "abc", expires: nil)
        let remember = try makeCookie(name: "ebt_remember", value: "xyz", expires: rememberExpiry)
        let now = Date(timeIntervalSince1970: 1_950_000_000)
        let capture = EBTLinkCookieExtractor.capture(from: [session, remember], now: now)
        #expect(capture?.expiresAt == rememberExpiry)
    }

    @Test("Capture: defaults to 30-min expiry when no cookie expires set")
    func defaults30MinExpiry() throws {
        let now = Date(timeIntervalSince1970: 1_900_000_000)
        let session = try makeCookie(name: "JSESSIONID", value: "abc", expires: nil)
        let capture = EBTLinkCookieExtractor.capture(from: [session], now: now)
        let delta = capture?.expiresAt.timeIntervalSince(now) ?? 0
        #expect(delta == 30 * 60)
    }

    // MARK: - Helpers

    private func makeCookie(
        name: String,
        value: String,
        expires: Date?,
        domain: String = ".ebt.ca.gov"
    ) throws -> HTTPCookie {
        var props: [HTTPCookiePropertyKey: Any] = [
            .name: name,
            .value: value,
            .domain: domain,
            .path: "/",
        ]
        if let expires {
            props[.expires] = expires
        }
        guard let cookie = HTTPCookie(properties: props) else {
            throw NSError(domain: "EBTLinkWebViewTests", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Could not build HTTPCookie"])
        }
        return cookie
    }
}
