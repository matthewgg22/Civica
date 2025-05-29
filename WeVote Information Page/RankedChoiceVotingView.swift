//
//  RankedChoiceVotingView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/17/25.
//
import SwiftUI

// MARK: - BarRow Component
struct BarRow: View {
    let percent: Double       // 0.0…1.0
    let color: Color
    let isEliminated: Bool
    let showLabel: Bool
    let isWinner: Bool
    let statusEmoji: String   // "❌", "➡️", "🎉", or ""
    let width: CGFloat        // full width of this bar

    var body: some View {
        ZStack(alignment: .leading) {
            // full-width background
            RoundedRectangle(cornerRadius: 3)
                .fill((isEliminated ? Color.gray : color).opacity(0.2))
                .frame(width: width, height: 20)

            // filled portion
            RoundedRectangle(cornerRadius: 3)
                .fill(isEliminated ? Color.clear : color)
                .frame(width: percent * width, height: 20)
                .shadow(color: isWinner ? color.opacity(0.6) : .clear,
                        radius: isWinner ? 6 : 0)

            // percentage label, always black, left-aligned
            if showLabel {
                Text("\(Int(percent * 100))%")
                    .font(.caption2).bold()
                    .foregroundColor(.black)
                    .padding(.leading, 4)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // status emoji in the bar (right-aligned)
            if !statusEmoji.isEmpty {
                Text(statusEmoji)
                    .font(.caption)
                    .padding(.trailing, 4)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }
}

// MARK: - RankedChoiceVotingView
struct RankedChoiceVotingView: View {
    private let candidateCount = 5
    private let colors: [Color] = [.red, .blue, .green, .orange, .purple]

    // Percentages by round (0...1), updated to ensure correct elimination order
    private let data: [[Double]] = [
        [0.28, 0.24, 0.18, 0.15, 0.15], // Round 1
        [0.32, 0.26, 0.22, 0.20, 0.00], // Round 2
        [0.42, 0.31, 0.27, 0.00, 0.00], // Round 3 (lowest 0.27 eliminated)
        [0.58, 0.42, 0.00, 0.00, 0.00]  // Round 4 (final head-to-head)
    ]

    @State private var currentRound = 1

    // Layout constants
    private let labelWidth: CGFloat = 60
    private let spacing: CGFloat   = 12
    private let horizontalPadding: CGFloat = 24

    var body: some View {
        // calculate available bar width
        let totalGaps = spacing * 3
        let totalPad  = horizontalPadding * 2
        let screenW   = UIScreen.main.bounds.width
        let barWidth  = (screenW - labelWidth - totalGaps - totalPad) / 4

        VStack(spacing: 12) {
            Text("Ranked Choice Voting (NYC)")
                .font(.headline)
                .padding(.top, 12)

            // Rounds header
            HStack(spacing: spacing) {
                Color.clear.frame(width: labelWidth)
                ForEach(1...4, id: \.self) { round in
                    Text("Round \(round)")
                        .font(.subheadline).fontWeight(.semibold)
                        .frame(width: barWidth)
                }
            }

            // Candidate rows
            ForEach(0..<candidateCount, id: \.self) { idx in
                HStack(spacing: spacing) {
                    // Label + emoji
                    let pctNow = data[currentRound - 1][idx]
                    let statusEmoji: String = {
                        if currentRound < 4 {
                            let next = data[currentRound][idx]
                            return next == 0 ? "❌" : "➡️"
                        } else {
                            return pctNow > 0.5 ? "🎉" : ""
                        }
                    }()
                    Text("Cand \(idx+1)\(statusEmoji)")
                        .font(.caption).fontWeight(.bold)
                        .frame(width: labelWidth, alignment: .leading)

                    // Bars per round
                    ForEach(1...4, id: \.self) { round in
                        let pct     = data[round - 1][idx]
                        let prevPct = round > 1 ? data[round - 2][idx] : 0
                        let eliminated = prevPct > 0 && pct == 0

                        BarRow(
                            percent: pct,
                            color: colors[idx],
                            isEliminated: eliminated,
                            showLabel: round == currentRound,
                            isWinner: pct > 0.5,
                            statusEmoji: "",
                            width: barWidth
                        )
                        .animation(.easeInOut, value: currentRound)
                    }
                }
            }
            .padding(.horizontal, horizontalPadding)

            // Slider
            HStack(spacing: spacing) {
                Image(systemName: "1.circle").font(.caption)
                Slider(
                    value: Binding(
                        get: { Double(currentRound) },
                        set: { new in withAnimation { currentRound = Int(new.rounded()) } }
                    ),
                    in: 1...4,
                    step: 1
                )
                .frame(height: 24)
                Image(systemName: "4.circle").font(.caption)
            }
            .padding(.horizontal, horizontalPadding)
        }
    }
}

// MARK: - Preview
struct RankedChoiceVotingView_Previews: PreviewProvider {
    static var previews: some View {
        RankedChoiceVotingView()
        RankedChoiceVotingView()
            .previewLayout(.sizeThatFits)
    }
}
