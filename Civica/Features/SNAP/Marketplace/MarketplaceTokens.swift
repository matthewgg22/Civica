import CivicaDesignSystem
import SwiftUI

// MARK: - Marketplace Design Tokens
//
// Color aliases for the SNAP student-marketplace flow.
// Hex values are the "Brick / Paper" token set from the HANDOFF spec.
// `Color(hex:)` is provided by CivicaDesignSystem.
//
// Font: Hanken Grotesk — already registered via CivicaFonts.register()
// (called at app launch in CivicaApp.swift). If fonts are absent the
// system fallback will render; fix by adding the .ttf files to
// CivicaDesignSystem/Sources/CivicaDesignSystem/Resources/.

extension Color {
    /// Primary brand, primary CTAs only. #9C3A24
    static let civicaBrick     = Color(hex: "#9C3A24")
    /// Positive outcomes, secondary actions, links. #2A6F66
    static let civicaTeal      = Color(hex: "#2A6F66")
    /// Page background. #F5F2EC
    static let civicaPaper     = Color(hex: "#F5F2EC")
    /// Cards, pills, inset surfaces. #EDE8DD
    static let civicaPaper2    = Color(hex: "#EDE8DD")
    /// Body text, primary numerals. #1A1714
    static let civicaInk       = Color(hex: "#1A1714")
    /// Secondary text, captions, labels. #5A544D
    static let civicaGraphite  = Color(hex: "#5A544D")
    /// Warnings / deadlines only. #9A5A14
    static let civicaAmber     = Color(hex: "#9A5A14")
}

// MARK: - Marketplace-scoped Font helpers

enum MFont {
    private static let regular  = "HankenGrotesk-Regular"
    private static let medium   = "HankenGrotesk-Medium"
    private static let semibold = "HankenGrotesk-SemiBold"

    // TODO: Verify HankenGrotesk-Italic is present in
    // CivicaDesignSystem/Sources/CivicaDesignSystem/Resources/
    // before removing the system-fallback comment below.
    private static let italic = "HankenGrotesk-Italic"

    static func regular(_ size: CGFloat)  -> Font { .custom(regular,  size: size) }
    static func medium(_ size: CGFloat)   -> Font { .custom(medium,   size: size) }
    static func semibold(_ size: CGFloat) -> Font { .custom(semibold, size: size) }

    /// Italic 400 — used only for the FWS regulation citation on Screen 03.
    static func italic(_ size: CGFloat)   -> Font { .custom(italic,   size: size) }

    // Named-role aliases that match the spec table
    static let navTitle:        Font = .custom(medium,   size: 17)
    static let heroHeadline:    Font = .custom(semibold, size: 20)
    static let heroNumeral:     Font = .custom(semibold, size: 48)
    static let body:            Font = .custom(regular,  size: 16)
    static let bodySmall:       Font = .custom(regular,  size: 15)
    static let bodySmallMedium: Font = .custom(medium,   size: 15)
    static let listTitle:       Font = .custom(semibold, size: 17)
    static let capsLabel:       Font = .custom(medium,   size: 11)
    static let pill:            Font = .custom(medium,   size: 11)
    static let meta:            Font = .custom(regular,  size: 13)
    static let metaMedium:      Font = .custom(medium,   size: 13)
    static let calcRowLabel:    Font = .custom(regular,  size: 15)
    static let calcRowAmount:   Font = .custom(medium,   size: 15)
    static let calcTotalLabel:  Font = .custom(semibold, size: 17)
    static let calcTotalAmount: Font = .custom(semibold, size: 20)
    static let heroEnrolled:    Font = .custom(semibold, size: 24)
    static let fwsCitation:     Font = .custom(italic,   size: 13)
}

// MARK: - Shared sub-components

/// A horizontal hairline at 24pt inset — graphite 20% opacity.
struct MHairline: View {
    var body: some View {
        Rectangle()
            .fill(Color.civicaGraphite.opacity(0.20))
            .frame(height: 1)
            .padding(.horizontal, 24)
    }
}

/// ALL-CAPS eyebrow label (11pt Medium, 1.5pt tracking).
struct MCapsLabel: View {
    let text: String
    var color: Color = .civicaGraphite
    var body: some View {
        Text(text)
            .font(MFont.capsLabel)
            .foregroundStyle(color)
            .textCase(.uppercase)
            .kerning(1.5)
            .padding(.horizontal, 24)
    }
}

/// Brick stroke check glyph (no circle). Matches both 26×26 (hero) and 18×18 variants.
struct MCheckGlyph: View {
    var size: CGFloat = 18
    var color: Color = .civicaBrick

    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            var path = Path()
            // Scaled from viewBox 0 0 18 18: "M2 9 L7 14 L16 4"
            path.move(to:    CGPoint(x: w * 2/18,  y: h * 9/18))
            path.addLine(to: CGPoint(x: w * 7/18,  y: h * 14/18))
            path.addLine(to: CGPoint(x: w * 16/18, y: h * 4/18))
            ctx.stroke(path,
                       with: .color(color),
                       style: StrokeStyle(lineWidth: size == 26 ? 3 : 2.4,
                                          lineCap: .square,
                                          lineJoin: .miter))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Chevron-right glyph (8×14pt, stroke 2, graphite@50%).
struct MChevron: View {
    var body: some View {
        Canvas { ctx, sz in
            var path = Path()
            path.move(to:    CGPoint(x: sz.width * 1/8, y: sz.height * 1/14))
            path.addLine(to: CGPoint(x: sz.width * 7/8, y: sz.height * 7/14))
            path.addLine(to: CGPoint(x: sz.width * 1/8, y: sz.height * 13/14))
            ctx.stroke(path,
                       with: .color(Color.civicaGraphite.opacity(0.5)),
                       style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
        .frame(width: 8, height: 14)
        .accessibilityHidden(true)
    }
}

/// Brick primary CTA button — full-width, 56pt tall, 3pt radius.
/// Height matches CivicaPrimaryCTAButtonStyle (HANDOFF.md §1).
struct MBrickButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(MFont.bodySmallMedium.weight(.medium))
                .foregroundStyle(Color.civicaPaper)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(Color.civicaBrick)
                .clipShape(RoundedRectangle(cornerRadius: 3))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 24)
    }
}

/// Brick-outline secondary CTA — transparent bg, 1pt brick border, brick text.
struct MBrickOutlineButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(MFont.bodySmallMedium.weight(.medium))
                .foregroundStyle(Color.civicaBrick)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .overlay(
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(Color.civicaBrick, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 24)
    }
}

/// Teal-outline secondary CTA — transparent bg, 1pt teal border, teal text.
struct MTealOutlineButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(MFont.bodySmallMedium.weight(.medium))
                .foregroundStyle(Color.civicaTeal)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .overlay(
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(Color.civicaTeal, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 24)
    }
}

/// Shimmer placeholder for numeric or text content that is still loading.
/// Width and height match the content being replaced; use cornerRadius 999 for pill shapes.
struct MShimmer: View {
    let width: CGFloat
    let height: CGFloat
    var cornerRadius: CGFloat = 4

    @State private var phase: Double = 0.3

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.civicaGraphite.opacity(phase))
            .frame(width: width, height: height)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    phase = 0.1
                }
            }
            .accessibilityHidden(true)
    }
}

/// Teal text link — centered, 15pt Regular.
struct MTealTextLink: View {
    let label: String
    let action: () -> Void

    var body: some View {
        HStack {
            Spacer()
            Button(action: action) {
                Text(label)
                    .font(MFont.bodySmall)
                    .foregroundStyle(Color.civicaTeal)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }
}
