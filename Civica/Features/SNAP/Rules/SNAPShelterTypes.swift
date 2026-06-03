import Foundation

// T16 Shelter Accuracy Stack — Gap #1 / #2 / #3
//
// UtilityType replaces the single `paysUtilitiesSeparately: Bool` that
// collapsed three distinct SUA tiers into one. A Set<UtilityType>
// carries which utilities the household actually pays, which maps
// unambiguously to a SUATier via `SUATier.determineTier(for:)`.
//
// CA rules (CDSS ACL 25-68 / CDSS MPP 63-503.43):
//   • Air conditioning qualifies as a "heating-equivalent" utility
//     in CA climate zones — selecting .cooling alone yields the full
//     SUA (.heatingCooling, $663 FY26). Gap #3 is closed for free:
//     no separate A/C yes/no question is needed once .cooling is a
//     checkbox option.
//   • Internet is NOT a qualifying utility (OBBBA §10104, effective
//     2025-07-04). It is intentionally omitted from this enum.
//
// Tier mapping (mirrors packages/snap-calculator/src/sua-rules.ts):
//   heatingCooling (.heatFuel or .cooling present)  → SUATier.heatingCooling
//   nonHeating     (.electricity, no heat/cooling)  → SUATier.nonHeating
//   phoneOnly      (.phone only)                    → SUATier.phoneOnly
//   none           (empty set)                      → SUATier.none

// MARK: - UtilityType

/// A utility the household pays separately from rent.
/// Presented as a multi-select checklist during intake.
enum UtilityType: String, Codable, CaseIterable, Identifiable, Hashable {
    /// Natural gas, oil, propane, or any fuel used for heating.
    case heatFuel
    /// Electric service (non-heating use — lights, appliances, etc.).
    case electricity
    /// Air conditioning. Qualifies as a heating-equivalent utility
    /// in California per CDSS MPP 63-503.43.
    case cooling
    /// Telephone or cell phone service.
    case phone

    public var id: String { rawValue }

    var displayNameEnglish: String {
        switch self {
        case .heatFuel:     return "Gas, oil, or heating fuel"
        case .electricity:  return "Electricity"
        case .cooling:      return "Air conditioning"
        case .phone:        return "Phone or cell service"
        }
    }

    var displayNameSpanish: String {
        switch self {
        case .heatFuel:     return "Gas, petróleo o combustible para calefacción"
        case .electricity:  return "Electricidad"
        case .cooling:      return "Aire acondicionado"
        case .phone:        return "Teléfono o celular"
        }
    }

    func displayName(in language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return displayNameEnglish
        case .spanish: return displayNameSpanish
        }
    }
}

// MARK: - SUATier tier determination

extension SUATier {

    /// Maps a set of utility types to the correct SUA tier.
    /// Logic mirrors `determineSuaTier()` in
    /// packages/snap-calculator/src/sua-rules.ts.
    ///
    /// - heatingCooling: household has gas/oil/propane heat OR
    ///   air conditioning (CA climate-zone rule).
    /// - nonHeating: household has electricity (no heat or AC).
    /// - phoneOnly: household has phone service only.
    /// - none: household pays no utilities separately from rent.
    static func determineTier(for utilities: Set<UtilityType>) -> SUATier {
        guard !utilities.isEmpty else { return .none }
        if utilities.contains(.heatFuel) || utilities.contains(.cooling) {
            return .heatingCooling
        }
        if utilities.contains(.electricity) {
            return .nonHeating
        }
        if utilities.contains(.phone) {
            return .phoneOnly
        }
        return .none
    }
}

// MARK: - Homeless shelter standard deduction

/// Federal homeless shelter standard deduction per 7 CFR 273.9(d)(6).
/// Applied automatically when `housingStatus == .unhoused`.
/// FY2026 value; update when USDA publishes the annual COLA.
enum SNAPHomelessShelterDeduction {
    static let monthlyFY2026: Decimal = 179
}
