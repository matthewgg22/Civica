import CivicaDesignSystem
import SwiftUI

// Cents-first currency input — Venmo / BofA / Cash App pattern.
//
// The user just types digits. The display fills from the right:
//   "5"     → 0.05
//   "55"    → 0.55
//   "555"   → 5.55
//   "5555"  → 55.55
//   "12345" → 123.45
//   "123456" → 1,234.56
//   "1234567" → 12,345.67
//
// No decimal key, no comma key, no leading-zero ambiguity. The view
// binds out a plain-decimal String ("55.55") so existing callers that
// expect a "1400.50"-style String binding keep working unchanged.
// Initial sync goes the other way: if the parent passes "1400" or
// "1400.50", we extract digits and present the formatted equivalent.
//
// Replaces ad-hoc TextField + "$" prefix patterns in:
//   • CivicaQuestionScreen.CivicaQuestionNumberInput (dollars kind)
//   • SNAPIncomeFlow (gross income, liquid resources)
//   • SNAPExpensesFlow (rent / utilities / childcare / medical)
//
// Other surfaces (EBT receipts, work-session sheet, marketplace
// self-attestation, conversation income capture) can adopt later by
// dropping in the same component.

struct CivicaCurrencyField: View {
    /// Bound text — plain decimal string like "55.55" or "1400.50",
    /// no `$`, no commas. Empty string means "no amount entered yet."
    @Binding var text: String
    let placeholder: String
    /// Lets callers preserve their existing visual treatment
    /// (currencyHero / cardTitle / subhead, etc.).
    var font: Font = CivicaTypography.cardTitle.monospacedDigit()
    var foregroundColor: Color = CivicaColors.ink

    /// User-visible formatted text (e.g. "1,400.50"). The TextField
    /// binds to this; we keep it in sync with `text` in both
    /// directions, guarded so external updates and internal
    /// reformatting don't loop.
    @State private var displayText: String = ""
    @State private var syncedInitial: Bool = false

    /// 9 digits = up to $9,999,999.99. Plenty of headroom for SNAP
    /// income / expenses without surfacing a 10-digit edge case in
    /// the formatter.
    private static let maxDigits: Int = 9

    var body: some View {
        TextField(placeholder, text: $displayText)
            .font(font)
            .foregroundStyle(foregroundColor)
            // numberPad (no decimal key) keeps the cents-first
            // metaphor unambiguous — the user can't fight the
            // formatter by typing a literal "." mid-stream.
            .keyboardType(.numberPad)
            .onChange(of: displayText) { _, new in
                handleDisplayChange(new)
            }
            .onChange(of: text) { _, new in
                handleExternalChange(new)
            }
            .onAppear {
                guard !syncedInitial else { return }
                syncedInitial = true
                let digits = digitsFromBoundString(text)
                displayText = formatForDisplay(digits: digits)
            }
    }

    private func handleDisplayChange(_ new: String) {
        let digits = String(new.filter(\.isNumber).prefix(Self.maxDigits))
        let formatted = formatForDisplay(digits: digits)
        if formatted != new {
            displayText = formatted
        }
        let plain = plainDecimalString(digits: digits)
        if text != plain {
            text = plain
        }
    }

    /// External code rewrote `text` (e.g. a reset). Re-derive display.
    /// Guarded so we don't fight our own write loop.
    private func handleExternalChange(_ new: String) {
        let externalDigits = digitsFromBoundString(new)
        let currentDigits = String(displayText.filter(\.isNumber).prefix(Self.maxDigits))
        guard externalDigits != currentDigits else { return }
        displayText = formatForDisplay(digits: externalDigits)
    }

    // MARK: - Formatting

    /// Digits → "1,400.50" / "0.05" / "" (when digits is empty so the
    /// placeholder still shows).
    private func formatForDisplay(digits: String) -> String {
        guard !digits.isEmpty else { return "" }
        let padded = digits.count < 3
            ? String(repeating: "0", count: 3 - digits.count) + digits
            : digits
        let dollarsPart = String(padded.dropLast(2))
        let centsPart = String(padded.suffix(2))
        let dollarsInt = Int(dollarsPart) ?? 0
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        let dollarsFormatted = formatter.string(from: NSNumber(value: dollarsInt))
            ?? String(dollarsInt)
        return "\(dollarsFormatted).\(centsPart)"
    }

    /// Digits → "55.55" / "0.05" / "" — no commas, no $. Lands on the
    /// binding so downstream parsing (Decimal init, validators) keeps
    /// working as it did with the old free-typed input.
    private func plainDecimalString(digits: String) -> String {
        guard !digits.isEmpty else { return "" }
        let padded = digits.count < 3
            ? String(repeating: "0", count: 3 - digits.count) + digits
            : digits
        let dollarsPart = String(padded.dropLast(2))
        let centsPart = String(padded.suffix(2))
        let dollarsInt = Int(dollarsPart) ?? 0
        return "\(dollarsInt).\(centsPart)"
    }

    /// Inverse of `plainDecimalString`. Accepts whole numbers
    /// ("1400") and decimal forms ("1400.5", "1400.50"); strips $/
    /// commas/whitespace. Whole numbers append "00" cents so a
    /// caller passing "1400" lands on display "1,400.00".
    private func digitsFromBoundString(_ s: String) -> String {
        let trimmed = s
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
        guard !trimmed.isEmpty else { return "" }
        if !trimmed.contains(".") {
            let wholeDigits = trimmed.filter(\.isNumber)
            return String((wholeDigits + "00").prefix(Self.maxDigits))
        }
        let parts = trimmed.split(separator: ".", maxSplits: 1).map(String.init)
        let whole = parts[0].filter(\.isNumber)
        let frac = parts.count > 1 ? parts[1].filter(\.isNumber) : ""
        let fracPadded = String((frac + "00").prefix(2))
        return String((whole + fracPadded).prefix(Self.maxDigits))
    }
}

#if DEBUG
struct CivicaCurrencyField_Previews: PreviewProvider {
    struct PreviewHost: View {
        @State var value: String = ""
        var body: some View {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 8) {
                    Text("$").font(CivicaTypography.currencyHero)
                        .foregroundStyle(CivicaColors.graphite)
                    CivicaCurrencyField(
                        text: $value,
                        placeholder: "0.00",
                        font: CivicaTypography.currencyHero
                    )
                }
                .padding()
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                Text("Bound value: \(value.isEmpty ? "(empty)" : value)")
                    .font(.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding()
            .background(CivicaColors.paper)
        }
    }

    static var previews: some View {
        PreviewHost()
    }
}
#endif
