import Foundation
import SwiftUI
import OSLog

// MARK: – Content Loading

extension IssueCallCenterViewModel {

    // Supabase is the source of truth for premade scripts.
    func fetchPublishedPremadeScripts() async throws -> [RemotePremadeScript] {
        try? await supabaseManager.signInAnonymouslyIfNeeded()

        #if canImport(Supabase)
        let response = try await SupabaseClientProvider.shared.client
            .from("civic_example_templates")
            .select("""
                slug,
                title,
                category,
                issue_area,
                summary,
                background_summary,
                action_sentence,
                live_script,
                voicemail_script,
                vehicle_label,
                status,
                display_order,
                target_chambers,
                primary_ask,
                template_asks,
                related_bills,
                tags,
                updated_at
            """)
            .eq("status", value: "published")
            .order("display_order", ascending: true)
            .order("updated_at", ascending: false)
            .execute()

        return try JSONDecoder().decode([RemotePremadeScript].self, from: response.data)
        #else
        struct SupabaseUnavailableError: LocalizedError {
            var errorDescription: String? { "Supabase SDK is unavailable." }
        }
        throw SupabaseUnavailableError()
        #endif
    }

    func loadPremadeScripts() async -> (scripts: [RemotePremadeScript], failed: Bool) {
        do {
            return (try await fetchPublishedPremadeScripts(), false)
        } catch {
            logger.error("Failed loading published premade scripts: \(String(describing: error), privacy: .public)")
            return ([], true)
        }
    }

    func loadExamplesAndHistory() async {
        isInitialContentLoading = true
        initialContentErrorMessage = nil
        isInitialContentEmpty = false
        defer {
            isInitialContentLoading = false
            hasLoadedInitialContent = true
        }

        let userID = await userIDForRequest()
        let remotePremadeScriptsResult = await loadPremadeScripts()
        let mappedRemoteExamples = mapRemoteScriptsToExampleCards(remotePremadeScriptsResult.scripts)
        examples = mappedRemoteExamples

        var didFailHistoryLoad = false

        do {
            historyGroups = try await apiClient.fetchHistory(userID: userID)
            saveSnapshot()
        } catch {
            didFailHistoryLoad = true
        }

        await refreshCallScoreData(for: userID)

        let hasContent = !examples.isEmpty || !historyGroups.isEmpty || !callBriefs.isEmpty
        if !hasContent {
            if remotePremadeScriptsResult.failed || didFailHistoryLoad {
                initialContentErrorMessage = "We couldn't load your call data right now. Please try again."
            } else {
                isInitialContentEmpty = true
            }
        }
    }

    func loadExamplesAndHistoryIfNeeded(force: Bool = false) async {
        guard force || !hasLoadedExamplesAndHistoryThisSession else { return }
        hasLoadedExamplesAndHistoryThisSession = true
        await loadExamplesAndHistory()
    }

    func mapRemoteScriptsToExampleCards(
        _ scripts: [RemotePremadeScript]
    ) -> [CivicExampleIssueCard] {
        let availableChambers = availablePremadeTargetChambers()
        let placeholders = [
            "[YOUR_NAME]",
            "[CITY]",
            "[ZIP]",
            "[OFFICIAL_TITLE]",
            "[OFFICIAL_LAST]",
            "[BILL_OR_RESOLUTION]"
        ]
        let availableChamberSet = Set(availableChambers)

        let cards = scripts.compactMap { script -> CivicExampleIssueCard? in
            guard let key = normalizedPremadeKey(script.slug) else { return nil }

            let title = normalizedNonEmpty(script.title)
                ?? key.replacingOccurrences(of: "-", with: " ").capitalized
            let actionSentence = normalizedSentence(script.actionSentence)
            let summary = normalizedNonEmpty(script.backgroundSummary)
                ?? normalizedNonEmpty(script.summary)
                ?? actionSentence
                ?? "Call your representatives about this issue."
            let rawLiveScript = normalizedNonEmpty(script.liveScript)
                ?? generatedFallbackScript(title: title, actionSentence: actionSentence, isVoicemail: false)
            let rawVoicemailScript = normalizedNonEmpty(script.voicemailScript)
                ?? generatedFallbackScript(title: title, actionSentence: actionSentence, isVoicemail: true)
            let liveScript = normalizedPremadeScriptWithCanonicalIntro(rawLiveScript, isVoicemail: false)
            let voicemailScript = normalizedPremadeScriptWithCanonicalIntro(rawVoicemailScript, isVoicemail: true)
            var targetChambers = (script.targetChambers ?? [])
                .compactMap { normalizedNonEmpty($0)?.lowercased() }
            if targetChambers.isEmpty {
                targetChambers = availableChambers
            }

            let chamberIntersection = Set(targetChambers).intersection(availableChamberSet)
            guard !chamberIntersection.isEmpty else { return nil }

            let askFromPrimary = civicAsk(from: script.primaryAsk)
            let templateAsks = (script.templateAsks ?? []).compactMap { civicAsk(from: $0.ask) }
            let resolvedTemplateAsks = templateAsks.isEmpty
                ? (askFromPrimary.map { [$0] } ?? [.support])
                : templateAsks
            let relatedBills = (script.relatedBills ?? []).compactMap { bill in
                normalizedNonEmpty(bill.displayText)
            }
            let vehicleLabel = normalizedNonEmpty(script.vehicleLabel)
                ?? relatedBills.first.flatMap { normalizedBillReference($0) }
            let tags = (script.tags ?? []).compactMap { normalizedNonEmpty($0) }

            return CivicExampleIssueCard(
                id: key,
                slug: key,
                title: title,
                category: normalizedNonEmpty(script.issueArea)
                    ?? normalizedNonEmpty(script.category)
                    ?? "Issue",
                targetChambers: targetChambers,
                primaryAsk: normalizedNonEmpty(script.primaryAsk) ?? askFromPrimary?.rawValue,
                summary: summary,
                vehicleLabel: vehicleLabel,
                actionSentence: actionSentence,
                relatedBills: relatedBills,
                repRelevance: repRelevanceLines(for: targetChambers),
                templateAsks: resolvedTemplateAsks,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                supporterVariant: nil,
                undecidedVariant: nil,
                stafferVariant: nil,
                voicemailFooter: nil,
                placeholders: placeholders,
                tags: tags,
                updatedAt: parseRemotePremadeTimestamp(script.updatedAt)
            )
        }

        return cards
    }

    func normalizedPremadeKey(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed.lowercased()
    }

    func availablePremadeTargetChambers() -> [String] {
        var chambers: [String] = []
        if repTargets.contains(where: { $0.slot == .house }) {
            chambers.append("house")
        }
        if repTargets.contains(where: { $0.slot == .senate1 || $0.slot == .senate2 }) {
            chambers.append("senate")
        }
        return chambers.isEmpty ? ["house", "senate"] : chambers
    }

    func repRelevanceLines(for targetChambers: [String]) -> [String] {
        var lines: [String] = []
        let chamberSet = Set(targetChambers)
        if chamberSet == Set(["senate"]) {
            lines.append("This issue is currently targeted to the Senate.")
        } else if chamberSet == Set(["house"]) {
            lines.append("This issue is currently targeted to the House.")
        } else {
            lines.append("This issue can be raised with both House and Senate offices.")
        }

        lines += repTargets
            .filter { target in
                if targetChambers.contains("house"), target.slot == .house { return true }
                if targetChambers.contains("senate"), target.slot == .senate1 || target.slot == .senate2 { return true }
                return false
            }
            .prefix(3)
            .map { "\($0.official.name) serves in \($0.officeType)." }

        return lines
    }

    func civicAsk(from rawAsk: String?) -> CivicAsk? {
        guard let normalized = normalizedNonEmpty(rawAsk)?.lowercased() else { return nil }
        switch normalized {
        case "support": return .support
        case "oppose": return .oppose
        case "cosponsor": return .cosponsor
        case "vote_yes", "vote-yes", "vote yes": return .voteYes
        case "vote_no", "vote-no", "vote no": return .voteNo
        case "seek_oversight", "seek-oversight", "seek oversight": return .seekOversight
        case "ask_public_statement", "ask-public-statement", "ask public statement": return .askPublicStatement
        case "ask_amendment", "ask-amendment", "ask amendment": return .askAmendment
        default:
            return CivicAsk(rawValue: normalized)
        }
    }

    func generatedFallbackScript(title: String, actionSentence: String?, isVoicemail: Bool) -> String {
        let actionLine = actionSentence ?? "take clear public action on this issue."
        if isVoicemail {
            return "Hi, this is [YOUR_NAME] from [CITY], [ZIP].\n\nI'm calling about \(title).\n\nPlease ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to \(actionLine)\n\nThank you."
        }
        return "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP].\n\nI'm calling about \(title).\n\nPlease ask [OFFICIAL_TITLE] [OFFICIAL_LAST] to \(actionLine)\n\nThank you for your time and consideration."
    }

    func normalizedPremadeScriptWithCanonicalIntro(_ script: String, isVoicemail: Bool) -> String {
        let intro = isVoicemail
            ? "Hi, this is [YOUR_NAME], a constituent from [CITY], [ZIP]."
            : "Hi, my name is [YOUR_NAME] and I'm a constituent from [CITY], [ZIP]."

        let body = strippedLeadingPremadeIntroSentences(from: script)
        guard !body.isEmpty else { return intro }
        return "\(intro)\n\n\(body)"
    }

    func strippedLeadingPremadeIntroSentences(from script: String) -> String {
        let introPattern = #"^\s*(?:hi|hello)[^.!?]{0,220}\b(?:my\s+name\s+is|this\s+is)\b[^.!?]*(?:\[(?:your_name|your name)\]|\bconstituent\b|\[(?:city|zip|your city/state)\])[^.!?]*[.!?]\s*"#
        var remaining = script
            .replacingOccurrences(of: "\r\n", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        for _ in 0..<4 {
            let updated = remaining.replacingOccurrences(
                of: introPattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
            if updated == remaining { break }
            remaining = updated.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return remaining
    }

    func normalizedSentence(_ value: String?) -> String? {
        guard let value = normalizedNonEmpty(value) else { return nil }
        if value.hasSuffix(".") || value.hasSuffix("!") || value.hasSuffix("?") { return value }
        return "\(value)."
    }

    func normalizedNonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }

    func parseRemotePremadeTimestamp(_ value: String?) -> Date? {
        guard let value = normalizedNonEmpty(value) else { return nil }
        return Self.iso8601WithFractional.date(from: value) ?? Self.iso8601Basic.date(from: value)
    }

    static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601Basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
