import Foundation
import Testing
@testable import Civica

// URLProtocol stub that intercepts every request made through a configured
// URLSession. Tests enqueue handlers in order; each handler fires once.
// nonisolated(unsafe) is necessary because URLProtocol subclass methods are
// called on arbitrary URLSession-internal threads.

final class EnrollmentStubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handlers: [(URLRequest) -> (Data, Int)] = []
    nonisolated(unsafe) static var capturedRequests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        EnrollmentStubProtocol.capturedRequests.append(request)
        guard !EnrollmentStubProtocol.handlers.isEmpty else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        let handler = EnrollmentStubProtocol.handlers.removeFirst()
        let (data, status) = handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

// MARK: - Test fixtures

private func packetJSON(
    id: String = "pkt-1",
    status: String = "Draft",
    stateCode: String = "CA"
) -> Data {
    """
    {
        "id": "\(id)",
        "status": "\(status)",
        "state_code": "\(stateCode)",
        "created_at": "2026-05-17T10:00:00.000Z",
        "updated_at": "2026-05-17T10:00:00.000Z",
        "submitted_at": null,
        "notes_for_applicant": null
    }
    """.data(using: .utf8)!
}

private func documentJSON(packetId: String = "pkt-1", kind: String = "photo_id") -> Data {
    """
    {
        "document_id": "doc-1",
        "packet_id": "\(packetId)",
        "applicant_id": "usr-1",
        "storage_path": "handoffs/\(packetId)/doc.jpg",
        "original_filename": "doc.jpg",
        "document_kind": "\(kind)",
        "processing_status": "pending",
        "on_device_quality_passed": true,
        "uploaded_at": "2026-05-17T10:05:00.000Z"
    }
    """.data(using: .utf8)!
}

private func inboxJSON() -> Data {
    """
    [
        {
            "id": "inbox-1",
            "packet_id": "pkt-1",
            "prompt": "Please upload a recent pay stub.",
            "created_at": "2026-05-17T09:00:00.000Z",
            "resolved": false
        }
    ]
    """.data(using: .utf8)!
}

// MARK: - Helpers

private func makeStubSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [EnrollmentStubProtocol.self]
    return URLSession(configuration: config)
}

private let testBaseURL = URL(string: "https://enrollment.test/v1/enrollment")!
private let testToken = "test-bearer-token-xyz"

private func makeClient() -> HTTPEnrollmentAPIClient {
    HTTPEnrollmentAPIClient(
        baseURL: testBaseURL,
        supabaseURL: URL(string: "https://supabase.test")!,
        supabaseAnonKey: "anon-key",
        session: makeStubSession(),
        tokenProvider: { testToken }
    )
}

// MARK: - Tests

// .serialized prevents concurrent test execution, which would cause
// EnrollmentStubProtocol.handlers (nonisolated(unsafe) static) to be
// cleared by one test's init() while another test is mid-flight.
@Suite(.serialized, .enabled(if: keychainAvailableForTests))
struct EnrollmentAPIClientTests {

    init() {
        // Clean state before each test.
        EnrollmentStubProtocol.handlers.removeAll()
        EnrollmentStubProtocol.capturedRequests.removeAll()
    }

    // 1. POST /me/packets encodes state_code in request body.
    @Test func createPacketEncodesStateCodeInBody() async throws {
        EnrollmentStubProtocol.handlers.append { _ in (packetJSON(stateCode: "TX"), 200) }

        let packet = try await makeClient().createPacket(stateCode: "TX")
        #expect(packet.stateCode == "TX")
        #expect(packet.id == "pkt-1")

        let req = EnrollmentStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "POST")
        let body = try JSONDecoder().decode([String: String].self, from: req.httpBody!)
        #expect(body["state_code"] == "TX")
    }

    // 2. PATCH /me/packets/:id attaches X-Transition-Reason header.
    @Test func withdrawPacketAttachesTransitionReasonHeader() async throws {
        EnrollmentStubProtocol.handlers.append { _ in (packetJSON(status: "Closed"), 200) }

        let packet = try await makeClient().withdrawPacket(packetId: "pkt-1", reason: "applicant-withdrew")
        #expect(packet.status == .closed)

        let req = EnrollmentStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "PATCH")
        #expect(req.value(forHTTPHeaderField: "X-Transition-Reason") == "applicant-withdrew")
    }

    // 3. POST /me/packets/:id/documents uses multipart/form-data and includes
    //    the document_kind field in the body.
    @Test func uploadDocumentUsesMultipartFormData() async throws {
        EnrollmentStubProtocol.handlers.append { _ in (documentJSON(kind: "photo_id"), 200) }

        let imageData = Data([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG magic bytes
        let doc = try await makeClient().uploadDocument(
            packetId: "pkt-1",
            imageData: imageData,
            mediaType: "image/jpeg",
            documentKind: .photoId,
            onDeviceQualityPassed: true
        )
        #expect(doc.documentKind == .photoId)

        let req = EnrollmentStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "POST")

        let contentType = req.value(forHTTPHeaderField: "Content-Type") ?? ""
        #expect(contentType.hasPrefix("multipart/form-data; boundary="),
                "Content-Type must be multipart/form-data, got: \(contentType)")

        let bodyText = String(data: req.httpBody ?? Data(), encoding: .utf8) ?? ""
        #expect(bodyText.contains("photo_id"),
                "Multipart body must contain the document_kind value")
        #expect(bodyText.contains("on_device_quality_passed"),
                "Multipart body must contain on_device_quality_passed field")
    }

    // 4. GET /me/inbox decodes the response envelope into [EnrollmentInboxItem].
    @Test func fetchInboxDecodesResponseShape() async throws {
        EnrollmentStubProtocol.handlers.append { _ in (inboxJSON(), 200) }

        let items = try await makeClient().fetchInbox()
        #expect(items.count == 1)
        #expect(items[0].id == "inbox-1")
        #expect(items[0].packetId == "pkt-1")
        #expect(items[0].resolved == false)
        #expect(items[0].prompt == "Please upload a recent pay stub.")
    }

    // 5. Every authenticated request carries a Bearer token in Authorization.
    @Test func everyRequestCarriesBearerToken() async throws {
        // Three separate requests: createPacket, fetchInbox, fetchDocuments.
        EnrollmentStubProtocol.handlers.append { _ in (packetJSON(), 200) }
        EnrollmentStubProtocol.handlers.append { _ in (inboxJSON(), 200) }
        EnrollmentStubProtocol.handlers.append { _ in ("[]".data(using: .utf8)!, 200) }

        let client = makeClient()
        _ = try await client.createPacket(stateCode: "CA")
        _ = try await client.fetchInbox()
        _ = try await client.fetchDocuments(packetId: "pkt-1")

        for req in EnrollmentStubProtocol.capturedRequests {
            let auth = req.value(forHTTPHeaderField: "Authorization") ?? ""
            #expect(auth == "Bearer \(testToken)",
                    "Request to \(req.url?.path ?? "?") missing Bearer token, got: \(auth)")
        }
    }

    // 6. GET /me/active-recert — happy path decodes the response.
    @Test func fetchActiveRecertDecodesRecert() async throws {
        let payload = """
        {
          "recert_id": "rec-001",
          "packet_id": "pkt-001",
          "cert_period_end": "2027-05-18",
          "status": "pending"
        }
        """.data(using: .utf8)!
        EnrollmentStubProtocol.handlers.append { _ in (payload, 200) }

        let result = try await makeClient().fetchActiveRecert()

        #expect(result?.recertId == "rec-001")
        #expect(result?.packetId == "pkt-001")
        #expect(result?.status == "pending")

        let req = EnrollmentStubProtocol.capturedRequests.first!
        #expect(req.url?.path.contains("/me/active-recert") == true)
    }

    // 7. GET /me/active-recert — 404 maps to nil (no active recert).
    @Test func fetchActiveRecertReturnsNilOn404() async throws {
        EnrollmentStubProtocol.handlers.append { _ in
            ("{\"error\":\"No active recertification\"}".data(using: .utf8)!, 404)
        }

        let result = try await makeClient().fetchActiveRecert()
        #expect(result == nil)
    }
}

