import Foundation
import OSLog
#if canImport(Supabase)
import Supabase
#endif

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var session: SupabaseSession?
    @Published private(set) var user: SupabaseUser?
    @Published private(set) var isSignedIn = false
    @Published private(set) var isLoading = true
    @Published var lastError: String?

    private let client: AppSupabaseClient
    private let logger = Logger(subsystem: "VoteNow", category: "AuthStore")
    private var authStateTask: Task<Void, Never>?
    private var lastRefreshAttemptAt: Date = .distantPast
    private let refreshThrottle: TimeInterval = 300

    init(
        client: AppSupabaseClient = SupabaseClientProvider.shared.client,
        startListening: Bool = true
    ) {
        self.client = client
        if startListening {
            start()
        } else {
            isLoading = false
        }
    }

    deinit {
        authStateTask?.cancel()
    }

    func start() {
        authStateTask?.cancel()
        authStateTask = Task { [weak self] in
            guard let self else { return }
            await self.bootstrapSession()
            await self.listenForAuthChanges()
        }
    }

    func signInWithOTP(email: String) async {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            lastError = "Enter a valid email."
            return
        }

        isLoading = true
        lastError = nil

        #if canImport(Supabase)
        do {
            try await client.auth.signInWithOTP(email: normalized)
        } catch is CancellationError {
            return
        } catch {
            logger.error("OTP sign-in failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
        #else
        lastError = "Supabase SDK missing. Add package dependency first."
        #endif

        isLoading = false
    }

    func signOut() async {
        isLoading = true
        lastError = nil

        #if canImport(Supabase)
        do {
            try await client.auth.signOut()
            applyAuthState(session: nil, source: "signOut")
        } catch is CancellationError {
            return
        } catch {
            logger.error("Sign-out failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
        #else
        applyAuthState(session: nil, source: "signOut-no-sdk")
        #endif

        isLoading = false
    }

    /// Lightweight refresh guard; checks session sparingly and only when signed in.
    func refreshIfNeeded(force: Bool = false) async {
        guard !Task.isCancelled else { return }
        guard force || isSignedIn else { return }

        let now = Date()
        guard force || now.timeIntervalSince(lastRefreshAttemptAt) >= refreshThrottle else { return }
        lastRefreshAttemptAt = now

        #if canImport(Supabase)
        do {
            let currentSession = try await client.auth.session
            applyAuthState(session: currentSession, source: "refresh")
        } catch is CancellationError {
            return
        } catch {
            // Keep cached in-memory session on transient errors.
            logger.error("Session refresh failed: \(error.localizedDescription, privacy: .public)")
        }
        #endif
    }

    private func bootstrapSession() async {
        #if canImport(Supabase)
        do {
            let currentSession = try await client.auth.session
            applyAuthState(session: currentSession, source: "bootstrap")
        } catch is CancellationError {
            return
        } catch {
            applyAuthState(session: nil, source: "bootstrap-empty")
        }
        #else
        applyAuthState(session: nil, source: "bootstrap-no-sdk")
        #endif
    }

    private func listenForAuthChanges() async {
        #if canImport(Supabase)
        for await (event, updatedSession) in client.auth.authStateChanges {
            if Task.isCancelled { break }
            applyAuthState(session: updatedSession, source: "event-\(String(describing: event))")
        }
        #endif
    }

    private func applyAuthState(session: SupabaseSession?, source: String) {
        self.session = session
        self.user = session?.user
        self.isSignedIn = session != nil
        self.isLoading = false

        _ = source
    }
}
