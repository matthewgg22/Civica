import Foundation
import Testing

// RA-4 (iOS audit 2026-05-29) coverage gate.
//
// The codemod migrated every existing `withAnimation(_:)` and
// `.animation(_:value:)` callsite under `Civica/` + `CivicaDesignSystem/`
// to the Reduce-Motion-respecting `civicaWithAnimation(_:)` and
// `.civicaAnimation(_:value:)` APIs from CivicaAnimationRespect.swift.
//
// This suite asserts the codemod stays applied. New code that bypasses
// the wrappers regresses ReduceMotion respect silently — the build
// won't fail; the only signal is users on Reduce Motion seeing
// animations the rest of the app correctly suppresses.
//
// Allowed exceptions:
//   • Files containing `// MARK: - REDUCE-MOTION EXEMPT` (numericText
//     counter springs in the estimator + EBT balance hero, per audit
//     RA-4 explicit exception) — declared per-callsite with a comment.
//   • CivicaAnimationRespect.swift itself (it defines the wrappers).
//   • `.transition(...).animation(...)` — different API (animates a
//     Transition, not a View); not in scope for this codemod.
@Suite(.serialized)
struct RAReduceMotionCoverageTests {

    @Test func noBareWithAnimationCallsites() throws {
        let offenders = try grepSwiftFiles(pattern: #"\bwithAnimation\("#) { content in
            // Skip the wrapper definition + EXEMPT files.
            !content.contains("// MARK: - Public API")
                && !content.contains("// MARK: - REDUCE-MOTION EXEMPT")
        }
        #expect(offenders.isEmpty, "Use civicaWithAnimation(_:) instead of bare withAnimation(_:): \(offenders.sorted())")
    }

    @Test func noBareAnimationModifierCallsites() throws {
        // Match `.animation(...)` but NOT `.civicaAnimation(`, `.contentTransition(`,
        // and not chained `.transition(...).animation(...)` (different API).
        let pattern = #"(?<![A-Za-z])\.animation\("#
        let offenders = try grepSwiftFiles(pattern: pattern) { content in
            !content.contains("// MARK: - Public API")
                && !content.contains("// MARK: - REDUCE-MOTION EXEMPT")
        } lineFilter: { line in
            // Allow `.transition(...).animation(...)` chains (transition API).
            !line.contains(".transition(") && !line.contains(".combined(") && !line.contains("// ")
        }
        #expect(offenders.isEmpty, "Use .civicaAnimation(_:value:) instead of bare .animation(_:value:): \(offenders.sorted())")
    }

    // MARK: - Helpers

    /// Roots scanned. Mirrors the codemod scope.
    private static let roots = [
        "Civica",
        "CivicaDesignSystem/Sources",
    ]

    /// Repo root resolution: walk up from this test file until we find
    /// `Civica.xcodeproj`. Robust against CI vs local DerivedData paths.
    private static func repoRoot() -> URL {
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<10 {
            url.deleteLastPathComponent()
            let candidate = url.appendingPathComponent("Civica.xcodeproj")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return url
            }
        }
        return url
    }

    /// Find Swift files matching `pattern`, skipping files where
    /// `fileFilter` returns false, and lines where `lineFilter` returns
    /// false. Returns `path:line` strings.
    private func grepSwiftFiles(
        pattern: String,
        fileFilter: (String) -> Bool = { _ in true },
        lineFilter: (String) -> Bool = { _ in true }
    ) throws -> [String] {
        let root = Self.repoRoot()
        let fm = FileManager.default
        let regex = try NSRegularExpression(pattern: pattern)
        var hits: [String] = []
        for relRoot in Self.roots {
            let base = root.appendingPathComponent(relRoot)
            guard let enumerator = fm.enumerator(at: base, includingPropertiesForKeys: nil) else { continue }
            for case let url as URL in enumerator {
                guard url.pathExtension == "swift" else { continue }
                let content = (try? String(contentsOf: url)) ?? ""
                guard fileFilter(content) else { continue }
                for (idx, line) in content.split(separator: "\n", omittingEmptySubsequences: false).enumerated() {
                    let s = String(line)
                    let range = NSRange(s.startIndex..., in: s)
                    if regex.firstMatch(in: s, range: range) != nil && lineFilter(s) {
                        let rel = url.path.replacingOccurrences(of: root.path + "/", with: "")
                        hits.append("\(rel):\(idx + 1)")
                    }
                }
            }
        }
        return hits
    }
}
