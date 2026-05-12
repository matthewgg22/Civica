import Foundation

// EXPERIMENTAL SILOED MODULE:
// Loads bundled InterviewQuestions_*.json files at init time and serves them
// to UI with lexical filtering. No vector retrieval, no BM25 — flat in-memory
// scan. Defer SQLite + sqlite-vec until the corpus crosses ~500 questions
// and lexical filtering measurably misses.
@MainActor
final class InterviewQuestionBank: ObservableObject {
    @Published private(set) var allQuestions: [InterviewQuestion] = []
    @Published private(set) var loadError: String?

    init(bundle: Bundle = .main) {
        load(from: bundle)
    }

    func questions(forState stateCode: String,
                   scenario: InterviewScenario? = nil,
                   category: QuestionCategory? = nil,
                   archetype: ApplicantArchetype? = nil) -> [InterviewQuestion] {
        allQuestions.filter { question in
            guard question.stateCode.caseInsensitiveCompare(stateCode) == .orderedSame else { return false }
            if let scenario, question.scenario != scenario { return false }
            if let category, question.category != category { return false }
            if let archetype {
                // archetype_tags acts as an inclusion list; an empty list means
                // the question applies to every archetype.
                if !question.archetypeTags.isEmpty && !question.archetypeTags.contains(archetype) {
                    return false
                }
            }
            return true
        }
    }

    var supportedStateCodes: Set<String> {
        Set(allQuestions.map(\.stateCode))
    }

    private func load(from bundle: Bundle) {
        let resourceNames = ["InterviewQuestions_MA"]
        var merged: [InterviewQuestion] = []
        let decoder = JSONDecoder()

        for name in resourceNames {
            guard let url = bundle.url(forResource: name, withExtension: "json") else {
                loadError = "Missing bundled resource: \(name).json"
                continue
            }
            do {
                let data = try Data(contentsOf: url)
                let batch = try decoder.decode([InterviewQuestion].self, from: data)
                merged.append(contentsOf: batch)
            } catch {
                loadError = "Failed to decode \(name).json: \(error.localizedDescription)"
            }
        }

        allQuestions = merged
    }
}
