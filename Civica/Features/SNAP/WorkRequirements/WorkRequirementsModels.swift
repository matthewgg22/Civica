import Foundation

// Models for the OBBBA work-requirements evaluation endpoint.
// POST /v1/enrollment/work-requirements/:packetId/evaluate

// MARK: - Request models

/// Per-member payload sent to the work-requirements evaluator.
/// Corresponds to `HouseholdMemberSchema` in the enrollment-api route.
struct WorkRequirementsHouseholdMember: Encodable {
    let id: String
    let age: Int
    let isTribalMember: Bool?
    let isEnrolledInQualifyingProgram: Bool?
}

// MARK: - Response models

/// Full evaluation result returned by the rules engine.
/// Maps to `WorkRequirementResult` in `@civica/snap-rules`.
struct WorkRequirementsEvaluation: Decodable {
    let isSubject: Bool
    let subjectMemberIds: [String]
    let timeLimitApplicable: Bool
    let citations: [WRCitation]
    let exemptionType: String?
    let complianceStatus: String?
}

/// A single regulatory citation attached to the evaluation result.
struct WRCitation: Decodable {
    let section: String
    let title: String
    let url: String?
}
