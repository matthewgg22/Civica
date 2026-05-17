// PacketStatus.swift — GENERATED stub. Keep in sync with
// packages/snap-enums/src/packetStatus.ts and the Postgres `packet_status` enum.
// See Civica/Features/SNAP/ for production Swift usage.

import Foundation

public enum PacketStatus: String, CaseIterable, Codable, Sendable {
    case draft                    = "Draft"
    case submittedForReview       = "Submitted for Review"
    case needsDocuments           = "Needs Documents"
    case needsApplicantClarification = "Needs Applicant Clarification"
    case inNavigatorReview        = "In Navigator Review"
    case readyForHandoff          = "Ready for Handoff"
    case handedOff                = "Handed Off"
    case closed                   = "Closed"

    /// Returns the valid forward transitions from this status.
    public var allowedTransitions: [PacketStatus] {
        switch self {
        case .draft:
            return [.submittedForReview]
        case .submittedForReview:
            return [.inNavigatorReview, .needsDocuments, .needsApplicantClarification]
        case .needsDocuments:
            return [.inNavigatorReview, .needsApplicantClarification]
        case .needsApplicantClarification:
            return [.inNavigatorReview, .needsDocuments]
        case .inNavigatorReview:
            return [.readyForHandoff, .needsDocuments, .needsApplicantClarification]
        case .readyForHandoff:
            return [.handedOff]
        case .handedOff:
            return [.closed]
        case .closed:
            return []
        }
    }

    public var isTerminal: Bool { self == .closed }
    public var isApplicantVisible: Bool { self != .inNavigatorReview && self != .readyForHandoff }
}
