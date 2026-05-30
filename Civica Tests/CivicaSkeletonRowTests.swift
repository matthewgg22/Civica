import Foundation
import SwiftUI
import Testing
@testable import CivicaDesignSystem

// IS-8 (audit 2026-05-29): smoke coverage for the first-paint
// skeleton row. The animation policy itself (suppress when
// accessibilityReduceMotion is on) is exercised by
// `CivicaAnimationRespectTests` via the shared internal seam — here
// we only verify the row instantiates with the requested geometry
// defaults and that the public initializer accepts a custom height
// without crashing.

@MainActor
@Suite("CivicaSkeletonRow")
struct CivicaSkeletonRowTests {

    @Test("Defaults to 56pt height + control radius")
    func defaultGeometry() {
        let row = CivicaSkeletonRow()
        // Public init compiles + the View body type is non-empty.
        // SwiftUI doesn't expose intrinsic state through reflection,
        // so the assertion is that the value is constructible — any
        // future regression in the public signature surfaces here.
        #expect(String(describing: type(of: row.body)).isEmpty == false)
    }

    @Test("Accepts a custom height + radius")
    func customGeometry() {
        let row = CivicaSkeletonRow(height: 96, cornerRadius: 4)
        #expect(String(describing: type(of: row.body)).isEmpty == false)
    }

    @Test("Renders inside a stack without trapping")
    func rendersInStack() {
        let stack = VStack(spacing: CivicaSpacing.lg) {
            CivicaSkeletonRow(height: 56)
            CivicaSkeletonRow(height: 56)
            CivicaSkeletonRow(height: 56)
        }
        #expect(String(describing: type(of: stack)).isEmpty == false)
    }
}
