import Foundation
import Security
import Testing
@testable import Civica

// Tests for CivicaEnrollmentAuth — phone normalization, OTP state machine,
// Keychain session persistence, and UserDefaults → Keychain migration.
//
// Keychain tests are gated on `keychainAvailableForTests` (same probe used
// by SNAPEligibilityResultKeychainStoreTests). On unsigned CI simulator
// builds (CODE_SIGNING_ALLOWED=NO) SecItemAdd returns errSecMissingEntitlement,
// so Keychain-dependent tests are skipped automatically.

// MARK: - Probe helpers for EnrollmentAuthKeychain

private let authKeychainService = "co.civica.enrollment.auth"
private let authKeychainAccount = "session"

private struct PersistedSession: Codable {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let expiresAt: Double
}

private func clearAuthKeychain() {
    let query: [String: Any] = [
        kSecClass as String:                     kSecClassGenericPassword,
        kSecAttrService as String:               authKeychainService,
        kSecAttrAccount as String:               authKeychainAccount,
        kSecAttrSynchronizable as String:        false,
        kSecUseDataProtectionKeychain as String: true
    ]
    SecItemDelete(query as CFDictionary)
}

private func readAuthKeychain() -> PersistedSession? {
    let query: [String: Any] = [
        kSecClass as String:                     kSecClassGenericPassword,
        kSecAttrService as String:               authKeychainService,
        kSecAttrAccount as String:               authKeychainAccount,
        kSecAttrSynchronizable as String:        false,
        kSecUseDataProtectionKeychain as String: true,
        kSecReturnData as String:                true,
        kSecMatchLimit as String:                kSecMatchLimitOne
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data else { return nil }
    return try? JSONDecoder().decode(PersistedSession.self, from: data)
}

// MARK: - OTP Stub

// A URLSession configuration that intercepts requests for OTP tests.
private final class AuthStubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handlers: [(URLRequest) -> (Data, Int)] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard !AuthStubProtocol.handlers.isEmpty else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        let handler = AuthStubProtocol.handlers.removeFirst()
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

private func makeAuthStubSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [AuthStubProtocol.self]
    return URLSession(configuration: config)
}

private let testSupabaseURL = URL(string: "https://supabase.test")!

private func verifyOTPSuccessJSON(userId: String = "user-abc") -> Data {
    """
    {
        "access_token": "access-tok",
        "refresh_token": "refresh-tok",
        "expires_in": 3600,
        "user": { "id": "\(userId)" }
    }
    """.data(using: .utf8)!
}

// MARK: - Phone normalization tests (no network, no Keychain)

@MainActor
struct CivicaEnrollmentAuthPhoneTests {

    private func makeAuth() -> CivicaEnrollmentAuth {
        CivicaEnrollmentAuth(
            supabaseURL: testSupabaseURL,
            anonKey: "anon",
            session: makeAuthStubSession()
        )
    }

    @Test @MainActor func tenDigitUSPhoneGetsE164Prefix() {
        let auth = makeAuth()
        #expect(auth.normalizePhone("5551234567") == "+15551234567")
    }

    @Test @MainActor func alreadyE164PhoneIsUnchanged() {
        let auth = makeAuth()
        #expect(auth.normalizePhone("+15551234567") == "+15551234567")
    }

    @Test @MainActor func internationalPrefixPreserved() {
        let auth = makeAuth()
        #expect(auth.normalizePhone("+521234567890") == "+521234567890")
    }

    @Test @MainActor func emptyInputYieldsEmptyString() {
        let auth = makeAuth()
        #expect(auth.normalizePhone("") == "")
    }

    @Test @MainActor func formattedPhoneStripsPunctuation() {
        let auth = makeAuth()
        // "(555) 123-4567" → 10 raw digits → "+15551234567"
        #expect(auth.normalizePhone("(555) 123-4567") == "+15551234567")
    }
}

// MARK: - OTP state machine tests

// .serialized prevents concurrent test execution, which would cause
// AuthStubProtocol.handlers (nonisolated(unsafe) static) to be
// cleared by one test's init() while another test is mid-flight.
@Suite(.serialized)
@MainActor
struct CivicaEnrollmentAuthOTPTests {

    init() {
        AuthStubProtocol.handlers.removeAll()
    }

    private func makeAuth() -> CivicaEnrollmentAuth {
        CivicaEnrollmentAuth(
            supabaseURL: testSupabaseURL,
            anonKey: "anon",
            session: makeAuthStubSession()
        )
    }

    @Test func requestOTPTransitionsToAwaitingState() async {
        AuthStubProtocol.handlers.append { _ in (Data(), 200) }
        let auth = makeAuth()
        await auth.requestOTP(phone: "5551234567")
        if case .awaitingOTP(let phone) = auth.state {
            #expect(phone == "+15551234567")
        } else {
            Issue.record("Expected awaitingOTP, got \(auth.state)")
        }
    }

    @Test func verifyOTPTransitionsToAuthenticatedState() async {
        // Prime state to awaitingOTP so verifyOTP is allowed to proceed.
        AuthStubProtocol.handlers.append { _ in (Data(), 200) }        // send OTP
        AuthStubProtocol.handlers.append { _ in (verifyOTPSuccessJSON(), 200) } // verify OTP

        let auth = makeAuth()
        await auth.requestOTP(phone: "5551234567")
        await auth.verifyOTP(code: "123456")

        if case .authenticated(let userId) = auth.state {
            #expect(userId == "user-abc")
        } else {
            Issue.record("Expected authenticated, got \(auth.state)")
        }
        #expect(auth.lastError == nil)
    }

    @Test func invalidOTPSurfacesInvalidOTPError() async {
        AuthStubProtocol.handlers.append { _ in (Data(), 200) }
        // 422 Unprocessable Entity → server rejects the OTP code.
        AuthStubProtocol.handlers.append { _ in
            ("{\"message\":\"Token has expired or is invalid\"}".data(using: .utf8)!, 422)
        }

        let auth = makeAuth()
        await auth.requestOTP(phone: "5551234567")
        await auth.verifyOTP(code: "000000")

        if case .invalidOTP = auth.lastError { } else {
            Issue.record("Expected lastError == .invalidOTP, got \(String(describing: auth.lastError))")
        }
        if case .awaitingOTP = auth.state { } else {
            Issue.record("State should remain awaitingOTP after a bad code, got \(auth.state)")
        }
    }
}

// MARK: - Keychain session persistence tests (CI-gated)

@Suite(.enabled(if: keychainAvailableForTests))
@MainActor
struct CivicaEnrollmentAuthKeychainTests {

    init() {
        clearAuthKeychain()
        AuthStubProtocol.handlers.removeAll()
    }

    private func makeAuth() -> CivicaEnrollmentAuth {
        CivicaEnrollmentAuth(
            supabaseURL: testSupabaseURL,
            anonKey: "anon",
            session: makeAuthStubSession()
        )
    }

    @Test func verifyOTPWritesSessionToKeychain() async {
        defer { clearAuthKeychain() }

        AuthStubProtocol.handlers.append { _ in (Data(), 200) }
        AuthStubProtocol.handlers.append { _ in (verifyOTPSuccessJSON(userId: "u-1"), 200) }

        let auth = makeAuth()
        await auth.requestOTP(phone: "5551234567")
        await auth.verifyOTP(code: "123456")

        let stored = readAuthKeychain()
        #expect(stored != nil, "Session must be written to Keychain on verify success")
        #expect(stored?.userId == "u-1")
        #expect(stored?.accessToken == "access-tok")
        #expect(stored?.refreshToken == "refresh-tok")
        #expect((stored?.expiresAt ?? 0) > Date().timeIntervalSince1970,
                "expiresAt must be in the future")
    }

    @Test func restoredSessionIsAuthenticatedOnNextLaunch() async {
        defer { clearAuthKeychain() }

        // Simulate a previous session stored in Keychain.
        AuthStubProtocol.handlers.append { _ in (Data(), 200) }
        AuthStubProtocol.handlers.append { _ in (verifyOTPSuccessJSON(userId: "u-restore"), 200) }

        let firstLaunch = makeAuth()
        await firstLaunch.requestOTP(phone: "5551234567")
        await firstLaunch.verifyOTP(code: "123456")

        // Second launch: new instance reads Keychain in restoreSession().
        let secondLaunch = makeAuth()
        // restoreSession runs in a Task so give it a moment.
        try? await Task.sleep(nanoseconds: 50_000_000) // 50 ms

        if case .authenticated(let userId) = secondLaunch.state {
            #expect(userId == "u-restore")
        } else {
            Issue.record("Expected authenticated after restore, got \(secondLaunch.state)")
        }
    }

    @Test func signOutDeletesKeychainEntry() async {
        defer { clearAuthKeychain() }

        AuthStubProtocol.handlers.append { _ in (Data(), 200) }
        AuthStubProtocol.handlers.append { _ in (verifyOTPSuccessJSON(), 200) }

        let auth = makeAuth()
        await auth.requestOTP(phone: "5551234567")
        await auth.verifyOTP(code: "123456")
        #expect(readAuthKeychain() != nil)

        await auth.signOut()

        #expect(readAuthKeychain() == nil, "Keychain entry must be removed on sign-out")
        #expect(auth.state == .unauthenticated)
    }

    @Test func userDefaultsMigrationOnRestoreSession() async {
        defer {
            clearAuthKeychain()
            [
                "enrollment.auth.access_token",
                "enrollment.auth.refresh_token",
                "enrollment.auth.user_id",
                "enrollment.auth.expires_at"
            ].forEach { UserDefaults.standard.removeObject(forKey: $0) }
        }

        // Seed legacy UserDefaults (simulate pre-Keychain install).
        let futureExpiry = Date().timeIntervalSince1970 + 3600
        UserDefaults.standard.set("legacy-access", forKey: "enrollment.auth.access_token")
        UserDefaults.standard.set("legacy-refresh", forKey: "enrollment.auth.refresh_token")
        UserDefaults.standard.set("legacy-user-id", forKey: "enrollment.auth.user_id")
        UserDefaults.standard.set(futureExpiry,      forKey: "enrollment.auth.expires_at")

        // First launch after upgrade: restoreSession() migrates to Keychain.
        let auth = makeAuth()
        try? await Task.sleep(nanoseconds: 50_000_000) // 50 ms for Task

        if case .authenticated(let userId) = auth.state {
            #expect(userId == "legacy-user-id")
        } else {
            Issue.record("Migration should result in authenticated state, got \(auth.state)")
        }

        // Keychain now holds the session.
        let stored = readAuthKeychain()
        #expect(stored?.userId == "legacy-user-id")
        #expect(stored?.accessToken == "legacy-access")

        // UserDefaults must be wiped.
        #expect(UserDefaults.standard.string(forKey: "enrollment.auth.access_token") == nil,
                "Legacy UserDefaults access_token must be deleted after migration")
        #expect(UserDefaults.standard.string(forKey: "enrollment.auth.user_id") == nil,
                "Legacy UserDefaults user_id must be deleted after migration")
    }
}

