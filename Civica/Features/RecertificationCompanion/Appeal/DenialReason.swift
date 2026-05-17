import Foundation

// Closed-set denial reasons that the appeal generator can target.
//
// We deliberately do NOT model substantive denials (over-income,
// failed-student-test, immigration status). Those require legal
// review of the underlying eligibility, not a procedural fair-
// hearing request. The companion module's value proposition is the
// "63% of fair hearings reverse the state's denial when appealed"
// procedural subset — keep the surface scoped to that.

enum DenialReason: String, CaseIterable, Codable, Equatable, Hashable {
    /// User missed the scheduled eligibility interview. Per
    /// 7 CFR 273.2(e)(3) the agency must re-schedule on request;
    /// "failure to appear" alone is not a denial-able offense.
    case missedInterview

    /// User did not provide one or more verifications the agency
    /// requested. The procedural argument is the same failure-vs-
    /// refusal-to-cooperate distinction per 7 CFR 273.2(d): the user
    /// must be given a chance to explain before denial.
    case missingDocuments

    /// User did not respond to an agency request (letter, phone).
    /// Often a function of mail returned to sender — explicitly
    /// addressed in 7 CFR 273.2(d) procedural protections.
    case noResponse

    /// Catch-all for other procedural reasons. Triggers a more
    /// generic argument without specific factual claims.
    case otherProcedural
}
