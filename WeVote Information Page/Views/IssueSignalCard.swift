import SwiftUI
import UIKit

struct IssueSignal: Identifiable, Hashable {
    let id: String
    let title: String
    let icon: String
    var signalStrength: Double
    var accentLevel: Double

    static let previewData: [IssueSignal] = [
        IssueSignal(id: "housing", title: "Housing", icon: "🏠", signalStrength: 0.24, accentLevel: 0.58),
        IssueSignal(id: "healthcare", title: "Healthcare", icon: "🩺", signalStrength: 0.32, accentLevel: 0.62),
        IssueSignal(id: "schools", title: "Schools", icon: "📚", signalStrength: 0.28, accentLevel: 0.56),
        IssueSignal(id: "jobs", title: "Jobs", icon: "💼", signalStrength: 0.29, accentLevel: 0.57),
        IssueSignal(id: "climate", title: "Climate", icon: "🌎", signalStrength: 0.21, accentLevel: 0.52),
        IssueSignal(id: "immigration", title: "Immigration", icon: "🛂", signalStrength: 0.27, accentLevel: 0.55)
    ]
}

struct HowCallsBecomeSignalCard: View {
    let issues: [IssueSignal]

    init(issues: [IssueSignal] = IssueSignal.previewData) {
        self.issues = issues
    }

    var body: some View {
        SignalChokepointView(issues: issues)
            .frame(maxWidth: .infinity)
            .frame(height: 250)
            .clipped()
            .accessibilityElement(children: .contain)
    }
}

struct WhyCallSignalBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let issueEmojiTokens: [String] = ["👨‍👩‍👧", "🩺", "🌿", "🐾", "💵", "🏫", "🚇", "🏘️", "🍽️", "🧒"]
    private let tokenCount = 6

    var body: some View {
        TimelineView(
            .animation(
                minimumInterval: reduceMotion ? 1.0 : (1.0 / 12.0),
                paused: reduceMotion
            )
        ) { context in
            GeometryReader { geo in
                let time = context.date.timeIntervalSinceReferenceDate
                ZStack {
                    ForEach(0..<tokenCount, id: \.self) { index in
                        let position = backdropFlowPosition(index: index, in: geo.size, time: time)
                        IssueEmojiGlyph(
                            emoji: issueEmojiTokens[index % issueEmojiTokens.count],
                            size: 13
                        )
                            .position(position)
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func backdropFlowPosition(index: Int, in size: CGSize, time: TimeInterval) -> CGPoint {
        let t = flowProgress(
            time: time,
            speed: 0.14 + seededUnit(index, salt: 59) * 0.04,
            offset: seededUnit(index, salt: 61)
        )
        let entry = offscreenEntryPoint(index: index, in: size)
        let exit = CGPoint(
            x: size.width * (0.44 + seededUnit(index, salt: 67) * 0.12),
            y: size.height + 120
        )
        let control1 = CGPoint(
            x: entry.x + (exit.x - entry.x) * 0.35,
            y: max(0, entry.y) + size.height * 0.18
        )
        let control2 = CGPoint(
            x: exit.x + CGFloat(sin(Double(index) * 0.61)) * 20,
            y: size.height * 0.72
        )
        return cubicBezier(t: t, p0: entry, p1: control1, p2: control2, p3: exit)
    }

    private func flowProgress(time: TimeInterval, speed: CGFloat, offset: CGFloat) -> CGFloat {
        let raw = CGFloat(time) * speed + offset
        return raw - floor(raw)
    }

    private func seededUnit(_ index: Int, salt: Int) -> CGFloat {
        let value = sin(Double(index * 137 + salt * 97)) * 43758.5453
        return CGFloat(value - floor(value))
    }

    private func offscreenEntryPoint(index: Int, in size: CGSize) -> CGPoint {
        let branch = index % 3
        switch branch {
        case 0:
            return CGPoint(
                x: size.width * (0.30 + seededUnit(index, salt: 71) * 0.40),
                y: -30 - seededUnit(index, salt: 73) * 52
            )
        case 1:
            return CGPoint(
                x: -26 - seededUnit(index, salt: 79) * 40,
                y: size.height * (0.02 + seededUnit(index, salt: 83) * 0.14)
            )
        default:
            return CGPoint(
                x: size.width + 26 + seededUnit(index, salt: 89) * 40,
                y: size.height * (0.02 + seededUnit(index, salt: 97) * 0.14)
            )
        }
    }

    private func cubicBezier(t: CGFloat, p0: CGPoint, p1: CGPoint, p2: CGPoint, p3: CGPoint) -> CGPoint {
        let inv = 1 - t
        let a = inv * inv * inv
        let b = 3 * inv * inv * t
        let c = 3 * inv * t * t
        let d = t * t * t
        return CGPoint(
            x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
            y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
        )
    }
}

private struct SignalChokepointView: View {
    let issues: [IssueSignal]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let issueEmojiTokens: [String] = ["👨‍👩‍👧", "🩺", "🌿", "🐾", "💵", "🏫", "🚇", "🏘️", "🍽️", "🧒"]
    private let topTokenCount = 6
    private let convergeTokenCount = 7
    private let postGateTokenCount = 8

    var body: some View {
        TimelineView(
            .animation(
                minimumInterval: reduceMotion ? 1.0 : (1.0 / 20.0),
                paused: reduceMotion
            )
        ) { context in
            GeometryReader { geo in
                let time = context.date.timeIntervalSinceReferenceDate

                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(VoteNowColors.brandSoftBlue.opacity(0.56))

                    ForEach(0..<topTokenCount, id: \.self) { index in
                        let point = chaoticPosition(index: index, in: geo.size, time: time)
                        let size = chaoticSize(index: index)
                        IssueEmojiGlyph(
                            emoji: issueEmojiTokens[index % issueEmojiTokens.count],
                            size: size
                        )
                            .position(point)
                    }

                    ForEach(0..<convergeTokenCount, id: \.self) { index in
                        let point = convergingPosition(index: index, in: geo.size, time: time)
                        IssueEmojiGlyph(
                            emoji: issueEmojiTokens[(index + 3) % issueEmojiTokens.count],
                            size: 16
                        )
                            .position(point)
                    }

                    ForEach(0..<postGateTokenCount, id: \.self) { index in
                        let point = postGateIssueFallPosition(index: index, in: geo.size, time: time)
                        IssueEmojiGlyph(
                            emoji: issueEmojiTokens[(index + 5) % issueEmojiTokens.count],
                            size: 14
                        )
                            .position(point)
                    }

                    bottleneckCongressGate(in: geo.size, time: time)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Animated constituent call signal flow")
    }

    private func bottleneckCongressGate(in size: CGSize, time: TimeInterval) -> some View {
        return CongressTokenGlyph(size: 153)
        .position(x: size.width * 0.5, y: size.height * 0.48)
    }

    private func chaoticPosition(index: Int, in size: CGSize, time: TimeInterval) -> CGPoint {
        let progress = flowProgress(
            time: time,
            speed: 0.075 + seededUnit(index, salt: 7) * 0.03,
            offset: seededUnit(index, salt: 13)
        )
        let source = offscreenEntryPoint(index: index, in: size)
        let target = CGPoint(
            x: size.width * (0.14 + seededUnit(index, salt: 2) * 0.72),
            y: size.height * (0.09 + seededUnit(index, salt: 5) * 0.20)
        )
        let settle = min(1, progress * 1.4)
        let eased = easeOut(settle)
        let swayX = CGFloat(sin(time * 0.66 + Double(index) * 0.53)) * 3.2
        let swayY = CGFloat(sin(time * 0.45 + Double(index) * 0.37)) * 1.2
        return CGPoint(
            x: lerp(source.x, target.x, eased) + swayX,
            y: lerp(source.y, target.y, eased) + swayY
        )
    }

    private func convergingPosition(index: Int, in size: CGSize, time: TimeInterval) -> CGPoint {
        let t = flowProgress(
            time: time,
            speed: 0.18 + seededUnit(index, salt: 17) * 0.05,
            offset: seededUnit(index, salt: 23)
        )
        let start = offscreenEntryPoint(index: index + 300, in: size)
        let gate = CGPoint(x: size.width * 0.5, y: size.height * 0.48)
        let control1 = CGPoint(
            x: start.x + (gate.x - start.x) * (0.34 + seededUnit(index, salt: 11) * 0.22),
            y: start.y + size.height * (0.12 + seededUnit(index, salt: 29) * 0.10)
        )
        let control2 = CGPoint(
            x: gate.x + CGFloat(sin(Double(index) * 0.9)) * 8,
            y: gate.y - size.height * (0.02 + seededUnit(index, salt: 19) * 0.06)
        )
        return cubicBezier(t: t, p0: start, p1: control1, p2: control2, p3: gate)
    }

    private func postGateIssueFallPosition(index: Int, in size: CGSize, time: TimeInterval) -> CGPoint {
        let t = flowProgress(
            time: time,
            speed: 0.22 + seededUnit(index, salt: 31) * 0.05,
            offset: seededUnit(index, salt: 37)
        )
        let lane = CGFloat(index % 3) - 1
        let neckSpread: CGFloat = 7
        let widening = pow(t, 1.15) * 12
        let laneCenterX = size.width * 0.5 + lane * (neckSpread + widening)
        let x = laneCenterX + CGFloat(sin(time * 0.5 + Double(index) * 0.43)) * 1.2
        let startY = size.height * 0.54
        let y = startY + t * size.height * 0.50

        return CGPoint(x: x, y: y)
    }

    private func chaoticSize(index: Int) -> CGFloat {
        CGFloat(20 + (index % 3) * 4)
    }

    private func flowProgress(time: TimeInterval, speed: CGFloat, offset: CGFloat) -> CGFloat {
        let raw = CGFloat(time) * speed + offset
        return raw - floor(raw)
    }

    private func seededUnit(_ index: Int, salt: Int) -> CGFloat {
        let value = sin(Double(index * 137 + salt * 97)) * 43758.5453
        return CGFloat(value - floor(value))
    }

    private func offscreenEntryPoint(index: Int, in size: CGSize) -> CGPoint {
        let branch = index % 3
        switch branch {
        case 0:
            return CGPoint(
                x: size.width * (0.34 + seededUnit(index, salt: 67) * 0.32),
                y: -28 - seededUnit(index, salt: 71) * 48
            )
        case 1:
            return CGPoint(
                x: -26 - seededUnit(index, salt: 73) * 42,
                y: size.height * (0.02 + seededUnit(index, salt: 79) * 0.16)
            )
        default:
            return CGPoint(
                x: size.width + 26 + seededUnit(index, salt: 83) * 42,
                y: size.height * (0.02 + seededUnit(index, salt: 89) * 0.16)
            )
        }
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * t
    }

    private func easeOut(_ t: CGFloat) -> CGFloat {
        1 - pow(1 - t, 3)
    }

    private func cubicBezier(t: CGFloat, p0: CGPoint, p1: CGPoint, p2: CGPoint, p3: CGPoint) -> CGPoint {
        let inv = 1 - t
        let a = inv * inv * inv
        let b = 3 * inv * inv * t
        let c = 3 * inv * t * t
        let d = t * t * t
        return CGPoint(
            x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
            y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
        )
    }
}

private struct CongressTokenGlyph: View {
    let size: CGFloat

    var body: some View {
        Group {
            if UIImage(named: "CapitolIcon") != nil {
                Image("CapitolIcon")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
            } else {
                Text("🏛️")
                    .font(.system(size: size * 0.9))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct IssueEmojiGlyph: View {
    let emoji: String
    let size: CGFloat

    var body: some View {
        Text(emoji)
            .font(.system(size: size * 0.66))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct HowCallsBecomeSignalCardDemo: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HowCallsBecomeSignalCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("Only 23% of constituents call their reps annually")
                        .font(.headline)
                        .foregroundStyle(VoteNowColors.primaryCTA)
                    Text("When fewer people call, each call carries more signal.")
                        .font(.subheadline)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemBackground).opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .padding(16)
        }
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
    }
}

#Preview("How Calls Signal - Light") {
    HowCallsBecomeSignalCardDemo()
}

#Preview("How Calls Signal - Dark") {
    HowCallsBecomeSignalCardDemo()
        .preferredColorScheme(.dark)
}

#Preview("How Calls Signal - AXXXL") {
    HowCallsBecomeSignalCardDemo()
        .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
}
