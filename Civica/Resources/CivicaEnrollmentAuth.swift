import Foundation
import OSLog
import Security

// Phone OTP authentication against Supabase Auth REST API.
// Uses URLSession directly (matching the FindHelpService pattern); the Supabase
// Swift SDK is linked to the VoteNow target only.
//
// Session is persisted in Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
// Synchronizable=false). On first launch after upgrade from a UserDefaults-based
// build, the old values are migrated and deleted atomically in restoreSession().

// MARK: - Keychain helper (private to this file)

private enum EnrollmentAuthKeychain {
    static let service = "co.civica.enrollment.auth"
    static let account = "session"

    struct Session: Codable {
        let accessToken: String
        let refreshToken: String
        let userId: String
        let expiresAt: Double
    }

    static func load() -> Session? {
        let query: [String: Any] = [
            kSecClass as String:                     kSecClassGenericPassword,
            kSecAttrService as String:               service,
            kSecAttrAccount as String:               account,
            kSecAttrSynchronizable as String:        false,
            kSecUseDataProtectionKeychain as String: true,
            kSecReturnData as String:                true,
            kSecMatchLimit as String:                kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(Session.self, from: data)
    }

    static func save(_ session: Session) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        delete()
        let attributes: [String: Any] = [
            kSecClass as String:                     kSecClassGenericPassword,
            kSecAttrService as String:               service,
            kSecAttrAccount as String:               account,
            kSecAttrAccessible as String:            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String:        false,
            kSecUseDataProtectionKeychain as String: true,
            kSecValueData as String:                 data
        ]
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String:                     kSecClassGenericPassword,
            kSecAttrService as String:               service,
            kSecAttrAccount as String:               account,
            kSecAttrSynchronizable as String:        false,
            kSecUseDataProtectionKeychain as String: true
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Auth class

@MainActor
final class CivicaEnrollmentAuth: ObservableObject {
    enum AuthState: Equatable {
        case unauthenticated
        case awaitingOTP(phone: String)
        case authenticated(userId: String)

        var isAuthenticated: Bool {
            if case .authenticated = self { return true }
            return false
        }
    }

    enum AuthError: Error, LocalizedError {
        case invalidPhone
        case invalidOTP
        case sessionMissing
        case wrapped(underlying: Error)

        var errorDescription: String? {
            switch self {
            case .invalidPhone:
                return NSLocalizedString("enrollment.auth.error.invalid_phone", comment: "")
            case .invalidOTP:
                return NSLocalizedString("enrollment.auth.error.invalid_otp", comment: "")
            case .sessionMissing:
                return NSLocalizedString("enrollment.auth.error.session_missing", comment: "")
            case .wrapped(let e):
                return e.localizedDescription
            }
        }
    }

    @Published private(set) var state: AuthState = .unauthenticated
    @Published private(set) var isLoading = false
    @Published private(set) var lastError: AuthError?

    private let supabaseURL: URL
    private let anonKey: String
    private let session: URLSession
    private static let logger = Logger(subsystem: "Civica", category: "EnrollmentAuth")

    // Legacy UserDefaults keys kept only for the one-shot migration read.
    private enum LegacyStorageKey {
        static let accessToken  = "enrollment.auth.access_token"
        static let refreshToken = "enrollment.auth.refresh_token"
        static let userId       = "enrollment.auth.user_id"
        static let expiresAt    = "enrollment.auth.expires_at"
    }

    init(
        supabaseURL: URL = SupabaseConfig.current.url,
        anonKey: String = SupabaseConfig.current.anonKey,
        session: URLSession = .shared
    ) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.session = session
        Task { await restoreSession() }
    }

    // MARK: - Public API

    func requestOTP(phone: String) async {
        let normalized = normalizePhone(phone)
        guard !normalized.isEmpty else { lastError = .invalidPhone; return }
        isLoading = true; lastError = nil
        defer { isLoading = false }

        do {
            try await sendOTPRequest(phone: normalized)
            state = .awaitingOTP(phone: normalized)
        } catch {
            Self.logger.error("OTP request failed: \(error.localizedDescription, privacy: .public)")
            lastError = .wrapped(underlying: error)
        }
    }

    func verifyOTP(code: String) async {
        guard case .awaitingOTP(let phone) = state else { return }
        isLoading = true; lastError = nil
        defer { isLoading = false }

        do {
            let response = try await verifyOTPRequest(phone: phone, token: code)
            persistSession(response)
            state = .authenticated(userId: response.user.id)
        } catch let e as AuthError {
            lastError = e
        } catch {
            Self.logger.error("OTP verify failed: \(error.localizedDescription, privacy: .public)")
            let isCode = error.localizedDescription.lowercased().contains("invalid")
                || error.localizedDescription.lowercased().contains("expired")
            lastError = isCode ? .invalidOTP : .wrapped(underlying: error)
        }
    }

    func signOut() async {
        clearPersistedSession()
        state = .unauthenticated
    }

    /// Returns the access token for the current session. Refreshes automatically if expired.
    nonisolated func currentAccessToken() async -> String? {
        guard let stored = EnrollmentAuthKeychain.load(),
              !stored.accessToken.isEmpty,
              !stored.userId.isEmpty
        else { return nil }

        if stored.expiresAt > 0, Date().timeIntervalSince1970 < stored.expiresAt - 60 {
            return stored.accessToken
        }

        guard !stored.refreshToken.isEmpty else { return nil }
        return await refreshAccessToken(refreshToken: stored.refreshToken)
    }

    // MARK: - REST helpers

    private func sendOTPRequest(phone: String) async throws {
        let url = supabaseURL.appendingPathComponent("auth/v1/otp")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(["phone": phone])
        let (_, response) = try await session.data(for: req)
        try validateHTTP(response)
    }

    private struct OTPVerifyResponse: Decodable {
        struct User: Decodable { let id: String }
        let access_token: String
        let refresh_token: String
        let expires_in: Int
        let user: User
    }

    private func verifyOTPRequest(phone: String, token: String) async throws -> OTPVerifyResponse {
        let url = supabaseURL.appendingPathComponent("auth/v1/verify")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        struct Body: Encodable { let phone, token, type: String }
        req.httpBody = try JSONEncoder().encode(Body(phone: phone, token: token, type: "sms"))
        let (data, response) = try await session.data(for: req)
        try validateHTTP(response, data: data)
        return try JSONDecoder().decode(OTPVerifyResponse.self, from: data)
    }

    private struct RefreshResponse: Decodable {
        let access_token: String
        let refresh_token: String
        let expires_in: Int
    }

    nonisolated private func refreshAccessToken(refreshToken: String) async -> String? {
        guard let url = URL(string: "auth/v1/token?grant_type=refresh_token", relativeTo: supabaseURL) else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        guard let body = try? JSONEncoder().encode(["refresh_token": refreshToken]) else { return nil }
        req.httpBody = body
        guard let (data, response) = try? await session.data(for: req),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let refreshed = try? JSONDecoder().decode(RefreshResponse.self, from: data),
              let existing = EnrollmentAuthKeychain.load()
        else { return nil }

        let expiresAt = Date().timeIntervalSince1970 + Double(refreshed.expires_in)
        let updated = EnrollmentAuthKeychain.Session(
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            userId: existing.userId,
            expiresAt: expiresAt
        )
        EnrollmentAuthKeychain.save(updated)
        return refreshed.access_token
    }

    private func validateHTTP(_ response: URLResponse, data: Data? = nil) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            let msg = data.flatMap { String(data: $0, encoding: .utf8) } ?? "HTTP \(http.statusCode)"
            throw URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: msg])
        }
    }

    // MARK: - Session persistence (Keychain)

    private func persistSession(_ r: OTPVerifyResponse) {
        let expiresAt = Date().timeIntervalSince1970 + Double(r.expires_in)
        EnrollmentAuthKeychain.save(EnrollmentAuthKeychain.Session(
            accessToken: r.access_token,
            refreshToken: r.refresh_token,
            userId: r.user.id,
            expiresAt: expiresAt
        ))
    }

    private func clearPersistedSession() {
        EnrollmentAuthKeychain.delete()
        // Belt-and-suspenders: wipe any residual legacy UserDefaults entries.
        let keys = [LegacyStorageKey.accessToken, LegacyStorageKey.refreshToken,
                    LegacyStorageKey.userId, LegacyStorageKey.expiresAt]
        keys.forEach { UserDefaults.standard.removeObject(forKey: $0) }
    }

    private func restoreSession() async {
        // 1. Try Keychain first (normal path after first Keychain write).
        if let stored = EnrollmentAuthKeychain.load(),
           !stored.userId.isEmpty, !stored.accessToken.isEmpty {
            state = .authenticated(userId: stored.userId)
            return
        }

        // 2. One-shot migration: read legacy UserDefaults, write to Keychain, delete.
        let defaults = UserDefaults.standard
        guard let userId = defaults.string(forKey: LegacyStorageKey.userId), !userId.isEmpty,
              let accessToken = defaults.string(forKey: LegacyStorageKey.accessToken), !accessToken.isEmpty
        else { return }

        let migrated = EnrollmentAuthKeychain.Session(
            accessToken: accessToken,
            refreshToken: defaults.string(forKey: LegacyStorageKey.refreshToken) ?? "",
            userId: userId,
            expiresAt: defaults.double(forKey: LegacyStorageKey.expiresAt)
        )
        EnrollmentAuthKeychain.save(migrated)
        [LegacyStorageKey.accessToken, LegacyStorageKey.refreshToken,
         LegacyStorageKey.userId, LegacyStorageKey.expiresAt]
            .forEach { defaults.removeObject(forKey: $0) }

        Self.logger.info("Migrated enrollment session from UserDefaults to Keychain")
        state = .authenticated(userId: userId)
    }

    // MARK: - Phone normalization

    func normalizePhone(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        if raw.hasPrefix("+") { return "+" + digits }
        if digits.count == 10 { return "+1\(digits)" }
        return digits.isEmpty ? "" : "+" + digits
    }
}

// MARK: - Factory

extension CivicaEnrollmentAuth {
    func makeEnrollmentAPIClient() -> any EnrollmentAPIClient {
        guard let baseURL = HTTPEnrollmentAPIClient.resolveBaseURL() else {
            return MockEnrollmentAPIClient()
        }
        return HTTPEnrollmentAPIClient(baseURL: baseURL, tokenProvider: { [weak self] in
            await self?.currentAccessToken()
        })
    }

    func makeOffersAPIClient() -> any EBTOffersAPIClient {
        guard let baseURL = HTTPEnrollmentAPIClient.resolveBaseURL() else {
            return MockEBTOffersAPIClient()
        }
        return HTTPEBTOffersAPIClient(baseURL: baseURL, tokenProvider: { [weak self] in
            await self?.currentAccessToken()
        })
    }
}
