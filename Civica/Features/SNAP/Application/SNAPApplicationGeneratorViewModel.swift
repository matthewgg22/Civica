import Foundation

// EXPERIMENTAL SILOED MODULE: drives the application PDF generation
// flow — request bytes from the backend, write to a temp file, surface
// the URL to the SwiftUI share-sheet integration.
//
// The temp file is written under FileManager.default.temporaryDirectory
// and is left for the system to reap. We don't keep a long-lived copy
// because the backend always re-renders on demand and the file
// contains the user's application contents.

@MainActor
final class SNAPApplicationGeneratorViewModel: ObservableObject {
    enum Phase: Equatable {
        case idle
        case generating
        case ready(URL)
        case error(String)
    }

    @Published private(set) var phase: Phase = .idle

    private let client: SNAPNetworkClient
    private let sessionID: String

    init(client: SNAPNetworkClient, sessionID: String) {
        self.client = client
        self.sessionID = sessionID
    }

    func generate() async {
        phase = .generating
        do {
            let data = try await client.generateApplicationPDF(sessionId: sessionID)
            let url = try writeToTempFile(data)
            phase = .ready(url)
        } catch {
            phase = .error(humanizedError(error))
        }
    }

    func reset() {
        phase = .idle
    }

    // MARK: - Helpers

    private func writeToTempFile(_ data: Data) throws -> URL {
        let dir = FileManager.default.temporaryDirectory
        let filename = "civica-snap-summary-\(sessionID.prefix(8)).pdf"
        let url = dir.appendingPathComponent(filename)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])
        return url
    }

    private func humanizedError(_ error: Error) -> String {
        switch error {
        case SNAPNetworkError.invalidURL:
            return "We couldn't reach the server."
        case SNAPNetworkError.unexpectedStatus(let code):
            return "The server returned an unexpected status (\(code))."
        case SNAPNetworkError.decodingFailed:
            return "We received an unexpected response from the server."
        default:
            return "Something went wrong generating your application packet."
        }
    }
}
