import Foundation

// Typed errors emitted by the EBT scraper + gateway, decoded by the
// iOS API client. Each variant maps to recipient-readable banner copy
// (via EBTBalanceStrings) and a single CTA action that tells the
// recipient the one next thing to do.
//
// Wire format per plan §16.2 (Stripe-style):
//
//   {
//     "error": {
//       "type": "ebt_scrape_error",
//       "code": "sessionExpired",
//       "message": "Your EBT card link has expired. Please re-link to continue.",
//       "cta": { "kind": "re_link", "target": "civica://ebt/link" },
//       "doc_url": "https://help.civica.app/ebt/re-link"
//     },
//     "request_id": "req_abc123"
//   }
//
// Adding a new variant is a three-point change documented in §16.2:
//   1. Add the code to the gateway emitter
//   2. Add the case here + map it in `Code`
//   3. Add EN+ES banner copy + CTA copy in EBTBalanceStrings.

// MARK: - Error

enum EBTScrapeError: Error, Equatable, Sendable {
    case networkTimeout
    case portalDown
    case sessionExpired
    case captcha
    case pinLocked
    case cardClosed
    case parseError
    /// CA card-lock route returns 501 with this code (per plan §4.1
    /// `EBTCardLockView.swift` "degrades gracefully" requirement). Not
    /// a scraper outage — a feature-not-available state.
    case cardLockUnsupported

    /// Server's wire code → enum. The encoder/emitter side lives in
    /// `apps/enrollment-api/src/routes/ebt/` (Lane A); this side
    /// decodes whatever it sends.
    enum Code: String, Codable, Sendable {
        case networkTimeout
        case portalDown
        case sessionExpired
        case captcha
        case pinLocked
        case cardClosed
        case parseError
        case cardLockUnsupported

        var error: EBTScrapeError {
            switch self {
            case .networkTimeout:     return .networkTimeout
            case .portalDown:         return .portalDown
            case .sessionExpired:     return .sessionExpired
            case .captcha:            return .captcha
            case .pinLocked:          return .pinLocked
            case .cardClosed:         return .cardClosed
            case .parseError:         return .parseError
            case .cardLockUnsupported: return .cardLockUnsupported
            }
        }
    }

    /// Banner copy shown on the dashboard when the error surfaces.
    /// Resolves through the active language at the view layer.
    var banner: CivicaText {
        switch self {
        case .networkTimeout:      return EBTBalanceStrings.networkTimeoutBanner
        case .portalDown:          return EBTBalanceStrings.portalDownBanner
        case .sessionExpired:      return EBTBalanceStrings.sessionExpiredBanner
        case .captcha:             return EBTBalanceStrings.captchaBanner
        case .pinLocked:           return EBTBalanceStrings.pinLockedBanner
        case .cardClosed:          return EBTBalanceStrings.cardClosedBanner
        case .parseError:          return EBTBalanceStrings.parseErrorBanner
        case .cardLockUnsupported: return EBTBalanceStrings.cardLockUnsupportedBanner
        }
    }

    /// CTA the banner exposes. nil when the surface should be
    /// informational only (no current variant returns nil — the field
    /// is nullable to keep room for future "passive" errors).
    var cta: EBTScrapeErrorCTA? {
        switch self {
        case .networkTimeout:
            return .tryAgain(label: EBTBalanceStrings.networkTimeoutCTA)
        case .portalDown:
            return .tryAgain(label: EBTBalanceStrings.portalDownCTA)
        case .sessionExpired:
            return .reLink(label: EBTBalanceStrings.sessionExpiredCTA)
        case .captcha:
            return .reLink(label: EBTBalanceStrings.captchaCTA)
        case .pinLocked:
            // CA EBT customer service number, per
            // EBTAccountServicesDirectory.
            return .callPhone(
                label: EBTBalanceStrings.pinLockedCTA,
                number: "18773289677"
            )
        case .cardClosed:
            return .openURL(
                label: EBTBalanceStrings.cardClosedCTA,
                url: URL(string: "https://www.cdss.ca.gov/inforesources/county-offices")!
            )
        case .parseError:
            return .tryAgain(label: EBTBalanceStrings.parseErrorCTA)
        case .cardLockUnsupported:
            return .openURL(
                label: EBTBalanceStrings.cardLockUnsupportedCTA,
                url: URL(string: "https://help.civica.app/ebt/card-lock-availability")!
            )
        }
    }

    /// Optional help-doc URL surfaced as the banner's secondary action.
    /// nil for variants the recipient can resolve in-app without a
    /// doc.
    var docURL: URL? {
        switch self {
        case .networkTimeout, .portalDown, .parseError:
            return nil
        case .sessionExpired:
            return URL(string: "https://help.civica.app/ebt/re-link")
        case .captcha:
            return URL(string: "https://help.civica.app/ebt/captcha")
        case .pinLocked:
            return URL(string: "https://help.civica.app/ebt/pin-locked")
        case .cardClosed:
            return URL(string: "https://help.civica.app/ebt/card-closed")
        case .cardLockUnsupported:
            return URL(string: "https://help.civica.app/ebt/card-lock-availability")
        }
    }

    /// Whether the next user action is "try again locally" (vs needing
    /// to leave the app for a call/URL). Drives the dashboard's
    /// pull-to-refresh affordance.
    var isRetryable: Bool {
        switch self {
        case .networkTimeout, .portalDown, .parseError:
            return true
        case .sessionExpired, .captcha, .pinLocked, .cardClosed, .cardLockUnsupported:
            return false
        }
    }
}

// MARK: - CTA

enum EBTScrapeErrorCTA: Equatable, Sendable {
    /// "Re-link card" — opens EBTLinkWebView.
    case reLink(label: CivicaText)
    /// "Call <number>" — dials a tel: URL.
    case callPhone(label: CivicaText, number: String)
    /// Opens a Safari URL (BenefitsCal, county office finder, help doc).
    case openURL(label: CivicaText, url: URL)
    /// In-app retry of the failed operation (e.g. fetchBalance).
    case tryAgain(label: CivicaText)

    var label: CivicaText {
        switch self {
        case .reLink(let l), .callPhone(let l, _), .openURL(let l, _), .tryAgain(let l):
            return l
        }
    }
}

// MARK: - Decodable (plan §16.2 wire format)

extension EBTScrapeError: Decodable {
    private enum EnvelopeKeys: String, CodingKey {
        case error
    }
    private enum ErrorKeys: String, CodingKey {
        case type
        case code
        case message
        case cta
        case docURL = "doc_url"
    }

    init(from decoder: any Decoder) throws {
        // Accept both bare error objects and the envelope { "error": {...} }.
        // The gateway always wraps; tests sometimes pass the bare form.
        // We try the envelope container first; if `error` isn't present
        // we fall back to decoding ErrorKeys at the top level.
        if let envelope = try? decoder.container(keyedBy: EnvelopeKeys.self),
           envelope.contains(.error),
           let inner = try? envelope.nestedContainer(keyedBy: ErrorKeys.self, forKey: .error),
           let code = try? inner.decode(Code.self, forKey: .code) {
            self = code.error
            return
        }
        let bare = try decoder.container(keyedBy: ErrorKeys.self)
        let code = try bare.decode(Code.self, forKey: .code)
        self = code.error
    }
}
