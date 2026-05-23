import Foundation
import Testing
@testable import Civica

// Covers T8: every EBTScrapeError variant decodes from the §16.2 wire
// format, every variant has banner + CTA + (where defined) docURL
// metadata, and isRetryable matches the spec.

@Suite("EBTScrapeError")
struct EBTScrapeErrorTests {
    private let decoder = JSONDecoder()

    // MARK: - Decoding from §16.2 wire format

    @Test("networkTimeout decodes from envelope")
    func decodesNetworkTimeout() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "networkTimeout")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .networkTimeout)
    }

    @Test("portalDown decodes from envelope")
    func decodesPortalDown() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "portalDown")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .portalDown)
    }

    @Test("sessionExpired decodes from envelope")
    func decodesSessionExpired() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "sessionExpired")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .sessionExpired)
    }

    @Test("captcha decodes from envelope")
    func decodesCaptcha() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "captcha")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .captcha)
    }

    @Test("pinLocked decodes from envelope")
    func decodesPinLocked() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "pinLocked")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .pinLocked)
    }

    @Test("cardClosed decodes from envelope")
    func decodesCardClosed() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "cardClosed")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .cardClosed)
    }

    @Test("parseError decodes from envelope")
    func decodesParseError() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "parseError")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .parseError)
    }

    @Test("cardLockUnsupported decodes from envelope (CA card-lock 501 case)")
    func decodesCardLockUnsupported() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "cardLockUnsupported")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .cardLockUnsupported)
    }

    @Test("unknown code throws decoding error (catches typos at runtime)")
    func unknownCodeFails() throws {
        let data = EBTScrapeErrorFixtures.envelopeJSON(code: "totallyMadeUpVariant")
        #expect(throws: (any Error).self) {
            try decoder.decode(EBTScrapeError.self, from: data)
        }
    }

    @Test("Bare (un-enveloped) JSON also decodes")
    func bareFormDecodes() throws {
        let data = EBTScrapeErrorFixtures.bareJSON(code: "sessionExpired")
        let err = try decoder.decode(EBTScrapeError.self, from: data)
        #expect(err == .sessionExpired)
    }

    // MARK: - Banner copy + CTA shape

    @Test("Every variant has non-empty banner copy in EN and ES")
    func everyVariantHasBanner() throws {
        let variants: [EBTScrapeError] = [
            .networkTimeout, .portalDown, .sessionExpired, .captcha,
            .pinLocked, .cardClosed, .parseError, .cardLockUnsupported,
        ]
        for v in variants {
            #expect(!v.banner.en.isEmpty, "EN banner missing for \(v)")
            #expect(!v.banner.es.isEmpty, "ES banner missing for \(v)")
        }
    }

    @Test("Every variant has a CTA")
    func everyVariantHasCTA() throws {
        let variants: [EBTScrapeError] = [
            .networkTimeout, .portalDown, .sessionExpired, .captcha,
            .pinLocked, .cardClosed, .parseError, .cardLockUnsupported,
        ]
        for v in variants {
            #expect(v.cta != nil, "CTA missing for \(v)")
        }
    }

    @Test("sessionExpired + captcha CTAs are re-link")
    func reLinkVariantsCTA() throws {
        for v in [EBTScrapeError.sessionExpired, .captcha] {
            guard case .reLink = v.cta else {
                Issue.record("Expected .reLink for \(v), got \(String(describing: v.cta))")
                continue
            }
        }
    }

    @Test("pinLocked CTA dials the CA EBT customer service number")
    func pinLockedCallsCorrectNumber() throws {
        guard case .callPhone(_, let number) = EBTScrapeError.pinLocked.cta else {
            Issue.record("Expected .callPhone CTA for pinLocked")
            return
        }
        #expect(number == "18773289677")
    }

    @Test("cardClosed CTA opens the CDSS county-office finder")
    func cardClosedOpensCountyFinder() throws {
        guard case .openURL(_, let url) = EBTScrapeError.cardClosed.cta else {
            Issue.record("Expected .openURL CTA for cardClosed")
            return
        }
        #expect(url.absoluteString == "https://www.cdss.ca.gov/inforesources/county-offices")
    }

    @Test("Retryable variants are exactly networkTimeout, portalDown, parseError")
    func retryableVariants() throws {
        #expect(EBTScrapeError.networkTimeout.isRetryable)
        #expect(EBTScrapeError.portalDown.isRetryable)
        #expect(EBTScrapeError.parseError.isRetryable)
        #expect(!EBTScrapeError.sessionExpired.isRetryable)
        #expect(!EBTScrapeError.captcha.isRetryable)
        #expect(!EBTScrapeError.pinLocked.isRetryable)
        #expect(!EBTScrapeError.cardClosed.isRetryable)
        #expect(!EBTScrapeError.cardLockUnsupported.isRetryable)
    }

    @Test("docURL is nil for in-app retryables, set for external-action variants")
    func docURLCoverage() throws {
        #expect(EBTScrapeError.networkTimeout.docURL == nil)
        #expect(EBTScrapeError.portalDown.docURL == nil)
        #expect(EBTScrapeError.parseError.docURL == nil)
        #expect(EBTScrapeError.sessionExpired.docURL != nil)
        #expect(EBTScrapeError.captcha.docURL != nil)
        #expect(EBTScrapeError.pinLocked.docURL != nil)
        #expect(EBTScrapeError.cardClosed.docURL != nil)
        #expect(EBTScrapeError.cardLockUnsupported.docURL != nil)
    }
}
