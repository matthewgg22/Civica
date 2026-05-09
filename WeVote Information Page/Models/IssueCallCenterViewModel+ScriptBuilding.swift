import Foundation
import SwiftUI
import OSLog

// MARK: – Script Building, Brief Composition & Snapshot Persistence

extension IssueCallCenterViewModel {

    // MARK: – Session Identifiers

    func ensureActiveMAPCSessionID() -> UUID {
        if let activeMAPCSessionID {
            return activeMAPCSessionID
        }
        let generated = UUID()
        activeMAPCSessionID = generated
        return generated
    }

    func ensureScriptChatSessionID() -> UUID {
        if let scriptChatSessionID {
            return scriptChatSessionID
        }
        let generated = UUID()
        scriptChatSessionID = generated
        return generated
    }

    func queueMAPCCallEvent(
        type: MAPCCallEventInsert.EventType,
        brief: CivicCallBrief?,
        issueID: String? = nil,
        issueTitle: String? = nil,
        completed: Bool? = nil,
        outcome: CivicCallOutcome? = nil,
        sourceScreen: String? = nil,
        metadata: [String: String]? = nil
    ) {
        let normalizedIssueTitle: String? = {
            let direct = issueTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !direct.isEmpty { return direct }
            let fallback = self.issueTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            return fallback.isEmpty ? nil : fallback
        }()

        let payload = MAPCCallEventInsert(
            sessionID: ensureActiveMAPCSessionID(),
            userID: nil,
            issueID: issueID ?? brief?.issueID,
            issueTitle: normalizedIssueTitle,
            briefID: brief?.id,
            repID: brief?.repID,
            repName: brief?.repName,
            repSlot: brief?.repSlot?.rawValue,
            eventType: type,
            completed: completed,
            outcome: outcome?.rawValue,
            sourceScreen: sourceScreen,
            metadata: metadata
        )

        Task { [supabaseManager] in
            await supabaseManager.logMAPCCallEvent(payload)
        }
    }

    func advanceToNextRep(after brief: CivicCallBrief) {
        moveToNextBrief(after: brief)
    }

    func retreatToPreviousRep(before brief: CivicCallBrief) {
        moveToPreviousBrief(before: brief)
    }

    func hasLoggedOutcome(for brief: CivicCallBrief) -> Bool {
        if loggedOutcomeByBriefID[brief.id] != nil {
            return true
        }

        return historyGroups.contains { group in
            group.issueID == brief.issueID &&
            group.logs.contains { log in
                log.briefID == brief.id
            }
        }
    }

    var activeBrief: CivicCallBrief? {
        if let activeBriefID,
           let matched = callBriefs.first(where: { $0.id == activeBriefID }) {
            return matched
        }
        return callBriefs.first
    }

    var activeBriefIndex: Int? {
        guard let active = activeBrief else { return nil }
        return callBriefs.firstIndex(where: { $0.id == active.id })
    }

    func isLastBrief(_ brief: CivicCallBrief) -> Bool {
        guard let idx = callBriefs.firstIndex(where: { $0.id == brief.id }) else { return false }
        return idx == callBriefs.index(before: callBriefs.endIndex)
    }

    func finishScript() {
        saveSnapshot()
    }

    func isSenateBrief(_ brief: CivicCallBrief) -> Bool {
        if brief.repSlot == .senate1 || brief.repSlot == .senate2 {
            return true
        }
        return brief.officeType.lowercased().contains("senator")
    }

    func committeeAssignments(for brief: CivicCallBrief) -> [String] {
        let fromOfficial = official(for: brief)?.committeeAssignments ?? []
        let fromRelevance = extractedCommitteeAssignments(from: brief.relevanceBadges)
        return Array(Set(fromOfficial + fromRelevance)).sorted()
    }

    func hasNextRep(after brief: CivicCallBrief) -> Bool {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else { return false }
        return scoped.index(after: currentIndex) < scoped.endIndex
    }

    func official(for brief: CivicCallBrief) -> Official? {
        if let official = officialLookupByRepID[brief.repID] {
            return official
        }
        if let slot = brief.repSlot, let official = officialBySlot[slot] {
            return official
        }
        let normalizedName = Self.normalizeNameKey(brief.repName)
        if let official = officialLookupByName[normalizedName] {
            return official
        }
        if let placeholderMatch = fallbackOfficialForPlaceholder(brief: brief) {
            return placeholderMatch
        }
        if let idx = callBriefs.firstIndex(where: { $0.id == brief.id }),
           repTargets.indices.contains(idx) {
            return repTargets[idx].official
        }
        return nil
    }

    func persistDraftState() {
        saveSnapshot()
    }

    func applyResolution(_ response: CivicIssueResolutionResponse) {
        let enriched = enrichResolutionWithFallbackBills(response)
        let fallbackIssueID = resolvedIssueIdentifier(
            preferredIssueID: enriched.issueID,
            issueTitle: enriched.issueTitle,
            issueSummary: enriched.issueSummary
        )
        let normalized = normalizedBriefs(enriched.callBriefs, fallbackIssueID: fallbackIssueID)
        issueTitle = enriched.issueTitle
        issueSummary = enriched.issueSummary
        resolvedEntities = enriched.resolvedEntities
        callBriefs = normalized
        activeBriefID = filteredBriefs.first?.id
    }

    func enrichResolutionWithFallbackBills(_ response: CivicIssueResolutionResponse) -> CivicIssueResolutionResponse {
        let explicitBill = normalizedBillReference(optionalBillRef)
        var resolvedBills = response.resolvedEntities.bills.compactMap(normalizedBillReference)
        if let explicitBill, !containsCaseInsensitive(resolvedBills, value: explicitBill) {
            resolvedBills.append(explicitBill)
        }

        let updatedBriefs = response.callBriefs.map { brief in
            let cleanedBriefBills = brief.relatedBills.compactMap(normalizedBillReference)
            let selectedBill = cleanedBriefBills.first ?? explicitBill
            if let selectedBill, !containsCaseInsensitive(resolvedBills, value: selectedBill) {
                resolvedBills.append(selectedBill)
            }

            let relatedBills = cleanedBriefBills.isEmpty ? (selectedBill.map { [$0] } ?? []) : cleanedBriefBills
            let liveScript = interpolateBillPlaceholder(in: brief.liveScript, billReference: selectedBill)
            let voicemailScript = interpolateBillPlaceholder(in: brief.voicemailScript, billReference: selectedBill)

            return CivicCallBrief(
                id: brief.id,
                repID: brief.repID,
                repName: brief.repName,
                officeType: brief.officeType,
                primaryPhoneNumber: brief.primaryPhoneNumber,
                localOfficePhoneNumber: brief.localOfficePhoneNumber,
                relevanceBadges: brief.relevanceBadges,
                relatedBills: relatedBills,
                relatedCommittees: brief.relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: brief.talkingPoints,
                issueID: brief.issueID,
                repSlot: brief.repSlot
            )
        }

        return CivicIssueResolutionResponse(
            issueID: response.issueID,
            issueTitle: response.issueTitle,
            issueSummary: response.issueSummary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: response.resolvedEntities.committees,
                agencies: response.resolvedEntities.agencies
            ),
            callBriefs: updatedBriefs
        )
    }

    func appendHistory(for resolution: CivicIssueResolutionResponse) {
        let fallbackIssueID = resolvedIssueIdentifier(
            preferredIssueID: resolution.issueID,
            issueTitle: resolution.issueTitle,
            issueSummary: resolution.issueSummary
        )
        let normalized = normalizedBriefs(resolution.callBriefs, fallbackIssueID: fallbackIssueID)
        let fresh = CivicHistoryGroup(
            id: UUID().uuidString,
            issueID: fallbackIssueID,
            issueTitle: resolution.issueTitle,
            issueSummary: resolution.issueSummary,
            date: Date(),
            briefs: normalized,
            logs: []
        )
        historyGroups.removeAll(where: { $0.issueID == fresh.issueID })
        historyGroups.insert(fresh, at: 0)
    }

    func applySeedResolution(for example: CivicExampleIssueCard) {
        let selectedSlots = slotsForExample(example)
        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        guard !selectedTargets.isEmpty else { return }

        let issueID = seededIssueID(for: example)
        let explicitRelatedBills = example.relatedBills.compactMap(normalizedBillReference)
        var resolvedBills = explicitRelatedBills
        let relatedCommittees = inferredCommittees(for: example)
        let talkPointAsk = selectedAsk?.title ?? example.primaryAsk ?? "Support"

        let briefs: [CivicCallBrief] = selectedTargets.map { target in
            let repName = target.official.name
            let repLastName = repName
                .split(separator: " ")
                .last
                .map(String.init) ?? repName
            let billValue = explicitRelatedBills.first
            if let billValue, !containsCaseInsensitive(resolvedBills, value: billValue) {
                resolvedBills.append(billValue)
            }
            let relevance = example.repRelevance.isEmpty
                ? fallbackRelevance(for: target, billRef: billValue)
                : example.repRelevance
            let committeeCallout = committeeJurisdictionCallout(
                repName: repName,
                officeType: target.officeType,
                officialCommittees: target.official.committeeAssignments,
                issueCommittees: relatedCommittees,
                repRelevance: relevance
            )

            let baseLiveScript = interpolateExampleScript(
                example.liveScript,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: billValue
            )
            let baseVoicemailScript = interpolateExampleScript(
                example.voicemailScript,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: billValue
            )
            let liveScript = injectCommitteeCallout(committeeCallout, into: baseLiveScript)
            let voicemailScript = injectCommitteeCallout(committeeCallout, into: baseVoicemailScript)
            let briefRelatedBills = explicitRelatedBills.isEmpty
                ? billValue.map { [$0] } ?? []
                : explicitRelatedBills

            return CivicCallBrief(
                id: UUID().uuidString,
                repID: stableRepID(for: target.official),
                repName: repName,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: relevance,
                relatedBills: briefRelatedBills,
                relatedCommittees: relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: [
                    "Issue: \(example.title)",
                    "Explicit ask: \(talkPointAsk)",
                    "Request the office to share the member's current position"
                ],
                issueID: issueID,
                repSlot: target.slot
            )
        }

        applyResolution(
            CivicIssueResolutionResponse(
                issueID: issueID,
                issueTitle: example.title,
                issueSummary: example.summary,
                resolvedEntities: CivicResolvedEntities(
                    bills: resolvedBills,
                    committees: relatedCommittees,
                    agencies: resolvedEntities.agencies
                ),
                callBriefs: briefs
            )
        )
        selectedRepFilter = .all
        saveSnapshot()
    }

    func seededIssueID(for example: CivicExampleIssueCard) -> String {
        let raw = example.id.trimmingCharacters(in: .whitespacesAndNewlines)
        if !raw.isEmpty {
            return raw
        }
        if let slug = example.slug?.trimmingCharacters(in: .whitespacesAndNewlines), !slug.isEmpty {
            return slug
        }
        return resolvedIssueIdentifier(
            preferredIssueID: nil,
            issueTitle: example.title,
            issueSummary: example.summary
        )
    }

    func slotsForExample(_ example: CivicExampleIssueCard) -> [CivicRepSlot] {
        let chamberSet = Set(
            example.targetChambers
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
                .filter { !$0.isEmpty }
        )
        guard !chamberSet.isEmpty else { return requestRepSlots }

        var slots: [CivicRepSlot] = []
        if chamberSet.contains("house") {
            slots.append(.house)
        }
        if chamberSet.contains("senate") {
            if repTargets.contains(where: { $0.slot == .senate1 }) {
                slots.append(.senate1)
            }
            if repTargets.contains(where: { $0.slot == .senate2 }) {
                slots.append(.senate2)
            }
        }

        return slots.isEmpty ? requestRepSlots : slots
    }

    func interpolateExampleScript(
        _ script: String,
        officialTitle: String,
        officialLastName: String,
        billOrResolution: String?
    ) -> String {
        let billText: String
        if let billOrResolution,
           !billOrResolution.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            billText = billOrResolution
        } else {
            billText = "this issue"
        }

        return script
            .replacingOccurrences(of: "[OFFICIAL_TITLE]", with: officialTitle)
            .replacingOccurrences(of: "[OFFICIAL_LAST]", with: officialLastName)
            .replacingOccurrences(of: "[BILL_OR_RESOLUTION]", with: billText)
            .replacingOccurrences(of: "[ZIP]", with: resolvedUserZip)
    }

    func interpolateBillPlaceholder(in script: String, billReference: String?) -> String {
        let replacement: String
        if let billReference,
           !billReference.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            replacement = billReference
        } else {
            replacement = "this issue"
        }

        return script.replacingOccurrences(of: "[BILL_OR_RESOLUTION]", with: replacement)
    }

    func targetForBrief(_ brief: CivicCallBrief) -> CivicRepTarget? {
        if let slot = brief.repSlot,
           let target = repTargets.first(where: { $0.slot == slot }) {
            return target
        }

        let trimmedRepID = brief.repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedRepID.isEmpty,
           let target = repTargets.first(where: {
               stableRepID(for: $0.official).caseInsensitiveCompare(trimmedRepID) == .orderedSame
           }) {
            return target
        }

        let normalizedName = Self.normalizeNameKey(brief.repName)
        if !normalizedName.isEmpty,
           let target = repTargets.first(where: {
               Self.normalizeNameKey($0.official.name) == normalizedName
           }) {
            return target
        }

        guard let official = official(for: brief) else {
            return nil
        }

        if let resolvedSlot = brief.repSlot
            ?? slotByRepID[trimmedRepID]
            ?? slotByName[normalizedName] {
            return CivicRepTarget(slot: resolvedSlot, official: official)
        }

        return nil
    }

    func extractedCommitteeAssignments(from relevanceBadges: [String]) -> [String] {
        var assignments: [String] = []

        for badge in relevanceBadges {
            let normalized = badge.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty else { continue }
            guard normalized.localizedCaseInsensitiveContains("committee") else { continue }

            if let servesOnRange = normalized.range(of: "serves on", options: [.caseInsensitive]) {
                var committee = String(normalized[servesOnRange.upperBound...])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if let parentheticalStart = committee.firstIndex(of: "(") {
                    committee = String(committee[..<parentheticalStart])
                }
                committee = committee.trimmingCharacters(in: CharacterSet(charactersIn: " ."))
                if !committee.isEmpty {
                    assignments.append(committee)
                    continue
                }
            }

            if normalized.localizedCaseInsensitiveContains("serves on ") {
                let components = normalized.components(separatedBy: "serves on ")
                if let tail = components.last {
                    let committee = tail.trimmingCharacters(in: CharacterSet(charactersIn: " ."))
                    if !committee.isEmpty {
                        assignments.append(committee)
                    }
                }
            }
        }

        return Array(Set(assignments)).sorted()
    }

    func inferredCommittees(for example: CivicExampleIssueCard) -> [String] {
        var ordered: [String] = []

        func appendUnique(_ values: [String]) {
            for value in values {
                let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { continue }
                if !ordered.contains(where: { normalizeCommitteeName($0) == normalizeCommitteeName(cleaned) }) {
                    ordered.append(cleaned)
                }
            }
        }

        appendUnique(extractedCommitteeAssignments(from: example.repRelevance))

        let categoryKey = (example.category ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let categoryCommittees: [String: [String]] = [
            "foreign affairs": ["Foreign Relations", "Armed Services", "Intelligence", "Appropriations"],
            "lgbtq": ["Judiciary", "Health, Education, Labor, and Pensions", "Homeland Security and Governmental Affairs"],
            "government oversight": ["Judiciary", "Homeland Security and Governmental Affairs", "Appropriations", "Intelligence"],
            "nominations": ["Judiciary", "Health, Education, Labor, and Pensions", "Finance", "Environment and Public Works", "Energy and Natural Resources"],
            "voter rights": ["Judiciary", "Rules and Administration", "Homeland Security and Governmental Affairs"],
            "immigration": ["Judiciary", "Homeland Security and Governmental Affairs", "Foreign Relations"],
            "environment": ["Environment and Public Works", "Energy and Natural Resources", "Appropriations"],
            "digital rights": ["Commerce, Science, and Transportation", "Judiciary", "Homeland Security and Governmental Affairs"],
        ]
        appendUnique(categoryCommittees[categoryKey] ?? [])

        let tagCommittees: [String: [String]] = [
            "foreign-policy": ["Foreign Relations", "Armed Services", "Intelligence"],
            "war-powers": ["Foreign Relations", "Armed Services"],
            "climate": ["Environment and Public Works", "Energy and Natural Resources"],
            "public-health": ["Health, Education, Labor, and Pensions", "Finance"],
            "immigration": ["Judiciary", "Homeland Security and Governmental Affairs"],
            "voting-rights": ["Judiciary", "Rules and Administration"],
            "digital-rights": ["Commerce, Science, and Transportation", "Judiciary"],
        ]
        let tagKeys = example.tags.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        for key in tagKeys {
            appendUnique(tagCommittees[key] ?? [])
        }

        return ordered
    }

    func committeeJurisdictionCallout(
        repName: String,
        officeType: String,
        officialCommittees: [String],
        issueCommittees: [String],
        repRelevance: [String]
    ) -> String? {
        var candidateIssueCommittees = issueCommittees
        var relevanceCommittee: String?
        if let relevanceLine = matchingCommitteeRelevanceLine(for: repName, in: repRelevance),
           let fromRelevance = committeeNameFromRelevanceLine(relevanceLine) {
            relevanceCommittee = fromRelevance
            candidateIssueCommittees.append(fromRelevance)
        }

        let matchedCommittee = bestMatchedCommittee(
            assigned: officialCommittees,
            relevant: candidateIssueCommittees
        ) ?? relevanceCommittee

        guard let matchedCommittee else {
            return nil
        }

        let officeLabel = officeType.lowercased().contains("senator") ? "Senator" : "Representative"
        let lastName = preferredLastName(from: repName)
        let committeeLabel = formattedCommitteeLabel(matchedCommittee, officeLabel: officeLabel)

        return "As \(officeLabel) \(lastName) is a member of the \(committeeLabel), this issue is in that committee's jurisdiction."
    }

    func bestMatchedCommittee(assigned: [String], relevant: [String]) -> String? {
        let assignedClean = assigned
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let relevantClean = relevant
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !assignedClean.isEmpty, !relevantClean.isEmpty else {
            return nil
        }

        for targetCommittee in relevantClean {
            let normalizedTarget = normalizeCommitteeName(targetCommittee)
            guard !normalizedTarget.isEmpty else { continue }

            for assignedCommittee in assignedClean {
                let normalizedAssigned = normalizeCommitteeName(assignedCommittee)
                guard !normalizedAssigned.isEmpty else { continue }
                if normalizedAssigned.contains(normalizedTarget)
                    || normalizedTarget.contains(normalizedAssigned) {
                    return assignedCommittee
                }
            }
        }

        return nil
    }

    func formattedCommitteeLabel(_ committeeName: String, officeLabel: String) -> String {
        var committeeLabel: String
        if committeeName.lowercased().contains("committee") {
            committeeLabel = committeeName
        } else {
            committeeLabel = "\(committeeName) Committee"
        }
        if officeLabel == "Senator", !committeeLabel.lowercased().contains("senate") {
            committeeLabel = "Senate \(committeeLabel)"
        } else if officeLabel == "Representative", !committeeLabel.lowercased().contains("house") {
            committeeLabel = "House \(committeeLabel)"
        }
        return committeeLabel
    }

    func normalizeCommitteeName(_ value: String) -> String {
        var normalized = value
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        normalized = normalized.replacingOccurrences(of: "&", with: " and ")
        normalized = normalized.replacingOccurrences(of: "committee on ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee for ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee of ", with: "")
        normalized = normalized.replacingOccurrences(of: "senate ", with: "")
        normalized = normalized.replacingOccurrences(of: "house ", with: "")
        normalized = normalized.replacingOccurrences(of: "u.s. ", with: "")
        normalized = normalized.replacingOccurrences(of: "us ", with: "")
        normalized = normalized.replacingOccurrences(of: "'", with: "")

        let allowed = CharacterSet.alphanumerics.union(.whitespaces)
        normalized = String(normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : " " })
        normalized = normalized.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func matchingCommitteeRelevanceLine(for repName: String, in repRelevance: [String]) -> String? {
        let committeeLines = repRelevance.filter {
            $0.localizedCaseInsensitiveContains("committee of jurisdiction")
        }
        guard !committeeLines.isEmpty else { return nil }

        let normalizedRepName = Self.normalizeNameKey(repName)
        if let match = committeeLines.first(where: { Self.normalizeNameKey($0).contains(normalizedRepName) }) {
            return match
        }

        let lastName = preferredLastName(from: repName)
        let normalizedLastName = Self.normalizeNameKey(lastName)
        if let match = committeeLines.first(where: { Self.normalizeNameKey($0).contains(normalizedLastName) }) {
            return match
        }

        return committeeLines.first
    }

    func committeeNameFromRelevanceLine(_ line: String) -> String? {
        let withoutSuffix = line
            .replacingOccurrences(
                of: "(committee of jurisdiction).",
                with: "",
                options: [.caseInsensitive],
                range: nil
            )
            .replacingOccurrences(
                of: "(committee of jurisdiction)",
                with: "",
                options: [.caseInsensitive],
                range: nil
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let servesOnRange = withoutSuffix.range(of: "serves on", options: [.caseInsensitive]) else {
            return nil
        }

        let committeeName = withoutSuffix[servesOnRange.upperBound...]
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))

        return committeeName.isEmpty ? nil : committeeName
    }

    func preferredLastName(from repName: String) -> String {
        repName
            .split(separator: " ")
            .last
            .map(String.init) ?? repName
    }

    func injectCommitteeCallout(_ callout: String?, into script: String) -> String {
        guard let callout,
              !callout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return script
        }

        if script.localizedCaseInsensitiveContains("committee's jurisdiction")
            || script.localizedCaseInsensitiveContains("committee of jurisdiction") {
            return script
        }

        let paragraphs = script
            .components(separatedBy: "\n\n")
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

        guard paragraphs.count >= 2 else {
            return script + "\n\n" + callout
        }

        var updated = paragraphs
        updated.insert(callout, at: 2)
        return updated.joined(separator: "\n\n")
    }

    // MARK: – Snapshot Persistence

    func saveSnapshot() {
        let resolution: CivicIssueResolutionResponse? = issueTitle.isEmpty
            ? nil
            : CivicIssueResolutionResponse(
                issueID: callBriefs.first?.issueID ?? UUID().uuidString,
                issueTitle: issueTitle,
                issueSummary: issueSummary,
                resolvedEntities: resolvedEntities,
                callBriefs: callBriefs
            )

        cacheStore.save(
            CivicLocalSnapshot(
                latestResolution: resolution,
                history: historyGroups,
                assistantDraft: CivicAssistantDraft(
                    selectedTab: selectedTab,
                    selectedRepFilter: selectedRepFilter,
                    concernText: concernText,
                    selectedAsk: selectedAsk,
                    optionalBillRef: optionalBillRef,
                    activeBriefID: activeBriefID
                ),
                updatedAt: Date()
            )
        )
    }

    func moveToNextBrief(after brief: CivicCallBrief) {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else {
            activeBriefID = filteredBriefs.first?.id
            return
        }

        let nextIndex = scoped.index(after: currentIndex)
        if nextIndex < scoped.endIndex {
            activeBriefID = scoped[nextIndex].id
            scheduleDeferredSnapshotPersistence()
        } else {
            activeBriefID = scoped[currentIndex].id
            scheduleDeferredSnapshotPersistence()
        }
    }

    func moveToPreviousBrief(before brief: CivicCallBrief) {
        let scoped = callBriefs
        guard let currentIndex = scoped.firstIndex(where: { $0.id == brief.id }) else {
            activeBriefID = filteredBriefs.first?.id
            return
        }

        guard currentIndex > scoped.startIndex else {
            activeBriefID = scoped[currentIndex].id
            scheduleDeferredSnapshotPersistence()
            return
        }

        let previousIndex = scoped.index(before: currentIndex)
        activeBriefID = scoped[previousIndex].id
        scheduleDeferredSnapshotPersistence()
    }

    func scheduleDeferredSnapshotPersistence(delayNanoseconds: UInt64 = 300_000_000) {
        deferredSnapshotTask?.cancel()
        deferredSnapshotTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delayNanoseconds)
            guard let self, !Task.isCancelled else { return }
            self.saveSnapshot()
        }
    }

    // MARK: – Resolution & Script Building

    func resolutionFromScriptPackage(
        _ package: CivicScriptPackageResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let canonicalContext = package.canonicalContext
        let issueTitle = normalizedNonEmpty(canonicalContext?.title) ?? deriveIssueTitle(from: trimmedConcern)
        let issueSummary = normalizedNonEmpty(canonicalContext?.summaryPlain) ?? trimmedConcern
        let issueID = resolvedIssueIdentifier(
            preferredIssueID: canonicalContext?.issueID,
            issueTitle: issueTitle,
            issueSummary: issueSummary
        )

        var resolvedBills = (canonicalContext?.relatedBills ?? [])
            .compactMap(normalizedBillReference)
        if let explicitBill = normalizedBillReference(optionalBillRef),
           !containsCaseInsensitive(resolvedBills, value: explicitBill) {
            resolvedBills.append(explicitBill)
        }

        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        let scopedTargets = selectedTargets.isEmpty ? repTargets : selectedTargets

        let coreLive = normalizedNonEmpty(package.scriptCore?.liveScriptCore)
            ?? generatedFallbackScript(title: issueTitle, actionSentence: canonicalContext?.commonAsk, isVoicemail: false)
        let coreVoicemail = normalizedNonEmpty(package.scriptCore?.voicemailScriptCore)
            ?? generatedFallbackScript(title: issueTitle, actionSentence: canonicalContext?.commonAsk, isVoicemail: true)

        let briefs: [CivicCallBrief] = scopedTargets.map { target in
            let targetRepID = stableRepID(for: target.official)
            let overlay = package.officeOverlays.first(where: { !$0.repID.isEmpty && $0.repID == targetRepID })
                ?? package.officeOverlays.first(where: { Self.normalizeNameKey($0.repName) == Self.normalizeNameKey(target.official.name) })
                ?? package.officeOverlays.first(where: { overlay in
                    let chamber = overlay.chamber.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    if chamber == "house" { return target.slot == .house }
                    if chamber == "senate" { return target.slot == .senate1 || target.slot == .senate2 }
                    return false
                })

            let liveTemplate = normalizedNonEmpty(overlay?.liveScriptFinal) ?? coreLive
            let voicemailTemplate = normalizedNonEmpty(overlay?.voicemailScriptFinal) ?? coreVoicemail
            let repLastName = target.official.name
                .split(separator: " ")
                .last
                .map(String.init) ?? target.official.name
            let liveScript = interpolateExampleScript(
                liveTemplate,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: resolvedBills.first
            )
            let voicemailScript = interpolateExampleScript(
                voicemailTemplate,
                officialTitle: target.officeType,
                officialLastName: repLastName,
                billOrResolution: resolvedBills.first
            )
            let relatedCommittees = Array(Set((overlay?.relatedCommittees ?? []).compactMap { normalizedNonEmpty($0) })).sorted()
            let relevanceBadges = fallbackRelevance(for: target, billRef: resolvedBills.first)

            return CivicCallBrief(
                id: UUID().uuidString,
                repID: targetRepID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: relevanceBadges,
                relatedBills: resolvedBills,
                relatedCommittees: relatedCommittees,
                liveScript: liveScript,
                voicemailScript: voicemailScript,
                talkingPoints: [
                    "Issue: \(issueTitle)",
                    "Explicit ask: \(canonicalContext?.commonAsk ?? ask.title)",
                    "End with a courteous thank-you."
                ],
                issueID: issueID,
                repSlot: target.slot
            )
        }

        let resolvedCommittees = Array(
            Set(package.officeOverlays.flatMap { overlay in
                overlay.relatedCommittees.compactMap { normalizedNonEmpty($0) }
            })
        ).sorted()

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: issueTitle,
            issueSummary: issueSummary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: resolvedCommittees,
                agencies: []
            ),
            callBriefs: briefs
        )
    }

    func fallbackOfficialForPlaceholder(brief: CivicCallBrief) -> Official? {
        if let slot = brief.repSlot, let official = officialBySlot[slot] {
            return official
        }

        let normalizedOfficeType = brief.officeType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedOfficeType.contains("senator") {
            let senateTargets = repTargets.filter { $0.slot == .senate1 || $0.slot == .senate2 }
            guard senateTargets.count == 1 else {
                logger.notice("Placeholder official recovery aborted due to ambiguous senate target mapping.")
                return nil
            }
            return senateTargets.first?.official
        }
        if normalizedOfficeType.contains("representative") || normalizedOfficeType.contains("congress") {
            let houseTargets = repTargets.filter { $0.slot == .house }
            guard houseTargets.count == 1 else {
                logger.notice("Placeholder official recovery aborted due to ambiguous house target mapping.")
                return nil
            }
            return houseTargets.first?.official
        }
        logger.notice("Placeholder official recovery aborted because office text did not map to an unambiguous slot.")
        return nil
    }

    func resolvedPrimaryPhone(for target: CivicRepTarget) -> String {
        if let phone = normalizedNonEmpty(target.official.officialPhone) {
            return phone
        }
        if let fallbackOffice = normalizedNonEmpty(target.officeType), fallbackOffice.lowercased().contains("senator") {
            return "(202) 224-3121"
        }
        return "(202) 225-3121"
    }

    func fallbackResolution(
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> CivicIssueResolutionResponse {
        let issueID = UUID().uuidString
        let title = deriveIssueTitle(from: concernText)
        let summary = concernText.trimmingCharacters(in: .whitespacesAndNewlines)

        let selectedTargets = repTargets.filter { selectedSlots.contains($0.slot) }
        let explicitBillRef = normalizedBillReference(optionalBillRef)
        var resolvedBills: [String] = explicitBillRef.map { [$0] } ?? []
        var briefs: [CivicCallBrief] = []

        for target in selectedTargets {
            let repID = stableRepID(for: target.official)
            let selectedBillRef = explicitBillRef
            if let selectedBillRef, !containsCaseInsensitive(resolvedBills, value: selectedBillRef) {
                resolvedBills.append(selectedBillRef)
            }

            let reasons = fallbackRelevance(for: target, billRef: selectedBillRef)
            let (live, voicemail, points) = composeScripts(
                repName: target.official.name,
                issueTitle: title,
                ask: ask,
                billRef: selectedBillRef,
                zip: resolvedUserZip,
                reasons: reasons
            )

            let brief = CivicCallBrief(
                id: UUID().uuidString,
                repID: repID,
                repName: target.official.name,
                officeType: target.officeType,
                primaryPhoneNumber: resolvedPrimaryPhone(for: target),
                localOfficePhoneNumber: nil,
                relevanceBadges: reasons,
                relatedBills: selectedBillRef.map { [$0] } ?? [],
                relatedCommittees: [],
                liveScript: live,
                voicemailScript: voicemail,
                talkingPoints: points,
                issueID: issueID,
                repSlot: target.slot
            )

            briefs.append(brief)
        }

        return CivicIssueResolutionResponse(
            issueID: issueID,
            issueTitle: title,
            issueSummary: summary,
            resolvedEntities: CivicResolvedEntities(
                bills: resolvedBills,
                committees: [],
                agencies: []
            ),
            callBriefs: briefs
        )
    }

    func vettedGeneratedResolution(
        _ response: CivicIssueResolutionResponse,
        concernText: String,
        ask: CivicAsk,
        selectedSlots: [CivicRepSlot],
        optionalBillRef: String?
    ) -> (resolution: CivicIssueResolutionResponse, usedFallback: Bool) {
        let validation = generatedResolutionValidation(
            response,
            concernText: concernText,
            ask: ask,
            optionalBillRef: optionalBillRef
        )
        let sanitized = validation.sanitized
        let shouldFallback = validation.shouldFallback
        if shouldFallback {
            let fallback = fallbackResolution(
                concernText: concernText,
                ask: ask,
                selectedSlots: selectedSlots,
                optionalBillRef: optionalBillRef
            )
            return (fallback, true)
        }
        return (sanitized, false)
    }

    // MARK: – Script Composition

    func composeScripts(
        repName: String,
        issueTitle: String,
        ask: CivicAsk,
        billRef: String?,
        zip: String,
        reasons: [String]
    ) -> (String, String, [String]) {
        let billFragment = billRef.map { " \($0)" } ?? " this issue"
        let factLine = reasons.first ?? "This issue is currently active in Congress."

        let liveBase = "Hi, my name is [Your Name], and I am a constituent in ZIP \(zip). I am calling about \(issueTitle). I'm urging \(repName) to \(ask.scriptPhrase)\(billFragment). \(factLine). Thank you for your time."

        let voicemailBase = "Hi, constituent in ZIP \(zip) calling about \(issueTitle). I'm urging \(repName) to \(ask.scriptPhrase)\(billFragment). Thank you."

        let liveScript = trimToWordLimit(liveBase, maxWords: 90)
        let voicemailScript = trimToWordLimit(voicemailBase, maxWords: 50)

        let points: [String] = [
            "Constituent location: ZIP \(zip)",
            "Explicit ask: \(ask.title)\(billRef.map { " \($0)" } ?? " this issue")",
            "Close with a clear thank-you."
        ]

        return (liveScript, voicemailScript, points)
    }

    func deriveIssueTitle(from concern: String) -> String {
        let trimmed = concern.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Constituent issue" }

        if let sentenceEnd = trimmed.firstIndex(where: { [".", "!", "?", "\n"].contains($0) }) {
            let sentence = String(trimmed[..<sentenceEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
            if sentence.count > 6 {
                return trimToWordLimit(sentence, maxWords: 9)
            }
        }
        return trimToWordLimit(trimmed, maxWords: 9)
    }

    func canonicalIssueDisplayTitle(from canonicalIssue: String) -> String {
        let trimmed = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        let tokens = trimmed
            .split(separator: "-")
            .map(String.init)
            .filter { !$0.isEmpty }

        guard !tokens.isEmpty else { return "" }

        return tokens.map { token in
            if token.count <= 3 {
                return token.uppercased()
            }
            return token.prefix(1).uppercased() + token.dropFirst().lowercased()
        }.joined(separator: " ")
    }

    func curatedIssueBillReference(for canonicalIssue: String) -> String? {
        let key = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return nil }

        let mapping: [String: String] = [
            "oppose-the-save-america-act": "SAVE America Act",
            "save-america-act": "SAVE America Act",
            "stop-unauthorized-military-strikes-on-iran": "War Powers Resolution"
        ]
        return mapping[key]
    }

    func inferredIssueCommittees(
        canonicalIssue: String,
        concernText: String,
        currentStatus: String
    ) -> [String] {
        let key = canonicalIssue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let context = "\(key) \(concernText.lowercased()) \(currentStatus.lowercased())"

        func containsAny(_ tokens: [String]) -> Bool {
            tokens.contains { context.contains($0) }
        }

        var committees: [String] = []
        if containsAny(["crypto", "cryptocurrency", "digital asset", "stablecoin", "token"]) {
            committees.append(contentsOf: ["Banking, Housing, and Urban Affairs", "Financial Services", "Agriculture"])
        }
        if containsAny(["tsa", "aviation", "airport", "checkpoint", "travel delays"]) {
            committees.append(contentsOf: ["Commerce, Science, and Transportation", "Homeland Security"])
        }
        if containsAny(["flood", "fema", "disaster", "recovery"]) {
            committees.append(contentsOf: ["Appropriations", "Homeland Security", "Transportation and Infrastructure"])
        }
        if containsAny(["war powers", "iran", "foreign policy", "military"]) {
            committees.append(contentsOf: ["Foreign Relations", "Armed Services"])
        }
        if containsAny(["oversight", "accountability", "executive", "white house", "presidential"]) {
            committees.append(contentsOf: ["Judiciary", "Oversight and Government Reform", "Homeland Security and Governmental Affairs"])
        }

        var ordered: [String] = []
        for item in committees {
            let cleaned = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { continue }
            if !ordered.contains(where: { normalizeCommitteeName($0) == normalizeCommitteeName(cleaned) }) {
                ordered.append(cleaned)
            }
        }
        return ordered
    }

    func fallbackRelevance(for target: CivicRepTarget, billRef: String?) -> [String] {
        var reasons: [String] = []
        switch target.slot {
        case .house:
            reasons.append("Represents your House district")
            reasons.append("House chamber relevance")
        case .senate1, .senate2:
            reasons.append("Represents your state in the Senate")
            reasons.append("Senate chamber relevance")
        }
        if let billRef, !billRef.isEmpty {
            reasons.insert("Related to \(billRef)", at: 0)
        } else {
            reasons.append("No public position found")
        }
        return reasons
    }

    func normalizedBillReference(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let cleaned = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        guard !cleaned.isEmpty else { return nil }
        if cleaned.localizedCaseInsensitiveContains("[BILL_OR_RESOLUTION]") {
            return nil
        }
        return cleaned
    }

    func containsCaseInsensitive(_ values: [String], value: String) -> Bool {
        values.contains { existing in
            existing.caseInsensitiveCompare(value) == .orderedSame
        }
    }
}
