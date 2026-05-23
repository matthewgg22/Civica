import Foundation
import SwiftUI
import WebKit

// In-app WKWebView at ebt.ca.gov for the cookie-handoff link flow
// (per plan D4 / §4.3). The recipient enters card+PIN inside the
// state portal's own page — Civica never reads the form. On
// successful login, the WebView captures the session cookie + (if
// present) the "remember me" cookie and hands them off to the
// gateway via the EBTBalanceAPIClient.
//
// IMPORTANT (D4): the PIN is never captured, never persisted on
// Civica infrastructure. We only ever read cookies from
// WKHTTPCookieStore — never form fields, never JavaScript over
// document.forms.
//
// Login detection: post-login the portal navigates to a path
// containing "/cardholder" (PoC will refine the exact URL). When the
// nav delegate sees that and the cookie jar has a session cookie,
// we extract + forward.

// MARK: - Cookie capture

/// Output of a successful cookie capture. The view's completion
/// handler receives this; the repository's link() persists it.
struct EBTLinkCapture: Equatable, Sendable {
    let cookie: String
    let rememberCookie: String?
    let expiresAt: Date
}

/// Names of cookies the CA EBT portal sets on a successful login.
/// Lane B Phase-1 PoC will confirm — these are the conventional
/// J2EE app-server names. We accept any of them as the "session"
/// cookie because the portal may rebrand without notice.
enum EBTLinkCookieNames {
    static let sessionCandidates: [String] = [
        "JSESSIONID",      // Java app servers (Tomcat, Weblogic)
        "ASP.NET_SessionId", // ASP.NET fallback (some state portals migrated)
        "PHPSESSID",
    ]
    static let rememberCandidates: [String] = [
        "ebt_remember",
        "REMEMBERME",
        "remember_token",
    ]
}

/// Pure-fn cookie extractor — given a snapshot of cookies + the
/// current URL, return a capture if both a session cookie exists and
/// the URL matches the post-login pattern. Pulled out so tests can
/// drive it without mocking WKWebView.
enum EBTLinkCookieExtractor {
    /// True when the URL looks like a successful post-login landing
    /// page on the CA EBT portal.
    static func isPostLoginURL(_ url: URL) -> Bool {
        guard let host = url.host, host.contains("ebt.ca.gov") else { return false }
        let path = url.path.lowercased()
        return path.contains("/cardholder")
            || path.contains("/dashboard")
            || path.contains("/account")
    }

    /// Extract the highest-priority session cookie + a remember
    /// cookie from a flat list. Returns nil if no session cookie
    /// matches the candidate list. `now` is injectable for tests.
    static func capture(
        from cookies: [HTTPCookie],
        now: Date = Date()
    ) -> EBTLinkCapture? {
        let session = cookies.first(where: { EBTLinkCookieNames.sessionCandidates.contains($0.name) })
        guard let session, !session.value.isEmpty else { return nil }

        let remember = cookies.first(where: { EBTLinkCookieNames.rememberCandidates.contains($0.name) })

        // Use the session cookie's expiry when set; the portal
        // typically issues short-lived (~20–30min) session cookies.
        // Lane B PoC will measure the real number. Default to 30
        // minutes from `now` so the gateway can plan its first
        // re-link push.
        let expiry: Date
        if let cookieExpiry = session.expiresDate {
            expiry = cookieExpiry
        } else if let rememberExpiry = remember?.expiresDate, rememberExpiry > now {
            expiry = rememberExpiry
        } else {
            expiry = now.addingTimeInterval(30 * 60)
        }

        return EBTLinkCapture(
            cookie: "\(session.name)=\(session.value)",
            rememberCookie: remember.map { "\($0.name)=\($0.value)" },
            expiresAt: expiry
        )
    }
}

// MARK: - SwiftUI WebView

/// UIViewControllerRepresentable wrapping a WKWebView pointed at
/// ebt.ca.gov. The hosting view should embed this inside a
/// NavigationStack and present a cancel button.
struct EBTLinkWebView: UIViewControllerRepresentable {
    /// Called once on successful capture. The hosting view tears
    /// down the WebView and forwards to EBTBalanceStore.linkWithCookie.
    let onCapture: (EBTLinkCapture) -> Void

    /// URL the WebView starts at. Default = California EBT portal.
    var startURL: URL = URL(string: "https://www.ebt.ca.gov/")!

    func makeUIViewController(context: Context) -> EBTLinkWebViewController {
        let vc = EBTLinkWebViewController(startURL: startURL)
        vc.onCapture = onCapture
        return vc
    }

    func updateUIViewController(_ uiViewController: EBTLinkWebViewController, context: Context) {
        // No-op; the controller manages its own lifecycle.
    }
}

// MARK: - UIKit controller

/// Owns the WKWebView + nav delegate. Split out so the SwiftUI
/// wrapper stays a thin Representable.
final class EBTLinkWebViewController: UIViewController, WKNavigationDelegate {
    private let startURL: URL
    private(set) lazy var webView: WKWebView = {
        let config = WKWebViewConfiguration()
        // Non-persistent data store — cookies live only for this
        // session, never persist to disk. Once we've captured the
        // cookie + handed it to the gateway, this jar is torn down.
        config.websiteDataStore = .nonPersistent()
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        wv.translatesAutoresizingMaskIntoConstraints = false
        return wv
    }()

    var onCapture: ((EBTLinkCapture) -> Void)?
    private var hasCaptured = false

    init(startURL: URL) {
        self.startURL = startURL
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("Use init(startURL:)")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])
        webView.load(URLRequest(url: startURL))
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        attemptCapture()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // Allow everything — the portal's flow includes redirects
        // through SAML / auth subdomains. We only inspect cookies
        // after the page finishes loading.
        decisionHandler(.allow)
    }

    private func attemptCapture() {
        guard !hasCaptured else { return }
        guard let url = webView.url, EBTLinkCookieExtractor.isPostLoginURL(url) else { return }

        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
            guard let self else { return }
            // Filter to ebt.ca.gov cookies — don't ship third-party
            // analytics/CDN cookies upstream.
            let portalCookies = cookies.filter {
                $0.domain.contains("ebt.ca.gov") || $0.domain.contains(".ca.gov")
            }
            guard let capture = EBTLinkCookieExtractor.capture(from: portalCookies) else { return }
            self.hasCaptured = true
            self.onCapture?(capture)
        }
    }
}
