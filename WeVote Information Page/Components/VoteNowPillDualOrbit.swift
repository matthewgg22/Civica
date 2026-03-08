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
        GeometryReader { geo in
            let orbitPath = capsuleOrbitPath(in: orbitRect(in: geo.size))

            ZStack {
                orbitPath
                    .stroke(
                        Color.white.opacity(idleOpacity),
                        style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
                    )

                if reduceMotion {
                    ZStack {
                        segment(path: orbitPath, color: redColor, head: 0.14, length: segmentLength)
                        segment(path: orbitPath, color: blueColor, head: 0.64, length: segmentLength)
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
                                segment(path: orbitPath, color: blueColor, head: blueHead, length: segmentLength)
                                segment(path: orbitPath, color: redColor, head: redHead, length: segmentLength)
                            } else {
                                segment(path: orbitPath, color: redColor, head: redHead, length: segmentLength)
                                segment(path: orbitPath, color: blueColor, head: blueHead, length: segmentLength)
                            }
                        }
                    }
                }
            }
        }
    }

    private func segment(path: Path, color: Color, head: Double, length: Double) -> some View {
        let end = normalized(head)
        let start = normalized(end - length)

        return ZStack {
            if start <= end {
                segmentSlice(path: path, color: color, from: start, to: end)
            } else {
                segmentSlice(path: path, color: color, from: 0, to: end)
                segmentSlice(path: path, color: color, from: start, to: 1)
            }
        }
    }

    private func segmentSlice(path: Path, color: Color, from: Double, to: Double) -> some View {
        path
            .trimmedPath(from: from, to: to)
            .stroke(
                color,
                style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
            )
            .shadow(color: color.opacity(glowIntensity), radius: strokeThickness * 0.9, x: 0, y: 0)
            .shadow(color: color.opacity(glowIntensity * 0.55), radius: strokeThickness * 1.8, x: 0, y: 0)
    }

    private func orbitRect(in size: CGSize) -> CGRect {
        let outer = CGRect(origin: .zero, size: size)
        let inset = max(0, borderInset) + (strokeThickness / 2)
        return outer.insetBy(dx: inset, dy: inset)
    }

    private func capsuleOrbitPath(in rect: CGRect) -> Path {
        guard rect.width > 1, rect.height > 1 else { return Path() }

        let radius = min(rect.height / 2, rect.width / 2)
        let leftCenter = CGPoint(x: rect.minX + radius, y: rect.midY)
        let rightCenter = CGPoint(x: rect.maxX - radius, y: rect.midY)

        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rightCenter.x, y: rect.minY))
        path.addArc(
            center: rightCenter,
            radius: radius,
            startAngle: .degrees(-90),
            endAngle: .degrees(90),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: leftCenter.x, y: rect.maxY))
        path.addArc(
            center: leftCenter,
            radius: radius,
            startAngle: .degrees(90),
            endAngle: .degrees(270),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: rect.midX, y: rect.minY))
        return path
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
