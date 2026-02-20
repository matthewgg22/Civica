import Foundation
import Supabase

struct DeviceTokenRow: Encodable {
    let user_id: UUID
    let token: String
    let platform: String
    let apns_env: String
    let is_enabled: Bool
}

struct DeviceTokenRowWithMetadata: Encodable {
    let user_id: UUID
    let token: String
    let platform: String
    let apns_env: String
    let is_enabled: Bool
    let last_seen_at: String
    let app_version: String
}

private func appVersionString() -> String {
    let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
    return "\(short) (\(build))"
}

private func currentAPNSEnvironment() -> String {
    #if DEBUG
    return "sandbox"
    #else
    return "production"
    #endif
}

private func redactedToken(_ token: String) -> String {
    guard token.count > 12 else { return token }
    return "\(token.prefix(8))...\(token.suffix(4))"
}

@MainActor
func saveDeviceTokenToSupabase(token: String) async {
    let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedToken.isEmpty else {
        print("⚠️ APNs token is empty; skipping Supabase save")
        return
    }

    let supabase = SupabaseClientProvider.shared.client

    let userID: UUID
    do {
        try await SupabaseManager.shared.signInAnonymouslyIfNeeded()
        let session = try await supabase.auth.session
        userID = session.user.id
    } catch {
        print("⚠️ No active Supabase session; skipping device token save:", String(describing: error))
        return
    }

    let rowWithMetadata = DeviceTokenRowWithMetadata(
        user_id: userID,
        token: trimmedToken,
        platform: "ios",
        apns_env: currentAPNSEnvironment(),
        is_enabled: true,
        last_seen_at: SupabaseTimestampCodec.encode(Date()),
        app_version: appVersionString()
    )

    let fallbackRow = DeviceTokenRow(
        user_id: userID,
        token: trimmedToken,
        platform: "ios",
        apns_env: currentAPNSEnvironment(),
        is_enabled: true
    )

    do {
        _ = try await supabase
            .from("device_tokens")
            .upsert(rowWithMetadata, onConflict: "token")
            .execute()
        print("✅ Device token saved to Supabase (\(redactedToken(trimmedToken)))")
    } catch {
        // Fallback for older schemas that don't have last_seen_at/app_version yet.
        if let postgrestError = error as? PostgrestError {
            let details = (postgrestError.message + " " + (postgrestError.hint ?? "")).lowercased()
            let missingMetadataColumn = postgrestError.code == "PGRST204"
                && (details.contains("last_seen_at") || details.contains("app_version"))
            if missingMetadataColumn {
                do {
                    _ = try await supabase
                        .from("device_tokens")
                        .upsert(fallbackRow, onConflict: "token")
                        .execute()
                    print("✅ Device token saved to Supabase (\(redactedToken(trimmedToken)))")
                    return
                } catch {
                    print("❌ Failed saving device token:", String(describing: error))
                    return
                }
            }
        }
        print("❌ Failed saving device token:", String(describing: error))
    }
}
