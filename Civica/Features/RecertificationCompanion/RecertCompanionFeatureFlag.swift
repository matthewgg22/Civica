import Foundation
import SwiftUI

// Runtime feature flag for the Recertification Companion module.
//
// Why runtime (rather than the existing #if SNAP_DEV compile-time
// pattern): the product brief calls for shipping dark and enabling
// progressively. Compile-time gating means cutting a new build to flip
// the flag, which kills progressive rollout. The flag defaults to false
// in production — there is no user-facing toggle, only engineering
// access via debug menu or direct UserDefaults write during pilot.

enum RecertCompanionFeatureFlag {
    /// UserDefaults key — kept stable so QA can flip it via Settings or
    /// a debug-build affordance without redeploying.
    static let storageKey = "co.civica.recertCompanion.enabled"

    /// Default-off in production. Flip per-device via the debug menu
    /// (TODO) or, until that ships, by writing the key directly:
    /// `UserDefaults.standard.set(true, forKey: RecertCompanionFeatureFlag.storageKey)`
    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: storageKey)
    }

    /// Explicit setter for the debug surface. Avoids spreading raw
    /// UserDefaults writes throughout the codebase.
    static func setEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: storageKey)
    }
}

/// SwiftUI property wrapper for views that need to react to the flag
/// changing at runtime (e.g. a debug toggle). Use the static
/// `isEnabled` accessor for non-view code paths.
@propertyWrapper
struct RecertCompanionEnabled: DynamicProperty {
    @AppStorage(RecertCompanionFeatureFlag.storageKey)
    private var enabled: Bool = false

    var wrappedValue: Bool { enabled }
}
