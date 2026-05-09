import Foundation
import SwiftUI
import OSLog

// MARK: – Topic & Script Validation

extension IssueCallCenterViewModel {

    struct GeneratedResolutionValidationResult {
        let sanitized: CivicIssueResolutionResponse
        let shouldFallback: Bool
        let containsDisallowedMeta: Bool
        let offTopic: Bool
        let unreadableScripts: Bool
    }

    func mapcV3ValidationConcernText(
        concernText: String,
        selectedOptionLabel: String
    ) -> String {
        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard shouldUseRelaxedMAPCV3TopicValidation(concernText: trimmedConcern) else {
            return trimmedConcern
        }

        let normalizedIssue = mapcV3DisplayIssue.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedOption = selectedOptionLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = [normalizedIssue, normalizedOption, trimmedConcern].filter { !$0.isEmpty }
        if parts.isEmpty {
            return trimmedConcern
        }
        return parts.joined(separator: ". ")
    }

    func shouldUseRelaxedMAPCV3TopicValidation(concernText: String) -> Bool {
        let trimmed = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return false }
        let semanticTokens = semanticTopicTokens(in: trimmed)
        if semanticTokens.count < 2 {
            return true
        }
        return wordCount(in: trimmed) <= 3
    }

    func generatedResolutionValidation(
        _ response: CivicIssueResolutionResponse,
        concernText: String,
        ask: CivicAsk,
        optionalBillRef: String?,
        relaxedTopicValidation: Bool = false
    ) -> GeneratedResolutionValidationResult {
        let sanitized = sanitizedGeneratedResolution(response)
        let hasDisallowedMeta = containsDisallowedScriptMeta(in: sanitized)
        let offTopic = !relaxedTopicValidation
            && isLikelyOffTopic(response: sanitized, concernText: concernText, optionalBillRef: optionalBillRef)
        let unreadableScripts = !hasReadableCallScripts(
                in: sanitized,
                ask: ask,
                concernText: concernText,
                optionalBillRef: optionalBillRef,
                requireConcernTopicOverlap: !relaxedTopicValidation
            )
        return GeneratedResolutionValidationResult(
            sanitized: sanitized,
            shouldFallback: hasDisallowedMeta || offTopic || unreadableScripts,
            containsDisallowedMeta: hasDisallowedMeta,
            offTopic: offTopic,
            unreadableScripts: unreadableScripts
        )
    }

    func sanitizedGeneratedResolution(_ response: CivicIssueResolutionResponse) -> CivicIssueResolutionResponse {
        let cleanedTitle = normalizeIssueTitle(response.issueTitle)
        let cleanedSummary = normalizeScriptText(response.issueSummary, maxWords: 90)
        let cleanedBriefs = response.callBriefs.map { brief in
            let cleanedTalkingPoints = brief.talkingPoints
                .map { normalizeScriptText($0, maxWords: 28) }
                .filter { !$0.isEmpty }
            return CivicCallBrief(
                id: brief.id,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: brief.relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: normalizeScriptText(brief.liveScript, maxWords: 95),
                voicemailScript: normalizeScriptText(brief.voicemailScript, maxWords: 55),
                talkingPoints: cleanedTalkingPoints.isEmpty ? brief.talkingPoints.map { trimToWordLimit($0, maxWords: 28) } : cleanedTalkingPoints,
                issueID: brief.issueID,
                repSlot: brief.repSlot
            )
        }

        return CivicIssueResolutionResponse(
            issueID: response.issueID,
            issueTitle: cleanedTitle,
            issueSummary: cleanedSummary,
            resolvedEntities: response.resolvedEntities,
            callBriefs: cleanedBriefs
        )
    }

    func normalizeIssueTitle(_ raw: String) -> String {
        let cleaned = raw
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "```", with: "")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return "Constituent issue" }
        return trimToWordLimit(cleaned, maxWords: 12)
    }

    func normalizeScriptText(_ raw: String, maxWords: Int) -> String {
        let trimmed = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        var paragraphs: [String] = []
        var currentParagraphLines: [String] = []
        for rawLine in trimmed.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty {
                if !currentParagraphLines.isEmpty {
                    paragraphs.append(currentParagraphLines.joined(separator: " "))
                    currentParagraphLines = []
                }
                continue
            }
            let lower = line.lowercased()
            if lower.hasPrefix("assistant:")
                || lower.hasPrefix("system:")
                || lower.hasPrefix("developer:")
                || lower.hasPrefix("user:") {
                continue
            }
            let collapsedLine = line
                .replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !collapsedLine.isEmpty {
                currentParagraphLines.append(collapsedLine)
            }
        }
        if !currentParagraphLines.isEmpty {
            paragraphs.append(currentParagraphLines.joined(separator: " "))
        }

        var collapsed = paragraphs.joined(separator: "\n\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // Remove low-value boilerplate labels that make scripts feel machine-generated.
        let boilerplatePatterns = [
            #"(?i)\bcurrent status:\s*[^\n]*"#,
            #"(?i)\badditional context:\s*[^\n]*"#,
            #"(?i)\bpolicy focus:\s*[^\n]*"#,
            #"(?i)\bfocus refinement:\s*[^\n]*"#,
            #"(?i)\boffice tie-in:\s*[^\n]*"#,
            #"(?i)\blatest item:\s*[^\n]*"#,
            #"(?i)\bthis issue is typically handled in[^\n]*"#,
            #"(?i)\bno verified evidence items are available yet[^\n]*"#,
            #"(?i)\bmost recent evidence points to ongoing activity[^\n]*"#,
        ]
        for pattern in boilerplatePatterns {
            collapsed = collapsed.replacingOccurrences(
                of: pattern,
                with: "",
                options: .regularExpression
            )
        }
        collapsed = collapsed
            .replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
            .replacingOccurrences(of: " {2,}", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        collapsed = collapsed.replacingOccurrences(
            of: #"(?i)\bto\s+(support|oppose|protect|fund|expand|reject|block)\s+(?:and\s+)?\1\b"#,
            with: "to $1",
            options: .regularExpression
        )

        guard !collapsed.isEmpty else {
            return "Hi, my name is [Your Name], and I am a constituent calling about this issue."
        }

        return trimToWordLimit(collapsed, maxWords: maxWords)
    }

    func clarificationPromptForConcern(
        _ concernText: String,
        optionalBillRef: String?,
        selectedAsk: CivicAsk?
    ) -> String? {
        if let requiredPrompt = requiredMAPCFollowUpPrompt(
            concernText: concernText,
            optionalBillRef: optionalBillRef,
            selectedAsk: selectedAsk
        ) {
            return requiredPrompt
        }

        if normalizedBillReference(optionalBillRef) != nil {
            return nil
        }

        let normalizedConcern = concernText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalizedConcern.isEmpty else {
            return "Please describe the issue in one sentence and include the action you want Congress to take."
        }

        let words = normalizedConcern
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
        let wordSet = Set(words)

        let knownIssueSignals: Set<String> = [
            "crypto", "ukraine", "iran", "housing", "lihtc", "snap", "medicaid", "medicare",
            "social", "security", "immigration", "climate", "voting", "election", "reproductive",
            "labor", "workers", "health", "ai", "trans", "tps", "farm", "pell", "student"
        ]
        let policyActionSignals = [
            // baseline legislative action terms
            "bill", "act", "resolution", "vote", "support", "oppose", "funding",
            "amendment", "oversight", "confirm", "nomination",
            // committee procedure
            "markup", "mark up", "committee vote", "subcommittee vote", "report out",
            "vote out of committee", "refer to committee", "referred to committee", "send to committee",
            "discharge", "discharge petition",
            // floor procedure
            "floor vote", "vote on the floor", "bring to the floor", "take to the floor", "calendar", "put on the calendar",
            "unanimous consent", "uc", "filibuster", "cloture", "suspend the rules", "suspension",
            "special rule", "closed rule", "open rule", "structured rule", "point of order",
            "quorum call", "conference committee", "conference report",
            // funding / legislative vehicles
            "appropriations", "authorization", "continuing resolution", "cr",
            "rider", "omnibus", "minibus",
            // sponsorship / companion phrasing
            "sponsor", "co sponsor", "cosponsor", "companion bill", "companion legislation"
        ]

        let hasKnownIssueSignal = !wordSet.intersection(knownIssueSignals).isEmpty
        let hasPolicyActionSignal = policyActionSignals.contains(where: {
            containsLegislativeSignal(in: normalizedConcern, signal: $0)
        })

        if hasKnownIssueSignal || hasPolicyActionSignal || words.count >= 3 {
            return nil
        }

        return "Please add one specific policy action so I can generate a stronger script. Example: 'Support federal funding to protect wild horse habitats' or include a bill/resolution."
    }

    func requiredMAPCFollowUpPrompt(
        concernText: String,
        optionalBillRef: String?,
        selectedAsk: CivicAsk?
    ) -> String? {
        let concern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        if concern.isEmpty {
            return nil
        }

        let lowered = concern.lowercased()
        let hasAction = selectedAsk != nil || hasCongressionalActionSignal(in: lowered)
        let hasReference = hasBillProgramAgencySignal(in: concern, optionalBillRef: optionalBillRef)
        let hasKnownTopic = hasKnownIssueTopicSignal(in: lowered)
        let wordCount = concern
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .count

        let isVeryVague = wordCount <= 1 && !hasKnownTopic && !hasReference
        if hasAction && !isVeryVague {
            return nil
        }
        if wordCount >= 2 || hasKnownTopic || hasReference {
            return nil
        }

        return """
        For short or broad prompts, please add:
        1) What exact action should Congress take?
        2) Is there a bill, program, or agency tied to this?

        Example: "Please support VA pilot grant funding for therapeutic riding programs for veterans through appropriations."
        """
    }

    func hasCongressionalActionSignal(in loweredConcern: String) -> Bool {
        let normalizedConcern = normalizedLegislativeSignalText(loweredConcern)
        let actionSignals = [
            // bill movement
            "take up", "bring up", "move the bill", "move forward", "move ahead", "advance the bill",
            "revive the bill", "resurrect the bill", "refile", "report out", "vote out of committee",
            "discharge", "bring to the floor", "take to the floor", "floor vote", "calendar",
            "put on the calendar", "fast track", "whip votes",
            // baseline legislative action terms
            "support", "oppose", "yes on", "no on", "fund", "increase funding", "cut funding",
            "repeal", "oversight", "hold a hearing", "investigate", "table", "withdraw",
            "authorize", "reauthorize", "codify", "rescind", "halt", "ban", "confirm",
            // amendment actions
            "amend", "amend the bill", "offer an amendment", "substitute amendment",
            "manager s amendment", "strip out", "remove from the bill",
            "attach to the bill", "add as a rider", "fold into", "merge into", "package into",
            // sponsorship / companion phrasing
            "sponsor", "co sponsor", "cosponsor", "introduce", "reintroduce",
            "sign on", "sign onto",
            // floor / vote action
            "pass", "enact", "approve", "adopt", "reject", "block", "kill", "sink",
            "lay on the table", "postpone", "delay", "vote yes", "vote no", "yes on", "no on",
            "suspend the rules", "suspension"
        ]
        return actionSignals.contains(where: { containsLegislativeSignal(in: normalizedConcern, signal: $0) })
    }

    func hasBillProgramAgencySignal(in concernText: String, optionalBillRef: String?) -> Bool {
        if normalizedBillReference(optionalBillRef) != nil {
            return true
        }

        let normalizedConcern = normalizedLegislativeSignalText(concernText)
        let namedEntitySignals = [
            // funding / legislative vehicles
            "bill", "act", "legislation", "measure", "proposal", "package", "amendment",
            "substitute amendment", "rider", "appropriations bill", "spending bill",
            "authorization bill", "omnibus", "minibus", "continuing resolution", "cr",
            // committee / chamber products
            "resolution", "joint resolution", "concurrent resolution", "conference report",
            // sponsorship / companion phrasing
            "companion bill", "companion legislation", "house version", "senate version"
        ]
        if namedEntitySignals.contains(where: { containsLegislativeSignal(in: normalizedConcern, signal: $0) }) {
            return true
        }

        let patterns = [
            #"(?i)\b(?:h\.?\s?r\.?|s\.?|h\.?\s?j\.?\s?res\.?|s\.?\s?j\.?\s?res\.?)\s*\d+\b"#,
            #"(?i)\btitle\s+[ivx0-9]+\b"#,
        ]
        return patterns.contains { pattern in
            concernText.range(of: pattern, options: .regularExpression) != nil
        }
    }

    func normalizedLegislativeSignalText(_ text: String) -> String {
        text
            .lowercased()
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "'", with: "'")
            .replacingOccurrences(of: #"[^a-z0-9'\s]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func containsLegislativeSignal(in normalizedConcern: String, signal: String) -> Bool {
        let normalizedSignal = normalizedLegislativeSignalText(signal)
        guard !normalizedSignal.isEmpty else { return false }
        if normalizedSignal.count <= 2 {
            let escaped = NSRegularExpression.escapedPattern(for: normalizedSignal)
            let pattern = "\\b\(escaped)\\b"
            return normalizedConcern.range(of: pattern, options: .regularExpression) != nil
        }
        return normalizedConcern.contains(normalizedSignal)
    }

    func hasKnownIssueTopicSignal(in loweredConcern: String) -> Bool {
        let topicSignals = [
            "gun", "guns", "gun control", "firearm", "firearms", "background check", "assault weapon",
            "abortion", "reproductive", "immigration", "border", "climate", "environment", "housing",
            "healthcare", "health care", "medicaid", "medicare", "snap", "farm", "student", "pell",
            "ukraine", "iran", "crypto", "digital assets", "voting", "election", "social security"
        ]
        return topicSignals.contains(where: { loweredConcern.contains($0) })
    }

    func containsDisallowedScriptMeta(in response: CivicIssueResolutionResponse) -> Bool {
        let combined = [
            response.issueTitle,
            response.issueSummary
        ] + response.callBriefs.flatMap { brief in
            [brief.liveScript, brief.voicemailScript] + brief.talkingPoints
        }
        let text = combined.joined(separator: "\n").lowercased()

        let blockedMarkers = [
            "as an ai",
            "language model",
            "you are chatgpt",
            "openai policy",
            "system prompt",
            "developer message",
            "developer instruction",
            "internal note",
            "policy requires",
            "ignore previous instructions",
            "do not reveal",
            "do not disclose",
            "for internal use",
            "tool output",
            "prompt injection",
            "chain of thought",
            "i cannot help with",
            "i can't help with",
            "unable to assist with that request",
            "the user should",
            "issue packet",
            "briefing packet",
            "policy packet"
        ]
        return blockedMarkers.contains(where: { text.contains($0) })
    }

    func hasReadableCallScripts(
        in response: CivicIssueResolutionResponse,
        ask: CivicAsk,
        concernText: String,
        optionalBillRef: String?,
        requireConcernTopicOverlap: Bool = true
    ) -> Bool {
        guard !response.callBriefs.isEmpty else { return false }

        let askSignals = askSignalPhrases(for: ask)
        let concernContext = "\(concernText) \(optionalBillRef ?? "")"
        let concernTokens = semanticTopicTokens(in: concernContext)
        let concernAcronyms = uppercaseAcronyms(in: concernContext)
        let concernDomainAnchors = domainAnchors(in: concernContext)

        for brief in response.callBriefs {
            let live = brief.liveScript.trimmingCharacters(in: .whitespacesAndNewlines)
            let voicemail = brief.voicemailScript.trimmingCharacters(in: .whitespacesAndNewlines)
            if live.isEmpty || voicemail.isEmpty {
                return false
            }
            if wordCount(in: live) < 12 || wordCount(in: voicemail) < 8 {
                return false
            }

            let combined = "\(live) \(voicemail)".lowercased()
            let hasConstituentSignal = [
                "constituent",
                "[your name]",
                "my name is",
                "calling from",
                "zip"
            ].contains(where: { combined.contains($0) })
            if !hasConstituentSignal {
                return false
            }

            let hasAskSignal = askSignals.contains(where: { combined.contains($0) })
            if !hasAskSignal {
                return false
            }

            if requireConcernTopicOverlap, !concernDomainAnchors.isEmpty {
                let hasDomainAnchor = concernDomainAnchors.contains { combined.contains($0) }
                if !hasDomainAnchor {
                    return false
                }
            }

            if requireConcernTopicOverlap, !concernTokens.isEmpty {
                let scriptTokens = semanticTopicTokens(in: combined)
                if concernTokens.intersection(scriptTokens).isEmpty {
                    return false
                }
            }

            if requireConcernTopicOverlap, !concernAcronyms.isEmpty {
                let scriptUpper = combined.uppercased()
                let anyAcronymMatched = concernAcronyms.contains(where: { scriptUpper.contains($0) })
                if !anyAcronymMatched {
                    return false
                }
            }
        }

        return true
    }

    func askSignalPhrases(for ask: CivicAsk) -> [String] {
        switch ask {
        case .support:
            return [
                "support",
                "back",
                "in favor",
                "fund",
                "funding",
                "appropriate",
                "appropriation",
                "increase funding",
                "invest in"
            ]
        case .oppose:
            return ["oppose", "reject", "against"]
        case .cosponsor:
            return ["cosponsor", "co-sponsor"]
        case .voteYes:
            return ["vote yes", "yes on"]
        case .voteNo:
            return ["vote no", "no on"]
        case .seekOversight:
            return ["oversight", "investigate", "investigation"]
        case .askPublicStatement:
            return ["public statement", "speak out", "publicly"]
        case .askAmendment:
            return ["amendment", "amend"]
        }
    }

    func isLikelyOffTopic(
        response: CivicIssueResolutionResponse,
        concernText: String,
        optionalBillRef: String?
    ) -> Bool {
        let concern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !concern.isEmpty else { return false }

        let responseText = [
            response.issueTitle,
            response.issueSummary
        ] + response.callBriefs.flatMap { brief in
            [brief.liveScript, brief.voicemailScript] + brief.relatedBills + brief.talkingPoints
        }
        let responseBlob = responseText.joined(separator: " ")

        let concernTokens = semanticTopicTokens(in: concern + " " + (optionalBillRef ?? ""))
        let responseTokens = semanticTopicTokens(in: responseBlob)
        let concernAnchors = highSignalTopicTokens(in: concern + " " + (optionalBillRef ?? ""))

        if !concernAnchors.isEmpty {
            let anchorOverlap = concernAnchors.intersection(responseTokens)
            if anchorOverlap.isEmpty {
                let responseLower = responseBlob.lowercased()
                if !hasKnownAcronymExpansionMatch(concernText: concern, responseLower: responseLower) {
                    return true
                }
            }
        }

        if !concernTokens.isEmpty {
            let overlap = concernTokens.intersection(responseTokens).count
            let overlapRatio = Double(overlap) / Double(concernTokens.count)
            if concernTokens.count >= 2 && overlapRatio < 0.20 {
                return true
            }
        }

        let concernAcronyms = uppercaseAcronyms(in: concern + " " + (optionalBillRef ?? ""))
        if !concernAcronyms.isEmpty {
            let responseUpper = responseBlob.uppercased()
            let anyAcronymMatched = concernAcronyms.contains(where: { responseUpper.contains($0) })
            if !anyAcronymMatched {
                return true
            }
        }

        let concernLower = concern.lowercased()
        let billLower = (optionalBillRef ?? "").lowercased()
        let responseLower = responseBlob.lowercased()
        if responseLower.contains("iran")
            && !concernLower.contains("iran")
            && !billLower.contains("iran") {
            return true
        }

        if responseLower.contains("nomination")
            && !concernLower.contains("nomination")
            && !concernLower.contains("nominee")
            && !billLower.contains("nomination") {
            return true
        }

        return false
    }

    func highSignalTopicTokens(in raw: String) -> Set<String> {
        let words = raw.lowercased()
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count >= 5 }

        let stopWords: Set<String> = [
            "about", "would", "should", "could", "please", "issue", "support",
            "oppose", "urgent", "federal", "state", "congress", "member",
            "office", "people", "their", "them", "these", "those", "which",
            "where", "while", "there", "because", "after", "before", "under",
            "over", "between", "against", "around", "request", "asking", "asked",
            "needs", "need", "action"
        ]
        var tokens = Set<String>()
        for word in words where !stopWords.contains(word) {
            tokens.insert(word)
            if let singular = singularizedTopicToken(word), singular.count >= 5 {
                tokens.insert(singular)
            }
        }
        return tokens
    }

    func hasKnownAcronymExpansionMatch(concernText: String, responseLower: String) -> Bool {
        let concernLower = concernText.lowercased()
        let knownAcronyms: [String: [String]] = [
            "lihtc": ["low-income housing tax credit", "low income housing tax credit", "housing tax credit"],
            "snap": ["supplemental nutrition assistance program", "snap benefits"],
            "aca": ["affordable care act", "obamacare"],
            "epa": ["environmental protection agency"]
        ]

        for (acronym, expansions) in knownAcronyms where concernLower.contains(acronym) {
            if expansions.contains(where: { responseLower.contains($0) }) {
                return true
            }
        }
        return false
    }

    func semanticTopicTokens(in raw: String) -> Set<String> {
        let lower = raw.lowercased()
        let words = lower
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count >= 4 }

        let stopWords: Set<String> = [
            "that", "this", "with", "from", "about", "would", "should", "could",
            "please", "issue", "support", "oppose", "urgent", "federal", "state",
            "congress", "member", "office", "people", "their", "them", "into",
            "over", "under", "have", "been", "were", "will", "your", "public"
        ]
        var tokens = Set<String>()
        for word in words where !stopWords.contains(word) {
            tokens.insert(word)
            if let singular = singularizedTopicToken(word), singular.count >= 4 {
                tokens.insert(singular)
            }
        }
        return tokens
    }

    func singularizedTopicToken(_ token: String) -> String? {
        guard token.count >= 5 else { return nil }
        if token.hasSuffix("ies"), token.count > 5 {
            return String(token.dropLast(3)) + "y"
        }
        if token.hasSuffix("es"), token.count > 5 {
            return String(token.dropLast(2))
        }
        if token.hasSuffix("s"), token.count > 4 {
            return String(token.dropLast())
        }
        return nil
    }

    func domainAnchors(in raw: String) -> Set<String> {
        let lower = raw.lowercased()
        var anchors = Set<String>()

        let waterAnchors = [
            "water",
            "drinking water",
            "clean water",
            "wastewater",
            "pfas",
            "lead pipes",
            "lead pipe"
        ]

        let transitAnchors = [
            "transportation",
            "transit",
            "public transit",
            "public transportation",
            "bus",
            "rail",
            "train",
            "subway",
            "metro"
        ]

        for token in waterAnchors where lower.contains(token) {
            anchors.insert(token)
        }
        for token in transitAnchors where lower.contains(token) {
            anchors.insert(token)
        }

        return anchors
    }

    func uppercaseAcronyms(in raw: String) -> Set<String> {
        let parts = raw.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        var tokens = Set<String>()
        tokens.reserveCapacity(parts.count)

        for part in parts {
            let token = String(part)
            if token.count < 3 { continue }
            if token != token.uppercased() { continue }
            if token.rangeOfCharacter(from: .letters) == nil { continue }
            tokens.insert(token)
        }

        return tokens
    }

    func wordCount(in text: String) -> Int {
        text
            .split(whereSeparator: { $0.isWhitespace || $0 == "\n" || $0 == "\t" })
            .count
    }

    // MARK: – Fallback Bill Templates

    struct FallbackBillTemplate {
        let reference: String
        let keywords: [String]
        let committees: [String]
    }

    static let fallbackBillTemplates: [FallbackBillTemplate] = [
        FallbackBillTemplate(
            reference: "S.J.Res. 114 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 112 BIS End-Use Controls Disapproval Resolution",
            keywords: ["bureau of industry and security", "end-use controls", "export controls", "disapproval", "rule"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 116 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 118 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 115 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 628 Music in Our Schools Month Resolution",
            keywords: ["music in our schools", "music education", "schools", "arts education"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 627 National Slam the Scam Day Resolution",
            keywords: ["scam", "fraud", "impostor scams", "consumer protection", "public awareness"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 113 OCC Climate Financial Risk Disapproval Resolution",
            keywords: ["office of the comptroller", "occ", "climate-related financial risk", "bank regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 117 Iran War Powers Resolution",
            keywords: ["iran", "war powers", "unauthorized hostilities", "armed forces", "congressional authorization"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 110 Treasury Leverage Ratio Disapproval Resolution",
            keywords: ["treasury", "supplementary leverage ratio", "bank holding companies", "financial regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 109 Grand Staircase-Escalante Management Plan Disapproval Resolution",
            keywords: ["bureau of land management", "grand staircase-escalante", "public lands", "national monument", "management plans"],
            committees: ["Energy and Natural Resources"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 111 Federal Reserve Rating System Disapproval Resolution",
            keywords: ["federal reserve", "large financial institution rating system", "bank oversight", "financial regulation", "disapproval"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 625 Hawaiian Language Month Resolution",
            keywords: ["hawaiian language", "olelo hawaii", "language month", "cultural preservation"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 624 National Social and Emotional Learning Week Resolution",
            keywords: ["social and emotional learning", "sel", "schools", "students", "mental health"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 616 Human Rights in Honduras Resolution",
            keywords: ["human rights", "honduras", "oversight", "foreign policy", "state department"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 623 Team USA Ice Hockey Resolution",
            keywords: ["team usa", "ice hockey", "international competition", "sports diplomacy"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 612 Support for Ukraine Resolution",
            keywords: ["ukraine", "russia invasion", "support ukraine", "foreign policy", "security assistance"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 607 Marjory Stoneman Douglas Victims Resolution",
            keywords: ["marjory stoneman douglas", "school shooting", "gun violence", "victims"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 608 Ghislaine Maxwell Clemency Opposition Resolution",
            keywords: ["ghislaine maxwell", "clemency", "justice", "victims rights"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 557 Climate Financial Market Risk Resolution",
            keywords: ["climate change", "financial market", "systemic risk", "market collapse", "banking risk"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 552 Ocean Warming Resolution",
            keywords: ["oceans warming", "ocean temperature", "climate change", "marine environment"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.J.Res. 100 Caribbean and Eastern Pacific War Powers Resolution",
            keywords: ["caribbean sea", "eastern pacific", "unauthorized hostilities", "war powers", "armed forces"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 567 Foreign Censorship Opposition Resolution",
            keywords: ["foreign censorship", "free speech", "constitutionally protected speech", "civil liberties"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 565 Renewable Electricity Cost Resolution",
            keywords: ["renewable electricity", "clean energy", "energy costs", "grid", "electricity"],
            committees: ["Energy and Natural Resources"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 547 U.S.-Japan Alliance Support Resolution",
            keywords: ["u.s.-japan alliance", "japan alliance", "indo-pacific", "china pressure", "foreign policy"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 556 Florida Insurance Climate Risk Resolution",
            keywords: ["florida insurance", "insurance market", "climate risks", "property insurance"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 561 Particulate Matter Pollution Resolution",
            keywords: ["particulate matter", "pm2.5", "air pollution", "health harms", "environment"],
            committees: ["Environment and Public Works"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 555 Climate Mortgage Risk Resolution",
            keywords: ["climate change", "mortgage market", "home values", "housing risk", "financial risk"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 562 Ozone Pollution Health Harms Resolution",
            keywords: ["ozone pollution", "air quality", "public health", "reproductive harms", "environment"],
            committees: ["Environment and Public Works"]
        ),
        FallbackBillTemplate(
            reference: "S.Res. 549 Seize Shadow Fleet Russian Oil Resolution",
            keywords: ["shadow fleet", "russian oil", "sanctions enforcement", "maritime shipping", "foreign policy"],
            committees: ["Foreign Relations"]
        ),
        FallbackBillTemplate(
            reference: "S.1241 Sanctioning Russia Act of 2025",
            keywords: ["russia", "ukraine", "sanction", "international", "foreign policy"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1032 Major Richard Star Act",
            keywords: ["armed forces", "military", "national security", "veteran", "defense"],
            committees: ["Armed Services"]
        ),
        FallbackBillTemplate(
            reference: "S.1748 Kids Online Safety Act",
            keywords: ["kids online", "online safety", "social media", "technology", "internet"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.1261 CONNECT for Health Act of 2025",
            keywords: ["health", "telehealth", "care access", "medicare", "coverage"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.2837 Protect America's Workforce Act",
            keywords: ["workforce", "labor", "employment", "worker", "layoff"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1515 Affordable Housing Credit Improvement Act of 2025",
            keywords: ["housing", "rent", "homelessness", "affordability", "zoning"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.1973 Treat and Reduce Obesity Act of 2025",
            keywords: ["obesity", "nutrition", "chronic disease", "health"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.3048 TREATS Act",
            keywords: ["addiction", "opioid", "e-prescribing", "telehealth", "substance use"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.3209 NOPAIN for Veterans Act",
            keywords: ["veterans", "pain", "military health", "opioid"],
            committees: ["Veterans Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.3257 Mental Health in Aviation Act of 2025",
            keywords: ["mental health", "aviation", "airline", "pilot"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.847 Child Care Availability and Affordability Act",
            keywords: ["child care", "families", "caregiving", "affordability"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.932 Give Kids a Chance Act of 2025",
            keywords: ["kids", "children", "health", "pediatric"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.29 Sunshine Protection Act of 2025",
            keywords: ["sunshine", "daylight saving", "time change"],
            committees: ["Commerce, Science, and Transportation"]
        ),
        FallbackBillTemplate(
            reference: "S.1272 Trade Review Act of 2025",
            keywords: ["trade", "tariff", "import", "export", "international finance"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.179 FARM Act (Foreign Adversary Risk Management Act)",
            keywords: ["farm", "agriculture", "foreign adversary", "food security", "supply chain"],
            committees: ["Banking, Housing, and Urban Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.2237 Hospital Inpatient Services Modernization Act",
            keywords: ["hospital", "inpatient", "health care", "modernization"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.41 Advanced Border Coordination Act of 2025",
            keywords: ["immigration", "border", "asylum", "homeland security"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.3281 Restoring Food Security for American Families and Farmers Act of 2025",
            keywords: ["snap", "food security", "farmers", "agriculture", "nutrition"],
            committees: ["Agriculture, Nutrition, and Forestry"]
        ),
        FallbackBillTemplate(
            reference: "S.852 Richard L. Trumka Protecting the Right to Organize Act of 2025",
            keywords: ["union", "organize", "labor", "workers rights", "collective bargaining"],
            committees: ["Health, Education, Labor, and Pensions"]
        ),
        FallbackBillTemplate(
            reference: "S.46 Health Care Affordability Act of 2025",
            keywords: ["health care", "premiums", "deductibles", "coverage", "affordability"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.51 Washington, D.C. Admission Act",
            keywords: ["dc", "statehood", "representation", "voting rights", "democracy"],
            committees: ["Homeland Security and Governmental Affairs"]
        ),
        FallbackBillTemplate(
            reference: "S.1531 Assault Weapons Ban of 2025",
            keywords: ["assault weapons", "gun violence", "firearms", "crime"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.3043 Military and Federal Employee Protection Act",
            keywords: ["federal employee", "military", "workforce", "public finance"],
            committees: ["Appropriations"]
        ),
        FallbackBillTemplate(
            reference: "S.2823 FAMILY Act",
            keywords: ["family leave", "paid leave", "workers", "families", "labor"],
            committees: ["Finance"]
        ),
        FallbackBillTemplate(
            reference: "S.40 Commission to Study and Develop Reparation Proposals for African Americans Act",
            keywords: ["reparations", "civil rights", "racial justice", "minority issues"],
            committees: ["Judiciary"]
        ),
        FallbackBillTemplate(
            reference: "S.2939 Child Care for Every Community Act",
            keywords: ["child care", "families", "early childhood", "community"],
            committees: ["Health, Education, Labor, and Pensions"]
        )
    ]

    func suggestedBillReference(
        issueTitle: String,
        issueSummary: String,
        issueCommittees: [String],
        target: CivicRepTarget?
    ) -> String? {
        let context = "\(issueTitle) \(issueSummary)".lowercased()
        let resolutionContext = isResolutionContext(context)
        let targetCommittees = Set(
            (target?.official.committeeAssignments ?? [])
                .map(normalizeCommitteeName)
                .filter { !$0.isEmpty }
        )
        let relevantIssueCommittees = Set(
            issueCommittees
                .map(normalizeCommitteeName)
                .filter { !$0.isEmpty }
        )

        var bestTemplate: FallbackBillTemplate?
        var bestScore = Int.min

        for template in Self.fallbackBillTemplates {
            let keywordScore = template.keywords.reduce(into: 0) { partial, keyword in
                if context.contains(keyword) {
                    partial += 3
                }
            }
            let targetCommitteeScore = hasCommitteeOverlap(
                candidateCommittees: template.committees,
                normalizedCommittees: targetCommittees
            ) ? 6 : 0
            let issueCommitteeScore = hasCommitteeOverlap(
                candidateCommittees: template.committees,
                normalizedCommittees: relevantIssueCommittees
            ) ? 4 : 0
            let resolutionScore = (resolutionContext && isResolutionReference(template.reference)) ? 5 : 0

            let score = keywordScore + targetCommitteeScore + issueCommitteeScore + resolutionScore
            if score > bestScore {
                bestScore = score
                bestTemplate = template
            }
        }

        if bestScore > 0 {
            return bestTemplate?.reference
        }

        if !targetCommittees.isEmpty,
           let byTargetCommittee = Self.fallbackBillTemplates.first(where: {
               hasCommitteeOverlap(candidateCommittees: $0.committees, normalizedCommittees: targetCommittees)
           }) {
            return byTargetCommittee.reference
        }

        if !relevantIssueCommittees.isEmpty,
           let byIssueCommittee = Self.fallbackBillTemplates.first(where: {
               hasCommitteeOverlap(candidateCommittees: $0.committees, normalizedCommittees: relevantIssueCommittees)
           }) {
            return byIssueCommittee.reference
        }

        if let byKeyword = Self.fallbackBillTemplates.first(where: { template in
            template.keywords.contains(where: { context.contains($0) })
        }) {
            return byKeyword.reference
        }

        return Self.fallbackBillTemplates.first?.reference
    }

    func hasCommitteeOverlap(candidateCommittees: [String], normalizedCommittees: Set<String>) -> Bool {
        guard !candidateCommittees.isEmpty, !normalizedCommittees.isEmpty else {
            return false
        }

        for candidate in candidateCommittees {
            let normalizedCandidate = normalizeCommitteeName(candidate)
            guard !normalizedCandidate.isEmpty else { continue }
            if normalizedCommittees.contains(where: { normalized in
                normalized.contains(normalizedCandidate) || normalizedCandidate.contains(normalized)
            }) {
                return true
            }
        }
        return false
    }

    func isResolutionContext(_ lowercasedContext: String) -> Bool {
        let markers = ["resolution", "joint resolution", "disapproval", "s.j.res", "s.res"]
        return markers.contains { lowercasedContext.contains($0) }
    }

    func isResolutionReference(_ reference: String) -> Bool {
        let normalized = reference.lowercased().replacingOccurrences(of: " ", with: "")
        return normalized.contains("s.j.res.") || normalized.contains("s.res.")
    }
}
