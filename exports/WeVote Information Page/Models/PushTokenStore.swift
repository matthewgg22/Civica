import Foundation

@MainActor
func saveDeviceToken(_ token: String) async {
    await SupabaseManager.shared.saveDeviceToken(token)
}

@MainActor
func saveDeviceTokenToSupabase(token: String) async {
    await saveDeviceToken(token)
}
