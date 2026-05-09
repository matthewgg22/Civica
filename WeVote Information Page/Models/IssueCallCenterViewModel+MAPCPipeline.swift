import Foundation
import SwiftUI
import OSLog

// MARK: – MAPC v3 Pipeline

extension IssueCallCenterViewModel {

    func submitAssistantRequest() async {
        errorMessage = nil
        guard selectedAsk != nil else {
            errorMessage = "Select an explicit ask before generating call briefs."
            return
        }
        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedConcern.isEmpty else {
            errorMessage = "Enter your concern before generating call briefs."
            return
        }
        guard canSubmit else {
            errorMessage = "Enter your concern before generating call briefs."
            return
        }
        do {
            _ = try await resolvedRepSubmissionContext()
        } catch {
            errorMessage = mapcRepResolutionRequiredMessage
            logger.notice("Blocked MAPC submission because representative targets are unresolved.")
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        let userID = await userIDForRequest()
        if mapcPipelineV3Enabled && shouldContinueMAPCV3Clarification {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            prepareForMAPCV3ClarificationFollowUp()
        } else {
            prepareForFreshGeneration()
        }
        guard mapcPipelineV3Enabled else {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            pendingGeneratedResolution = nil
            lastGeneratedPackageID = nil
            requiresDraftApproval = false
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathBlockedLegacy,
                fallbackReason: "v3_disabled",
                sessionResetReason: nil
            )
            errorMessage = mapcV3RecoveryMessage
            logger.notice("Blocked legacy free-text generation because MAPC v3 is disabled.")
            return
        }

        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        await submitAssistantRequestV3(
            userID: userID,
            concernText: trimmedConcern
        )
    }

    func submitAssistantRequestV3(
        userID: String,
        concernText: String
    ) async {
        let isClarificationFollowUp = shouldContinueMAPCV3Clarification
        let preserveSessionForTurn = mapcV3PreserveSessionForNextSubmit
        mapcV3PreserveSessionForNextSubmit = false
        if !isClarificationFollowUp && !preserveSessionForTurn {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            mapcV3PendingSessionID = nil
            mapcV3SessionState = "new"
            mapcV3NeedsClarification = false
            mapcV3ClarificationPrompt = nil
            mapcV3ClarificationTurnCount = 0
            mapcV3MapcApproved = false
            mapcV3AccumulatedContext = []
        }
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        pendingGeneratedResolution = nil
        lastGeneratedPackageID = nil
        requiresDraftApproval = false

        do {
            let prepared = try await apiClient.prepareMAPCV3Selection(
                userID: userID,
                sessionID: mapcV3PendingSessionID,
                sessionState: mapcV3SessionState,
                concernText: concernText,
                accumulatedContext: mapcV3AccumulatedContext,
                clarificationTurnCount: mapcV3ClarificationTurnCount,
                introShown: mapcV3IntroShown,
                mapcApproved: mapcV3MapcApproved,
                userZip: requestUserZip
            )

            mapcV3PendingSessionID = prepared.sessionID
            mapcV3SessionState = prepared.session.sessionState
            mapcV3NeedsClarification = prepared.session.needsClarification
            mapcV3ClarificationPrompt = prepared.session.clarificationPrompt
            mapcV3ClarificationTurnCount = max(0, prepared.session.clarificationTurnCount)
            mapcV3MapcApproved = prepared.session.mapcApproved
            mapcV3AccumulatedContext = prepared.session.accumulatedContext
            mapcV3IntroShown = mapcV3IntroShown || prepared.session.introShown
            mapcV3DisplayIssue = prepared.displayIssue
            mapcV3AskOptions = prepared.options
            mapcV3SelectedOptionID = nil
            mapcV3SelectedDisplayAsk = ""

            if prepared.needsClarification {
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: nil,
                    sessionResetReason: nil
                )
                errorMessage = prepared.clarificationPrompt ?? "I need one detail to make this usable: what issue do you care about most?"
                return
            }
            if prepared.options.isEmpty {
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathOfflineNotice,
                    fallbackReason: "stage2_no_options",
                    sessionResetReason: nil
                )
                errorMessage = "I hit a snag, but I still have your issue. Pick a fix or restate the action you want."
                return
            }

            mapcV3NeedsClarification = false
            mapcV3ClarificationPrompt = nil
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathV3,
                fallbackReason: nil,
                sessionResetReason: nil
            )
            mapcV3LastFailureReasonCode = nil
            errorMessage = nil
            selectedTab = .assistant
        } catch {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            let failureMessage = resolveMAPCV3FailureMessage(for: error)
            errorMessage = failureMessage
            pendingGeneratedResolution = nil
            requiresDraftApproval = false
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathOfflineNotice,
                fallbackReason: compactLogError(error),
                sessionResetReason: nil
            )
            logger.error("MAPC v3 Stage 1/2 failed: \(self.compactLogError(error), privacy: .public)")
        }
    }

    func selectMAPCV3Option(optionID: String) {
        let trimmed = optionID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let option = mapcV3AskOptions.first(where: { $0.optionID == trimmed }) else { return }
        mapcV3SelectedOptionID = option.optionID
        mapcV3SelectedDisplayAsk = option.displayAsk
        mapcV3SessionState = "ask_selected"
    }

    func clearMAPCV3OptionSelection() {
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
    }

    func generateMAPCV3ScriptAfterPreviewConfirmation() async {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // New flow order: this can be invoked immediately after ask selection to build preview content.
        guard mapcPipelineV3Enabled else { return }
        let normalizedState = mapcV3SessionState
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if requiresDraftApproval,
           pendingGeneratedResolution != nil,
           normalizedState == "preview_shown" || normalizedState == "script_shown" {
            mapcV3SessionState = "preview_shown"
            errorMessage = nil
            return
        }
        guard let selectedOptionID = mapcV3SelectedOptionID,
              let sessionID = mapcV3PendingSessionID else {
            errorMessage = "Pick one ask option before confirming preview."
            return
        }
        let selectedOption = mapcV3AskOptions.first(where: { $0.optionID == selectedOptionID })
        let selectedOptionLabel = selectedOption?.displayAsk ?? "<missing-option-label>"
        let resolvedAsk = civicAsk(from: selectedOption?.askType) ?? selectedAsk ?? .support
        selectedAsk = resolvedAsk

        isSubmitting = true
        defer { isSubmitting = false }

        let trimmedConcern = concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBill = optionalBillRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let userID = await userIDForRequest()
        let resolvedRepContext: (slots: [CivicRepSlot], targets: [CivicRepTarget])
        do {
            resolvedRepContext = try await resolvedRepSubmissionContext()
        } catch {
            errorMessage = mapcRepResolutionRequiredMessage
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathV3,
                fallbackReason: "stage3_rep_targets_unresolved",
                sessionResetReason: nil
            )
            logger.notice("Blocked MAPC stage 3/4 generation because representative targets are unresolved.")
            return
        }
        let validationConcernText = mapcV3ValidationConcernText(
            concernText: trimmedConcern,
            selectedOptionLabel: selectedOptionLabel
        )
        let useRelaxedTopicValidation = shouldUseRelaxedMAPCV3TopicValidation(
            concernText: trimmedConcern
        )
        logger.debug(
            "MAPC stage3/4 preflight session_state=\(self.mapcV3SessionState, privacy: .public) session_id_present=\(!sessionID.isEmpty, privacy: .public) selected_option_id_present=\(!selectedOptionID.isEmpty, privacy: .public) selected_option_label_len=\(selectedOptionLabel.count, privacy: .public) concern_len=\(trimmedConcern.count, privacy: .public) validation_concern_len=\(validationConcernText.count, privacy: .public) relaxed_topic_validation=\(useRelaxedTopicValidation, privacy: .public) rep_slot_count=\(resolvedRepContext.slots.count, privacy: .public)"
        )
        if normalizedState != "ask_selected" {
            mapcV3SessionState = "ask_selected"
        }
        mapcV3MapcApproved = false

        do {
            let package = try await apiClient.generateMAPCV3ScriptFromSelection(
                userID: userID,
                concernText: trimmedConcern,
                sessionID: sessionID,
                selectedOptionID: selectedOptionID,
                targetReps: resolvedRepContext.slots,
                repTargets: resolvedRepContext.targets,
                optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill,
                userState: resolvedUserState
            )

            switch package.status {
            case .ok:
                let response = resolutionFromScriptPackage(
                    package,
                    concernText: trimmedConcern,
                    ask: resolvedAsk,
                    selectedSlots: resolvedRepContext.slots,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill
                )
                let validation = generatedResolutionValidation(
                    response,
                    concernText: validationConcernText,
                    ask: resolvedAsk,
                    optionalBillRef: trimmedBill.isEmpty ? nil : trimmedBill,
                    relaxedTopicValidation: useRelaxedTopicValidation
                )
                if validation.shouldFallback {
                    if validation.containsDisallowedMeta {
                        // mapc_pipeline_v3 — remove flag check after rollout confirmed
                        // Hard block only when scripts contain disallowed meta/injection markers.
                        pendingGeneratedResolution = nil
                        lastGeneratedPackageID = nil
                        requiresDraftApproval = false
                        mapcV3SessionState = "preview_shown"
                        mapcV3NeedsClarification = false
                        mapcV3ClarificationPrompt = nil
                        mapcV3MapcApproved = false
                        mapcV3BackgroundText = package.canonicalContext?.summaryPlain ?? ""
                        errorMessage = mapcV3RecoveryMessage
                        recordMAPCGenerationTelemetry(
                            path: mapcGenerationPathBlockedLegacy,
                            fallbackReason: "v3_validation_hard_block_disallowed_meta",
                            sessionResetReason: nil
                        )
                        logger.warning("Blocked MAPC v3 preview handoff due to disallowed script meta markers.")
                        return
                    }
                    // Soft-continue: do not surface "snag" for over-strict local readability/topic heuristics.
                    let offTopicFlag = validation.offTopic ? "true" : "false"
                    let unreadableFlag = validation.unreadableScripts ? "true" : "false"
                    let relaxedFlag = useRelaxedTopicValidation ? "true" : "false"
                    let softContinueMessage =
                        "MAPC v3 validation soft-continue " +
                        "off_topic=\(offTopicFlag) " +
                        "unreadable_scripts=\(unreadableFlag) " +
                        "relaxed_topic_validation=\(relaxedFlag)"
                    logger.warning("\(softContinueMessage, privacy: .public)")
                    recordMAPCGenerationTelemetry(
                        path: mapcGenerationPathV3,
                        fallbackReason: "v3_validation_soft_continue",
                        sessionResetReason: nil
                    )
                }
                let finalResponse = validation.sanitized
                mapcV3LastFailureReasonCode = nil
                errorMessage = nil
                applyResolution(finalResponse)
                pendingGeneratedResolution = finalResponse
                if let resolvedSessionID = apiClient.mapcV3ResolvedSessionID(from: sessionID) {
                    mapcV3PendingSessionID = resolvedSessionID
                }
                lastGeneratedPackageID = package.packageID
                requiresDraftApproval = true
                // Preview is now shown before final "Looks right" confirmation.
                mapcV3SessionState = "preview_shown"
                mapcV3NeedsClarification = false
                mapcV3ClarificationPrompt = nil
                mapcV3MapcApproved = false
                mapcV3BackgroundText = package.canonicalContext?.summaryPlain ?? ""
                mapcV3AskOptions = []
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: nil,
                    sessionResetReason: nil
                )
                saveSnapshot()
                selectedRepFilter = .all
                selectedTab = .assistant
                Task { [userID] in
                    await self.refreshCallScoreData(for: userID)
                }
            case .needsClarification:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                mapcV3SessionState = "issue_received"
                mapcV3NeedsClarification = true
                let hint = package.reviewRegenerateHint.trimmingCharacters(in: .whitespacesAndNewlines)
                if hint.isEmpty {
                    errorMessage = "I need one detail to make this usable: what issue do you care about most?"
                    mapcV3ClarificationPrompt = "I need one detail to make this usable: what issue do you care about most?"
                } else {
                    errorMessage = hint
                    mapcV3ClarificationPrompt = hint
                }
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: "stage3_needs_clarification",
                    sessionResetReason: nil
                )
            case .refused:
                pendingGeneratedResolution = nil
                lastGeneratedPackageID = nil
                requiresDraftApproval = false
                mapcV3SessionState = "issue_received"
                errorMessage = package.truthTrace?.refusalReason ?? package.reviewRegenerateHint
                recordMAPCGenerationTelemetry(
                    path: mapcGenerationPathV3,
                    fallbackReason: "stage4_refused",
                    sessionResetReason: nil
                )
            }
        } catch {
            let failureNSError = error as NSError
            logger.error(
                "MAPC stage3/4 request/parse failure location=\(#fileID, privacy: .public):\(#line, privacy: .public) function=\(#function, privacy: .public) domain=\(failureNSError.domain, privacy: .public) code=\(failureNSError.code, privacy: .public)"
            )
            let nsError = error as NSError
            if nsError.domain == "CivicIssueCallAPIClient", nsError.code == -31_009 {
                logger.notice(
                    "MAPC v3 Stage 3/4 ignored stale terminal background call session_state=\(self.mapcV3SessionState, privacy: .public)"
                )
                errorMessage = nil
                return
            }
            pendingGeneratedResolution = nil
            lastGeneratedPackageID = nil
            requiresDraftApproval = false
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            let failureMessage = resolveMAPCV3FailureMessage(for: error)
            errorMessage = failureMessage
            recordMAPCGenerationTelemetry(
                path: mapcGenerationPathOfflineNotice,
                fallbackReason: compactLogError(error),
                sessionResetReason: nil
            )
            logger.error("MAPC v3 Stage 3/4 failed: \(self.compactLogError(error), privacy: .public)")
        }
    }

    func isMAPCV3TransportFailure(_ error: Error) -> Bool {
        if error is URLError { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain { return true }
        if nsError.domain == NSCocoaErrorDomain && (nsError.code == 4865 || nsError.code == 3840) {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            // Upstream returned empty/invalid JSON payload; treat as recoverable transport-style failure.
            return true
        }
        return nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 502
    }

    func resolveMAPCV3FailureMessage(for error: Error) -> String {
        if isMAPCV3TransportFailure(error) {
            mapcV3LastFailureReasonCode = "transport_failure"
            return mapcV3RecoveryMessage
        }
        let nsError = error as NSError
        let lowered = nsError.localizedDescription.lowercased()
        mapcV3LastFailureReasonCode =
            extractedMAPCV3ReasonCode(from: nsError.localizedDescription)
            ?? inferredMAPCV3ReasonCode(from: lowered)
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 404 {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "route_not_found"
            return "MAPC v3 API route is unavailable. Confirm /api/v2/civic/mapc endpoints are deployed."
        }
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 401 {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "unauthorized"
            return "Session expired. Please reopen Civica and try again."
        }
        if lowered.contains("feature_flag_disabled") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "feature_flag_disabled"
            return "MAPC v3 is disabled on the backend."
        }
        if lowered.contains("placeholder_leak") || lowered.contains("disallowed token remained") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "placeholder_leak"
            return "I kept your issue, but the script had an unfilled placeholder. Tap Fix this and I'll regenerate it."
        }
        if lowered.contains("missing_selected_option") || lowered.contains("invalid_selected_option") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "invalid_selected_option"
            return "I kept your issue, but the selected ask did not sync. Tap an ask option again."
        }
        if lowered.contains("selected_other_option_requires_follow_up") {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "selected_other_option_requires_follow_up"
            return "Tell me your issue concern in one sentence and I'll regenerate your ask options."
        }
        if lowered.contains("invalid_initial_state") || lowered.contains("invalid_state_transition") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "invalid_state_transition"
            return "I kept your issue, but the session got out of sync. Tap an ask option again."
        }
        if lowered.contains("preview_not_confirmed") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "preview_not_confirmed"
            return "Please confirm the preview before generating the script."
        }
        if nsError.domain == "CivicIssueCallAPIClient"
            && nsError.code == 400
            && mapcV3LastFailureReasonCode == "reason_code_missing" {
            return "I kept your issue, but the server response was incomplete. Tap an ask option again."
        }
        if lowered.contains("universal_script_lint_failed")
            && (lowered.contains("placeholder:") || lowered.contains("[name]") || lowered.contains("[your name]")) {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "universal_script_lint_failed"
            return "I kept your issue, but the script still had a placeholder. Tap Fix this and I'll regenerate it."
        }
        if lowered.contains("universal_script_lint_failed") {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "universal_script_lint_failed"
            return mapcV3LintRecoveryMessage
        }
        if nsError.domain == "CivicIssueCallAPIClient" && nsError.code == 400 {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "bad_request"
            return "I kept your issue, but this request did not sync. Tap your ask option again."
        }
        if nsError.domain == "CivicIssueCallAPIClient"
            && [-31_006, -31_007, -31_008].contains(nsError.code) {
            mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "pending_state_missing"
            return mapcV3RecoveryMessage
        }
        mapcV3LastFailureReasonCode = mapcV3LastFailureReasonCode ?? "unknown_error"
        return mapcV3RecoveryMessage
    }

    func extractedMAPCV3ReasonCode(from description: String) -> String? {
        let source = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !source.isEmpty else { return nil }
        if let range = source.range(of: #""reason_code"\s*:\s*"([^"]+)""#, options: .regularExpression) {
            let matched = String(source[range])
            if let capture = matched.split(separator: "\"").dropFirst(3).first {
                let reason = String(capture).trimmingCharacters(in: .whitespacesAndNewlines)
                return reason.isEmpty ? nil : reason
            }
        }
        return nil
    }

    func inferredMAPCV3ReasonCode(from loweredDescription: String) -> String? {
        let knownCodes = [
            "feature_flag_disabled",
            "placeholder_leak",
            "missing_selected_option",
            "invalid_selected_option",
            "selected_other_option_requires_follow_up",
            "invalid_initial_state",
            "invalid_state_transition",
            "preview_not_confirmed",
            "universal_script_lint_failed",
            "pending_state_missing",
        ]
        if let match = knownCodes.first(where: { loweredDescription.contains($0) }) {
            return match
        }
        if loweredDescription.contains("reason_code") {
            return "reason_code_missing"
        }
        return nil
    }

    // mapc_pipeline_v3 — remove flag check after rollout confirmed
    // Test helper for strict reason_code-to-copy contract assertions.
    func mapcV3FailureMappingPreview(
        description: String,
        domain: String = "CivicIssueCallAPIClient",
        code: Int = 400
    ) -> (message: String, reasonCode: String?) {
        let error = NSError(
            domain: domain,
            code: code,
            userInfo: [NSLocalizedDescriptionKey: description]
        )
        let message = resolveMAPCV3FailureMessage(for: error)
        return (message, mapcV3LastFailureReasonCode)
    }

    func recordMAPCGenerationTelemetry(
        path: String? = nil,
        fallbackReason fallbackReasonValue: String? = nil,
        sessionResetReason sessionResetReasonValue: String? = nil
    ) {
        if let path {
            generationPath = path
        }
        fallbackReason = fallbackReasonValue
        sessionResetReason = sessionResetReasonValue
        logger.notice(
            "MAPC generation telemetry path=\(self.generationPath, privacy: .public) fallback_reason=\((self.fallbackReason ?? "none"), privacy: .public) session_reset_reason=\((self.sessionResetReason ?? "none"), privacy: .public)"
        )
    }

    func blockLegacyPreviewAtHandoff(reason: String) {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathBlockedLegacy,
            fallbackReason: reason,
            sessionResetReason: nil
        )
    }

    func clearDisplayedDraftBeforeNewGeneration() {
        issueTitle = ""
        issueSummary = ""
        resolvedEntities = .empty
        callBriefs = []
        activeBriefID = nil
        loggedOutcomeByBriefID = [:]
        pendingCallLaunch = nil
        lastCompletionResult = nil
        lastGeneratedPackageID = nil
    }

    func resetMAPCV3SelectionState() {
        mapcV3PendingSessionID = nil
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        mapcV3SessionState = "new"
        mapcV3NeedsClarification = false
        mapcV3ClarificationPrompt = nil
        mapcV3ClarificationTurnCount = 0
        mapcV3MapcApproved = false
        mapcV3AccumulatedContext = []
        mapcV3LastFailureReasonCode = nil
    }

    func prepareForMAPCV3ClarificationFollowUp() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = true
        // Backend Stage 1 does not accept script_shown for follow-up turns.
        // Force a valid transition state so subsequent ask/background stages stay in sync.
        mapcV3SessionState = "revising"
        mapcV3MapcApproved = false
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "clarification_follow_up"
        )
    }

    func prepareForMAPCV3RevisionFollowUp() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = true
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // Backend Stage 1 accepts new/issue_received/revising. Revision turns must not reuse script_shown.
        mapcV3SessionState = "revising"
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        mapcV3DisplayIssue = ""
        mapcV3AskOptions = []
        mapcV3SelectedOptionID = nil
        mapcV3SelectedDisplayAsk = ""
        mapcV3BackgroundText = ""
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "revision_follow_up"
        )
    }

    func markMAPCV3IntroShown() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3IntroShown = true
    }

    func markMAPCV3ApprovedByUser() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3MapcApproved = true
    }

    func prepareForFreshGeneration() {
        mapcV3PreserveSessionForNextSubmit = false
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        resetMAPCV3SelectionState()
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "fresh_generation"
        )
    }

    func startOverMAPCV3Session() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        mapcV3PreserveSessionForNextSubmit = false
        clearDisplayedDraftBeforeNewGeneration()
        pendingGeneratedResolution = nil
        requiresDraftApproval = false
        activeMAPCSessionID = nil
        selectedRepFilter = .all
        resetMAPCV3SelectionState()
        recordMAPCGenerationTelemetry(
            path: mapcGenerationPathV3,
            fallbackReason: nil,
            sessionResetReason: "start_over"
        )
    }

    func isMAPCV3TerminalDisplayState(_ state: String) -> Bool {
        let normalized = state.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized == "script_shown" || normalized == "preview_shown"
    }
}
