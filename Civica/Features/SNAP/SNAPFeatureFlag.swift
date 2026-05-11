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

    // Conversation flow (LLM-driven screener). Sub-flag of SNAP_DEV — only
    // meaningful when isEnabled is true. The static draft flow remains the
    // fallback when this is false, so we can ship the new vertical without
    // exposing it until the backend HTTP layer + privacy review have landed.
    #if SNAP_CONVERSATION_ENABLED
    static let isConversationEnabled = true
    #else
    static let isConversationEnabled = false
    #endif
}
