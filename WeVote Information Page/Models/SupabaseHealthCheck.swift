import Foundation
import OSLog

struct SupabaseHealthStatus: Sendable {
    let isHealthy: Bool
    let error: Error?
    let statusCode: Int?
}

enum SupabaseHealthCheck {
    private static let logger = Logger(subsystem: "VoteNow", category: "SupabaseHealthCheck")

    /// Lightweight connectivity ping to Supabase Auth settings endpoint.
    static func run(config: SupabaseConfig = .current) async -> SupabaseHealthStatus {
        var request = URLRequest(url: config.url.appending(path: "auth/v1/settings"))
        request.httpMethod = "GET"
        request.timeoutInterval = 8
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.anonKey)", forHTTPHeaderField: "Authorization")

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let statusCode = (response as? HTTPURLResponse)?.statusCode
            let isHealthy = {
                guard let statusCode else { return false }
                return (200..<300).contains(statusCode)
            }()

            if isHealthy {
                logger.info("Supabase health check passed with status \(statusCode ?? -1)")
            } else {
                logger.error("Supabase health check failed with status \(statusCode ?? -1)")
            }

            return SupabaseHealthStatus(
                isHealthy: isHealthy,
                error: nil,
                statusCode: statusCode
            )
        } catch {
            logger.error("Supabase health check error: \(error.localizedDescription, privacy: .public)")
            return SupabaseHealthStatus(
                isHealthy: false,
                error: error,
                statusCode: nil
            )
        }
    }
}
