import SafariServices
import SwiftUI

// Thin SFSafariViewController wrap so Civica can land users on
// official state portals (DTA Connect, fair-hearing requests,
// USDA documentation) without leaving the app. The system Safari
// view is preferred over a regular .openURL launch for benefit
// flows: it carries the user's existing iCloud Safari session for
// any pages that recognize them, supports Reader Mode, and keeps
// the user one tap away from Civica context when they're done.
//
// Civica intentionally does NOT preserve credentials, autofill
// state, or share its own session with the destination — this is
// a read-only window onto the state agency's site.
//
// Usage:
//
//   @State private var dtaConnectURL: URL?
//
//   .sheet(item: $dtaConnectURL) { url in
//       CivicaSafariSheet(url: url)
//   }
//
//   ...
//   Button("Open DTA Connect") {
//       dtaConnectURL = CivicaExternalLinks.dtaConnect
//   }

struct CivicaSafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        config.barCollapsingEnabled = true
        let controller = SFSafariViewController(url: url, configuration: config)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        // No-op. The SFSafariViewController is configured once at
        // creation time; URL changes require remounting via the
        // .sheet(item:) modifier.
    }
}

/// Stable identifier for external links Civica deep-links into. Keeps
/// URLs out of view code so the same DTA Connect link can be reached
/// from the recert / waiting-room / walkthrough surfaces and updated
/// in one place if the state agency moves things.
enum CivicaExternalLinks {

    /// Massachusetts DTA Connect — the state's official SNAP /
    /// CalFresh portal for submitting applications, uploading
    /// requested documents, and managing existing cases.
    static let dtaConnect: URL = URL(string: "https://dtaconnect.eohhs.mass.gov/")!

    /// MA DTA fair-hearing request page — where a denied applicant
    /// can request a hearing within 90 days of the decision notice.
    /// Used by the appeal CTA on the denial surface.
    static let dtaFairHearing: URL = URL(
        string: "https://www.mass.gov/info-details/how-to-request-a-fair-hearing"
    )!
}

// MARK: - URL identity for .sheet(item:)

// SwiftUI's .sheet(item:) requires Identifiable. URL isn't Identifiable
// by default, so we add a small wrapper that lets `@State var url: URL?`
// drive a sheet presentation.

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
