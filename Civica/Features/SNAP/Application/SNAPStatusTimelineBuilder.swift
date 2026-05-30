import Foundation

// Projection from SNAPApplicationStatus + milestone timestamps into
// the [CivicaStatusTimeline.Step] array that the timeline view
// consumes. Lives in its own file because the mapping is large
// (one timeline per status), grows over time, and is the most-likely
// place to need EN/ES copy tweaks per HANDOFF brand voice doc.

enum SNAPStatusTimelineBuilder {

    /// The canonical SNAP application timeline. 6 steps total —
    /// screener, packet, submit, state ack, interview, decision.
    /// Each step's state is derived from the current overall status:
    /// anything before the current is `.complete`, the current is
    /// either `.current` or `.blocked` depending on whether the user
    /// has to act, and anything after is `.future`.
    static func steps(
        for status: SNAPApplicationStatus,
        milestones: [SNAPApplicationStatus: Date],
        language: CivicaLanguage,
        stateCode: String? = nil
    ) -> [CivicaStatusTimeline.Step] {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en_US")

        func stamp(for milestone: SNAPApplicationStatus) -> String? {
            guard let date = milestones[milestone] else { return nil }
            return formatter.string(from: date)
        }

        return [
            .init(
                id: "screener",
                title: SNAPStatusHomeStrings.stepScreener.value(in: language),
                state: stateFor(step: .screenerComplete, current: status),
                timestamp: stamp(for: .screenerComplete)
            ),
            .init(
                id: "packet",
                title: SNAPStatusHomeStrings.stepPacket.value(in: language),
                state: stateFor(step: .packetGenerated, current: status),
                timestamp: stamp(for: .packetGenerated)
            ),
            .init(
                id: "submit",
                title: SNAPStatusHomeStrings.stepSubmit(stateCode: stateCode, language: language),
                detail: submitDetail(for: status, language: language, stateCode: stateCode),
                state: submitState(for: status),
                timestamp: stamp(for: .submittedToState)
            ),
            .init(
                id: "state_received",
                title: SNAPStatusHomeStrings.stepStateAcknowledged.value(in: language),
                state: stateFor(step: .submittedToState, current: status),
                timestamp: stamp(for: .submittedToState)
            ),
            .init(
                id: "interview",
                title: SNAPStatusHomeStrings.stepInterview.value(in: language),
                state: stateFor(step: .interviewScheduled, current: status),
                timestamp: stamp(for: .interviewScheduled)
            ),
            .init(
                id: "decision",
                title: SNAPStatusHomeStrings.stepDecision.value(in: language),
                state: decisionState(for: status),
                timestamp: stamp(for: .decisionApproved) ?? stamp(for: .decisionDenied)
            ),
        ]
    }

    // MARK: - Internal step-state mapping

    /// Compares the abstract milestone for a row to the user's current
    /// status. Maps to complete / current / future.
    private static func stateFor(
        step: SNAPApplicationStatus,
        current: SNAPApplicationStatus
    ) -> CivicaStatusTimeline.Step.State {
        let stepOrder = order(of: step)
        let currentOrder = order(of: current)
        if currentOrder > stepOrder { return .complete }
        if currentOrder == stepOrder { return .current }
        return .future
    }

    /// Submit row needs the `.blocked` treatment when the packet has
    /// been generated but the user hasn't yet self-reported submitting.
    private static func submitState(for current: SNAPApplicationStatus) -> CivicaStatusTimeline.Step.State {
        switch current {
        case .packetGenerated:
            return .blocked
        case .submittedToState, .documentsRequested, .interviewScheduled,
             .interviewCompleted, .decisionApproved, .decisionDenied, .recertDue:
            return .complete
        default:
            return .future
        }
    }

    private static func submitDetail(
        for current: SNAPApplicationStatus,
        language: CivicaLanguage,
        stateCode: String?
    ) -> String? {
        guard current == .packetGenerated else { return nil }
        // State-conditioned: pull the apply-portal host from the single
        // source (SNAPAgencyDirectory) instead of hardcoding MA's
        // dtaconnect.eohhs.mass.gov — which was wrong for CA applicants.
        let host = SNAPAgencyDirectory.portalShortURL(for: stateCode)
        let target = host.isEmpty ? nil : host
        switch language {
        case .english:
            return target.map { "Open \($0) to file." } ?? "Open your state SNAP portal to file."
        case .spanish:
            return target.map { "Abre \($0) para presentar." } ?? "Abre el portal de SNAP de tu estado para presentar."
        }
    }

    private static func decisionState(for current: SNAPApplicationStatus) -> CivicaStatusTimeline.Step.State {
        switch current {
        case .decisionApproved, .decisionDenied: return .complete
        case .interviewCompleted: return .current
        default: return .future
        }
    }

    /// Linear ordering for status comparisons. Recertification is
    /// excluded (it's a cycle restart, not part of the initial timeline).
    private static func order(of status: SNAPApplicationStatus) -> Int {
        switch status {
        case .notStarted:           return 0
        case .screenerInProgress:   return 1
        case .screenerComplete:     return 2
        case .packetGenerated:      return 3
        case .submittedToState:     return 4
        case .documentsRequested:   return 5
        case .interviewScheduled:   return 6
        case .interviewCompleted:   return 7
        case .decisionApproved,
             .decisionDenied:       return 8
        case .recertDue:            return 9
        }
    }
}
