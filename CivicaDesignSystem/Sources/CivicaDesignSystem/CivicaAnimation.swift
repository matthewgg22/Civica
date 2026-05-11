import SwiftUI

/// Semantic animation tokens. Token names describe the visual role; the
/// underlying curve and duration are tuned to match the most common patterns
/// in the codebase. Use these instead of inline `.easeInOut(duration:...)` so
/// future timing tweaks (e.g., snappier whole-app feel) become a one-edit
/// change.
public enum CivicaAnimation {
    /// 0.12s easeInOut — micro-interactions, instant feedback (toggle ticks,
    /// tiny state flips).
    public static let fast     = Animation.easeInOut(duration: 0.12)
    /// 0.20s easeInOut — default transition. Cards expanding, panels showing,
    /// most animated state changes.
    public static let standard = Animation.easeInOut(duration: 0.2)
    /// 0.18s easeOut — quick "snap back" / dismiss feel. Closing menus,
    /// returning to rest after a tap.
    public static let snap     = Animation.easeOut(duration: 0.18)
    /// 0.30s easeInOut — considered transitions. Section reveals, important
    /// state changes that warrant a beat of attention.
    public static let slow     = Animation.easeInOut(duration: 0.3)
    /// 0.24s easeOut — form-step cross-fade per HANDOFF.md / canvas board on
    /// form behavior. Used when navigating between one-question-per-screen
    /// form steps. Honor `@Environment(\.accessibilityReduceMotion)` and pass
    /// `nil` to `withAnimation` instead when reduce-motion is on.
    public static let stepTransition = Animation.easeOut(duration: 0.24)
    /// 0.08s — interval between staggered field reveals (e.g., when OCR
    /// resolves form fields one at a time after a document scan). Use with
    /// `Animation.delay(_:)` keyed off a row index.
    public static let staggerInterval: Double = 0.08
}
