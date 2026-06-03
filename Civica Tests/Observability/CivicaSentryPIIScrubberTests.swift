import Foundation
import Sentry
import Testing
@testable import Civica

// Civica's Sentry beforeSend hook is the only line of defense between an
// in-memory crash report and a third-party error tracker. This is a SNAP app
// — request bodies routinely carry household composition, addresses, paystub
// fields, and SSN-shaped strings. None of that may reach Sentry.
//
// Coverage: each test populates a SentryEvent with PII in one of the well-known
// carrier fields and asserts that CivicaSentry.scrub() nil's it. The userId is
// retained as the only allowed identifier (so error grouping still works).
@Suite("CivicaSentry.scrub() strips PII before send")
struct CivicaSentryPIIScrubberTests {

    // MARK: - Request scrubbing

    @Test("request bodyString is nil'd")
    func requestBodyIsScrubbed() {
        let event = Event()
        let request = Request()
        request.bodyString = #"{"ssn":"123-45-6789","household":[{"name":"Jane"}]}"#
        event.request = request

        _ = CivicaSentry.scrub(event)

        #expect(event.request?.bodyString == nil)
    }

    @Test("request cookies are nil'd")
    func requestCookiesAreScrubbed() {
        let event = Event()
        let request = Request()
        request.cookies = "session=abcdef; ga=GA1.2.123.456"
        event.request = request

        _ = CivicaSentry.scrub(event)

        #expect(event.request?.cookies == nil)
    }

    @Test("request queryString is nil'd (may contain user IDs / tokens)")
    func requestQueryStringIsScrubbed() {
        let event = Event()
        let request = Request()
        request.queryString = "token=eyJhbGciOiJIUzI1NiJ9&packetId=pkt_123"
        event.request = request

        _ = CivicaSentry.scrub(event)

        #expect(event.request?.queryString == nil)
    }

    @Test("request headers retain only content-type")
    func requestHeadersOnlyContentType() {
        let event = Event()
        let request = Request()
        request.headers = [
            "content-type": "application/json",
            "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9",
            "x-civica-user-state": "CA",
            "cookie": "session=abcdef",
        ]
        event.request = request

        _ = CivicaSentry.scrub(event)

        #expect(event.request?.headers == ["content-type": "application/json"])
    }

    @Test("request headers become nil when content-type is absent")
    func requestHeadersNilWithoutContentType() {
        let event = Event()
        let request = Request()
        request.headers = ["authorization": "Bearer …", "x-trace-id": "abc"]
        event.request = request

        _ = CivicaSentry.scrub(event)

        #expect(event.request?.headers == nil)
    }

    // MARK: - User scrubbing

    @Test("user email is nil'd")
    func userEmailIsScrubbed() {
        let event = Event()
        let user = User()
        user.email = "applicant@example.com"
        event.user = user

        _ = CivicaSentry.scrub(event)

        #expect(event.user?.email == nil)
    }

    @Test("user ipAddress is nil'd")
    func userIPIsScrubbed() {
        let event = Event()
        let user = User()
        user.ipAddress = "203.0.113.42"
        event.user = user

        _ = CivicaSentry.scrub(event)

        #expect(event.user?.ipAddress == nil)
    }

    @Test("user username + name are nil'd")
    func userIdentifiersAreScrubbed() {
        let event = Event()
        let user = User()
        user.username = "jdoe"
        user.name = "Jane Doe"
        event.user = user

        _ = CivicaSentry.scrub(event)

        #expect(event.user?.username == nil)
        #expect(event.user?.name == nil)
    }

    @Test("user data dictionary is nil'd (free-form PII bucket)")
    func userDataIsScrubbed() {
        let event = Event()
        let user = User()
        user.data = ["household_size": 4, "zip": "90210"]
        event.user = user

        _ = CivicaSentry.scrub(event)

        #expect(event.user?.data == nil)
    }

    @Test("user userId is preserved — error grouping still works")
    func userIdIsPreserved() {
        let event = Event()
        let user = User()
        user.userId = "civica_user_8af3"
        user.email = "applicant@example.com"
        event.user = user

        _ = CivicaSentry.scrub(event)

        #expect(event.user?.userId == "civica_user_8af3")
        #expect(event.user?.email == nil)
    }

    // MARK: - Extras

    @Test("event.extra dictionary is nil'd (free-form PII bucket)")
    func extraIsScrubbed() {
        let event = Event()
        event.extra = [
            "intake_step": "income",
            "wages_monthly": 2400,
            "address": "123 Main St, Oakland CA",
        ]

        _ = CivicaSentry.scrub(event)

        #expect(event.extra == nil)
    }

    // MARK: - Smoke — scrubbing a fully-empty event doesn't crash

    @Test("scrubbing an event with no PII fields succeeds")
    func emptyEventScrubsCleanly() {
        let event = Event()
        // No request, no user, no extra.

        _ = CivicaSentry.scrub(event)

        #expect(event.request == nil)
        #expect(event.user == nil)
        #expect(event.extra == nil)
    }
}
