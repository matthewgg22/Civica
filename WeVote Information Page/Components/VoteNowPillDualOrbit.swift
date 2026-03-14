import SwiftUI

/// Reusable always-on CTA border effect for pill buttons.
/// Two colored segments run the same capsule path with dynamic z-order:
/// the segment currently "ahead" is rendered last, so it occludes the trailing one.
struct VoteNowPillDualOrbitModifier: ViewModifier {
    var redColor: Color = Color(hex: "#E14D3A")
    var blueColor: Color = Color(hex: "#2F83D1").opacity(0.80)
    var strokeThickness: CGFloat = 3
    var loopDuration: Double = 3.3
    var glowIntensity: CGFloat = 0.30
    var idleOpacity: Double = 0.34
    var borderInset: CGFloat = 1
    var segmentLength: Double = 0.34
    var separatorThickness: CGFloat = 0.8

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
                segmentLength: segmentLength,
                separatorThickness: separatorThickness
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
    let separatorThickness: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let orbitPath = capsuleOrbitPath(in: orbitRect(in: geo.size))
            let separatorPath = capsuleOrbitPath(
                in: orbitRect(in: geo.size).insetBy(
                    dx: strokeThickness * 0.55,
                    dy: strokeThickness * 0.55
                )
            )

            ZStack {
                orbitPath
                    .stroke(
                        Color.white.opacity(idleOpacity * 0.82),
                        style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
                    )

                // Thin separator ring between button fill and orbit glow.
                separatorPath
                    .stroke(
                        Color.white.opacity(0.96),
                        style: StrokeStyle(lineWidth: max(0.55, separatorThickness), lineCap: .round, lineJoin: .round)
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
        let slices = 6
        let sliceLength = max(length / Double(slices), 0.01)
        return ZStack {
            ForEach(0..<slices, id: \.self) { index in
                let sliceEnd = normalized(head - (Double(index) * sliceLength))
                let sliceStart = normalized(sliceEnd - sliceLength)
                let fade = pow(0.72, Double(index))
                let glowScale = max(0.28, 1.0 - (Double(index) * 0.12))

                if sliceStart <= sliceEnd {
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: sliceStart,
                        to: sliceEnd,
                        glowScale: CGFloat(glowScale)
                    )
                } else {
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: 0,
                        to: sliceEnd,
                        glowScale: CGFloat(glowScale)
                    )
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: sliceStart,
                        to: 1,
                        glowScale: CGFloat(glowScale)
                    )
                }
            }
        }
    }

    private func segmentSlice(path: Path, color: Color, from: Double, to: Double, glowScale: CGFloat) -> some View {
        path
            .trimmedPath(from: from, to: to)
            .stroke(
                color,
                style: StrokeStyle(lineWidth: strokeThickness, lineCap: .round, lineJoin: .round)
            )
            .shadow(color: color.opacity(glowIntensity * Double(glowScale)), radius: strokeThickness * 0.8 * glowScale, x: 0, y: 0)
            .shadow(color: color.opacity(glowIntensity * 0.5 * Double(glowScale)), radius: strokeThickness * 1.5 * glowScale, x: 0, y: 0)
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
        redColor: Color = Color(hex: "#E14D3A"),
        blueColor: Color = Color(hex: "#2F83D1").opacity(0.80),
        strokeThickness: CGFloat = 3,
        loopDuration: Double = 3.3,
        glowIntensity: CGFloat = 0.30,
        idleOpacity: Double = 0.34,
        borderInset: CGFloat = 1,
        segmentLength: Double = 0.34,
        separatorThickness: CGFloat = 0.8
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
                segmentLength: segmentLength,
                separatorThickness: separatorThickness
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
