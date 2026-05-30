import SwiftUI
import UIKit

// MARK: - Public API

public extension View {
    /// Declarative variant. Drop-in for `.animation(_:value:)` that
    /// respects `accessibilityReduceMotion`. Use when you have an
    /// equatable trigger value.
    ///
    /// Pass any `Animation` (including a `CivicaAnimation.<token>`
    /// semantic token). When Reduce Motion is on, this resolves to a
    /// `nil` animation so the state change snaps instantly.
    func civicaAnimation<V: Equatable>(_ animation: Animation, value: V) -> some View {
        modifier(CivicaAnimationModifier(animation: animation, value: value))
    }
}

/// Imperative variant. Drop-in for `withAnimation(_:) { ... }` that
/// respects Reduce Motion. Reads the env via `UIAccessibility` because
/// free functions don't have `@Environment` access.
///
/// Pass any `Animation` (including a `CivicaAnimation.<token>`
/// semantic token). When Reduce Motion is on, the closure runs without
/// any animation wrapper so the state change snaps instantly.
public func civicaWithAnimation<Result>(
    _ animation: Animation,
    _ body: () throws -> Result
) rethrows -> Result {
    try _civicaWithAnimation(
        animation,
        reduceMotion: UIAccessibility.isReduceMotionEnabled,
        body
    )
}

// MARK: - Internal seams (testable)

/// Resolves a semantic animation under a given Reduce Motion state.
/// Internal seam so tests can verify the policy without spinning up a
/// SwiftUI host or mutating `UIAccessibility`.
@inline(__always)
internal func _resolveCivicaAnimation(_ animation: Animation, reduceMotion: Bool) -> Animation? {
    reduceMotion ? nil : animation
}

/// Reduce-Motion-respecting `withAnimation` with the env value injected.
/// Internal seam so tests can drive both branches deterministically.
@inline(__always)
internal func _civicaWithAnimation<Result>(
    _ animation: Animation,
    reduceMotion: Bool,
    _ body: () throws -> Result
) rethrows -> Result {
    if reduceMotion {
        return try body()
    } else {
        return try withAnimation(animation, body)
    }
}

// MARK: - Modifier

private struct CivicaAnimationModifier<V: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let animation: Animation
    let value: V

    func body(content: Content) -> some View {
        content.animation(_resolveCivicaAnimation(animation, reduceMotion: reduceMotion), value: value)
    }
}

// MARK: - Codemod guide (deferred to follow-up PR)
//
// This PR ships only the infra. Existing `.animation(_:value:)` and
// `withAnimation(_:)` callsites are NOT touched here — that codemod is a
// separate later PR per Pass 6 / RA-4 of the iOS audit 2026-05-29.
//
// When the codemod PR lands, the mechanical translation is:
//
//   Find:    .animation(CivicaAnimation.<token>, value: <v>)
//   Replace: .civicaAnimation(CivicaAnimation.<token>, value: <v>)
//
//   Find:    withAnimation(CivicaAnimation.<token>) { <body> }
//   Replace: civicaWithAnimation(CivicaAnimation.<token>) { <body> }
//
//   Find:    withAnimation(.spring(...)) { <body> }
//   Replace: civicaWithAnimation(.spring(...)) { <body> } only if motion-critical;
//            ad-hoc spring values stay where they're tied to a specific physics
//            interaction (numericText counter etc.).
//
// Callsites that ALREADY thread `@Environment(\.accessibilityReduceMotion)`
// manually (e.g., `.animation(reduceMotion ? nil : CivicaAnimation.standard, value: x)`)
// collapse to a single `.civicaAnimation(CivicaAnimation.standard, value: x)`
// and the local `reduceMotion` env read can drop if it has no other consumer.
//
// Note on parameter type: the audit's ARCH-5 recommendation sketches a
// `_ token: CivicaAnimation` signature. `CivicaAnimation` is currently a
// caseless namespace (`public enum CivicaAnimation { public static let fast = ... }`),
// not an enum with cases, so the property-access form `CivicaAnimation.fast`
// already evaluates to an `Animation`. Taking `Animation` directly here keeps
// every existing token site valid without reshaping `CivicaAnimation` and
// breaking the ~60 in-tree usages of `CivicaAnimation.<token>` as an
// `Animation` (which the codemod is explicitly out of scope for in this PR).
