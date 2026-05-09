import SwiftUI

/// Semantic animation tokens. Token names describe the visual role; the
/// underlying curve and duration are tuned to match the most common patterns
/// in the codebase. Use these instead of inline `.easeInOut(duration:...)` so
/// future timing tweaks (e.g., snappier whole-app feel) become a one-edit
/// change.
enum CivicaAnimation {
    /// 0.12s easeInOut — micro-interactions, instant feedback (toggle ticks,
    /// tiny state flips).
    static let fast     = Animation.easeInOut(duration: 0.12)
    /// 0.20s easeInOut — default transition. Cards expanding, panels showing,
    /// most animated state changes.
    static let standard = Animation.easeInOut(duration: 0.2)
    /// 0.18s easeOut — quick "snap back" / dismiss feel. Closing menus,
    /// returning to rest after a tap.
    static let snap     = Animation.easeOut(duration: 0.18)
    /// 0.30s easeInOut — considered transitions. Section reveals, important
    /// state changes that warrant a beat of attention.
    static let slow     = Animation.easeInOut(duration: 0.3)
}
