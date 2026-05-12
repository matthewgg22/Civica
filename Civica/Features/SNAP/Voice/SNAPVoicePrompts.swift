import Foundation

// Prompts for the per-step slot-filling LLM and the always-on distress
// pass. Each step prompt frames the role, lists the fields available on
// the schema, and bakes in the confidence-calibration rule so the model
// produces useful 0.0–1.0 values.
enum SNAPVoicePrompts {

    static let sharedRules = """
    You extract structured SNAP application fields from informal speech.

    Hard rules:
    • If a field is not clearly stated or strongly implied, leave it nil. Never guess.
    • Confidence calibration (per field):
      – 1.0 only when the speaker said the value explicitly and unambiguously.
      – 0.7–0.9 when paraphrased or stated with minor ambiguity.
      – 0.4–0.69 when uncertain or partially inferred. The UI will flag these.
      – Below 0.4 means do not return a value at all — leave the field nil.
    • Never include sensitive identifiers: SSN, full immigration status, bank or routing numbers.
    • Always include the speaker themselves in any household count, unless they explicitly say they live alone elsewhere.
    """

    static func stepPrompt(for step: SNAPDraftStep, transcript: String) -> String {
        let rolePrompt = stepRolePrompt(for: step)
        return """
        \(sharedRules)

        \(rolePrompt)

        Transcript:
        \"\"\"
        \(transcript)
        \"\"\"
        """
    }

    private static func stepRolePrompt(for step: SNAPDraftStep) -> String {
        switch step {
        case .whereApplyingFrom:
            return """
            Extract the speaker's US state (two-letter abbreviation) and housing status.
            Housing status categories:
            • stableHome — has a permanent residence
            • temporaryHousing — shelter, transitional, motel
            • stayingWithOthers — couch-surfing, doubled up
            • unhoused — sleeping outside, in car, no housing
            """
        case .householdBasics:
            return """
            Extract the speaker's food household composition. The household includes everyone
            who buys and prepares food together with the speaker. Always include the speaker.

            Fields:
            • householdSize: a short label like "1", "2", "3-4", "5+".
            • hasMinorInHousehold: any child under 18 in the household?
            • hasElderlyOrDisabled: anyone 60+ or with a disability?
            """
        case .applicantAge:
            return "Extract the speaker's age in whole years."
        case .addressContact:
            return """
            Extract the speaker's contact details only — email, phone (digits only),
            and preferred contact method (phone, text, email, mail). Do not invent
            addresses or numbers. The residential address is collected on a separate
            screen and is not part of this step.
            """
        case .income:
            return """
            Extract the speaker's income at the household level.
            Dollar amounts must be in plain US dollars (convert words like
            "twelve hundred" to 1200, "fifteen K" to 15000).

            Fields:
            • anyoneEarning: is anyone in the household currently earning from a job
              or self-employment? (yes / no / notSure)
            • grossMonthlyIncome: total gross monthly earned income in dollars.
              Only set when the speaker stated a monthly total — do not convert
              per-week or per-hour figures.
            • incomeChangesMonthToMonth: does income vary month to month?
              (yes / no / notSure)
            • hasUnearnedIncome: does the household receive any unearned income
              (unemployment, social security, child support, VA benefits, etc.)?
              (yes / no / notSure)
            """
        case .studentStatus:
            return """
            Extract higher-education student-eligibility flags only. Do not infer
            from age — the speaker must mention school, college, university,
            tuition, classes, enrollment, work-study, etc.

            Fields are independent Bools:
            • enrolledInHigherEd, enrolledHalfTime, works20PlusHours,
              inWorkStudy, responsibleForDependentChild.
            """
        case .expenses:
            return """
            Extract the speaker's monthly recurring expenses in US dollars.
            Convert words to numbers ("eight hundred" → 800). Keep rent,
            utilities, childcare, and medical separate even if the speaker
            gives a single total — only assign a category when the speaker
            named it.
            """
        case .documentsChecklist:
            return """
            Extract which document categories the speaker said they already have on hand.
            Only include documents the speaker explicitly mentioned possessing.
            """
        case .reviewDraft, .nextSteps:
            return "No extraction. Return all fields nil."
        }
    }

    static func distressPrompt(transcript: String) -> String {
        return """
        \(sharedRules)

        You are scanning for emotional distress and crisis signals that should
        trigger expedited SNAP processing. Look for explicit statements only —
        do not over-infer from neutral language.

        Examples that count:
        • "I haven't eaten in days" → noFoodToday
        • "We're out of food" → noFoodToday
        • "I lost my job last week and have no money" → noIncomeThisMonth
        • "We're getting evicted next week" → unstableHousing
        • "Sleeping in my car" → unstableHousing
        • "My kids haven't eaten today" → childrenWithoutFood, noFoodToday

        Examples that DO NOT count:
        • "Money is tight" (too vague)
        • "Looking for work" (no crisis claim)
        • "Rent is high" (not at risk of eviction)

        Set confidence to your overall certainty that at least one of these
        crisis signals is genuinely present in the transcript.

        Transcript:
        \"\"\"
        \(transcript)
        \"\"\"
        """
    }
}
