import SwiftUI

// Hidden QA affordance — surfaced from CivicaEntryView via a 5-tap
// gesture on the version footer. Not discoverable to normal users by
// design (design review D7).
//
// Add new runtime feature flags here as they appear. Compile-time
// flags (SNAP_DEV etc.) stay in their own header.

struct DebugMenuView: View {
    @AppStorage(RecertCompanionFeatureFlag.storageKey)
    private var recertCompanionEnabled: Bool = false

    @AppStorage(LPIEFeatureFlag.cacheKey)
    private var lpieAutoExemptEnabled: Bool = true

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Feature flags") {
                    Toggle("RecertificationCompanion", isOn: $recertCompanionEnabled)
                    Toggle("LPIE auto-exempt (CA)", isOn: $lpieAutoExemptEnabled)
                }
                Section("Build") {
                    LabeledContent(
                        "Version",
                        value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
                    )
                    LabeledContent(
                        "Build",
                        value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
                    )
                }
            }
            .navigationTitle("Debug")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityLabel("Done. Close debug menu.")
                }
            }
        }
    }
}

#if DEBUG
#Preview {
    DebugMenuView()
}
#endif
