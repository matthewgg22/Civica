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
    private static let issueEmojiTokens: [String] = ["👪", "🩺", "🌿", "🐾", "💵", "🏫", "🚍", "🏠", "🍽️", "🧒"]
    private static let flowTokens: [EmojiFlowToken] = makeFlowTokens()
    @State private var phase: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let choke = CGPoint(x: geo.size.width * 0.5, y: chokeY(in: geo.size))

            ZStack {
                ForEach(Self.flowTokens) { token in
                    IssueEmojiGlyph(emoji: token.emoji, size: token.size)
                        .position(flowPosition(token: token, in: geo.size, choke: choke, globalPhase: phase))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            phase = 0
            withAnimation(.linear(duration: 13).repeatForever(autoreverses: false)) {
                phase = 1
            }
        }
    }

    private func chokeY(in size: CGSize) -> CGFloat {
        min(max(250, size.height * 0.37), 350)
    }

    private static func makeFlowTokens() -> [EmojiFlowToken] {
        var tokens: [EmojiFlowToken] = []
        tokens.reserveCapacity(24)

        for index in 0..<24 {
            let emoji = issueEmojiTokens[index % issueEmojiTokens.count]
            let lane = index % 7
            let branch = index % 5
            let offset = CGFloat((index * 9) % 100) / 100.0
            let size = 15 + CGFloat((index + 1) % 3)

            tokens.append(
                EmojiFlowToken(
                    id: index,
                    emoji: emoji,
                    lane: lane,
                    branch: branch,
                    offset: offset,
                    size: size
                )
            )
        }

        return tokens
    }

    private func flowPosition(token: EmojiFlowToken, in size: CGSize, choke: CGPoint, globalPhase: CGFloat) -> CGPoint {
        let t = wrapped(globalPhase + token.offset)

        if t < 0.56 {
            let u = eased(t / 0.56)
            let entry = entryPoint(token: token, in: size, choke: choke)
            let control1 = CGPoint(
                x: entry.x + (choke.x - entry.x) * 0.30,
                y: entry.y + (choke.y - entry.y) * 0.43
            )
            let control2 = CGPoint(
                x: choke.x + laneX(token) * 7,
                y: choke.y - 24
            )
            return cubicBezier(t: u, p0: entry, p1: control1, p2: control2, p3: choke)
        }

        let v = eased((t - 0.56) / 0.44)
        let lane = laneX(token)
        let spread = 10 + v * 24
        let end = CGPoint(
            x: choke.x + lane * spread,
            y: size.height + 130
        )
        let control1 = CGPoint(
            x: choke.x + lane * 4,
            y: choke.y + size.height * 0.10
        )
        let control2 = CGPoint(
            x: choke.x + lane * spread * 0.90,
            y: size.height * 0.72
        )
        return cubicBezier(t: v, p0: choke, p1: control1, p2: control2, p3: end)
    }

    private func laneX(_ token: EmojiFlowToken) -> CGFloat {
        CGFloat(token.lane - 3)
    }

    private func entryPoint(token: EmojiFlowToken, in size: CGSize, choke: CGPoint) -> CGPoint {
        let jitterX = seededUnit(token: token, salt: 31) * 24
        let jitterY = seededUnit(token: token, salt: 37) * 30

        switch token.branch {
        case 0:
            return CGPoint(
                x: -42,
                y: choke.y * (0.32 + seededUnit(token: token, salt: 41) * 0.18) + jitterY
            )
        case 1:
            return CGPoint(
                x: size.width * (0.17 + seededUnit(token: token, salt: 43) * 0.20),
                y: -50 - jitterY
            )
        case 2:
            return CGPoint(
                x: size.width * (0.83 - seededUnit(token: token, salt: 47) * 0.20),
                y: -50 - jitterY
            )
        case 3:
            return CGPoint(
                x: size.width + 42,
                y: choke.y * (0.32 + seededUnit(token: token, salt: 53) * 0.18) + jitterY
            )
        default:
            return CGPoint(
                x: size.width * (0.50 + (seededUnit(token: token, salt: 59) - 0.5) * 0.30) + jitterX,
                y: -52 - jitterY
            )
        }
    }

    private func seededUnit(token: EmojiFlowToken, salt: Int) -> CGFloat {
        let value = sin(Double(token.id * 137 + salt * 97)) * 43758.5453
        return CGFloat(value - floor(value))
    }

    private func wrapped(_ value: CGFloat) -> CGFloat {
        let raw = value - floor(value)
        return raw < 0 ? raw + 1 : raw
    }

    private func eased(_ t: CGFloat) -> CGFloat {
        let clamped = max(0, min(1, t))
        return clamped * clamped * (3 - 2 * clamped)
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

private struct EmojiFlowToken: Identifiable, Hashable {
    let id: Int
    let emoji: String
    let lane: Int
    let branch: Int
    let offset: CGFloat
    let size: CGFloat
}

private struct SignalChokepointView: View {
    let issues: [IssueSignal]

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.48)

            CongressTokenGlyph(size: 153)
                .position(center)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Constituent concerns converge through a congressional office chokepoint")
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
            .font(.system(size: size))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct HowCallsBecomeSignalCardDemo: View {
    var body: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                HowCallsBecomeSignalCard()

                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    Text("Only 23% of constituents call their reps annually")
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ctaBlue)
                    Text("When fewer people call, each call carries more signal.")
                        .font(CivicaTypography.subhead)
                }
                .padding(CivicaSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.brandSoftBlue.ignoresSafeArea())
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
