import SwiftUI

/// Renders a money amount per HANDOFF.md §1 "Money rule":
///   * Always tabular-nums.
///   * Always with denominator (`$291/mo`, `$1.99/meal`) when one applies.
///   * Whole-dollar amounts hide trailing zeros (`$291`, not `$291.00`); cents are shown for non-whole values.
///   * VoiceOver reads the amount in full ("two hundred ninety-one dollars per month").
///
/// Use this view anywhere the app surfaces money — never re-derive the formatting in screens.
public struct CivicaMoney: View {
    public let amount: Decimal
    public let denominator: String?
    public let font: Font

    /// - Parameters:
    ///   - amount: the dollar amount.
    ///   - denominator: optional unit shown after a slash (e.g. `mo`, `meal`, `yr`, `wk`).
    ///   - font: the font to render the visible glyphs in. Defaults to body. Always rendered with
    ///     `.monospacedDigit()` regardless of the font the caller supplies.
    public init(amount: Decimal, denominator: String? = nil, font: Font = CivicaTypography.body) {
        self.amount = amount
        self.denominator = denominator
        self.font = font
    }

    public var body: some View {
        Text(visibleString)
            .font(font.monospacedDigit())
            .accessibilityLabel(Text(spokenLabel))
    }

    private var visibleString: String {
        let isWhole = (amount as NSDecimalNumber).doubleValue.truncatingRemainder(dividingBy: 1) == 0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        formatter.minimumFractionDigits = isWhole ? 0 : 2
        formatter.maximumFractionDigits = isWhole ? 0 : 2
        let amountText = formatter.string(from: amount as NSDecimalNumber) ?? "$0"
        if let denominator, !denominator.isEmpty {
            return "\(amountText)/\(denominator)"
        }
        return amountText
    }

    private var spokenLabel: String {
        let spell = NumberFormatter()
        spell.numberStyle = .spellOut
        spell.locale = .current
        let amountText = spell.string(from: amount as NSDecimalNumber) ?? "zero"
        let dollars = "\(amountText) dollars"
        guard let denominator, !denominator.isEmpty else { return dollars }
        let unitWord: String
        switch denominator.lowercased() {
        case "mo", "month": unitWord = "month"
        case "yr", "year": unitWord = "year"
        case "wk", "week": unitWord = "week"
        case "day": unitWord = "day"
        case "meal": unitWord = "meal"
        case "hr", "hour": unitWord = "hour"
        default: unitWord = denominator
        }
        return "\(dollars) per \(unitWord)"
    }
}

#Preview {
    VStack(alignment: .leading, spacing: CivicaSpacing.md) {
        CivicaMoney(amount: 291, denominator: "mo")
        CivicaMoney(amount: 1.99, denominator: "meal")
        CivicaMoney(amount: 24000, denominator: "yr", font: CivicaTypography.cardHero)
        CivicaMoney(amount: 0)
    }
    .padding()
    .background(CivicaColors.paper)
}
