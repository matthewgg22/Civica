import Foundation

struct CommitteeMatcher {
    static func bestMatch(for issue: IssueCode, assignedCommittees: [String]) -> String? {
        let cleanedAssigned = assignedCommittees
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !cleanedAssigned.isEmpty else { return nil }

        let normalizedAssigned: [(raw: String, normalized: String)] = cleanedAssigned.map {
            (raw: $0, normalized: normalizedCommitteeName($0))
        }

        for relevant in issue.relevantSenateCommittees {
            let normalizedRelevant = normalizedCommitteeName(relevant)
            guard !normalizedRelevant.isEmpty else { continue }

            for assigned in normalizedAssigned {
                guard !assigned.normalized.isEmpty else { continue }

                if isMatch(assigned: assigned.normalized, relevant: normalizedRelevant) {
                    return assigned.raw
                }
            }
        }

        return nil
    }

    private static func isMatch(assigned: String, relevant: String) -> Bool {
        if assigned == relevant {
            return true
        }

        return assigned.contains(relevant) || relevant.contains(assigned)
    }

    private static func normalizedCommitteeName(_ value: String) -> String {
        var normalized = value
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        normalized = normalized.replacingOccurrences(of: "&", with: " and ")
        normalized = normalized.replacingOccurrences(of: "committee on ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee for ", with: "")
        normalized = normalized.replacingOccurrences(of: "committee of ", with: "")
        normalized = normalized.replacingOccurrences(of: "senate ", with: "")
        normalized = normalized.replacingOccurrences(of: "u.s. ", with: "")
        normalized = normalized.replacingOccurrences(of: "us ", with: "")
        normalized = normalized.replacingOccurrences(of: "'", with: "")

        let allowed = CharacterSet.alphanumerics.union(.whitespaces)
        normalized = String(normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : " " })
        normalized = normalized.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
