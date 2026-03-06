import SwiftUI

/// Reusable always-on CTA border effect for pill buttons.
/// Two colored segments run the same capsule path with dynamic z-order:
/// the segment currently "ahead" is rendered last, so it occludes the trailing one.
struct VoteNowPillDualOrbitModifier: ViewModifier {
    var redColor: Color = Color(hex: "#FF3B30")
    var blueColor: Color = Color(hex: "#2563FF")
    var strokeThickness: CGFloat = 3
    var loopDuration: Double = 2.2
    var glowIntensity: CGFloat = 0.42
    var idleOpacity: Double = 0.34
    var borderInset: CGFloat = 1
    var segmentLength: Double = 0.34

    func body(content: Content) -> some View {
        content.overlay {
            VoteNowPillDualOrbitLayer(
                redColor: redColor,
                blueColor: blueColor,
                strokeThickness: strokeThickness,
                loopDuration: loopDuration,
                glowIntensity: glowIntensity,
                idleOpacity: idleOpacity,
                borderInset: borderInset,
                segmentLength: segmentLength
            )
            .compositingGroup()
            .allowsHitTesting(false)
        }
    }
}

private struct VoteNowPillDualOrbitLayer: View {
    let redColor: Color
    let blueColor: Color
    let strokeThickness: CGFloat
    let loopDuration: Double
    let glowIntensity: CGFloat
    let idleOpacity: Double
    let borderInset: CGFloat
    let segmentLength: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Capsule(style: .continuous)
                .inset(by: max(0, borderInset))
                .stroke(
                    Color.white.opacity(idleOpacity),
                    style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
                )

            if reduceMotion {
                ZStack {
                    segment(color: redColor, head: 0.14, length: segmentLength)
                    segment(color: blueColor, head: 0.64, length: segmentLength)
                }
                .opacity(0.92)
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: false)) { context in
                    let now = context.date.timeIntervalSinceReferenceDate
                    let base = normalized(now / max(loopDuration, 0.2))

                    // Slight speed delta creates occasional overtakes on the same path.
                    let redHead = normalized(base * 1.03)
                    let blueHead = normalized(base * 0.97 + 0.5)

                    let delta = normalized(redHead - blueHead)
                    let redLeading = delta > 0 && delta < 0.5

                    ZStack {
                        if redLeading {
                            segment(color: blueColor, head: blueHead, length: segmentLength)
                            segment(color: redColor, head: redHead, length: segmentLength)
                        } else {
                            segment(color: redColor, head: redHead, length: segmentLength)
                            segment(color: blueColor, head: blueHead, length: segmentLength)
                        }
                    }
                }
            }
        }
    }

    private func segment(color: Color, head: Double, length: Double) -> some View {
        let end = normalized(head)
        let start = normalized(end - length)

        return ZStack {
            if start <= end {
                segmentSlice(color: color, from: start, to: end)
            } else {
                segmentSlice(color: color, from: 0, to: end)
                segmentSlice(color: color, from: start, to: 1)
            }
        }
    }

    private func segmentSlice(color: Color, from: Double, to: Double) -> some View {
        Capsule(style: .continuous)
            .inset(by: max(0, borderInset))
            .trim(from: from, to: to)
            .rotation(Angle(degrees: -90))
            .stroke(
                color,
                style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
            )
            .shadow(color: color.opacity(glowIntensity), radius: strokeThickness * 0.9, x: 0, y: 0)
            .shadow(color: color.opacity(glowIntensity * 0.55), radius: strokeThickness * 1.8, x: 0, y: 0)
    }

    private func normalized(_ value: Double) -> Double {
        let wrapped = value.truncatingRemainder(dividingBy: 1)
        return wrapped < 0 ? wrapped + 1 : wrapped
    }
}

extension View {
    func voteNowPillDualOrbit(
        redColor: Color = Color(hex: "#FF3B30"),
        blueColor: Color = Color(hex: "#2563FF"),
        strokeThickness: CGFloat = 3,
        loopDuration: Double = 2.2,
        glowIntensity: CGFloat = 0.42,
        idleOpacity: Double = 0.34,
        borderInset: CGFloat = 1,
        segmentLength: Double = 0.34
    ) -> some View {
        modifier(
            VoteNowPillDualOrbitModifier(
                redColor: redColor,
                blueColor: blueColor,
                strokeThickness: strokeThickness,
                loopDuration: loopDuration,
                glowIntensity: glowIntensity,
                idleOpacity: idleOpacity,
                borderInset: borderInset,
                segmentLength: segmentLength
            )
        )
    }
}

#Preview("Dual Orbit Pill") {
    Button {} label: {
        Label("Start Calling Reps!", systemImage: "phone.fill")
            .font(.headline.weight(.semibold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(VoteNowColors.primaryCTA)
            .clipShape(Capsule(style: .continuous))
            .voteNowPillDualOrbit()
    }
    .buttonStyle(.plain)
    .padding()
    .background(VoteNowColors.brandSoftBlue)
}
