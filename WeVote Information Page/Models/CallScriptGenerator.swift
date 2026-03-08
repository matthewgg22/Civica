import Foundation

struct CallScriptGenerator {
    static func script(for senatorName: String, issue: IssueCode, assignedCommittees: [String]) -> String {
        let targetName = targetDisplayName(from: senatorName)
        let closing = committeeClosing(for: issue, assignedCommittees: assignedCommittees)

        return "Hi, my name is [user/placeholder], and I'm calling to ask Senator \(targetName) to \(issue.shortPrompt). \(issue.defaultAsk) \(closing) Thank you."
    }

    static func committeeClosing(for issue: IssueCode, assignedCommittees: [String]) -> String {
        if let matched = CommitteeMatcher.bestMatch(for: issue, assignedCommittees: assignedCommittees) {
            return "Since this connects to your work on the \(matched), your voice could make a real difference."
        }
        return "I hope you'll keep this issue in mind and take action."
    }

    private static func targetDisplayName(from senatorName: String) -> String {
        let trimmed = senatorName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "your office" }

        if trimmed.lowercased().hasPrefix("senator ") {
            return String(trimmed.dropFirst("senator ".count))
        }

        let parts = trimmed.split(separator: " ")
        guard let last = parts.last else { return trimmed }
        return String(last)
    }
}
