import Foundation

// JSON fixtures for EBTScrapeError decoding tests. Mirrors the plan
// §16.2 wire format. Kept inline (not loaded from disk) so the test
// suite stays self-contained — the EBT __fixtures__ folder is wired
// into the Civica target, not as a resource bundle.

enum EBTScrapeErrorFixtures {
    /// Build a wire envelope for a given code. Mirrors what the
    /// gateway returns. Tests assert each variant decodes to the
    /// right enum case.
    static func envelopeJSON(
        code: String,
        message: String = "An error occurred.",
        ctaKind: String = "tryAgain",
        ctaTarget: String = "civica://ebt/retry",
        docURL: String? = "https://help.civica.app/ebt/error"
    ) -> Data {
        let docPart = docURL.map { ", \"doc_url\": \"\($0)\"" } ?? ""
        let json = """
        {
            "error": {
                "type": "ebt_scrape_error",
                "code": "\(code)",
                "message": "\(message)",
                "cta": { "kind": "\(ctaKind)", "target": "\(ctaTarget)" }\(docPart)
            },
            "request_id": "req_test_\(code)"
        }
        """
        return json.data(using: .utf8)!
    }

    /// Bare error object (no envelope) — supported by the decoder for
    /// older test harnesses + the Fly scraper's direct emission path.
    static func bareJSON(code: String) -> Data {
        let json = """
        {
            "type": "ebt_scrape_error",
            "code": "\(code)",
            "message": "Bare form."
        }
        """
        return json.data(using: .utf8)!
    }
}
