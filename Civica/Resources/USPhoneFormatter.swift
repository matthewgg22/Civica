import Foundation

// Format-as-you-type US phone number helper. Strips non-digits,
// caps at 10 digits, and renders progressively:
//
//   ""           → ""
//   "5"          → "(5"
//   "555"        → "(555)"
//   "5551"       → "(555) 1"
//   "5551234"    → "(555) 123-4"
//   "5551234567" → "(555) 123-4567"
//
// Designed for use as a SwiftUI Binding<String> transformer. The
// backing store can hold the raw digits or the formatted form —
// callers that need to send the value over the wire should call
// .digits to strip back to a clean E.164-style 10-digit string.

enum USPhoneFormatter {

    /// Maximum number of digits the formatter retains. Anything past
    /// the tenth digit is dropped — there is no international support
    /// in this helper, intentionally. Civica is MA-first.
    static let maxDigits = 10

    /// Format the user's raw input string. Strips everything that
    /// isn't a digit, then groups by the standard US pattern.
    static func format(_ raw: String) -> String {
        let digits = String(raw.filter(\.isNumber).prefix(maxDigits))
        switch digits.count {
        case 0:
            return ""
        case 1...3:
            return "(\(digits)"
        case 4...6:
            let area = digits.prefix(3)
            let middle = digits.dropFirst(3)
            return "(\(area)) \(middle)"
        default:  // 7-10
            let area = digits.prefix(3)
            let middle = digits.dropFirst(3).prefix(3)
            let last = digits.dropFirst(6)
            return "(\(area)) \(middle)-\(last)"
        }
    }

    /// Strip formatting back to the bare digit string for sending
    /// over the wire or matching against E.164.
    static func digits(_ formatted: String) -> String {
        formatted.filter(\.isNumber)
    }

    /// True when the digit count matches a complete US phone number.
    /// Use to gate "Continue" CTAs after the user has typed a phone.
    static func isComplete(_ raw: String) -> Bool {
        digits(raw).count == maxDigits
    }
}
