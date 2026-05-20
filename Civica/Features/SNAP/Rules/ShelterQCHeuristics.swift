import Foundation

// T16 Shelter Accuracy Stack — Gap #7
//
// ShelterQCHeuristics flags suspicious shelter values before the packet is
// submitted. Flagged cases are surfaced to the navigator (or the student
// in self-service mode) as a "check this before submitting" prompt — NOT
// as hard blockers. The goal is to catch the most common data-quality
// issues that turn into QC errors at re-determination:
//
//   Flag A — Rent too low for county
//     Rent below the county floor almost always means the applicant
//     reported their individual share of a multi-person lease without
//     flagging shared housing. In LA/Bay Area counties, $300/mo is
//     implausible as a sole-renter amount. Prompt: "Is that your full
//     rent, or your share of rent with roommates?"
//
//   Flag B — Rent exceeds income
//     Rent > gross monthly income is statistically common among students
//     (parents help, financial aid covers it) but is a systematic QC
//     flag at re-determination when the caseworker can't reconcile.
//     Prompt: "Your rent appears higher than your reported income —
//     confirm the amounts are correct before submitting."
//
//   Flag C — No utilities in a zip code without campus housing
//     A student who reports an off-campus address but selects no utility
//     types and has no identified Banner housing assignment is likely
//     missing utility data. Prompt: "You didn't report any utilities —
//     are they included in your rent?"
//
//   Flag D — Lease amount looks like a full multi-person lease
//     When sharedHousingOccupants is nil but the rent is above the
//     single-person 80th-percentile threshold for the county, the
//     applicant may have entered the total lease rather than their share.
//     Prompt: "That rent is high for a single person in your area —
//     are you splitting it with roommates?"
//
// All thresholds are CA-specific. Add a `stateCode` parameter when
// expanding to other states.

// MARK: - Flag types

/// A shelter data quality flag returned by ShelterQCHeuristics.evaluate().
/// Flags are advisory — never block submission.
enum ShelterQCFlag: Equatable {
    /// Rent is implausibly low for a solo renter in California.
    /// `floor` is the threshold that was not met.
    case rentBelowCountyFloor(reported: Decimal, floor: Decimal)

    /// Rent exceeds gross monthly income.
    case rentExceedsIncome(rent: Decimal, income: Decimal)

    /// No utilities selected for an off-campus address (not on Banner housing).
    case noUtilitiesOffCampus

    /// Rent suggests a full multi-person lease rather than a pro-rated share.
    case rentSuggestsUnproratedLease(reported: Decimal, singlePersonP80: Decimal)
}

extension ShelterQCFlag {
    /// Navigator-facing summary. Not shown directly to students —
    /// the UI wraps this in softer language.
    var navigatorSummary: String {
        switch self {
        case .rentBelowCountyFloor(let reported, let floor):
            return "Rent $\(reported)/mo is below the $\(floor)/mo CA floor for solo renters. Likely a shared-lease share that wasn't pro-rated."
        case .rentExceedsIncome(let rent, let income):
            return "Rent $\(rent)/mo exceeds gross income $\(income)/mo. Confirm both figures."
        case .noUtilitiesOffCampus:
            return "No utility types selected for an off-campus address. Confirm utilities are included in rent."
        case .rentSuggestsUnproratedLease(let reported, let p80):
            return "Rent $\(reported)/mo exceeds the CA single-person 80th percentile ($\(p80)/mo). May be a full lease — check if shared."
        }
    }
}

// MARK: - Heuristics engine

enum ShelterQCHeuristics {

    // MARK: - CA county rent floors (solo renter, FY2026 estimate)
    // Source: HUD FMR data + CA Housing Is Key survey medians.
    // These are the *minimum* plausible rent for a solo renter —
    // values below this almost always indicate a shared-lease share.
    private static let caCountyRentFloors: [String: Decimal] = [
        "Los Angeles":    350,
        "San Diego":      375,
        "Santa Clara":    500,
        "San Francisco":  600,
        "Alameda":        450,
        "Orange":         400,
        "Sacramento":     325,
        "Riverside":      300,
        "San Bernardino": 275,
        "Fresno":         250,
        "Kern":           225,
    ]
    /// Statewide fallback floor when county isn't in the table.
    private static let caStatewideFallbackFloor: Decimal = 250

    // CA single-person rent 80th percentile by county (FY2026 HUD FMR basis)
    // Rents above this for a "not sharing" selection warrant a flag.
    private static let caCountyP80: [String: Decimal] = [
        "Los Angeles":    2_100,
        "San Diego":      2_300,
        "Santa Clara":    2_800,
        "San Francisco":  3_200,
        "Alameda":        2_500,
        "Orange":         2_400,
        "Sacramento":     1_700,
        "Riverside":      1_800,
        "San Bernardino": 1_500,
        "Fresno":         1_200,
        "Kern":           1_100,
    ]
    private static let caStatewideFallbackP80: Decimal = 1_600

    // MARK: - Evaluate

    /// Evaluates a SNAP application draft for shelter data quality issues.
    /// Returns an array of advisory flags in priority order (most actionable first).
    /// Empty array = no flags raised.
    ///
    /// - Parameters:
    ///   - draft: The current SNAPApplicationDraft.
    ///   - county: The county name from `draft.whereApplying.county` (optional —
    ///     falls back to statewide thresholds when nil).
    ///   - onCampus: Pass true when a Banner housing assignment confirms on-campus
    ///     residence. On-campus students legitimately have $0 utilities and low rent.
    static func evaluate(
        draft: SNAPApplicationDraft,
        county: String? = nil,
        onCampus: Bool = false
    ) -> [ShelterQCFlag] {
        // Unhoused applicants don't have rent/utility data to validate.
        guard draft.whereApplying.housingStatus != .unhoused else { return [] }

        var flags: [ShelterQCFlag] = []
        let rent = draft.expenses.monthlyRentOrHousing ?? 0
        let gross = draft.expenses.monthlyRentOrHousing == nil ? nil
            : draft.income.grossMonthlyIncome

        // Flag C: no utilities for off-campus address (highest actionability first)
        if !onCampus
            && draft.expenses.selectedUtilities.isEmpty
            && draft.whereApplying.housingStatus == .stableHome {
            flags.append(.noUtilitiesOffCampus)
        }

        guard rent > 0 else { return flags }  // $0 rent = skip rent-based flags

        let floor = caCountyRentFloors[county ?? ""] ?? caStatewideFallbackFloor
        let p80   = caCountyP80[county ?? ""]       ?? caStatewideFallbackP80
        let isSharing = draft.expenses.sharedHousingOccupants != nil

        // Flag A: rent below county floor (solo or already pro-rated)
        if !isSharing && rent < floor {
            flags.append(.rentBelowCountyFloor(reported: rent, floor: floor))
        }

        // Flag D: rent suggests un-pro-rated lease (not sharing flagged, but rent is high)
        if !isSharing && rent > p80 {
            flags.append(.rentSuggestsUnproratedLease(reported: rent, singlePersonP80: p80))
        }

        // Flag B: rent exceeds income
        if let income = gross, income > 0, rent > income {
            flags.append(.rentExceedsIncome(rent: rent, income: income))
        }

        return flags
    }
}
