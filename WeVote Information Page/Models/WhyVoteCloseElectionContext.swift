import Foundation

enum MarginValue {
    case votes(Int)
    case percent(Double)
}

struct MarginResolved {
    let votes: Int?
    let percent: Double?
    let source: String // exactVotes | computedFromPercent | percentOnly
}

enum CloseElectionContextMaker {
    static let voteThresholdLadder: [(threshold: Int, label: String)] = [
        (10, "everyone at a dinner table arguing"),
        (25, "one full elementary classroom"),
        (40, "a packed school bus"),
        (75, "one airplane cabin (737 economy section)"),
        (100, "everyone at a wedding reception"),
        (150, "a full church on Sunday"),
        (250, "a high school assembly"),
        (500, "a Walmart on a busy afternoon"),
        (1_000, "an entire high school"),
        (2_000, "a Costco on Saturday"),
        (5_000, "a huge suburban high school district"),
        (10_000, "a sold-out concert arena"),
        (20_000, "a packed NBA arena"),
        (40_000, "a full MLB stadium"),
        (60_000, "a packed NFL stadium"),
        (100_000, "a massive outdoor festival"),
        (250_000, "Mardi Gras on one major day"),
        (500_000, "Times Square on New Year's Eve"),
        (750_000, "everyone who lives within 3 to 4 large suburbs combined"),
        (1_000_000, "a million-person march in D.C.")
    ]

    static func resolvedMargin(
        notableCloseRace: String,
        marginVotes: Int?,
        marginPercent: Double?,
        totalVotesCast: Int?
    ) -> MarginResolved {
        let parsedVotes = extractVoteMarginVotes(from: notableCloseRace)
        let parsedPercent = extractMarginPercent(from: notableCloseRace)
        let parsedTotalVotes = extractTotalVotesCast(from: notableCloseRace)

        return resolve(
            marginVotes: marginVotes ?? parsedVotes,
            marginPercent: marginPercent ?? parsedPercent,
            totalVotesCast: totalVotesCast ?? parsedTotalVotes
        )
    }

    static func resolve(
        marginVotes: Int?,
        marginPercent: Double?,
        totalVotesCast: Int?
    ) -> MarginResolved {
        if let rawVotes = marginVotes, rawVotes > 0 {
            let cleanVotes = abs(rawVotes)
            let normalizedPercent: Double?
            if let totalVotesCast, totalVotesCast > 0 {
                normalizedPercent = (Double(cleanVotes) / Double(totalVotesCast)) * 100
            } else {
                normalizedPercent = normalizedMarginPercent(marginPercent)
            }
            return MarginResolved(votes: cleanVotes, percent: normalizedPercent, source: "exactVotes")
        }

        guard let normalizedPercent = normalizedMarginPercent(marginPercent) else {
            return MarginResolved(votes: nil, percent: nil, source: "percentOnly")
        }

        if let totalVotesCast, totalVotesCast > 0 {
            let computedVotes = Int((normalizedPercent * Double(totalVotesCast) / 100).rounded())
            return MarginResolved(votes: max(computedVotes, 0), percent: normalizedPercent, source: "computedFromPercent")
        }

        return MarginResolved(votes: nil, percent: normalizedPercent, source: "percentOnly")
    }

    // Accepts either percent value (0..100) or fractional decimal (0..1), with heuristic.
    // If <= 0.05, treat as fraction (e.g. 0.002 -> 0.2%). Otherwise treat as already percent.
    static func normalizedMarginPercent(_ raw: Double?) -> Double? {
        guard let raw, raw.isFinite else { return nil }
        let magnitude = abs(raw)

        if magnitude <= 1.0 {
            if magnitude <= 0.05 {
                return magnitude * 100
            }
            return magnitude
        }

        return magnitude
    }

    static func votesContext(for votes: Int) -> String {
        let value = max(0, votes)
        guard let first = voteThresholdLadder.first,
              let last = voteThresholdLadder.last else {
            return "a large local crowd"
        }

        if value <= first.threshold {
            return first.label
        }

        if value >= last.threshold {
            return last.label
        }

        for entry in voteThresholdLadder.reversed() where value >= entry.threshold {
            return entry.label
        }

        return first.label
    }

    static func marginLine(for resolved: MarginResolved) -> String {
        if let votes = resolved.votes {
            return "Margin: \(formatWhole(votes)) votes"
        }

        if let percent = resolved.percent {
            return "Margin: \(formatPercent(percent))%"
        }

        return "Margin: Not provided"
    }

    static func contextLine(for resolved: MarginResolved) -> String {
        if let votes = resolved.votes {
            let label = votesContext(for: votes)
            if resolved.source == "computedFromPercent" {
                return "That's about \(label) (approx.)."
            }
            return "That's about \(label)."
        }

        if let percent = resolved.percent {
            switch percentBucket(for: percent) {
            case .photoFinish:
                return "That's a photo finish."
            case .razorThin:
                return "That's razor-thin."
            case .veryClose:
                return "That's very close."
            case .close:
                return "That's close."
            }
        }

        return "That's razor-thin."
    }

    static func extractVoteMarginVotes(from text: String) -> Int? {
        let pattern = #"([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s+votes?"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }

        let fullRange = NSRange(text.startIndex..<text.endIndex, in: text)
        let matches = regex.matches(in: text, options: [], range: fullRange)
        let values = matches.compactMap { match -> Int? in
            guard let range = Range(match.range(at: 1), in: text) else { return nil }
            return Int(text[range].replacingOccurrences(of: ",", with: ""))
        }

        return values.min()
    }

    static func extractMarginPercent(from text: String) -> Double? {
        let pattern = #"([+-]?[0-9]+(?:\.[0-9]+)?)\s*%"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }

        let fullRange = NSRange(text.startIndex..<text.endIndex, in: text)
        let matches = regex.matches(in: text, options: [], range: fullRange)
        let percents = matches.compactMap { match -> Double? in
            guard let range = Range(match.range(at: 1), in: text),
                  let value = Double(String(text[range])) else {
                return nil
            }
            return abs(value)
        }

        return percents.min()
    }

    static func extractTotalVotesCast(from text: String) -> Int? {
        let patterns = [
            #"(?:out of|of)\s+([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s+(?:votes|ballots?)"#,
            #"(?:total|turnout)\s*(?:of|:)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})"#
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
                continue
            }

            let fullRange = NSRange(text.startIndex..<text.endIndex, in: text)
            if let match = regex.firstMatch(in: text, options: [], range: fullRange),
               let range = Range(match.range(at: 1), in: text),
               let value = Int(text[range].replacingOccurrences(of: ",", with: "")) {
                return value
            }
        }

        return nil
    }

    private enum PercentBucket {
        case photoFinish
        case razorThin
        case veryClose
        case close
    }

    private static func percentBucket(for percent: Double) -> PercentBucket {
        if percent <= 0.1 { return .photoFinish }
        if percent <= 0.5 { return .razorThin }
        if percent <= 1.0 { return .veryClose }
        return .close
    }

    private static let wholeFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    private static let percentFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    private static func formatWhole(_ value: Int) -> String {
        wholeFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private static func formatPercent(_ value: Double) -> String {
        percentFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

/*
 Sample checks:
 - marginVotes=17 => everyone at a dinner table arguing
 - marginVotes=120 => everyone at a wedding reception
 - marginPercent=0.2 and totalVotesCast=200_000 => 400 votes => a high school assembly
 - marginPercent=0.002 and totalVotesCast=200_000 => 400 votes => a high school assembly
*/
