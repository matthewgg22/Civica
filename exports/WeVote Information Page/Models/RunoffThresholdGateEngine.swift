import Foundation

struct ThresholdGateCandidate: Identifiable, Equatable {
    let id: Int
    let label: String
}

struct ThresholdGateRoundOneResult: Equatable {
    let shares: [Double]
    let threshold: Double
    let majorityWinnerIndex: Int?
    let topTwoIndices: [Int]

    var hasMajorityWinner: Bool {
        majorityWinnerIndex != nil
    }
}

enum RunoffThresholdGateEngine {
    static let candidates: [ThresholdGateCandidate] = [
        ThresholdGateCandidate(id: 0, label: "Candidate 1"),
        ThresholdGateCandidate(id: 1, label: "Candidate 2"),
        ThresholdGateCandidate(id: 2, label: "Candidate 3")
    ]

    static let defaultThreshold = 50.0
    static let defaultRoundOneShares: [Double] = [41, 34, 25]
    static let defaultRoundTwoShares: [Double] = [48, 52]

    // The split values are set so sample round two resolves to 48/52 from 41/34/25.
    static let defaultTransferToFirstFinalistByCandidateID: [Int: Double] = [
        2: 28
    ]

    static func roundOneResult(
        shares: [Double],
        threshold: Double
    ) -> ThresholdGateRoundOneResult {
        let sanitized = sanitizedShares(shares)
        let topTwo = topTwoIndices(from: sanitized)
        let winner = sanitized.firstIndex(where: { $0 >= threshold })

        return ThresholdGateRoundOneResult(
            shares: sanitized,
            threshold: threshold,
            majorityWinnerIndex: winner,
            topTwoIndices: topTwo
        )
    }

    static func adjustedShares(
        currentShares: [Double],
        updating index: Int,
        to requestedValue: Double
    ) -> [Double] {
        guard currentShares.indices.contains(index), currentShares.count > 1 else {
            return sanitizedShares(currentShares)
        }

        var next = sanitizedShares(currentShares)
        let clampedTarget = clamp(requestedValue, min: 0, max: 100)
        let remainingTarget = max(0, 100 - clampedTarget)

        let otherIndices = next.indices.filter { $0 != index }
        let otherTotal = otherIndices.reduce(0.0) { partial, candidateIndex in
            partial + max(0, next[candidateIndex])
        }

        if otherTotal <= 0 {
            let even = remainingTarget / Double(otherIndices.count)
            for candidateIndex in otherIndices {
                next[candidateIndex] = even
            }
        } else {
            for candidateIndex in otherIndices {
                let oldValue = max(0, next[candidateIndex])
                next[candidateIndex] = oldValue / otherTotal * remainingTarget
            }
        }

        next[index] = clampedTarget
        return normalizedToOneHundred(next)
    }

    static func runoffShares(
        roundOneShares: [Double],
        transferToFirstFinalistByCandidateID: [Int: Double],
        finalists: [Int]
    ) -> [Double] {
        let sanitized = sanitizedShares(roundOneShares)
        guard finalists.count == 2,
              sanitized.indices.contains(finalists[0]),
              sanitized.indices.contains(finalists[1]),
              finalists[0] != finalists[1] else {
            return defaultRoundTwoShares
        }

        let firstFinalist = finalists[0]
        let secondFinalist = finalists[1]

        var firstShare = sanitized[firstFinalist]
        var secondShare = sanitized[secondFinalist]

        for index in sanitized.indices where index != firstFinalist && index != secondFinalist {
            let eliminatedShare = sanitized[index]
            let splitToFirst = clamp(transferToFirstFinalistByCandidateID[index] ?? 50, min: 0, max: 100) / 100
            firstShare += eliminatedShare * splitToFirst
            secondShare += eliminatedShare * (1 - splitToFirst)
        }

        let normalized = normalizedToOneHundred([firstShare, secondShare])
        return normalized
    }

    static func topTwoIndices(from shares: [Double]) -> [Int] {
        let sanitized = sanitizedShares(shares)
        let sorted = sanitized.indices.sorted { lhs, rhs in
            if sanitized[lhs] == sanitized[rhs] {
                return lhs < rhs
            }
            return sanitized[lhs] > sanitized[rhs]
        }
        return Array(sorted.prefix(2))
    }

    static func sanitizedShares(_ shares: [Double]) -> [Double] {
        normalizedToOneHundred(
            shares.map { value in
                guard value.isFinite else { return 0 }
                return max(0, value)
            }
        )
    }

    private static func normalizedToOneHundred(_ shares: [Double]) -> [Double] {
        guard !shares.isEmpty else { return [] }

        let total = shares.reduce(0, +)
        var normalized: [Double]

        if !total.isFinite || total <= 0 {
            let even = 100 / Double(shares.count)
            normalized = Array(repeating: even, count: shares.count)
        } else {
            normalized = shares.map { $0 / total * 100 }
        }

        // Correct floating point drift so the final sum is exactly 100.
        let sum = normalized.reduce(0, +)
        guard sum.isFinite else {
            let even = 100 / Double(shares.count)
            return Array(repeating: even, count: shares.count)
        }
        let delta = 100 - sum
        if delta.isFinite, let maxIndex = normalized.indices.max(by: { normalized[$0] < normalized[$1] }) {
            normalized[maxIndex] += delta
        }

        return normalized.map { value in
            value.isFinite ? max(0, value) : 0
        }
    }

    private static func clamp(_ value: Double, min lowerBound: Double, max upperBound: Double) -> Double {
        Swift.max(lowerBound, Swift.min(upperBound, value))
    }
}
