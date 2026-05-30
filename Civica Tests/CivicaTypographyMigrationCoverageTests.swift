import Foundation
import Testing

// RA-1 step 2 (iOS audit 2026-05-29) coverage gate.
//
// After the typography codemod, no Swift source under `Civica/` or
// `CivicaDesignSystem/` is allowed to use `.font(.system(size: N, ...))` as a
// Dynamic-Type bypass. Replacements live in CivicaTypography (size + weight
// tokens that wrap UIFontMetrics via CivicaTypographyResolver) or
// `.imageScale(.large) + .font(.body)` for SF Symbol icons.
//
// Two callsites are documented exceptions and carry an inline `// keep system
// size` comment — they're kept out of the regex match by requiring the
// callsite to NOT be immediately preceded by `// keep`/`// Rounded-design`/
// `// Info badge` comment lines. Simpler: enumerate the exception files and
// allow exactly the historical count.
@Suite(.serialized)
struct CivicaTypographyMigrationCoverageTests {

    // Files where `.font(.system(size:...))` is intentionally retained, with
    // expected occurrence count. Update only when a NEW exception is added
    // with an accompanying code comment and PR justification.
    private static let allowedExceptions: [String: Int] = [
        // Rounded-design hero numeric (interview score).
        "Civica/Features/SNAP/InterviewCoach/ReviewSummaryView.swift": 1,
        // Info badge sized to fit fixed 16pt circle.
        "Civica/Features/SNAP/Marketplace/JobMatchListView.swift": 1,
    ]

    @Test("No new .font(.system(size:)) bypasses regress past the documented exceptions")
    func noSystemFontBypasses() throws {
        let repoRoot = Self.repoRoot()
        let roots = ["Civica", "CivicaDesignSystem"]
        let pattern = #".font(.system(size:"#

        var offenders: [String: Int] = [:]
        for root in roots {
            let dir = repoRoot.appendingPathComponent(root)
            for file in Self.swiftFiles(under: dir) {
                guard let contents = try? String(contentsOf: file, encoding: .utf8) else { continue }
                let count = Self.occurrenceCount(of: pattern, in: contents)
                guard count > 0 else { continue }
                let rel = Self.relativePath(of: file, base: repoRoot)
                offenders[rel] = count
            }
        }

        // Diff offenders against the allowlist.
        var unexpected: [String] = []
        for (path, count) in offenders {
            let allowed = Self.allowedExceptions[path] ?? 0
            if count != allowed {
                unexpected.append("\(path): \(count) bypass(es), expected \(allowed)")
            }
        }
        // Also check none of the allowlist entries went to zero (would mean a
        // silent migration that should now drop the exception).
        for (path, allowed) in Self.allowedExceptions where (offenders[path] ?? 0) == 0 {
            unexpected.append("\(path): allowed \(allowed) bypass(es) but file no longer has any — drop from allowlist")
        }

        let offenderList = unexpected.joined(separator: "\n  - ")
        #expect(
            unexpected.isEmpty,
            ".font(.system(size:)) bypass regression. See offenders:\n  - \(offenderList)"
        )
    }

    // MARK: - Helpers

    private static func repoRoot() -> URL {
        // This file lives at <repo>/Civica Tests/CivicaTypographyMigrationCoverageTests.swift.
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private static func swiftFiles(under directory: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        var out: [URL] = []
        for case let url as URL in enumerator where url.pathExtension == "swift" {
            // Skip the package's own .build directory and Xcode-derived artifacts.
            let path = url.path
            if path.contains("/.build/") || path.contains("/DerivedData/") { continue }
            out.append(url)
        }
        return out
    }

    private static func relativePath(of url: URL, base: URL) -> String {
        let basePath = base.path.hasSuffix("/") ? base.path : base.path + "/"
        let p = url.path
        return p.hasPrefix(basePath) ? String(p.dropFirst(basePath.count)) : p
    }

    private static func occurrenceCount(of substring: String, in haystack: String) -> Int {
        var count = 0
        var range = haystack.startIndex..<haystack.endIndex
        while let found = haystack.range(of: substring, range: range) {
            count += 1
            range = found.upperBound..<haystack.endIndex
        }
        return count
    }
}
