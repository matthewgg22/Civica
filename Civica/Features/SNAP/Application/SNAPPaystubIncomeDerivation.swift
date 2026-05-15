import Foundation

// Derives a monthly earned-income estimate from a confirmed SNAPPaystub
// so the income flow can prefill the "gross monthly income" screen.
//
// SNAP eligibility is gross-monthly. Paystubs are typically per pay
// period. Multiplying by a frequency factor (×4.333 weekly,
// ×2.167 biweekly, ×2 semimonthly, ×1 monthly) gives the standard
// gross-monthly approximation that state agencies use.
//
// Frequency inference is dual-source: the printed pay-period dates
// are more reliable than the free-text "pay frequency" label, so we
// prefer the period length and use the label only as a tiebreaker
// for the 14-vs-15-day biweekly/semimonthly ambiguity, or as a
// fallback when dates are missing. Confidence is downgraded when
// the two sources disagree so the UI can require an explicit user
// confirmation before applying the derived value.

enum SNAPPaystubFrequency: Equatable {
    case weekly
    case biweekly
    case semimonthly
    case monthly

    /// Multiplier from per-period gross to gross monthly. The weekly
    /// and biweekly factors are the standard SNAP averaging constants
    /// (52/12 and 26/12) — the same ones used in state SNAP manuals.
    var monthlyMultiplier: Decimal {
        switch self {
        case .weekly:     return Decimal(string: "4.333")!
        case .biweekly:   return Decimal(string: "2.167")!
        case .semimonthly: return 2
        case .monthly:    return 1
        }
    }

    var shortLabelEn: String {
        switch self {
        case .weekly:      return "every week"
        case .biweekly:    return "every 2 weeks"
        case .semimonthly: return "twice a month"
        case .monthly:     return "every month"
        }
    }
}

enum SNAPPaystubDerivationConfidence: Equatable {
    /// Dates and (optional) label agree. Safe to suggest "Use this" as
    /// the primary action.
    case high
    /// Single source (dates OR label, not both) or label disagrees but
    /// the date-based reading is clearly authoritative. Suggest the
    /// value but require an explicit user tap.
    case medium
    /// Sources conflict or are weak. Show the value as a hint only;
    /// keep manual entry as the primary affordance.
    case low
}

struct SNAPPaystubDerivation: Equatable {
    let monthlyEarnedIncome: Decimal
    let frequency: SNAPPaystubFrequency
    let perPeriodGross: Decimal
    let confidence: SNAPPaystubDerivationConfidence
}

enum SNAPPaystubIncomeDerivation {

    /// Returns nil when no useful derivation is possible (missing
    /// gross, no period dates AND no label). Callers fall back to
    /// manual entry.
    static func derive(from paystub: SNAPPaystub) -> SNAPPaystubDerivation? {
        let gross = paystub.grossPayPeriod
        guard gross > 0 else { return nil }

        let dateFrequency = frequencyFromPeriodDates(
            start: paystub.payPeriodStart,
            end: paystub.payPeriodEnd,
            label: paystub.payFrequencyLabelAsPrinted
        )
        let labelFrequency = frequencyFromLabel(paystub.payFrequencyLabelAsPrinted)

        let (frequency, confidence): (SNAPPaystubFrequency, SNAPPaystubDerivationConfidence)
        switch (dateFrequency, labelFrequency) {
        case let (.some(date), .some(label)):
            if date == label {
                (frequency, confidence) = (date, .high)
            } else {
                // Dates win — period length is harder to fake than a
                // human-typed label — but we mark low so the UI asks.
                (frequency, confidence) = (date, .low)
            }
        case let (.some(date), .none):
            // Dates only: if label is absent we treat that as silent
            // agreement (high); if label was present but unparseable
            // we keep high too — there's nothing to disagree with.
            (frequency, confidence) = (date, .high)
        case let (.none, .some(label)):
            (frequency, confidence) = (label, .medium)
        case (.none, .none):
            return nil
        }

        let monthly = (gross * frequency.monthlyMultiplier).roundedToCents()
        return SNAPPaystubDerivation(
            monthlyEarnedIncome: monthly,
            frequency: frequency,
            perPeriodGross: gross,
            confidence: confidence
        )
    }

    // MARK: - Frequency inference

    /// Period-length-based inference. The 14-vs-15-day ambiguity is the
    /// only case where the printed label matters: a 14-day period with
    /// a "semi-monthly" label is treated as semimonthly, otherwise
    /// 13-15 days reads as biweekly.
    private static func frequencyFromPeriodDates(
        start: String,
        end: String,
        label: String?
    ) -> SNAPPaystubFrequency? {
        guard let days = daysBetween(start: start, end: end) else { return nil }
        switch days {
        case 6...8:
            return .weekly
        case 13:
            return .biweekly
        case 14...15:
            // Biweekly periods are typically printed as inclusive
            // 14-day ranges. Semimonthly typically prints 1st-15th
            // or 16th-end-of-month (15-16 days). Only override to
            // semimonthly when the label backs it.
            if let label, looksSemimonthly(label) {
                return .semimonthly
            }
            return .biweekly
        case 16:
            // 16 days is more often the second half of a semimonthly
            // month (16th → 31st) than biweekly drift.
            return .semimonthly
        case 27...31:
            return .monthly
        default:
            return nil
        }
    }

    private static func frequencyFromLabel(_ label: String?) -> SNAPPaystubFrequency? {
        guard let raw = label?.lowercased() else { return nil }
        let normalized = raw
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "_", with: "")
        if looksSemimonthly(raw) { return .semimonthly }
        if normalized.contains("biweekly") || normalized.contains("everytwoweeks") {
            return .biweekly
        }
        if normalized.contains("weekly") { return .weekly }
        if normalized.contains("monthly") { return .monthly }
        return nil
    }

    private static func looksSemimonthly(_ label: String) -> Bool {
        let raw = label.lowercased()
        return raw.contains("semi") || raw.contains("twice a month") || raw.contains("twice monthly")
    }

    // MARK: - Date helpers

    private static let isoDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Inclusive day-count between two ISO YYYY-MM-DD dates (e.g. a
    /// 2026-01-01 → 2026-01-14 biweekly period is 14 days).
    private static func daysBetween(start: String, end: String) -> Int? {
        guard !start.isEmpty, !end.isEmpty else { return nil }
        guard let s = isoDateFormatter.date(from: start),
              let e = isoDateFormatter.date(from: end),
              e >= s else { return nil }
        let components = Calendar(identifier: .gregorian)
            .dateComponents([.day], from: s, to: e)
        guard let day = components.day else { return nil }
        return day + 1 // inclusive
    }
}

private extension Decimal {
    func roundedToCents() -> Decimal {
        var input = self
        var result = Decimal()
        NSDecimalRound(&result, &input, 2, .bankers)
        return result
    }
}
