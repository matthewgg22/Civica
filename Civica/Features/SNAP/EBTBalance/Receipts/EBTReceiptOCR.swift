import Foundation

// Pure-function on-device OCR result parser for EBT receipts.
//
// Input: an array of strings as produced by VNRecognizeTextRequest
//        (one string per recognized text block / line).
// Output: EBTReceiptOCRResult with merchant, total, and confidence.
//
// Rules per plan Lane F:
//  Merchant — first non-empty line that is ≥ 3 chars and not all-digits.
//  Total    — scan all lines for $?d+.dd patterns; pick the LARGEST value;
//             express as integer cents.
//  Confidence:
//    1.0 — both merchant and total found
//    0.6 — exactly one of the two found
//    0.0 — neither found
//
// No imports beyond Foundation; no Vision types (Vision integration is in
// EBTReceiptCaptureView which calls this after text recognition).

// MARK: - Result type

struct EBTReceiptOCRResult: Sendable {
    /// First non-empty non-numeric line at the top of the receipt.
    let merchant: String?
    /// Largest currency value found in the receipt text, expressed in cents.
    let totalCents: Int?
    /// 0.0–1.0; values < 0.7 trigger the manual-confirm sheet.
    let confidence: Double
}

// MARK: - Parser

enum EBTReceiptOCR {
    /// Currency pattern: optional leading "$", digits, period, exactly two digits.
    private static let currencyPattern = try! NSRegularExpression(
        pattern: #"\$?(\d+)\.(\d{2})"#,
        options: []
    )

    /// Parse OCR text lines into a structured result.
    static func parse(lines: [String]) -> EBTReceiptOCRResult {
        let merchant = findMerchant(in: lines)
        let totalCents = findLargestCurrency(in: lines)
        let confidence: Double
        switch (merchant != nil, totalCents != nil) {
        case (true, true):   confidence = 1.0
        case (false, false): confidence = 0.0
        default:             confidence = 0.6
        }
        return EBTReceiptOCRResult(merchant: merchant, totalCents: totalCents, confidence: confidence)
    }

    // MARK: - Private helpers

    /// Returns the first non-empty line that:
    ///  - has at least 3 characters
    ///  - is not composed entirely of digits (i.e. not a phone / card number)
    private static func findMerchant(in lines: [String]) -> String? {
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.count >= 3 else { continue }
            let isAllDigits = trimmed.unicodeScalars.allSatisfy { CharacterSet.decimalDigits.contains($0) }
            if !isAllDigits { return trimmed }
        }
        return nil
    }

    /// Returns the largest dollar value found anywhere in the lines, in cents.
    private static func findLargestCurrency(in lines: [String]) -> Int? {
        var largest: Int? = nil
        for line in lines {
            let nsLine = line as NSString
            let range = NSRange(location: 0, length: nsLine.length)
            let matches = currencyPattern.matches(in: line, options: [], range: range)
            for match in matches {
                guard match.numberOfRanges == 3 else { continue }
                let dollarRange = Range(match.range(at: 1), in: line)
                let centRange  = Range(match.range(at: 2), in: line)
                guard let dr = dollarRange, let cr = centRange,
                      let dollars = Int(line[dr]),
                      let cents = Int(line[cr]) else { continue }
                let total = dollars * 100 + cents
                if largest == nil || total > largest! {
                    largest = total
                }
            }
        }
        return largest
    }
}
