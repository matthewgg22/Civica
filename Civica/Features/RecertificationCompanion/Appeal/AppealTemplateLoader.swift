import Foundation

// Wire shape + bundle loader for state-specific appeal templates.
// Templates live in Fixtures/AppealTemplates/{state}.{lang}.json
// — one file per (state, language) pair so legal review can sign
// off on each combination independently.

struct AppealTemplate: Codable, Equatable {
    let stateCode: String           // USPS two-letter, e.g. "MA"
    let language: String            // ISO 639-1, e.g. "en"
    let agencyName: String
    let agencyAddressBlock: String
    let statutoryCitations: Citations
    let paragraphs: Paragraphs
    let requiredSlots: [String]

    struct Citations: Codable, Equatable {
        let federal: String         // e.g. "7 CFR 273.2(d)"
        let state: String           // e.g. "106 CMR 343.250"
    }

    /// Each paragraph is a template string with {{slot}} markers.
    /// Renderer substitutes from a slots dictionary. Conditional
    /// paragraphs (per denial reason) are picked at render time;
    /// every paragraph that is rendered comes from this struct.
    struct Paragraphs: Codable, Equatable {
        let header: String
        let opening: String

        // Reason-specific paragraphs — exactly one of these is
        // chosen by AppealRenderer based on the DenialReason.
        let missedInterview: String
        let missingDocuments: String
        let noResponse: String
        let otherProcedural: String

        // Always rendered after the reason-specific paragraph. This
        // is where the failure-to-cooperate vs refusal-to-cooperate
        // distinction per 7 CFR 273.2(d) lives.
        let failureVsRefusalArgument: String

        let closing: String
        let signatureBlock: String
    }
}

enum AppealTemplateLoader {
    enum LoadError: Error, Equatable {
        case fileNotFound(state: String, language: String)
        case decodeFailed(state: String, language: String, underlying: String)
    }

    /// Load the template for a (state, language) pair from the
    /// bundle. Returns the typed value or a structured error so the
    /// UI can fall back to a generic "we don't have a template for
    /// your state yet" surface.
    static func load(state: String, language: CivicaLanguage) -> Result<AppealTemplate, LoadError> {
        load(state: state, languageCode: language.rawValue, bundle: .main)
    }

    /// Test seam.
    static func load(state: String, languageCode: String, bundle: Bundle) -> Result<AppealTemplate, LoadError> {
        let normalized = state.uppercased()
        let resource = "\(normalized).\(languageCode)"
        guard let url = bundle.url(
            forResource: resource,
            withExtension: "json",
            subdirectory: "AppealTemplates"
        ) ?? bundle.url(forResource: resource, withExtension: "json") else {
            return .failure(.fileNotFound(state: normalized, language: languageCode))
        }
        do {
            let data = try Data(contentsOf: url)
            let template = try JSONDecoder().decode(AppealTemplate.self, from: data)
            return .success(template)
        } catch {
            return .failure(.decodeFailed(
                state: normalized,
                language: languageCode,
                underlying: String(describing: error)
            ))
        }
    }

    /// Direct decode for unit tests — bypasses the bundle.
    static func decode(_ data: Data) throws -> AppealTemplate {
        try JSONDecoder().decode(AppealTemplate.self, from: data)
    }
}
