import Foundation

// Redacts common PII patterns from a voice transcript before it is
// passed to the distress-detection session. The distress model only
// needs emotional and crisis language — it never needs financial
// identifiers — so we strip them at the boundary.
//
// Scrubs: SSNs, 9+ consecutive digit sequences (routing numbers,
// unformatted SSNs), 16-digit card numbers, and NANP phone numbers.
// All matches are replaced with "[REDACTED]".
//
// This scrubbing is intentionally conservative (may redact some
// innocent long numbers). That trade-off is correct for the distress
// pass, where false positives cost nothing and PII leakage costs a lot.
enum SNAPVoicePIIScrubber {

    static func scrubForDistress(_ text: String) -> String {
        var result = text
        for pattern in patterns {
            result = pattern.stringByReplacingMatches(
                in: result,
                range: NSRange(result.startIndex..., in: result),
                withTemplate: "[REDACTED]"
            )
        }
        return result
    }

    // Patterns ordered from most-specific to least-specific so a
    // formatted SSN (###-##-####) is caught before the 9-digit fallback.
    private static let patterns: [NSRegularExpression] = [
        // Formatted SSN: 123-45-6789 or 123 45 6789
        try! NSRegularExpression(pattern: #"\b\d{3}[-\s]\d{2}[-\s]\d{4}\b"#),
        // 16-digit card numbers with optional spaces/dashes
        try! NSRegularExpression(pattern: #"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b"#),
        // NANP phone: (###) ###-#### or ###-###-#### or ##########
        try! NSRegularExpression(pattern: #"(?:\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}"#),
        // 9+ consecutive digits (unformatted SSN, routing/account numbers)
        try! NSRegularExpression(pattern: #"\b\d{9,}\b"#),
    ]
}
