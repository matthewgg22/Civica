import Foundation
import SwiftUI

// Runtime feature flag for the Applicant-side County Outcome capture
// module. Mirrors RecertCompanionFeatureFlag exactly — see that file
// for the rationale (runtime over compile-time to allow progressive
// rollout without cutting a build).
//
// Ships dark: default-off in production. Engineering / QA can flip per
// device via the debug menu or by writing the UserDefaults key directly:
//   UserDefaults.standard.set(true, forKey: CountyOutcomeFeatureFlag.storageKey)

enum CountyOutcomeFeatureFlag {
    /// UserDefaults key — stable for QA/debug flipping.
    static let storageKey = "co.civica.countyOutcome.enabled"

    /// Default-off in production.
    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: storageKey)
    }

    /// Explicit setter for the debug surface.
    static func setEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: storageKey)
    }
}

/// SwiftUI property wrapper for views that need to react to the flag
/// changing at runtime.
@propertyWrapper
struct CountyOutcomeEnabled: DynamicProperty {
    @AppStorage(CountyOutcomeFeatureFlag.storageKey)
    private var enabled: Bool = false

    var wrappedValue: Bool { enabled }
}
