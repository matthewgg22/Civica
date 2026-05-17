import Foundation
import OSLog

// Lazy loader for per-state SNAP document requirement rules.
// JSON files live in Civica/Resources/SNAPRules/ and are bundled at
// compile time (no runtime fetch). Both CA and MA files are decoded once
// per process and cached; subsequent calls return the cached value.
//
// evaluateChecklist(stateCode:answers:) is the primary entry point for
// the iOS app. It mirrors the @civica/snap-rules TS package so the same
// contract is satisfied on both runtimes from the same JSON source files.

// MARK: - Public contract

struct SNAPChecklistAnswers {
    var householdSize: Int = 1
    var hasEarnedIncome: Bool = false
    var hasUnearnedIncome: Bool = false
    var claimsShelterDeduction: Bool = false
    var claimsUtilityDeduction: Bool = false
}

struct SNAPChecklistItem {
    let category: String
    let label: String
    let helperTextEn: String
    let helperTextEs: String
}

struct SNAPChecklistResult {
    let items: [SNAPChecklistItem]
    let flags: [String]
}

// MARK: - Loader

enum SNAPRulesLoader {

    private static let logger = Logger(subsystem: "Civica", category: "SNAPRules")

    // MARK: Rules access

    /// Returns the decoded rules file for the given state code, or nil if the
    /// bundle is missing the resource or decoding failed. Cached after first load.
    static func rules(for stateCode: String?) -> SNAPRulesFile? {
        guard let key = normalize(stateCode) else { return nil }
        return cache[key]
    }

    // MARK: Checklist evaluation

    /// Evaluate the document checklist for a given state and applicant answers.
    /// Returns only items whose required_when condition is met.
    /// Always includes the orientation disclaimer in `flags`.
    static func evaluateChecklist(
        stateCode: String?,
        answers: SNAPChecklistAnswers = SNAPChecklistAnswers()
    ) -> SNAPChecklistResult {
        guard let rulesFile = rules(for: stateCode) else {
            logger.warning("evaluateChecklist called for unsupported state: \(stateCode ?? "nil", privacy: .public)")
            return SNAPChecklistResult(
                items: [],
                flags: ["Orientation only — does not determine eligibility. Actual requirements are determined by your state agency."]
            )
        }

        let items: [SNAPChecklistItem] = rulesFile.documentRequirements
            .filter { conditionMet($0, answers: answers) }
            .map {
                SNAPChecklistItem(
                    category: $0.category,
                    label: $0.label,
                    helperTextEn: $0.helperTextEn,
                    helperTextEs: $0.helperTextEs
                )
            }

        return SNAPChecklistResult(
            items: items,
            flags: ["Orientation only — does not determine eligibility. Actual requirements are determined by your state agency."]
        )
    }

    // MARK: - Private

    private static func normalize(_ code: String?) -> String? {
        let trimmed = (code ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return trimmed.isEmpty ? nil : trimmed
    }

    private static let cache: [String: SNAPRulesFile] = {
        var map: [String: SNAPRulesFile] = [:]
        for stateCode in ["CA", "MA"] {
            let resourceName = "snap_rules_\(stateCode.lowercased())"
            guard let url = Bundle.main.url(forResource: resourceName, withExtension: "json") else {
                logger.error("SNAP rules bundle resource missing: \(resourceName, privacy: .public).json")
                continue
            }
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase
                let file = try decoder.decode(SNAPRulesFile.self, from: data)
                guard file.version == 1 else {
                    logger.error("SNAP rules unsupported version \(file.version) in \(resourceName, privacy: .public).json")
                    continue
                }
                map[stateCode] = file
            } catch {
                logger.error("SNAP rules decode failed (\(resourceName, privacy: .public).json): \(error.localizedDescription, privacy: .public)")
            }
        }
        return map
    }()

    private static func conditionMet(_ req: SNAPDocumentRequirement, answers: SNAPChecklistAnswers) -> Bool {
        if req.requiredWhen.always == true { return true }
        if let gte = req.requiredWhen.householdSizeGte { return answers.householdSize >= gte }
        if req.requiredWhen.hasEarnedIncome == true { return answers.hasEarnedIncome }
        if req.requiredWhen.hasUnearnedIncome == true { return answers.hasUnearnedIncome }
        if req.requiredWhen.claimsShelterDeduction == true { return answers.claimsShelterDeduction }
        if req.requiredWhen.claimsUtilityDeduction == true { return answers.claimsUtilityDeduction }
        return false
    }
}

// MARK: - Codable models

struct SNAPRulesFile: Decodable {
    let stateCode: String
    let version: Int
    let asOfDate: String
    let documentRequirements: [SNAPDocumentRequirement]
}

struct SNAPDocumentRequirement: Decodable {
    let category: String
    let label: String
    let helperTextEn: String
    let helperTextEs: String
    let requiredWhen: SNAPRequiredWhen
    let isRequired: Bool
    let reviewNote: String?
}

/// All condition keys are optional so one struct covers every variant.
/// Exactly one key is non-nil in well-formed data.
struct SNAPRequiredWhen: Decodable {
    let always: Bool?
    let householdSizeGte: Int?
    let hasEarnedIncome: Bool?
    let hasUnearnedIncome: Bool?
    let claimsShelterDeduction: Bool?
    let claimsUtilityDeduction: Bool?
}
