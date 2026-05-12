import Foundation

// State-keyed document staleness rules. Loaded from
// Fixtures/document-rules.json at bundle time — no remote fetch.
// Adding a state means dropping a JSON entry plus a small policy
// review (see NOTES.md "State coverage" TODOs); no code change needed.

// MARK: - Wire shapes

struct DocumentExpirationRulesFile: Decodable {
    let schemaVersion: Int
    let notes: String?
    let states: [String: StateRules]

    struct StateRules: Decodable {
        let documents: [String: DocumentRule]
    }

    struct DocumentRule: Decodable {
        let maxAgeDaysAtRecert: Int
        /// Optional cadence hint. Today only "biweekly" / "monthly"
        /// are interpreted; everything else is treated as one-shot.
        let frequency: String?
    }
}

// MARK: - Runtime API

enum DocumentExpirationRules {
    /// Unique identifier of the bundled fixture, for diagnostics.
    static let fixtureName = "document-rules"
    static let fixtureExtension = "json"

    /// Memoized in-memory cache. The file is small and unchanging at
    /// runtime so we load it once per process.
    private static let cached: DocumentExpirationRulesFile? = loadBundledFile()

    /// Per-document rule lookup. Returns nil for any state/document
    /// pair not configured in the fixture — the predictor treats nil
    /// as "no advice" rather than guessing.
    static func rule(state: String, document: SNAPDocumentType) -> DocumentExpirationRulesFile.DocumentRule? {
        guard let cached else { return nil }
        let normalizedState = state.uppercased()
        return cached.states[normalizedState]?.documents[document.rawValue]
    }

    /// Every document type configured for a state. Empty when the
    /// state isn't in the fixture.
    static func documentsConfigured(for state: String) -> [SNAPDocumentType] {
        guard let cached else { return [] }
        let normalizedState = state.uppercased()
        let configured = cached.states[normalizedState]?.documents ?? [:]
        return SNAPDocumentType.allCases.filter { configured[$0.rawValue] != nil }
    }

    /// True when the fixture contains any rules for `state`.
    static func isStateConfigured(_ state: String) -> Bool {
        guard let cached else { return false }
        return cached.states[state.uppercased()] != nil
    }

    // MARK: - Bundle loading

    private static func loadBundledFile() -> DocumentExpirationRulesFile? {
        guard let url = Bundle.main.url(forResource: fixtureName, withExtension: fixtureExtension) else {
            // TODO(states): when other states are added, double-check
            // the JSON resource is included in the Copy Bundle
            // Resources build phase of the Civica target.
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(DocumentExpirationRulesFile.self, from: data)
        } catch {
            assertionFailure("Failed to decode document-rules.json: \(error)")
            return nil
        }
    }

    /// Test seam — lets unit tests load a custom rules file without
    /// going through the bundle.
    static func decode(from data: Data) throws -> DocumentExpirationRulesFile {
        try JSONDecoder().decode(DocumentExpirationRulesFile.self, from: data)
    }
}
