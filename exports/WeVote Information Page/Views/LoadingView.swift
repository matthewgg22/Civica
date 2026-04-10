//
//
//  LoadingView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI
import UIKit

struct LoadingView: View {
    let selectedStateName: String?
    let selectedZip: String?

    private let splashBlue = VoteNowColors.brandSoftBlue
    private let logoRed = Color(red: 1.0, green: 0.30, blue: 0.24)
    private let marqueeRed = Color(red: 223.0 / 255.0, green: 87.0 / 255.0, blue: 70.0 / 255.0) // #DF5746

    private let stateNames: [String] = [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
        "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York",
        "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
        "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
        "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
    ]

    private var normalizedStateName: String? {
        guard let raw = selectedStateName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return nil }
        return raw.uppercased()
    }

    private var scrollingStateNames: [String] {
        let uppercasedBase = stateNames.map { $0.uppercased() }
        guard let selected = normalizedStateName else { return uppercasedBase }
        if uppercasedBase.contains(selected) {
            return uppercasedBase
        }
        var replaced = uppercasedBase
        if !replaced.isEmpty {
            replaced[0] = selected
        }
        return replaced
    }

    private let marqueeSpeed: CGFloat = 30
    private let marqueeBottomPadding: CGFloat = 38

    init(selectedStateName: String? = nil, selectedZip: String? = nil) {
        self.selectedStateName = selectedStateName
        self.selectedZip = selectedZip
    }

    var body: some View {
        ZStack {
            splashBlue
                .ignoresSafeArea()

            FlagMark(color: logoRed)
                .frame(width: 188, height: 96) // wider/shorter to avoid squeezed look
                .scaleEffect(0.85) // true 15% uniform shrink
                .offset(y: -130) // significantly higher on screen
                .accessibilityHidden(true)

            VStack(spacing: 2) { // closer together
                // Top line: reverse/back-leaning + scroll left
                StateMarqueeLine(
                    states: scrollingStateNames,
                    direction: .left,
                    speed: marqueeSpeed,
                    textColor: marqueeRed
                )

                // Bottom line: forward-leaning + scroll right
                StateMarqueeLine(
                    states: scrollingStateNames,
                    direction: .right,
                    speed: marqueeSpeed,
                    textColor: marqueeRed
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding(.bottom, marqueeBottomPadding)
        }
    }
}

private struct StateMarqueeLine: View {
    enum Direction {
        case left
        case right
    }

    let states: [String]
    let direction: Direction
    let speed: CGFloat
    let textColor: Color

    private let spacing: CGFloat = 0
    private let lineHeight: CGFloat = 22
    private let fontSize: CGFloat = 19
    private let dotSeparator = "  •  " // exactly two spaces before and after

    private var aptosFontName: String? {
        let candidates = [
            "Aptos-Bold",
            "AptosDisplay-Bold",
            "Aptos Display Bold",
            "Aptos Bold",
            "AptosDisplay-Regular",
            "Aptos-Regular",
            "Aptos Display",
            "Aptos"
        ]
        return candidates.first { UIFont(name: $0, size: fontSize) != nil }
    }

    private var marqueeUIFont: UIFont {
        if let name = aptosFontName, let aptos = UIFont(name: name, size: fontSize) {
            return aptos
        }
        return UIFont.systemFont(ofSize: fontSize, weight: .black)
    }

    private var marqueeFont: Font {
        if let name = aptosFontName {
            return .custom(name, size: fontSize)
        }
        return .system(size: fontSize, weight: .black, design: .default)
    }

    // Top line (direction .left) is reverse/back-leaning; bottom line is forward-leaning.
    private var italicSkew: CGFloat {
        direction == .left ? -0.25 : 0.25
    }

    private var cycleText: String {
        let tokenized = states.isEmpty ? [""] : states
        return tokenized.joined(separator: dotSeparator) + dotSeparator
    }

    private var measuredTextWidth: CGFloat {
        max(cycleText.size(withAttributes: [.font: marqueeUIFont]).width, 1)
    }

    private var tokenizedStates: [String] {
        states.isEmpty ? [""] : states
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { context in
            GeometryReader { geo in
                let cycle = measuredTextWidth
                let progress = (CGFloat(context.date.timeIntervalSinceReferenceDate) * speed)
                    .truncatingRemainder(dividingBy: cycle)

                let offsetX = (direction == .left) ? -progress : (-cycle + progress)

                // Extra room needed so the shear doesn't clip.
                let skewInset = abs(italicSkew) * lineHeight + 6

                // Expand ONLY the visually-short side.
                let leftInset  = italicSkew > 0 ? skewInset : 0   // forward-leaning needs extra on left
                let rightInset = italicSkew < 0 ? skewInset : 0   // back-leaning needs extra on right

                HStack(spacing: spacing) {
                    marqueeChunk
                    marqueeChunk
                    marqueeChunk
                }
                .lineLimit(1)
                .fixedSize()
                .offset(x: offsetX - leftInset)
                .frame(width: geo.size.width + leftInset + rightInset, alignment: .leading)
                .clipped()
            }
            .frame(height: lineHeight)
        }
        .frame(height: lineHeight)
    }

    private var marqueeChunk: some View {
        HStack(spacing: 0) {
            ForEach(Array(tokenizedStates.enumerated()), id: \.offset) { _, state in
                // Group state + dot, then skew the group so dots stay optically aligned.
                HStack(spacing: 0) {
                    Text(state)
                    Text(dotSeparator)
                }
                .font(marqueeFont)
                .foregroundColor(textColor)
                .transformEffect(CGAffineTransform(a: 1, b: 0, c: italicSkew, d: 1, tx: 0, ty: 0))
            }
        }
    }
}

private struct FlagMark: View {
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            bar(widthRatio: 0.56, alignment: .trailing)
            bar(widthRatio: 0.56, alignment: .trailing)
            bar(widthRatio: 0.56, alignment: .trailing)
            bar(widthRatio: 1.0, alignment: .center)
            bar(widthRatio: 1.0, alignment: .center)
            bar(widthRatio: 1.0, alignment: .center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func bar(widthRatio: CGFloat, alignment: Alignment) -> some View {
        GeometryReader { geo in
            let width = geo.size.width * widthRatio
            RoundedRectangle(cornerRadius: 0)
                .fill(color)
                .frame(width: width, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: alignment)
        }
        .frame(height: 14)
    }
}

struct LoadingView_Previews: PreviewProvider {
    static var previews: some View {
        LoadingView()
    }
}
