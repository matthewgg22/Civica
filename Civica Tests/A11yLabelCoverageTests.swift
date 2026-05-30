import Foundation
import Testing

// RA-5 (iOS audit 2026-05-29) coverage gate.
//
// Every `*View.swift` under `Civica/Features/SNAP/` and `Civica/App/` MUST
// declare its VoiceOver intent in one of two ways:
//
//   1. `.accessibilityLabel(...)` — for interactive surfaces (Button,
//      NavigationLink, TextField, Toggle, etc.). At least one label per file.
//
//   2. `// MARK: - AccessibilityElement = parent` — for pure container /
//      layout wrappers with no interactive elements, declaring that VoiceOver
//      reads the merged child text rather than a synthetic label.
//
// Soft check (file-system / regex). If it becomes brittle (e.g. moves to
// `.accessibilityRepresentation` or an unrelated rename), mark the suite
// `@Suite(.disabled)` and document — don't silently weaken the rule.
@Suite(.serialized)
struct A11yLabelCoverageTests {

    @Test("Every *View.swift has accessibilityLabel or AccessibilityElement = parent MARK")
    func everyViewIsLabeled() throws {
        let roots = ["Civica/Features/SNAP", "Civica/App"]
        let repoRoot = Self.repoRoot()
        let files = roots.flatMap { Self.swiftViewFiles(under: repoRoot.appendingPathComponent($0)) }

        #expect(files.count >= 80, "Expected ≥80 *View.swift files; got \(files.count). Did the layout change?")

        var uncovered: [String] = []
        for file in files {
            guard let contents = try? String(contentsOf: file, encoding: .utf8) else {
                uncovered.append(file.path)
                continue
            }
            let hasLabel = contents.contains("accessibilityLabel")
            let hasMark = contents.contains("MARK: - AccessibilityElement = parent")
            if !(hasLabel || hasMark) {
                uncovered.append(file.lastPathComponent)
            }
        }

        #expect(uncovered.isEmpty, "VoiceOver coverage gap. Uncovered: \(uncovered.joined(separator: ", "))")
    }

    // MARK: - Helpers

    private static func repoRoot() -> URL {
        // This file lives at <repo>/Civica Tests/A11yLabelCoverageTests.swift.
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private static func swiftViewFiles(under directory: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        var hits: [URL] = []
        for case let url as URL in enumerator {
            if url.pathExtension == "swift" && url.lastPathComponent.hasSuffix("View.swift") {
                hits.append(url)
            }
        }
        return hits
    }
}
