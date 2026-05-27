import Foundation

// DTOs for the re-entry pipeline.
//
// Wire format mirrors the enrollment-api routes:
//   GET  /me/re-entry-suggestion        → ReEntrySuggestionResponse
//   POST /me/re-enroll-from/:packet_id  → ReEnrollResponse
//
// Server-side definitions live at:
//   apps/enrollment-api/src/routes/me.ts

struct ReEntrySuggestionResponse: Decodable, Sendable, Equatable {
    let candidate: Bool
    let days_since_close: Int?
    let prior_packet: PriorPacket?

    struct PriorPacket: Decodable, Sendable, Equatable {
        let packet_id: String
        let state_code: String
        let county: String?
        let county_fips: String?
        let closed_at: String
    }
}

// Retention-risk scoring result. Mirrors the gateway response from
// GET /me/packets/:packetId/retention-risk (Unrath retention pillar, G1).
// Surfaced here so the same API client + plumbing can serve both
// re-entry suggestions (G2) and the active-packet retention badge (G4).
struct RetentionRiskResult: Decodable, Sendable, Equatable {
    let tier: String  // "high" | "medium" | "low" | "no-reporting-window"
    let score: Int?
    let would_be_type_1_error_if_exits: Bool
    let top_signals: [String]
    let engine_version: String
}

struct ReEnrollResponse: Decodable, Sendable, Equatable {
    let packet: Packet
    let hydrated: HydratedCounts
    let idempotent: Bool

    struct Packet: Decodable, Sendable, Equatable {
        let packet_id: String
        let status: String
        let state_code: String
        let created_at: String
        let updated_at: String
    }

    struct HydratedCounts: Decodable, Sendable, Equatable {
        let answers: Int
    }
}
