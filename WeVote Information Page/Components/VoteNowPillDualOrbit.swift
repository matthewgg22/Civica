import SwiftUI

enum VoteNowDualOrbitPathStyle {
    case automatic
    case roundedRect(cornerRadius: CGFloat)
}

private enum VoteNowDualOrbitRuntime {
    static var isEnabled: Bool {
        // Temporarily disabled while tracking intermittent CoreGraphics NaN path warnings.
        false
    }
}

/// Reusable always-on CTA border effect for pill buttons.
/// Two colored segments run the same capsule path with dynamic z-order:
/// the segment currently "ahead" is rendered last, so it occludes the trailing one.
struct VoteNowPillDualOrbitModifier: ViewModifier {
    var enabled: Bool? = nil
    var redColor: Color = Color(hex: "#E14D3A")
    var blueColor: Color = Color(hex: "#2F83D1").opacity(0.80)
    var strokeThickness: CGFloat = 3
    var loopDuration: Double = 3.3
    var glowIntensity: CGFloat = 0.30
    var idleOpacity: Double = 0.34
    var borderInset: CGFloat = 1
    var segmentLength: Double = 0.34
    var separatorThickness: CGFloat = 0.8
    var sliceFadeFactor: Double = 0.72
    /// 0 keeps red/blue exactly opposite (full ring when segmentLength is 0.5).
    var speedVariance: Double = 0.03
    var pathStyle: VoteNowDualOrbitPathStyle = .automatic

    func body(content: Content) -> some View {
        content.overlay {
            if enabled ?? VoteNowDualOrbitRuntime.isEnabled {
                VoteNowPillDualOrbitLayer(
                    redColor: redColor,
                    blueColor: blueColor,
                    strokeThickness: strokeThickness,
                    loopDuration: loopDuration,
                    glowIntensity: glowIntensity,
                    idleOpacity: idleOpacity,
                    borderInset: borderInset,
                    segmentLength: segmentLength,
                    separatorThickness: separatorThickness,
                    sliceFadeFactor: sliceFadeFactor,
                    speedVariance: speedVariance,
                    pathStyle: pathStyle
                )
                .compositingGroup()
                .allowsHitTesting(false)
            }
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
    let sliceFadeFactor: Double
    let speedVariance: Double
    let pathStyle: VoteNowDualOrbitPathStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let orbitPath = orbitOutlinePath(in: orbitRect(in: geo.size))
            let separatorPath = orbitOutlinePath(
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
                if separatorThickness > 0.001 {
                    separatorPath
                        .stroke(
                            Color.white.opacity(0.96),
                            style: StrokeStyle(lineWidth: separatorThickness, lineCap: .round, lineJoin: .round)
                        )
                }

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
                        let clampedVariance = min(max(speedVariance, 0), 0.40)
                        let redHead = normalized(base * (1 + clampedVariance))
                        let blueHead = normalized(base * (1 - clampedVariance) + 0.5)

                        let delta = normalized(redHead - blueHead)
                        // Keep a stable z-order rule so the loop boundary does not pop.
                        let redLeading = (delta > 0 && delta < 0.5)

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
        let safeHead = safeUnit(head)
        let safeLength = length.isFinite ? length : 0.34
        let clampedLength = min(max(safeLength, 0.02), 0.9)
        let slices = 72
        let sliceLength = max(clampedLength / Double(slices), 0.002)
        let tailStart = normalized(safeHead - clampedLength)

        return ZStack {
            // Base continuous trail prevents the "dotted" look between slices.
            if tailStart <= safeHead {
                segmentSlice(
                    path: path,
                    color: color.opacity(0.22),
                    from: tailStart,
                    to: safeHead,
                    glowScale: 0.22,
                    lineCap: .round
                )
            } else {
                segmentSlice(
                    path: path,
                    color: color.opacity(0.22),
                    from: 0,
                    to: safeHead,
                    glowScale: 0.22,
                    lineCap: .round
                )
                segmentSlice(
                    path: path,
                    color: color.opacity(0.22),
                    from: tailStart,
                    to: 1,
                    glowScale: 0.22,
                    lineCap: .round
                )
            }

            ForEach(0..<slices, id: \.self) { index in
                let sliceEnd = normalized(safeHead - (Double(index) * sliceLength))
                let sliceStart = normalized(sliceEnd - sliceLength)
                let fade = pow(min(max(sliceFadeFactor, 0.0), 1.0), Double(index))
                let glowScale = max(0.28, 1.0 - (Double(index) * 0.12))

                if sliceStart <= sliceEnd {
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: sliceStart,
                        to: sliceEnd,
                        glowScale: CGFloat(glowScale),
                        lineCap: .butt
                    )
                } else {
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: 0,
                        to: sliceEnd,
                        glowScale: CGFloat(glowScale),
                        lineCap: .butt
                    )
                    segmentSlice(
                        path: path,
                        color: color.opacity(fade),
                        from: sliceStart,
                        to: 1,
                        glowScale: CGFloat(glowScale),
                        lineCap: .butt
                    )
                }
            }
        }
    }

    private func segmentSlice(
        path: Path,
        color: Color,
        from: Double,
        to: Double,
        glowScale: CGFloat,
        lineCap: CGLineCap
    ) -> some View {
        let safeFrom = safeUnit(from)
        let safeTo = safeUnit(to)
        let safeGlowScale = glowScale.isFinite ? max(0, glowScale) : 0
        let safeStrokeThickness = strokeThickness.isFinite ? max(0, strokeThickness) : 0
        guard safeStrokeThickness > 0 else { return AnyView(EmptyView()) }

        let drawPath: Path
        if safeFrom <= safeTo {
            drawPath = path.trimmedPath(from: safeFrom, to: safeTo)
        } else {
            drawPath = Path()
        }

        return AnyView(
            drawPath
            .stroke(
                color,
                style: StrokeStyle(lineWidth: safeStrokeThickness, lineCap: lineCap, lineJoin: .round)
            )
            .shadow(
                color: color.opacity(glowIntensity * Double(safeGlowScale)),
                radius: safeStrokeThickness * 0.8 * safeGlowScale,
                x: 0,
                y: 0
            )
            .shadow(
                color: color.opacity(glowIntensity * 0.5 * Double(safeGlowScale)),
                radius: safeStrokeThickness * 1.5 * safeGlowScale,
                x: 0,
                y: 0
            )
        )
    }

    private func orbitRect(in size: CGSize) -> CGRect {
        let width = size.width.isFinite ? max(0, size.width) : 0
        let height = size.height.isFinite ? max(0, size.height) : 0
        let outer = CGRect(origin: .zero, size: CGSize(width: width, height: height))
        let safeBorderInset = borderInset.isFinite ? borderInset : 0
        let safeStrokeThickness = strokeThickness.isFinite ? strokeThickness : 0
        let inset = max(0, safeBorderInset) + (safeStrokeThickness / 2)
        return outer.insetBy(dx: inset, dy: inset)
    }

    private func orbitOutlinePath(in rect: CGRect) -> Path {
        guard rect.width.isFinite, rect.height.isFinite, rect.width > 1, rect.height > 1 else { return Path() }

        switch pathStyle {
        case .roundedRect(let cornerRadius):
            let clamped = min(max(0, cornerRadius), min(rect.width, rect.height) / 2)
            return Path(roundedRect: rect, cornerRadius: clamped, style: .continuous)
        case .automatic:
            return capsuleOrbitPath(in: rect)
        }
    }

    private func capsuleOrbitPath(in rect: CGRect) -> Path {
        guard rect.width.isFinite, rect.height.isFinite, rect.width > 1, rect.height > 1 else { return Path() }
        if abs(rect.width - rect.height) <= 0.5 {
            return Path(ellipseIn: rect)
        }

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
        guard value.isFinite else { return 0 }
        let wrapped = value.truncatingRemainder(dividingBy: 1)
        guard wrapped.isFinite else { return 0 }
        return wrapped < 0 ? wrapped + 1 : wrapped
    }

    private func safeUnit(_ value: Double) -> Double {
        let normalizedValue = normalized(value)
        if normalizedValue.isFinite {
            return min(max(normalizedValue, 0), 1)
        }
        return 0
    }
}

extension View {
    func voteNowPillDualOrbit(
        enabled: Bool? = nil,
        redColor: Color = Color(hex: "#E14D3A"),
        blueColor: Color = Color(hex: "#2F83D1").opacity(0.80),
        strokeThickness: CGFloat = 3,
        loopDuration: Double = 3.3,
        glowIntensity: CGFloat = 0.30,
        idleOpacity: Double = 0.34,
        borderInset: CGFloat = 1,
        segmentLength: Double = 0.34,
        separatorThickness: CGFloat = 0.8,
        sliceFadeFactor: Double = 0.72,
        speedVariance: Double = 0.03,
        pathStyle: VoteNowDualOrbitPathStyle = .automatic
    ) -> some View {
        modifier(
            VoteNowPillDualOrbitModifier(
                enabled: enabled,
                redColor: redColor,
                blueColor: blueColor,
                strokeThickness: strokeThickness,
                loopDuration: loopDuration,
                glowIntensity: glowIntensity,
                idleOpacity: idleOpacity,
                borderInset: borderInset,
                segmentLength: segmentLength,
                separatorThickness: separatorThickness,
                sliceFadeFactor: sliceFadeFactor,
                speedVariance: speedVariance,
                pathStyle: pathStyle
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
            .background(VoteNowColors.ctaBlue)
            .clipShape(Capsule(style: .continuous))
            .voteNowPillDualOrbit()
    }
    .buttonStyle(.plain)
    .padding()
    .background(VoteNowColors.brandSoftBlue)
}
