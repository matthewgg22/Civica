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
/// URLs out of view code so the same apply-portal link can be reached
/// from the recert / waiting-room / walkthrough surfaces and updated
/// in one place if the state agency moves things.
///
/// State-keyed lookups route through `applyPortal(for:)` etc.; the
/// legacy MA-only constants are retained for surfaces that haven't
/// yet been threaded with a state code and still default to MA.
enum CivicaExternalLinks {

    /// California BenefitsCal — CalFresh's statewide apply portal.
    static let benefitsCal: URL = URL(string: "https://benefitscal.com/")!

    /// CDSS State Hearings Division request page — where a denied
    /// CalFresh applicant can request a state hearing within 90 days.
    static let cdssFairHearing: URL = URL(
        string: "https://www.cdss.ca.gov/inforesources/state-hearings/request-a-state-hearing"
    )!

    /// California WIC info page. Used by the cross-program teaser
    /// when the household has minors.
    static let caWICInfo: URL = URL(
        string: "https://www.cdph.ca.gov/Programs/CFH/DWICSN/Pages/Program-Landing1.aspx"
    )!

    /// Massachusetts DTA Connect — MA's official SNAP portal.
    static let dtaConnect: URL = URL(string: "https://dtaconnect.eohhs.mass.gov/")!

    /// MA DTA fair-hearing request page.
    static let dtaFairHearing: URL = URL(
        string: "https://www.mass.gov/info-details/how-to-request-a-fair-hearing"
    )!

    /// Massachusetts WIC Nutrition Program info page.
    static let maWICInfo: URL = URL(
        string: "https://www.mass.gov/wic-nutrition-program"
    )!

    /// State-keyed apply-portal lookup. Falls back to the launch
    /// state's portal when the state code is unknown.
    static func applyPortal(for stateCode: String?) -> URL {
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA": return benefitsCal
        case "MA": return dtaConnect
        default:   return benefitsCal
        }
    }

    /// State-keyed fair-hearing-request page lookup. Falls back to
    /// the launch state's portal.
    static func fairHearingPage(for stateCode: String?) -> URL {
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA": return cdssFairHearing
        case "MA": return dtaFairHearing
        default:   return cdssFairHearing
        }
    }

    /// State-keyed WIC info page lookup.
    static func wicInfoPage(for stateCode: String?) -> URL {
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA": return caWICInfo
        case "MA": return maWICInfo
        default:   return caWICInfo
        }
    }
}

// MARK: - URL identity for .sheet(item:)

// SwiftUI's .sheet(item:) requires Identifiable. URL isn't Identifiable
// by default, so we add a small wrapper that lets `@State var url: URL?`
// drive a sheet presentation.

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
