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

// MARK: - Bilingual labels
//
// `label` stays as the English fallback (CaseIterable previews + dev
// tooling still rely on it). Spanish renders are surfaced through
// `localizedLabel(in:)`. Domain terms here are closed-set and simple
// enough to translate safely; the open-ended question prompts and
// guidance copy in InterviewQuestions_*.json are not, which is why
// they stay English-only until a native reviewer signs off.

extension QuestionCategory {
    func localizedLabel(in language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return label
        case .spanish:
            switch self {
            case .income: return "Ingresos"
            case .household: return "Hogar"
            case .expenses: return "Gastos"
            case .workRequirements: return "Requisitos laborales"
            case .immigration: return "Estatus migratorio"
            case .identity: return "Identidad y documentos"
            }
        }
    }
}

extension InterviewScenario {
    func localizedLabel(in language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return label
        case .spanish:
            switch self {
            case .initial: return "Solicitud inicial"
            case .recertification: return "Recertificación"
            case .expedited: return "Trámite urgente"
            case .changeReporting: return "Reporte de cambios"
            }
        }
    }
}

extension ApplicantArchetype {
    func localizedLabel(in language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return label
        case .spanish:
            switch self {
            case .student: return "Estudiante"
            case .gigWorker: return "Trabajo eventual / ingreso variable"
            case .mixedStatus: return "Hogar de estatus mixto"
            case .unhoused: return "Sin vivienda / vivienda inestable"
            case .senior: return "Adulto mayor (60+)"
            }
        }
    }
}

extension CaseworkerArchetype {
    func localizedLabel(in language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return label
        case .spanish:
            switch self {
            case .friendlyRushed: return "Amistoso pero apurado"
            case .formal: return "Formal / procedimental"
            case .skeptical: return "Escéptico"
            case .languageMismatched: return "Idioma diferente"
            case .adversarial: return "Hostil (sondeo de fraude)"
            }
        }
    }
}
