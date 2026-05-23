import Foundation

// Models for the applicant-facing work-hours logging endpoints.
// POST /v1/enrollment/me/work-requirements/:packetId/hours
// GET  /v1/enrollment/me/work-requirements/:packetId/hours?month=YYYY-MM
// DELETE /v1/enrollment/me/work-requirements/:packetId/hours/:logId

// MARK: - Activity type

enum WorkActivityType: String, CaseIterable, Codable, Identifiable {
    case work
    case training
    case volunteering
    case job_search

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .work: return "Work"
        case .training: return "Job Training"
        case .volunteering: return "Volunteering"
        case .job_search: return "Job Search"
        }
    }

    var displayLabelES: String {
        switch self {
        case .work: return "Trabajo"
        case .training: return "Capacitación laboral"
        case .volunteering: return "Voluntariado"
        case .job_search: return "Búsqueda de empleo"
        }
    }
}

// MARK: - Request

struct LogWorkHoursRequest: Encodable {
    let work_date: String   // "YYYY-MM-DD"
    let hours: Double
    let activity_type: String
    let employer_name: String?
    let document_id: String?
    let notes: String?
}

// MARK: - Response models

struct WorkHourLogEntry: Decodable, Identifiable {
    let log_id: String
    let work_date: String
    let hours: Double
    let activity_type: String
    let employer_name: String?
    let document_id: String?
    let notes: String?
    let logged_at: String

    var id: String { log_id }

    var activityType: WorkActivityType {
        WorkActivityType(rawValue: activity_type) ?? .work
    }

    var workDateParsed: Date? {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: work_date)
    }
}

struct WorkHoursMonthlySummary: Decodable {
    let month: String
    let total_hours: Double
    let target_hours: Double
    let entries_count: Int
    let has_documentation: Bool
    let is_on_track: Bool
    let is_complete: Bool

    var progressFraction: Double {
        guard target_hours > 0 else { return 0 }
        return min(total_hours / target_hours, 1.0)
    }

    var hoursRemaining: Double {
        max(target_hours - total_hours, 0)
    }
}

struct WorkHoursResponse: Decodable {
    let monthly_summary: WorkHoursMonthlySummary
    let entries: [WorkHourLogEntry]
}

struct LogWorkHoursResponse: Decodable {
    let entry: WorkHourLogEntry
    let monthly_summary: WorkHoursMonthlySummary
}
