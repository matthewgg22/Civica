import Foundation
import SwiftUI
import OSLog

// MARK: – Script Chat

extension IssueCallCenterViewModel {

    func logScriptChatTurn(
        role: String,
        messageText: String,
        messageType: String?,
        metadata: [String: String]? = nil
    ) {
        let normalizedRole = role.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedRole == "user" || normalizedRole == "assistant" else { return }
        let normalizedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedText.isEmpty else { return }

        let sessionID = ensureScriptChatSessionID().uuidString
        scriptChatTurnIndex += 1
        let turnIndex = scriptChatTurnIndex
        let packageID = lastGeneratedPackageID
        let normalizedType = messageType?.trimmingCharacters(in: .whitespacesAndNewlines)
        pendingScriptChatTurnPayloads.append(
            ScriptChatTurnPayload(
                sessionID: sessionID,
                packageID: packageID,
                role: normalizedRole,
                turnIndex: turnIndex,
                messageText: normalizedText,
                messageType: (normalizedType?.isEmpty == false) ? normalizedType : nil,
                metadata: metadata
            )
        )
        persistScriptChatState()

        Task {
            await self.flushPendingScriptChatTurns()
        }
    }

    func resetScriptChatSession() {
        scriptChatSessionID = nil
        scriptChatTurnIndex = 0
        persistScriptChatState()
    }

    func flushPendingScriptChatTurns() async {
        guard !isFlushingScriptChatTurns else { return }
        isFlushingScriptChatTurns = true
        defer { isFlushingScriptChatTurns = false }

        while !pendingScriptChatTurnPayloads.isEmpty {
            let payload = pendingScriptChatTurnPayloads[0]
            let userID = await userIDForRequest()
            do {
                try await apiClient.logScriptChatTurn(
                    userID: userID,
                    sessionID: payload.sessionID,
                    packageID: payload.packageID,
                    role: payload.role,
                    turnIndex: payload.turnIndex,
                    messageText: payload.messageText,
                    messageType: payload.messageType,
                    metadata: payload.metadata
                )
                pendingScriptChatTurnPayloads.removeFirst()
                persistScriptChatState()
            } catch {
                if !self.hasLoggedScriptChatTelemetryFailure {
                    self.hasLoggedScriptChatTelemetryFailure = true
                    self.logger.notice(
                        "Script chat telemetry unavailable; retrying silently. \(self.compactLogError(error), privacy: .public)"
                    )
                }
                Task { [weak self] in
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    guard let self else { return }
                    await self.flushPendingScriptChatTurns()
                }
                break
            }
        }
    }

    func restorePersistedScriptChatState() {
        guard let data = UserDefaults.standard.data(forKey: scriptChatStateDefaultsKey) else { return }
        guard let state = attempt("decode PersistedScriptChatState", logger: logger, {
            try JSONDecoder().decode(PersistedScriptChatState.self, from: data)
        }) else {
            logger.warning("Corrupt script chat state in UserDefaults — clearing.")
            UserDefaults.standard.removeObject(forKey: scriptChatStateDefaultsKey)
            return
        }

        if let sessionID = state.sessionID, let parsedSessionID = UUID(uuidString: sessionID) {
            scriptChatSessionID = parsedSessionID
        } else {
            scriptChatSessionID = nil
        }
        scriptChatTurnIndex = max(state.turnIndex, 0)
        pendingScriptChatTurnPayloads = state.pendingPayloads
    }

    func persistScriptChatState() {
        let state = PersistedScriptChatState(
            sessionID: scriptChatSessionID?.uuidString,
            turnIndex: scriptChatTurnIndex,
            pendingPayloads: pendingScriptChatTurnPayloads
        )

        if scriptChatSessionID == nil && scriptChatTurnIndex == 0 && pendingScriptChatTurnPayloads.isEmpty {
            UserDefaults.standard.removeObject(forKey: scriptChatStateDefaultsKey)
            return
        }

        guard let data = attempt("encode PersistedScriptChatState", logger: logger, {
            try JSONEncoder().encode(state)
        }) else { return }
        UserDefaults.standard.set(data, forKey: scriptChatStateDefaultsKey)
    }
}
