import Foundation
import OSLog
import Supabase

enum GovHelpServiceError: LocalizedError {
    case invalidResponse
    case serverMessage(String)
    case httpStatus(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The assistant returned an unreadable response. Please try again."
        case .serverMessage(let message):
            return message
        case .httpStatus(let status, let message):
            if message.isEmpty {
                return "Government help request failed (\(status)). Please try again."
            }
            return message
        }
    }
}

final class GovHelpService {
    private let client: AppSupabaseClient
    private let logger = Logger(subsystem: "Civica", category: "GovHelpService")
    private let legacyFunctionSlug = "super-function"

    init(client: AppSupabaseClient = SupabaseClientProvider.shared.client) {
        self.client = client
    }

    func send(_ request: GovHelpRequestPayload) async throws -> GovHelpResponsePayload {
        try await SupabaseManager.shared.signInAnonymouslyIfNeeded()

        let session = try await resolveSession()
        let configuredFunctionSlug = SupabaseConfig.current.govHelpFunctionSlug
        let configuredEndpoint = edgeFunctionURL(functionSlug: configuredFunctionSlug)
        var activeEndpoint = configuredEndpoint

        let primaryBody = try JSONEncoder().encode(request)
        var result = try await sendHTTP(
            endpoint: activeEndpoint,
            accessToken: session.accessToken,
            body: primaryBody
        )

        if result.statusCode == 404,
           configuredFunctionSlug != legacyFunctionSlug,
           isFunctionNotFoundResponse(result.data) {
            logger.warning("GovHelp function slug '\(configuredFunctionSlug, privacy: .public)' not found; retrying legacy slug.")
            let legacyEndpoint = edgeFunctionURL(functionSlug: legacyFunctionSlug)
            activeEndpoint = legacyEndpoint
            result = try await sendHTTP(
                endpoint: activeEndpoint,
                accessToken: session.accessToken,
                body: primaryBody
            )
        }

        if result.statusCode == 400,
           let errorPayload = try? JSONDecoder().decode(GovHelpErrorPayload.self, from: result.data),
           errorPayload.error.localizedCaseInsensitiveContains("missing required fields: zip and messages[]") {
            logger.debug("GovHelp fallback payload path triggered after 400 response.")
            let fallbackBody = try JSONEncoder().encode(legacyFallbackPayload(from: request))
            result = try await sendHTTP(
                endpoint: activeEndpoint,
                accessToken: session.accessToken,
                body: fallbackBody
            )
        }

        if (200...299).contains(result.statusCode) == false {
            logger.error("GovHelp request failed status=\(result.statusCode)")
            if let errorPayload = try? JSONDecoder().decode(GovHelpErrorPayload.self, from: result.data) {
                let detailedMessage: String
                if let detail = errorPayload.detail?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !detail.isEmpty {
                    detailedMessage = "\(errorPayload.error): \(detail)"
                } else {
                    detailedMessage = errorPayload.error
                }
                throw GovHelpServiceError.serverMessage(detailedMessage)
            }
            if result.statusCode == 404, isFunctionNotFoundResponse(result.data) {
                throw GovHelpServiceError.serverMessage(
                    "Government help service is not deployed yet for this Supabase project. Deploy edge function 'govhelp' (or keep legacy slug 'super-function')."
                )
            }
            let rawMessage = String(data: result.data, encoding: .utf8) ?? ""
            throw GovHelpServiceError.httpStatus(result.statusCode, rawMessage)
        }

        let decoder = JSONDecoder()
        do {
            let parsed = try decoder.decode(GovHelpResponsePayload.self, from: result.data)
            return parsed
        } catch {
            logger.error("GovHelp decode failed for response payload.")
            throw GovHelpServiceError.invalidResponse
        }
    }

    private func resolveSession() async throws -> SupabaseSession {
        do {
            let session = try await client.auth.session
            if session.isExpired {
                return try await client.auth.refreshSession()
            }
            return session
        } catch {
            return try await client.auth.refreshSession()
        }
    }

    private func edgeFunctionURL(functionSlug: String) -> URL {
        let base = SupabaseConfig.current.url
        return base
            .appendingPathComponent("functions")
            .appendingPathComponent("v1")
            .appendingPathComponent(functionSlug)
    }

    private func sendHTTP(
        endpoint: URL,
        accessToken: String,
        body: Data
    ) async throws -> (statusCode: Int, data: Data) {
        let maxAttempts = 3
        var attempt = 1
        while true {
            do {
                var urlRequest = URLRequest(url: endpoint)
                urlRequest.httpMethod = "POST"
                urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                urlRequest.setValue(SupabaseConfig.current.anonKey, forHTTPHeaderField: "apikey")
                urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                urlRequest.httpBody = body

                let (rawData, response) = try await URLSession.shared.data(for: urlRequest)
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw GovHelpServiceError.invalidResponse
                }
                return (httpResponse.statusCode, rawData)
            } catch {
                let nsError = error as NSError
                let transientNetworkError: Bool
                if nsError.domain == NSURLErrorDomain {
                    switch nsError.code {
                    case NSURLErrorTimedOut,
                         NSURLErrorNetworkConnectionLost,
                         NSURLErrorNotConnectedToInternet,
                         NSURLErrorCannotConnectToHost,
                         NSURLErrorCannotFindHost,
                         NSURLErrorDNSLookupFailed:
                        transientNetworkError = true
                    default:
                        transientNetworkError = false
                    }
                } else {
                    transientNetworkError = false
                }

                guard transientNetworkError, attempt < maxAttempts else {
                    throw error
                }

                attempt += 1
                let delay = UInt64(250_000_000 * attempt)
                logger.warning("GovHelp network request failed transiently; retrying.")
                try await Task.sleep(nanoseconds: delay)
            }
        }
    }

    private func legacyFallbackPayload(from request: GovHelpRequestPayload) -> LegacyGovHelpRequestPayload {
        LegacyGovHelpRequestPayload(
            zip: request.zip,
            reps: request.reps.map {
                LegacyGovHelpRepPayload(
                    repId: $0.repID,
                    name: $0.name,
                    officeLabel: $0.sectionTitle,
                    phone: $0.officialPhone,
                    website: $0.websiteURL
                )
            },
            messages: request.messages
        )
    }

    private func isFunctionNotFoundResponse(_ data: Data) -> Bool {
        struct SupabaseFunctionErrorPayload: Decodable {
            let code: String?
            let message: String?
        }

        if let payload = try? JSONDecoder().decode(SupabaseFunctionErrorPayload.self, from: data) {
            if payload.code?.uppercased() == "NOT_FOUND" {
                return true
            }
            if payload.message?.localizedCaseInsensitiveContains("not found") == true {
                return true
            }
        }

        let raw = String(data: data, encoding: .utf8)?.lowercased() ?? ""
        return raw.contains("not found")
    }
}

private struct LegacyGovHelpRepPayload: Encodable {
    let repId: String
    let name: String
    let officeLabel: String
    let phone: String?
    let website: String?
}

private struct LegacyGovHelpRequestPayload: Encodable {
    let zip: String
    let reps: [LegacyGovHelpRepPayload]
    let messages: [GovHelpConversationTurn]
}
