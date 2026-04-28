import Foundation

// EXPERIMENTAL SILOED MODULE:
// SNAP stays siloed and hidden during the build period so core civic flows remain unchanged.
enum SNAPFeatureFlag {
    // Default-off so SNAP is present in code but not exposed to production users yet.
    // Enabled only for the dedicated SNAP dev build configuration.
    #if SNAP_DEV
    static let isEnabled = true
    #else
    static let isEnabled = false
    #endif

    // Optional debug affordance for development builds.
    #if DEBUG
    static let showDebugEntry = true
    #else
    static let showDebugEntry = false
    #endif
}
