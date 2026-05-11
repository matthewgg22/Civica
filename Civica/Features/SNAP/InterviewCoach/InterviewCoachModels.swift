import Foundation

// EXPERIMENTAL SILOED MODULE: SNAP Interview Coach domain models.
// All values in this file are session-only and bundled-resource-derived.
// No persistence to disk, network, or analytics without explicit review.

enum QuestionCategory: String, Codable, CaseIterable, Identifiable {
    case income
    case household
    case expenses
    case workRequirements = "work_requirements"
    case immigration
    case identity

    var id: String { rawValue }

    var label: String {
        switch self {
        case .income: return "Income"
        case .household: return "Household"
        case .expenses: return "Expenses"
        case .workRequirements: return "Work requirements"
        case .immigration: return "Immigration status"
        case .identity: return "Identity & documents"
        }
    }
}

enum InterviewScenario: String, Codable, CaseIterable, Identifiable {
    case initial
    case recertification
    case expedited
    case changeReporting = "change_reporting"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .initial: return "Initial application"
        case .recertification: return "Recertification"
        case .expedited: return "Expedited (urgent)"
        case .changeReporting: return "Change reporting"
        }
    }
}

enum ApplicantArchetype: String, Codable, CaseIterable, Identifiable {
    case student
    case gigWorker = "gig_worker"
    case mixedStatus = "mixed_status"
    case unhoused
    case senior

    var id: String { rawValue }

    var label: String {
        switch self {
        case .student: return "Student"
        case .gigWorker: return "Gig / variable income"
        case .mixedStatus: return "Mixed-status household"
        case .unhoused: return "Unhoused / unstable housing"
        case .senior: return "Senior (60+)"
        }
    }
}

// Phase 2 will populate .friendlyRushed. Later phases add the rest.
// Listed here so the JSON schema and pickers don't need to change later.
enum CaseworkerArchetype: String, Codable, CaseIterable, Identifiable {
    case friendlyRushed = "friendly_rushed"
    case formal
    case skeptical
    case languageMismatched = "language_mismatched"
    case adversarial

    var id: String { rawValue }

    var label: String {
        switch self {
        case .friendlyRushed: return "Friendly but rushed"
        case .formal: return "Formal / procedural"
        case .skeptical: return "Skeptical"
        case .languageMismatched: return "Language mismatch"
        case .adversarial: return "Adversarial (fraud probe)"
        }
    }

    var isImplemented: Bool {
        switch self {
        case .friendlyRushed: return true
        case .formal, .skeptical, .languageMismatched, .adversarial: return false
        }
    }
}

struct InterviewQuestion: Codable, Identifiable, Hashable {
    let id: String
    let stateCode: String
    let scenario: InterviewScenario
    let category: QuestionCategory
    let archetypeTags: [ApplicantArchetype]
    let prompt: String
    let guidance: String

    enum CodingKeys: String, CodingKey {
        case id
        case stateCode = "state_code"
        case scenario
        case category
        case archetypeTags = "archetype_tags"
        case prompt
        case guidance
    }
}
