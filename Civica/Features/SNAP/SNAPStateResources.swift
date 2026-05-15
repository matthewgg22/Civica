import Foundation

// SNAP state-resource lookup. Three distinct data layers:
//
//   1. State agency name (50 states + DC) — local dict at the bottom
//      of this file, sourced from snap_state_agencies.xlsx. Static
//      reference, no network.
//
//   2. State timeline + on-time band (50 states) — local dict at the
//      bottom of this file, sourced from
//      SNAP_Application_Timeline_50_States_App_Memo.xlsx.
//
//   3. State application URL + helpline (currently 7 states) —
//      loaded from Fixtures/usda_snap_state_directory.json via
//      SNAPStateDirectoryLoader. The JSON is the source of truth;
//      adding states is a data-drop, not a code change. Snapshot
//      provenance lives in the JSON envelope (source + snapshot_date)
//      so the UI can surface "Last verified MMM YYYY" when needed.
//
// Legal review gate: layer 3 is grounded in the USDA SNAP State
// Directory of Resources (a public federal source). Layer 1's
// agency-name list still carries its own verification TODO below.
enum SNAPStateResources {
    /// USDA's directory of state SNAP agencies. Used as the universal
    /// fallback CTA when the user selects a state Civica's screener
    /// isn't tuned for yet — the FNS directory always points to the
    /// state's current apply path.
    /// Reference: docs/SNAP-source-citation-signoff.md (Agency list row).
    static let usdaStateDirectoryURL = "https://www.fns.usda.gov/snap/state-directory"

    /// Convenience accessor for MA-only callers. Kept for backward
    /// compatibility; new call sites should go through `resource(for:)`.
    static var massachusetts: SNAPStateResource? { resource(for: "MA") }

    /// Convenience accessor for CA-only callers. CA is the launch
    /// state; prefer `resource(for:)` in new code so the surface
    /// stays state-agnostic.
    static var california: SNAPStateResource? { resource(for: "CA") }

    /// Returns the application-resource bundle for a state, drawing
    /// agency name, official URL, and hotline from the bundled USDA
    /// SNAP State Directory snapshot. Returns nil when the state is
    /// not present in the directory snapshot — today that's any
    /// state outside the seven the snapshot covers (MA, CA, NY, TX,
    /// FL, PA, IL). Adding more states is a data-drop, not a code
    /// change: extend the JSON in Fixtures/usda_snap_state_directory.json.
    static func resource(for stateCode: String?) -> SNAPStateResource? {
        let normalized = normalizedStateCode(stateCode)
        guard let entry = SNAPStateDirectoryLoader.entry(forStateCode: normalized) else {
            return nil
        }
        return SNAPStateResource(
            stateCode: normalized,
            displayName: displayName(for: normalized),
            agencyName: entry.agencyName,
            officialApplicationLabel: applicationLabel(for: normalized),
            officialApplicationURL: entry.website,
            phoneHelpLabel: phoneLabel(for: normalized, formattedHotline: entry.displayHotline),
            notes: applicationNotes(for: normalized)
        )
    }

    /// State display name. Pulled from the existing 50-state timeline
    /// table so spellings stay consistent across surfaces. Falls back
    /// to the bare state code if a code outside the timeline table
    /// somehow reaches this path.
    private static func displayName(for normalizedCode: String) -> String {
        stateTimelineByCode[normalizedCode]?.displayName ?? normalizedCode
    }

    /// Editorial label for the apply-online CTA. MA and CA use their
    /// state-specific portal names ("DTA Connect", "BenefitsCal");
    /// other states get a generic label because we don't have
    /// brand-equivalent portals vetted yet.
    private static func applicationLabel(for normalizedCode: String) -> String {
        switch normalizedCode {
        case "MA": return "DTA Connect"
        case "CA": return "BenefitsCal"
        default: return "Apply online"
        }
    }

    /// Phone-help label includes the formatted hotline number. MA and
    /// CA get state-specific naming ("DTA Assistance Line",
    /// "CalFresh Info Line"); other states use a generic prefix.
    private static func phoneLabel(for normalizedCode: String, formattedHotline: String) -> String {
        switch normalizedCode {
        case "MA": return "DTA Assistance Line · \(formattedHotline)"
        case "CA": return "CalFresh Info Line · \(formattedHotline)"
        default:   return "State SNAP helpline · \(formattedHotline)"
        }
    }

    /// One-line editorial note about how to apply. MA and CA have
    /// state-tested copy; other states use a generic note pointing
    /// at the agency and helpline below.
    private static func applicationNotes(for normalizedCode: String) -> String {
        switch normalizedCode {
        case "MA":
            return "Massachusetts residents generally apply through DTA Connect or official DTA channels."
        case "CA":
            return "California residents generally apply for CalFresh through BenefitsCal or their county welfare department."
        default:
            return "Apply online through the state portal above or call the SNAP helpline. The agency below administers SNAP for your state."
        }
    }

    static func timelineContext(for stateCode: String?) -> SNAPStateTimelineContext? {
        let normalized = normalizedStateCode(stateCode)
        return stateTimelineByCode[normalized]
    }

    static func administeringAgencyName(for stateCode: String?) -> String? {
        let normalized = normalizedStateCode(stateCode)
        return snapAgencyByStateCode[normalized]
    }

    static func administeringStateName(for stateCode: String?) -> String? {
        guard let code = stateCode else { return nil }
        return stateNameByCode[normalizedStateCode(code)]
    }

    private static let stateNameByCode: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
        "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
        "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
        "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
        "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
        "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
        "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
        "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
        "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
        "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
        "WI": "Wisconsin", "WY": "Wyoming", "DC": "Washington D.C.",
    ]

    static let federalTimelineSummary = SNAPFederalTimelineSummary(
        regularSNAPDeadline: "Most completed SNAP applications get a decision within 30 days.",
        expeditedSNAPDeadline: "If you qualify for expedited SNAP, benefits can be available within 7 days.",
        firstContactGuidance: "You may hear from the office by phone, mail, text, email, or portal message while your case is being reviewed.",
        interviewTiming: "Many people need an interview. Try to answer calls and return missed calls quickly.",
        documentsVerificationWindow: "If documents are requested, you usually have at least 10 days to send them.",
        expeditedCriteria: "Expedited screening may apply if your income and available cash are very low compared with basic costs like housing and utilities."
    )

    static let processTimelineSteps: [SNAPProcessTimelineStep] = [
        .init(
            stepNumber: 1,
            appStatusLabel: "Prep checklist completed",
            typicalDayRange: "Day 0",
            applicantAction: "Save your confirmation details and gather basic documents if you have them.",
            appFriendlyCopy: "Your SNAP draft is complete. The review clock starts when you submit through your official state process."
        ),
        .init(
            stepNumber: 2,
            appStatusLabel: "Expedited screening",
            typicalDayRange: "Day 0-7",
            applicantAction: "If money is very tight, tell the office right away so they can check faster processing.",
            appFriendlyCopy: "We are checking whether your case qualifies for faster SNAP processing."
        ),
        .init(
            stepNumber: 3,
            appStatusLabel: "Interview needed",
            typicalDayRange: "As soon as possible",
            applicantAction: "Watch for a call or message and respond quickly if you miss it.",
            appFriendlyCopy: "You may need an interview before your SNAP decision. Watch for a call or notice."
        ),
        .init(
            stepNumber: 4,
            appStatusLabel: "Documents needed",
            typicalDayRange: "Usually after interview or notice",
            applicantAction: "Send requested documents by the due date. Ask for help if you cannot get a document.",
            appFriendlyCopy: "We may need documents to finish your case. Send them by the due date on your notice."
        ),
        .init(
            stepNumber: 5,
            appStatusLabel: "Expedited benefits",
            typicalDayRange: "By Day 7",
            applicantAction: "Check EBT card and PIN delivery or pickup details.",
            appFriendlyCopy: "If you qualify for expedited SNAP, benefits can be available within 7 calendar days."
        ),
        .init(
            stepNumber: 6,
            appStatusLabel: "Regular decision",
            typicalDayRange: "By Day 30",
            applicantAction: "Check your notice for approval, amount, or next steps.",
            appFriendlyCopy: "Most completed SNAP applications should receive a decision or benefits within 30 calendar days."
        ),
        .init(
            stepNumber: 7,
            appStatusLabel: "Missed interview",
            typicalDayRange: "Before Day 30",
            applicantAction: "Contact the office immediately to reschedule; do not wait for Day 30.",
            appFriendlyCopy: "You missed an interview. Contact the SNAP office as soon as possible to reschedule."
        ),
        .init(
            stepNumber: 8,
            appStatusLabel: "Still processing",
            typicalDayRange: "After Day 30",
            applicantAction: "Call the office, check your portal, and review notices for what to do next.",
            appFriendlyCopy: "Your case is past the usual 30-day window. Contact the SNAP office for status and next steps."
        )
    ]

    private static let stateTimelineByCode: [String: SNAPStateTimelineContext] = [
        "AL": makeTimeline(stateCode: "AL", displayName: "Alabama", onTimeRateFY2024: 0.9302, timelinessBand: "High on-time (90%+)"),
        "AK": makeTimeline(stateCode: "AK", displayName: "Alaska", onTimeRateFY2024: 0.5793, timelinessBand: "Watch closely (<75%)"),
        "AZ": makeTimeline(stateCode: "AZ", displayName: "Arizona", onTimeRateFY2024: 0.9029, timelinessBand: "High on-time (90%+)"),
        "AR": makeTimeline(stateCode: "AR", displayName: "Arkansas", onTimeRateFY2024: 0.6194, timelinessBand: "Watch closely (<75%)"),
        "CA": makeTimeline(stateCode: "CA", displayName: "California", onTimeRateFY2024: 0.8021, timelinessBand: "Moderate / monitor"),
        "CO": makeTimeline(stateCode: "CO", displayName: "Colorado", onTimeRateFY2024: 0.6687, timelinessBand: "Watch closely (<75%)"),
        "CT": makeTimeline(stateCode: "CT", displayName: "Connecticut", onTimeRateFY2024: 0.8911, timelinessBand: "Moderate / monitor"),
        "DE": makeTimeline(stateCode: "DE", displayName: "Delaware", onTimeRateFY2024: 0.7508, timelinessBand: "Moderate / monitor"),
        "FL": makeTimeline(stateCode: "FL", displayName: "Florida", onTimeRateFY2024: 0.6331, timelinessBand: "Watch closely (<75%)"),
        "GA": makeTimeline(stateCode: "GA", displayName: "Georgia", onTimeRateFY2024: 0.6722, timelinessBand: "Watch closely (<75%)"),
        "HI": makeTimeline(stateCode: "HI", displayName: "Hawaii", onTimeRateFY2024: 0.6887, timelinessBand: "Watch closely (<75%)"),
        "ID": makeTimeline(stateCode: "ID", displayName: "Idaho", onTimeRateFY2024: 0.9102, timelinessBand: "High on-time (90%+)"),
        "IL": makeTimeline(stateCode: "IL", displayName: "Illinois", onTimeRateFY2024: 0.9356, timelinessBand: "High on-time (90%+)"),
        "IN": makeTimeline(stateCode: "IN", displayName: "Indiana", onTimeRateFY2024: 0.8004, timelinessBand: "Moderate / monitor"),
        "IA": makeTimeline(stateCode: "IA", displayName: "Iowa", onTimeRateFY2024: 0.6466, timelinessBand: "Watch closely (<75%)"),
        "KS": makeTimeline(stateCode: "KS", displayName: "Kansas", onTimeRateFY2024: 0.8199, timelinessBand: "Moderate / monitor"),
        "KY": makeTimeline(stateCode: "KY", displayName: "Kentucky", onTimeRateFY2024: 0.8738, timelinessBand: "Moderate / monitor"),
        "LA": makeTimeline(stateCode: "LA", displayName: "Louisiana", onTimeRateFY2024: 0.8708, timelinessBand: "Moderate / monitor"),
        "ME": makeTimeline(stateCode: "ME", displayName: "Maine", onTimeRateFY2024: 0.6493, timelinessBand: "Watch closely (<75%)"),
        "MD": makeTimeline(stateCode: "MD", displayName: "Maryland", onTimeRateFY2024: 0.9104, timelinessBand: "High on-time (90%+)"),
        "MA": makeTimeline(stateCode: "MA", displayName: "Massachusetts", onTimeRateFY2024: 0.8545, timelinessBand: "Moderate / monitor"),
        "MI": makeTimeline(stateCode: "MI", displayName: "Michigan", onTimeRateFY2024: 0.7605, timelinessBand: "Moderate / monitor"),
        "MN": makeTimeline(stateCode: "MN", displayName: "Minnesota", onTimeRateFY2024: 0.8037, timelinessBand: "Moderate / monitor"),
        "MS": makeTimeline(stateCode: "MS", displayName: "Mississippi", onTimeRateFY2024: 0.7938, timelinessBand: "Moderate / monitor"),
        "MO": makeTimeline(stateCode: "MO", displayName: "Missouri", onTimeRateFY2024: 0.7828, timelinessBand: "Moderate / monitor"),
        "MT": makeTimeline(stateCode: "MT", displayName: "Montana", onTimeRateFY2024: 0.6688, timelinessBand: "Watch closely (<75%)"),
        "NE": makeTimeline(stateCode: "NE", displayName: "Nebraska", onTimeRateFY2024: 0.8896, timelinessBand: "Moderate / monitor"),
        "NV": makeTimeline(stateCode: "NV", displayName: "Nevada", onTimeRateFY2024: 0.9309, timelinessBand: "High on-time (90%+)"),
        "NH": makeTimeline(stateCode: "NH", displayName: "New Hampshire", onTimeRateFY2024: 0.8932, timelinessBand: "Moderate / monitor"),
        "NJ": makeTimeline(stateCode: "NJ", displayName: "New Jersey", onTimeRateFY2024: 0.7761, timelinessBand: "Moderate / monitor"),
        "NM": makeTimeline(stateCode: "NM", displayName: "New Mexico", onTimeRateFY2024: 0.5236, timelinessBand: "Watch closely (<75%)"),
        "NY": makeTimeline(stateCode: "NY", displayName: "New York", onTimeRateFY2024: 0.8161, timelinessBand: "Moderate / monitor"),
        "NC": makeTimeline(stateCode: "NC", displayName: "North Carolina", onTimeRateFY2024: 0.8440, timelinessBand: "Moderate / monitor"),
        "ND": makeTimeline(stateCode: "ND", displayName: "North Dakota", onTimeRateFY2024: 0.5702, timelinessBand: "Watch closely (<75%)"),
        "OH": makeTimeline(stateCode: "OH", displayName: "Ohio", onTimeRateFY2024: 0.9193, timelinessBand: "High on-time (90%+)"),
        "OK": makeTimeline(stateCode: "OK", displayName: "Oklahoma", onTimeRateFY2024: 0.8865, timelinessBand: "Moderate / monitor"),
        "OR": makeTimeline(stateCode: "OR", displayName: "Oregon", onTimeRateFY2024: 0.7183, timelinessBand: "Watch closely (<75%)"),
        "PA": makeTimeline(stateCode: "PA", displayName: "Pennsylvania", onTimeRateFY2024: 0.9029, timelinessBand: "High on-time (90%+)"),
        "RI": makeTimeline(stateCode: "RI", displayName: "Rhode Island", onTimeRateFY2024: 0.9352, timelinessBand: "High on-time (90%+)"),
        "SC": makeTimeline(stateCode: "SC", displayName: "South Carolina", onTimeRateFY2024: 0.7348, timelinessBand: "Watch closely (<75%)"),
        "SD": makeTimeline(stateCode: "SD", displayName: "South Dakota", onTimeRateFY2024: 0.8589, timelinessBand: "Moderate / monitor"),
        "TN": makeTimeline(stateCode: "TN", displayName: "Tennessee", onTimeRateFY2024: 0.4272, timelinessBand: "Watch closely (<75%)"),
        "TX": makeTimeline(stateCode: "TX", displayName: "Texas", onTimeRateFY2024: 0.7548, timelinessBand: "Moderate / monitor"),
        "UT": makeTimeline(stateCode: "UT", displayName: "Utah", onTimeRateFY2024: 0.8982, timelinessBand: "Moderate / monitor"),
        "VT": makeTimeline(stateCode: "VT", displayName: "Vermont", onTimeRateFY2024: 0.8447, timelinessBand: "Moderate / monitor"),
        "VA": makeTimeline(stateCode: "VA", displayName: "Virginia", onTimeRateFY2024: 0.8323, timelinessBand: "Moderate / monitor"),
        "WA": makeTimeline(stateCode: "WA", displayName: "Washington", onTimeRateFY2024: 0.9036, timelinessBand: "High on-time (90%+)"),
        "WV": makeTimeline(stateCode: "WV", displayName: "West Virginia", onTimeRateFY2024: 0.7580, timelinessBand: "Moderate / monitor"),
        "WI": makeTimeline(stateCode: "WI", displayName: "Wisconsin", onTimeRateFY2024: 0.9562, timelinessBand: "High on-time (90%+)"),
        "WY": makeTimeline(stateCode: "WY", displayName: "Wyoming", onTimeRateFY2024: 0.9043, timelinessBand: "High on-time (90%+)")
    ]

    // Source: /Users/matthewgreer-gentis/Downloads/snap_state_agencies.xlsx
    // Sheet: "SNAP Agencies" (Jurisdiction + State SNAP Agency columns).
    // Static reference data only; no network fetch at runtime.
    // TODO(legal/source-verification): Row 12 in docs/SNAP-source-citation-signoff.md. Confirm this list against the USDA State Directory and state agency pages before production release.
    private static let snapAgencyByStateCode: [String: String] = [
        "AL": "Alabama Department of Human Resources",
        "AK": "Alaska Department of Health",
        "AZ": "Arizona Department of Economic Security",
        "AR": "Arkansas Department of Human Services",
        "CA": "California Department of Social Services",
        "CO": "Colorado Department of Human Services",
        "CT": "Connecticut Department of Social Services",
        "DE": "Delaware Department of Health and Human Services",
        "DC": "District of Columbia Department of Human Services",
        "FL": "Florida Department of Children and Families",
        "GA": "Georgia Department of Human Services",
        "HI": "Hawaii Department of Human Services",
        "ID": "Idaho Department of Health and Welfare",
        "IL": "Illinois Department of Human Services",
        "IN": "Indiana Family and Social Services Administration",
        "IA": "Iowa Department of Health and Human Services",
        "KS": "Kansas Department for Children and Families",
        "KY": "Kentucky Cabinet for Health and Family Services",
        "LA": "Louisiana Department of Children & Family Services",
        "ME": "Maine Department of Health and Human Services",
        "MD": "Maryland Department of Human Services",
        "MA": "Massachusetts Department of Transitional Assistance",
        "MI": "Michigan Department of Health and Human Services",
        "MN": "Minnesota Department of Children, Youth, and Families",
        "MS": "Mississippi Department of Human Services",
        "MO": "Missouri Department of Social Services",
        "MT": "Montana Department of Public Health and Human Services",
        "NE": "Nebraska Department of Health and Human Services",
        "NV": "Nevada Department of Health and Human Services",
        "NH": "New Hampshire Department of Health and Human Services",
        "NJ": "New Jersey Department of Human Services",
        "NM": "New Mexico Health Care Authority",
        "NY": "New York State Office of Temporary and Disability Assistance",
        "NC": "North Carolina Department of Health and Human Services",
        "ND": "North Dakota Health and Human Services",
        "OH": "Ohio Department of Job and Family Services",
        "OK": "Oklahoma Human Services / Oklahoma Department of Human Services",
        "OR": "Oregon Department of Human Services",
        "PA": "Pennsylvania Department of Human Services",
        "RI": "Rhode Island Department of Human Services",
        "SC": "South Carolina Department of Social Services",
        "SD": "South Dakota Department of Social Services",
        "TN": "Tennessee Department of Human Services",
        "TX": "Texas Health and Human Services Commission",
        "UT": "Utah Department of Workforce Services",
        "VT": "Vermont Agency of Human Services, Department for Children and Families",
        "VA": "Virginia Department of Social Services",
        "WA": "Washington State Department of Social and Health Services",
        "WV": "West Virginia Department of Human Services",
        "WI": "Wisconsin Department of Health Services",
        "WY": "Wyoming Department of Family Services"
    ]

    private static let standardFollowUpInApp = "If you do not get an interview or notice by around Day 10-14, check your portal or call the SNAP office."
    private static let earlyFollowUpInApp = "Follow up early: check your portal or call around Day 7-10, and again before Day 30 if needed."

    private static func followUpSuggestion(for timelinessBand: String) -> String {
        if timelinessBand.contains("Watch closely") {
            return earlyFollowUpInApp
        }
        return standardFollowUpInApp
    }

    private static func makeTimeline(
        stateCode: String,
        displayName: String,
        onTimeRateFY2024: Double,
        timelinessBand: String
    ) -> SNAPStateTimelineContext {
        SNAPStateTimelineContext(
            stateCode: stateCode,
            displayName: displayName,
            onTimeRateFY2024: onTimeRateFY2024,
            timelinessBand: timelinessBand,
            suggestedFollowUpInApp: followUpSuggestion(for: timelinessBand)
        )
    }

    private static func normalizedStateCode(_ stateCode: String?) -> String {
        (stateCode ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
    }
}

struct SNAPStateResource: Equatable {
    let stateCode: String
    let displayName: String
    let agencyName: String
    let officialApplicationLabel: String
    let officialApplicationURL: String
    let phoneHelpLabel: String
    let notes: String
}

struct SNAPStateTimelineContext: Equatable {
    let stateCode: String
    let displayName: String
    let onTimeRateFY2024: Double
    let timelinessBand: String
    let suggestedFollowUpInApp: String

    var onTimeRatePercentText: String {
        String(format: "%.1f%%", onTimeRateFY2024 * 100)
    }

    var laymanBandLabel: String {
        if timelinessBand.contains("High on-time") {
            return "Usually on time"
        }
        if timelinessBand.contains("Watch closely") {
            return "Delays are more common"
        }
        return "Mixed timing"
    }
}

struct SNAPFederalTimelineSummary: Equatable {
    let regularSNAPDeadline: String
    let expeditedSNAPDeadline: String
    let firstContactGuidance: String
    let interviewTiming: String
    let documentsVerificationWindow: String
    let expeditedCriteria: String
}

struct SNAPProcessTimelineStep: Equatable, Identifiable {
    let stepNumber: Int
    let appStatusLabel: String
    let typicalDayRange: String
    let applicantAction: String
    let appFriendlyCopy: String

    var id: Int { stepNumber }
}
