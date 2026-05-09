import Foundation
import SwiftUI
import OSLog

// MARK: – Representative Helpers, Brief Normalization & Utilities

extension IssueCallCenterViewModel {

    static func buildRepTargets(from federalReps: [Official]) -> [CivicRepTarget] {
        let senators = federalReps
            .filter { official in
                let title = (official.officeTitle ?? "").lowercased()
                if title.contains("senator") { return true }
                let division = (official.divisionId ?? "").lowercased()
                return division.contains("/state:") && !division.contains("/cd:")
            }
            .sorted { lhs, rhs in
                let lhsRank = senateClassRank(for: lhs)
                let rhsRank = senateClassRank(for: rhs)
                if lhsRank != rhsRank {
                    return lhsRank < rhsRank
                }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
        var seenSenatorNameKeys = Set<String>()
        let uniqueSenators = senators.filter { senator in
            let nameKey = Self.normalizeNameKey(senator.name)
            guard !nameKey.isEmpty else { return true }
            return seenSenatorNameKeys.insert(nameKey).inserted
        }

        let house = federalReps.first {
            let title = ($0.officeTitle ?? "").lowercased()
            if title.contains("representative") || title.contains("congress") { return true }
            let division = ($0.divisionId ?? "").lowercased()
            if division.contains("/cd:") { return true }
            return false
        }

        var targets: [CivicRepTarget] = []
        if let house {
            targets.append(CivicRepTarget(slot: .house, official: house))
        }
        if uniqueSenators.indices.contains(0) {
            targets.append(CivicRepTarget(slot: .senate1, official: uniqueSenators[0]))
        }
        if uniqueSenators.indices.contains(1) {
            targets.append(CivicRepTarget(slot: .senate2, official: uniqueSenators[1]))
        }

        if targets.isEmpty {
            for (index, rep) in federalReps.prefix(3).enumerated() {
                let slot: CivicRepSlot = index == 0 ? .house : (index == 1 ? .senate1 : .senate2)
                targets.append(CivicRepTarget(slot: slot, official: rep))
            }
        }

        return targets
    }

    static func senateClassRank(for official: Official) -> Int {
        let upper = (official.officeTitle ?? "")
            .uppercased()
            .replacingOccurrences(of: "CLASS", with: " ")
        let token = upper
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .first(where: { !$0.isEmpty && ($0 == "I" || $0 == "II" || $0 == "III" || $0 == "1" || $0 == "2" || $0 == "3") })

        switch token {
        case "I", "1":
            return 1
        case "II", "2":
            return 2
        case "III", "3":
            return 3
        default:
            return 99
        }
    }

    func normalizedBriefs(
        _ briefs: [CivicCallBrief],
        fallbackIssueID: String,
        regenerateIDs: Bool = false
    ) -> [CivicCallBrief] {
        var seenIDs = Set<String>()
        var normalized: [(index: Int, brief: CivicCallBrief)] = []

        for (index, brief) in briefs.enumerated() {
            let baseID: String
            if regenerateIDs {
                baseID = UUID().uuidString
            } else {
                let trimmedID = brief.id.trimmingCharacters(in: .whitespacesAndNewlines)
                baseID = trimmedID.isEmpty ? UUID().uuidString : trimmedID
            }
            let uniqueID = seenIDs.insert(baseID).inserted ? baseID : "\(baseID)-\(index)"

            let nameKey = Self.normalizeNameKey(brief.repName)
            let resolvedSlot = brief.repSlot ?? slotByRepID[brief.repID] ?? slotByName[nameKey]
            let resolvedIssueID = resolvedIssueIdentifier(
                preferredIssueID: brief.issueID,
                issueTitle: issueTitle,
                issueSummary: issueSummary,
                fallbackIssueID: fallbackIssueID
            )

            let normalizedBrief = CivicCallBrief(
                id: uniqueID,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: brief.relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: brief.liveScript,
                voicemailScript: brief.voicemailScript,
                talkingPoints: brief.talkingPoints,
                issueID: resolvedIssueID,
                repSlot: resolvedSlot
            )

            normalized.append((index, normalizedBrief))
        }

        let defaultOrder: [CivicRepSlot: Int] = [
            .house: 0,
            .senate1: 1,
            .senate2: 2
        ]

        return normalized
            .sorted { lhs, rhs in
                let lRank = lhs.brief.repSlot.flatMap { defaultOrder[$0] } ?? 99
                let rRank = rhs.brief.repSlot.flatMap { defaultOrder[$0] } ?? 99
                if lRank != rRank {
                    return lRank < rRank
                }
                return lhs.index < rhs.index
            }
            .map(\.brief)
    }

    func resolvedIssueIdentifier(
        preferredIssueID: String?,
        issueTitle: String,
        issueSummary: String,
        fallbackIssueID: String? = nil
    ) -> String {
        let preferred = preferredIssueID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !preferred.isEmpty {
            return preferred
        }

        if let fallbackIssueID {
            let normalizedFallback = fallbackIssueID.trimmingCharacters(in: .whitespacesAndNewlines)
            if !normalizedFallback.isEmpty {
                return normalizedFallback
            }
        }

        if let slug = slugifiedIssueIdentifier(from: issueTitle) {
            return slug
        }
        if let slug = slugifiedIssueIdentifier(from: issueSummary) {
            return slug
        }

        return UUID().uuidString
    }

    func slugifiedIssueIdentifier(from raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let lowercased = trimmed.lowercased()
        let slug = lowercased
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))

        guard !slug.isEmpty else { return nil }
        return String(slug.prefix(80))
    }

    static func normalizeNameKey(_ raw: String) -> String {
        raw
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    // MARK: – Error Classification & Utilities

    func isSafetyBlockedError(_ error: Error) -> Bool {
        let lower = (error as NSError).localizedDescription.lowercased()
        return lower.contains("safety_blocked")
            || (lower.contains("disallowed") && lower.contains("safety"))
            || (lower.contains("harmful") && lower.contains("request"))
    }

    func resolveFailureMessage(for error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        let lower = raw.lowercased()

        if lower.contains("unexpected script payload")
            || lower.contains("decode")
            || lower.contains("invalid response format") {
            return "The civic API responded, but in an unexpected format. Using a safe local draft for now."
        }
        if lower.contains("requested path is invalid")
            || lower.contains("status 404")
            || lower.contains("badurl") {
            return "Civic API is not configured yet. Set CIVIC_API_BASE_URL to your deployed civic backend. Using offline call briefs for now."
        }
        if lower.contains("timed out") || lower.contains("timeout") {
            return "The civic API took too long to respond. Using offline call briefs for now."
        }
        if lower.contains("authentication required")
            || lower.contains("invalid or expired token")
            || lower.contains("status 401")
            || lower.contains("status 403") {
            return "Session expired. Please reopen Civica and try generating again."
        }

        return "Using offline call briefs while the civic API is unavailable."
    }

    func compactLogError(_ error: Error) -> String {
        let nsError = error as NSError
        return "\(nsError.domain)#\(nsError.code)"
    }

    func userIDForRequest() async -> String {
        if let id = await SupabaseManager.shared.currentUserIDIfAvailable() {
            return id.uuidString
        }
        return UUID().uuidString
    }

    // MARK: – Initialization Helpers

    enum RepSubmissionContextError: Error {
        case unresolvedTargets
    }

    func resolvedRepSubmissionContext() async throws -> (slots: [CivicRepSlot], targets: [CivicRepTarget]) {
        let immediateSlots = requestRepSlots
        if !immediateSlots.isEmpty {
            return (immediateSlots, repTargets)
        }

        try? await Task.sleep(nanoseconds: 3_000_000_000)

        let delayedSlots = requestRepSlots
        if !delayedSlots.isEmpty {
            return (delayedSlots, repTargets)
        }

        logger.notice("MAPC submission blocked after 3-second rep target wait because no representative targets are resolved.")
        throw RepSubmissionContextError.unresolvedTargets
    }
}
