import SwiftUI
import Testing
import UIKit
@testable import CivicaDesignSystem

@Suite("CivicaAnimationRespect")
struct CivicaAnimationRespectTests {

    // MARK: - _resolveCivicaAnimation

    @Test("reduceMotion=true returns nil — animation suppressed")
    func resolverReturnsNilWhenReduceMotionOn() {
        let resolved = _resolveCivicaAnimation(.easeInOut(duration: 0.2), reduceMotion: true)
        #expect(resolved == nil)
    }

    @Test("reduceMotion=false returns the provided animation")
    func resolverReturnsAnimationWhenReduceMotionOff() {
        let token: Animation = .easeInOut(duration: 0.2)
        let resolved = _resolveCivicaAnimation(token, reduceMotion: false)
        #expect(resolved != nil)
        #expect(resolved == token)
    }

    @Test("resolver respects each CivicaAnimation token when motion is on")
    func resolverHonorsAllTokensUnderReducedMotion() {
        let tokens: [Animation] = [
            CivicaAnimation.fast,
            CivicaAnimation.standard,
            CivicaAnimation.snap,
            CivicaAnimation.slow,
            CivicaAnimation.stepTransition,
        ]
        for token in tokens {
            #expect(_resolveCivicaAnimation(token, reduceMotion: true) == nil)
            #expect(_resolveCivicaAnimation(token, reduceMotion: false) == token)
        }
    }

    // MARK: - _civicaWithAnimation (internal seam, both branches deterministic)

    @Test("withAnimation seam runs closure and returns its value when reduceMotion=true")
    func withAnimationSeamReturnsClosureValueUnderReducedMotion() {
        let result = _civicaWithAnimation(CivicaAnimation.standard, reduceMotion: true) {
            42
        }
        #expect(result == 42)
    }

    @Test("withAnimation seam runs closure and returns its value when reduceMotion=false")
    func withAnimationSeamReturnsClosureValueWithMotion() {
        let result = _civicaWithAnimation(CivicaAnimation.standard, reduceMotion: false) {
            "ok"
        }
        #expect(result == "ok")
    }

    @Test("withAnimation seam invokes closure exactly once on each branch")
    func withAnimationSeamInvokesClosureOnce() {
        var motionOnCount = 0
        _civicaWithAnimation(CivicaAnimation.fast, reduceMotion: true) {
            motionOnCount += 1
        }
        #expect(motionOnCount == 1)

        var motionOffCount = 0
        _civicaWithAnimation(CivicaAnimation.fast, reduceMotion: false) {
            motionOffCount += 1
        }
        #expect(motionOffCount == 1)
    }

    @Test("withAnimation seam rethrows errors thrown in the closure")
    func withAnimationSeamRethrows() {
        struct Boom: Error {}
        #expect(throws: Boom.self) {
            try _civicaWithAnimation(CivicaAnimation.standard, reduceMotion: true) {
                throw Boom()
            }
        }
        #expect(throws: Boom.self) {
            try _civicaWithAnimation(CivicaAnimation.standard, reduceMotion: false) {
                throw Boom()
            }
        }
    }

    // MARK: - civicaWithAnimation public surface

    @Test("public civicaWithAnimation returns closure value (env-driven branch)")
    func publicWithAnimationReturnsClosureValue() {
        // Whichever branch UIAccessibility resolves to in the test host,
        // the closure must still run and return its value. This guards
        // against accidental "drop body" regressions on either branch.
        let result = civicaWithAnimation(CivicaAnimation.standard) { 7 * 6 }
        #expect(result == 42)
    }

    // MARK: - View modifier smoke test

    @Test("civicaAnimation modifier composes and renders without crashing")
    @MainActor
    func modifierSmokeTest() {
        // We can't introspect the resolved Animation without ViewInspector
        // (and `accessibilityReduceMotion` is read-only in the env, so we
        // can't drive both branches from a test). Rendering the modifier
        // through a hosting controller still exercises body() in the
        // host's current env and catches generic-constraint regressions
        // at compile + render time. Branch coverage for the policy itself
        // lives in the `_resolveCivicaAnimation` tests above.
        let view = Color.clear.civicaAnimation(CivicaAnimation.standard, value: 1)
        _ = UIHostingController(rootView: view).view
    }
}
