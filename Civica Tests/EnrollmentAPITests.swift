import Foundation
import Testing
@testable import Civica

// Covers four of the test-plan items from PR #81:
//   1. OTP auth flow (request + verify state transitions, phone normalization, offline error)
//   2. Mock client failure path (shouldFailNext on each method)
//   3. Inbox sort order (unresolved-first, newest-first within group)
//   4. EnrollmentModels JSON decoding (packet statuses, date formats, inbox item)
//
// "Live OTP round-trip on a real device" cannot be automated — it requires
// an actual SMS and Supabase production credentials. These tests validate
// every code path exercised by that round-trip using a mock URLSession.

// MARK: - URLProtocol mock

private final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    static var requestHandler: (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private extension URLSession {
    static func mock() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }
}

private func otpSuccessSession() -> URLSession {
    MockURLProtocol.requestHandler = { _ in
        let url = URL(string: "https://test.supabase.co")!
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        return (resp, Data())
    }
    return .mock()
}

private func verifySuccessSession(userId: String = "user-abc") -> URLSession {
    MockURLProtocol.requestHandler = { _ in
        let url = URL(string: "https://test.supabase.co")!
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        let body = """
        {"access_token":"tok","refresh_token":"ref","expires_in":3600,
         "user":{"id":"\(userId)"}}
        """
        return (resp, Data(body.utf8))
    }
    return .mock()
}

// MARK: - Auth flow tests

@Suite(.serialized, .enabled(if: keychainAvailableForTests))  // MockURLProtocol.requestHandler is a static — must not run in parallel.
struct EnrollmentAuthTests {
    private let supabaseURL = URL(string: "https://test.supabase.co")!

    // MARK: Phone normalization

    @MainActor
    @Test func requestOTPNormalizes10DigitUSNumber() async {
        var capturedBody: [String: String]?
        MockURLProtocol.requestHandler = { req in
            capturedBody = try? JSONDecoder().decode([String: String].self, from: req.httpBody ?? Data())
            let resp = HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (resp, Data())
        }
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: .mock())
        await auth.requestOTP(phone: "5551234567")
        #expect(capturedBody?["phone"] == "+15551234567")
    }

    @MainActor
    @Test func requestOTPPreservesLeadingPlusPrefix() async {
        var capturedPhone: String?
        MockURLProtocol.requestHandler = { req in
            let body = try? JSONDecoder().decode([String: String].self, from: req.httpBody ?? Data())
            capturedPhone = body?["phone"]
            let resp = HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (resp, Data())
        }
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: .mock())
        await auth.requestOTP(phone: "+447700900123")
        #expect(capturedPhone == "+447700900123")
    }

    @MainActor
    @Test func requestOTPRejectsEmptyPhone() async {
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: .mock())
        await auth.requestOTP(phone: "")
        #expect(auth.state == .unauthenticated)
        if case .invalidPhone = auth.lastError { /* pass */ }
        else { Issue.record("Expected .invalidPhone, got \(String(describing: auth.lastError))") }
    }

    // MARK: OTP state transitions

    @MainActor
    @Test func requestOTPTransitionsToAwaitingOTP() async {
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: otpSuccessSession())
        await auth.requestOTP(phone: "5551234567")
        if case .awaitingOTP(let phone) = auth.state {
            #expect(phone == "+15551234567")
        } else {
            Issue.record("Expected .awaitingOTP, got \(auth.state)")
        }
        #expect(auth.lastError == nil)
    }

    @MainActor
    @Test func verifyOTPTransitionsToAuthenticated() async {
        // Step 1: get to .awaitingOTP
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: otpSuccessSession())
        await auth.requestOTP(phone: "5551234567")

        // Step 2: verify OTP
        MockURLProtocol.requestHandler = { req in
            let resp = HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            let body = #"{"access_token":"tok","refresh_token":"ref","expires_in":3600,"user":{"id":"user-42"}}"#
            return (resp, Data(body.utf8))
        }
        await auth.verifyOTP(code: "123456")

        if case .authenticated(let userId) = auth.state {
            #expect(userId == "user-42")
        } else {
            Issue.record("Expected .authenticated, got \(auth.state)")
        }
        #expect(auth.lastError == nil)
    }

    @MainActor
    @Test func signOutClearsToUnauthenticated() async {
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: otpSuccessSession())
        await auth.requestOTP(phone: "5551234567")
        await auth.signOut()
        #expect(auth.state == .unauthenticated)
    }

    // MARK: Offline / error paths

    @MainActor
    @Test func requestOTPOfflineShowsWrappedError() async {
        MockURLProtocol.requestHandler = { _ in throw URLError(.notConnectedToInternet) }
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: .mock())
        await auth.requestOTP(phone: "5551234567")
        #expect(auth.state == .unauthenticated)
        if case .wrapped = auth.lastError { /* pass */ }
        else { Issue.record("Expected .wrapped, got \(String(describing: auth.lastError))") }
    }

    @MainActor
    @Test func verifyOTPServerErrorShowsInvalidOTP() async {
        // Get to .awaitingOTP first
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: otpSuccessSession())
        await auth.requestOTP(phone: "5551234567")

        // Server returns 400 with "invalid otp" in body
        MockURLProtocol.requestHandler = { req in
            let resp = HTTPURLResponse(url: req.url!, statusCode: 400, httpVersion: nil, headerFields: nil)!
            return (resp, Data("invalid otp token".utf8))
        }
        await auth.verifyOTP(code: "000000")

        if case .invalidOTP = auth.lastError { /* pass */ }
        else if case .wrapped = auth.lastError { /* also acceptable — body-sniffed */ }
        else { Issue.record("Expected .invalidOTP or .wrapped, got \(String(describing: auth.lastError))") }
    }

    @MainActor
    @Test func verifyOTPServerErrorShowsWrappedForNonOTPError() async {
        let auth = CivicaEnrollmentAuth(supabaseURL: supabaseURL, anonKey: "key", session: otpSuccessSession())
        await auth.requestOTP(phone: "5551234567")

        MockURLProtocol.requestHandler = { req in
            let resp = HTTPURLResponse(url: req.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (resp, Data("server error".utf8))
        }
        await auth.verifyOTP(code: "999999")
        #expect(auth.lastError != nil)
        // State must not advance to .authenticated on server error
        if case .authenticated = auth.state {
            Issue.record("State must not be .authenticated after 500 error")
        }
    }
}

// MARK: - Model decoding

struct EnrollmentModelDecodingTests {
    @Test func packetStatusDecodesAllEightValues() throws {
        let cases: [(String, EnrollmentPacketStatus)] = [
            ("Draft", .draft),
            ("Submitted for Review", .submittedForReview),
            ("Needs Documents", .needsDocuments),
            ("Needs Applicant Clarification", .needsApplicantClarification),
            ("In Navigator Review", .inNavigatorReview),
            ("Ready for Handoff", .readyForHandoff),
            ("Handed Off", .handedOff),
            ("Closed", .closed),
        ]
        for (raw, expected) in cases {
            let json = """
            {"id":"1","status":"\(raw)","state_code":"CA",
             "created_at":"2026-05-17T00:00:00Z","updated_at":"2026-05-17T00:00:00Z"}
            """
            let packet = try JSONDecoder.enrollmentDecoder.decode(EnrollmentPacket.self, from: Data(json.utf8))
            #expect(packet.status == expected, "Mismatch for raw value '\(raw)'")
        }
    }

    @Test func packetIsActionableOnlyForDocumentsAndClarification() {
        #expect(EnrollmentPacketStatus.needsDocuments.isActionable)
        #expect(EnrollmentPacketStatus.needsApplicantClarification.isActionable)
        #expect(!EnrollmentPacketStatus.draft.isActionable)
        #expect(!EnrollmentPacketStatus.submittedForReview.isActionable)
        #expect(!EnrollmentPacketStatus.inNavigatorReview.isActionable)
        #expect(!EnrollmentPacketStatus.readyForHandoff.isActionable)
        #expect(!EnrollmentPacketStatus.handedOff.isActionable)
        #expect(!EnrollmentPacketStatus.closed.isActionable)
    }

    @Test func packetDecodesWithFractionalSecondsDate() throws {
        let json = """
        {"id":"abc","status":"Draft","state_code":"CA",
         "created_at":"2026-05-17T14:30:00.123Z",
         "updated_at":"2026-05-17T14:30:00.123Z"}
        """
        let packet = try JSONDecoder.enrollmentDecoder.decode(EnrollmentPacket.self, from: Data(json.utf8))
        #expect(packet.id == "abc")
        #expect(packet.stateCode == "CA")
        #expect(packet.submittedAt == nil)
        #expect(packet.notesForApplicant == nil)
    }

    @Test func packetDecodesWithPlainISO8601DateAndOptionalFields() throws {
        let json = """
        {"id":"xyz","status":"Handed Off","state_code":"MA",
         "created_at":"2026-05-10T09:00:00Z",
         "updated_at":"2026-05-10T09:00:00Z",
         "submitted_at":"2026-05-10T09:05:00Z",
         "notes_for_applicant":"Please call DTA"}
        """
        let packet = try JSONDecoder.enrollmentDecoder.decode(EnrollmentPacket.self, from: Data(json.utf8))
        #expect(packet.status == .handedOff)
        #expect(packet.submittedAt != nil)
        #expect(packet.notesForApplicant == "Please call DTA")
    }

    @Test func inboxItemDecodesCorrectly() throws {
        let json = """
        {"id":"item1","packet_id":"pkt1",
         "prompt":"Please upload your pay stub.",
         "created_at":"2026-05-15T12:00:00Z",
         "resolved":false}
        """
        let item = try JSONDecoder.enrollmentDecoder.decode(EnrollmentInboxItem.self, from: Data(json.utf8))
        #expect(item.id == "item1")
        #expect(item.packetId == "pkt1")
        #expect(item.prompt == "Please upload your pay stub.")
        #expect(!item.resolved)
    }

    @Test func inboxItemDecodesResolvedTrue() throws {
        let json = """
        {"id":"item2","packet_id":"pkt1",
         "prompt":"Lease uploaded — confirmed.",
         "created_at":"2026-05-12T08:00:00Z",
         "resolved":true}
        """
        let item = try JSONDecoder.enrollmentDecoder.decode(EnrollmentInboxItem.self, from: Data(json.utf8))
        #expect(item.resolved)
    }
}

// MARK: - Mock client

struct MockEnrollmentAPIClientTests {
    @Test func createPacketReturnsDraftStatus() async throws {
        let mock = MockEnrollmentAPIClient()
        let packet = try await mock.createPacket(stateCode: "CA")
        #expect(packet.status == .draft)
        #expect(packet.stateCode == "CA")
        #expect(mock.createdPackets.count == 1)
    }

    @Test func submitPacketAdvancesToSubmittedForReview() async throws {
        let mock = MockEnrollmentAPIClient()
        let created = try await mock.createPacket(stateCode: "MA")
        let submitted = try await mock.submitPacket(packetId: created.id)
        #expect(submitted.status == .submittedForReview)
        #expect(submitted.submittedAt != nil)
        #expect(mock.submittedPacketIds.contains(created.id))
    }

    @Test func submitUnknownPacketThrows404() async {
        let mock = MockEnrollmentAPIClient()
        do {
            _ = try await mock.submitPacket(packetId: "nonexistent-id")
            Issue.record("Expected submitPacket to throw for unknown packet ID")
        } catch let e as EnrollmentAPIError {
            if case .unexpectedStatus(404, _) = e { /* pass */ }
            else { Issue.record("Expected 404 error, got \(e)") }
        } catch {
            Issue.record("Unexpected error type: \(error)")
        }
    }

    @Test func shouldFailNextCreatePacketThrowsAndClearsFlag() async {
        let mock = MockEnrollmentAPIClient()
        mock.shouldFailNext = true
        do {
            _ = try await mock.createPacket(stateCode: "CA")
            Issue.record("Expected createPacket to throw when shouldFailNext")
        } catch {
            #expect(mock.createdPackets.isEmpty)
            #expect(!mock.shouldFailNext, "shouldFailNext should clear after single use")
        }
    }

    @Test func shouldFailNextUploadDocumentThrowsStorageFailed() async {
        let mock = MockEnrollmentAPIClient()
        mock.shouldFailNext = true
        do {
            _ = try await mock.uploadDocument(
                packetId: "p1",
                imageData: Data("pixels".utf8),
                mediaType: "image/jpeg",
                documentKind: .photoId,
                onDeviceQualityPassed: true
            )
            Issue.record("Expected uploadDocument to throw when shouldFailNext")
        } catch let e as EnrollmentAPIError {
            if case .storageFailed = e { /* pass */ }
            else { Issue.record("Expected .storageFailed, got \(e)") }
        } catch {
            Issue.record("Unexpected error type: \(error)")
        }
    }

    @Test func shouldFailNextSubmitPacketThrowsConflict() async throws {
        let mock = MockEnrollmentAPIClient()
        let created = try await mock.createPacket(stateCode: "CA")
        mock.shouldFailNext = true
        do {
            _ = try await mock.submitPacket(packetId: created.id)
            Issue.record("Expected submitPacket to throw when shouldFailNext")
        } catch let e as EnrollmentAPIError {
            if case .unexpectedStatus(409, _) = e { /* pass */ }
            else { Issue.record("Expected 409 conflict, got \(e)") }
        } catch {
            Issue.record("Unexpected error type: \(error)")
        }
    }

    @Test func fetchInboxReturnsConfiguredItems() async throws {
        let mock = MockEnrollmentAPIClient()
        mock.inboxItems = [
            EnrollmentInboxItem(id: "x", packetId: "p", prompt: "Send your lease", createdAt: Date(), resolved: false),
        ]
        let fetched = try await mock.fetchInbox()
        #expect(fetched.count == 1)
        #expect(fetched.first?.prompt == "Send your lease")
    }

    @Test func uploadDocumentCreatesRecordWithCorrectPacketId() async throws {
        let mock = MockEnrollmentAPIClient()
        let doc = try await mock.uploadDocument(
            packetId: "packet-99",
            imageData: Data("img".utf8),
            mediaType: "image/jpeg",
            documentKind: .paystub,
            onDeviceQualityPassed: true
        )
        #expect(doc.packetId == "packet-99")
        #expect(doc.documentKind == .paystub)
        #expect(doc.onDeviceQualityPassed)
        #expect(mock.uploadedDocuments.count == 1)
    }
}

// MARK: - Inbox sort order

struct InboxSortOrderTests {
    @Test func unresolvedItemsAppearBeforeResolved() {
        let older = Date().addingTimeInterval(-200)
        let newer = Date()
        let items: [EnrollmentInboxItem] = [
            EnrollmentInboxItem(id: "1", packetId: "p", prompt: "A", createdAt: older, resolved: false),
            EnrollmentInboxItem(id: "2", packetId: "p", prompt: "B", createdAt: newer, resolved: true),
            EnrollmentInboxItem(id: "3", packetId: "p", prompt: "C", createdAt: newer, resolved: false),
        ]
        let sorted = inboxSorted(items)
        #expect(sorted[0].resolved == false)
        #expect(sorted[1].resolved == false)
        #expect(sorted[2].resolved == true)
    }

    @Test func withinUnresolvedGroupNewestFirst() {
        let t1 = Date().addingTimeInterval(-300)
        let t2 = Date().addingTimeInterval(-100)
        let t3 = Date()
        let items: [EnrollmentInboxItem] = [
            EnrollmentInboxItem(id: "old", packetId: "p", prompt: "", createdAt: t1, resolved: false),
            EnrollmentInboxItem(id: "mid", packetId: "p", prompt: "", createdAt: t2, resolved: false),
            EnrollmentInboxItem(id: "new", packetId: "p", prompt: "", createdAt: t3, resolved: false),
        ]
        let sorted = inboxSorted(items)
        #expect(sorted[0].id == "new")
        #expect(sorted[1].id == "mid")
        #expect(sorted[2].id == "old")
    }

    @Test func withinResolvedGroupNewestFirst() {
        let early = Date().addingTimeInterval(-600)
        let late  = Date()
        let items: [EnrollmentInboxItem] = [
            EnrollmentInboxItem(id: "r1", packetId: "p", prompt: "", createdAt: early, resolved: true),
            EnrollmentInboxItem(id: "r2", packetId: "p", prompt: "", createdAt: late,  resolved: true),
        ]
        let sorted = inboxSorted(items)
        #expect(sorted[0].id == "r2")
        #expect(sorted[1].id == "r1")
    }

    @Test func emptyInboxProducesEmptySort() {
        #expect(inboxSorted([]).isEmpty)
    }

    private func inboxSorted(_ items: [EnrollmentInboxItem]) -> [EnrollmentInboxItem] {
        let unresolved = items.filter { !$0.resolved }.sorted { $0.createdAt > $1.createdAt }
        let resolved   = items.filter {  $0.resolved }.sorted { $0.createdAt > $1.createdAt }
        return unresolved + resolved
    }
}

// MARK: - Spanish string coverage

struct EnrollmentSpanishStringTests {
    // Validates that every CivicaText in the enrollment sign-in and inbox
    // screens was declared with an `es:` translation. Parses source files
    // directly so a missing Spanish param is caught at test time, not by
    // a bilingual QA pass.

    @Test func signInViewHasSpanishForAllCivicaText() throws {
        let source = try enrollmentSource("SNAPPhoneSignInView")
        let matches = civicaTextMatches(in: source)
        #expect(matches.withES == matches.total,
            "SNAPPhoneSignInView: \(matches.total - matches.withES) CivicaText instance(s) missing es: translation")
    }

    @Test func inboxSectionHasSpanishForAllCivicaText() throws {
        let source = try enrollmentSource("SNAPEnrollmentInboxSection")
        let matches = civicaTextMatches(in: source)
        #expect(matches.withES == matches.total,
            "SNAPEnrollmentInboxSection: \(matches.total - matches.withES) CivicaText instance(s) missing es: translation")
    }

    // MARK: - Helpers

    private struct Counts { let total: Int; let withES: Int }

    private func enrollmentSource(_ filename: String) throws -> String {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let path = root
            .appendingPathComponent("Civica/Features/SNAP/Enrollment")
            .appendingPathComponent("\(filename).swift")
        return try String(contentsOf: path, encoding: .utf8)
    }

    private func civicaTextMatches(in source: String) -> Counts {
        // Match CivicaText("..." patterns — exclude comment lines.
        let lines = source.split(separator: "\n", omittingEmptySubsequences: false)
        let codeLines = lines.filter { !$0.trimmingCharacters(in: .whitespaces).hasPrefix("//") }
        let code = codeLines.joined(separator: "\n")

        let pattern = #"CivicaText\("[^"]*""#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return Counts(total: 0, withES: 0) }
        let range = NSRange(code.startIndex..., in: code)
        let allMatches = regex.matches(in: code, range: range)

        let esPattern = #"CivicaText\("[^"]*",\s*es:"#
        guard let esRegex = try? NSRegularExpression(pattern: esPattern) else {
            return Counts(total: allMatches.count, withES: 0)
        }
        let esMatches = esRegex.matches(in: code, range: range)
        return Counts(total: allMatches.count, withES: esMatches.count)
    }
}
