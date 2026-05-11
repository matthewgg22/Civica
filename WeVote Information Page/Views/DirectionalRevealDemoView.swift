//
//  DirectionalRevealDemoView.swift
//  WeVote Information Page
//
//  Directional "shockwave" reveal micro-interaction demo.
//

import CivicaDesignSystem
import SwiftUI

struct DirectionalRevealDemoView: View {
    // Tunable parameters
    private let revealColor = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0)
    private let duration: Double = 0.75
    private let directionVector = CGVector(dx: 0.85, dy: -0.55) // up-right bias
    private let biasStrength: CGFloat = 0.42
    private let softness: CGFloat = 2.7
    private let containerCornerRadius: CGFloat = 28

    @State private var progress: CGFloat = 0
    @State private var iconCenterGlobal: CGPoint = .zero

    var body: some View {
        GeometryReader { rootGeo in
            let frame = rootGeo.frame(in: .global)
            let localOrigin = CGPoint(
                x: iconCenterGlobal.x - frame.minX,
                y: iconCenterGlobal.y - frame.minY
            )

            ZStack {
                // Base container background
                RoundedRectangle(cornerRadius: containerCornerRadius, style: .continuous)
                    .fill(Color(red: 0.68, green: 0.84, blue: 0.90))
                    .overlay(alignment: .topLeading) {
                        Text("Directional Reveal")
                            .font(CivicaTypography.sectionHeader)
                            .foregroundStyle(.white.opacity(0.95))
                            .padding(CivicaSpacing.lg)
                    }

                // Solid color overlay, revealed by directional mask
                revealColor
                    .mask {
                        DirectionalRevealMask(
                            origin: localOrigin,
                            progress: progress,
                            direction: directionVector,
                            bias: biasStrength,
                            softness: softness
                        )
                    }
                    .allowsHitTesting(false)

                // Trigger icon/button
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            toggleReveal()
                        } label: {
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(CivicaColors.surfacePrimary)
                                .frame(width: 56, height: 56)
                                .background(
                                    Circle()
                                        .fill(CivicaColors.ink.opacity(0.32))
                                )
                        }
                        .buttonStyle(.plain)
                        .background(
                            GeometryReader { geo in
                                Color.clear
                                    .preference(
                                        key: IconCenterPreferenceKey.self,
                                        value: geo.frame(in: .global).center
                                    )
                            }
                        )
                        .padding(CivicaSpacing.lg)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: containerCornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: containerCornerRadius, style: .continuous)
                    .strokeBorder(CivicaColors.surfacePrimary.opacity(0.4), lineWidth: 1)
            }
            .padding(CivicaSpacing.lg)
            .onPreferenceChange(IconCenterPreferenceKey.self) { newCenter in
                guard let newCenter else { return }
                iconCenterGlobal = newCenter
            }
        }
    }

    private func toggleReveal() {
        let expanding = progress < 0.01
        withAnimation(.easeOut(duration: duration)) {
            progress = expanding ? 1.0 : 0.0
        }
    }
}

/// Directionally biased reveal shape.
/// Radius model:
/// r(θ) = baseRadius(t) * (1 + bias * cos(θ - θ0)) * superellipse(θ)
struct DirectionalRevealMask: Shape {
    var origin: CGPoint
    var progress: CGFloat
    var direction: CGVector
    var bias: CGFloat
    var softness: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        guard rect.width > 0, rect.height > 0 else { return Path() }

        let eased = 1 - pow(1 - max(0, min(1, progress)), 3)
        let theta0 = atan2(direction.dy, direction.dx)
        let maxBase = maxBaseRadiusToCoverRect(rect: rect, from: origin, theta0: theta0)
        let baseRadius = maxBase * eased
        let clampedSoftness = max(1.4, softness)
        let samples = 260

        var points: [CGPoint] = []
        points.reserveCapacity(samples + 1)

        for i in 0...samples {
            let t = CGFloat(i) / CGFloat(samples)
            let angle = t * .pi * 2
            let r = directionalRadius(
                angle: angle,
                base: baseRadius,
                theta0: theta0,
                softness: clampedSoftness
            )
            points.append(
                CGPoint(
                    x: origin.x + r * cos(angle),
                    y: origin.y + r * sin(angle)
                )
            )
        }

        // Smooth closed contour from sampled points.
        var path = Path()
        if let first = points.first {
            path.move(to: first)
            for index in 1..<points.count {
                let p0 = points[index - 1]
                let p1 = points[index]
                let mid = CGPoint(x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5)
                path.addQuadCurve(to: mid, control: p0)
            }
            path.closeSubpath()
        }

        return path
    }

    private func directionalRadius(angle: CGFloat, base: CGFloat, theta0: CGFloat, softness: CGFloat) -> CGFloat {
        let clampedBias = max(-0.9, min(0.9, bias))
        let directionalFactor = max(0.12, 1 + clampedBias * cos(angle - theta0))

        let c = abs(cos(angle))
        let s = abs(sin(angle))
        let superellipse = pow(pow(c, softness) + pow(s, softness), -1 / softness)

        return base * directionalFactor * superellipse
    }

    private func maxBaseRadiusToCoverRect(rect: CGRect, from origin: CGPoint, theta0: CGFloat) -> CGFloat {
        let corners = [
            CGPoint(x: rect.minX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.maxY)
        ]

        let clampedBias = max(-0.9, min(0.9, bias))
        let clampedSoftness = max(1.4, softness)

        var needed: CGFloat = 0
        for corner in corners {
            let dx = corner.x - origin.x
            let dy = corner.y - origin.y
            let distance = hypot(dx, dy)
            let angle = atan2(dy, dx)

            let directionalFactor = max(0.12, 1 + clampedBias * cos(angle - theta0))
            let c = abs(cos(angle))
            let s = abs(sin(angle))
            let superellipse = pow(pow(c, clampedSoftness) + pow(s, clampedSoftness), -1 / clampedSoftness)

            let factor = max(0.08, directionalFactor * superellipse)
            needed = max(needed, distance / factor)
        }

        return needed * 1.04
    }
}

private struct IconCenterPreferenceKey: PreferenceKey {
    static var defaultValue: CGPoint? = nil
    static func reduce(value: inout CGPoint?, nextValue: () -> CGPoint?) {
        value = nextValue() ?? value
    }
}

private extension CGRect {
    var center: CGPoint { CGPoint(x: midX, y: midY) }
}

struct DirectionalRevealDemoView_Previews: PreviewProvider {
    static var previews: some View {
        DirectionalRevealDemoView()
            .preferredColorScheme(.light)
    }
}

