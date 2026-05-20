import SwiftUI

/// A single row in the campus job listing.
///
/// The leading glyph (◆/○/∶) provides a colorblind-safe secondary cue
/// alongside the pill color. FWS rows use teal; W-2 rows use ink; gig rows
/// use graphite. Dollar amounts are rendered by CivicaMoney so tabular-nums
/// and VoiceOver are handled automatically.
public struct JobMatchRow: View {

    public enum JobType {
        case fws      // Federal Work-Study — income excluded 7 CFR 273.9(c)(3)
        case w2       // Standard wage employment — income counts
        case gig      // Gig/platform — income variable, counts toward OBBBA hours
    }

    public let title: String
    public let meta: String
    public let type: JobType
    public let pillText: String
    public let benefitText: String
    public let benefitAmount: Decimal?
    public let onTap: () -> Void

    public init(
        title: String,
        meta: String,
        type: JobType,
        pillText: String,
        benefitText: String,
        benefitAmount: Decimal? = nil,
        onTap: @escaping () -> Void
    ) {
        self.title = title
        self.meta = meta
        self.type = type
        self.pillText = pillText
        self.benefitText = benefitText
        self.benefitAmount = benefitAmount
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: CivicaSpacing.md) {
                leadingGlyph
                    .frame(width: 16)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(title)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(meta)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    pill
                    benefitLine
                }
                .frame(width: 150, alignment: .leading)
            }
            .padding(.horizontal, CivicaSpacing.xl)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 80)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
        // At xxxLarge Dynamic Type, stack vertically
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }

    // MARK: - Private

    private var leadingGlyph: some View {
        Text(glyphCharacter)
            .font(CivicaTypography.footnote)
            .foregroundStyle(glyphColor)
            .accessibilityHidden(true)
    }

    private var glyphCharacter: String {
        switch type {
        case .fws: return "◆"
        case .w2:  return "○"
        case .gig: return "∶"
        }
    }

    private var glyphColor: Color {
        switch type {
        case .fws: return CivicaColors.accentTeal
        case .w2:  return CivicaColors.ink
        case .gig: return CivicaColors.graphite
        }
    }

    private var pillColor: Color {
        switch type {
        case .fws: return CivicaColors.accentTeal
        case .w2:  return CivicaColors.graphite
        case .gig: return CivicaColors.graphite
        }
    }

    private var dotColor: Color {
        switch type {
        case .fws: return CivicaColors.accentTeal
        case .w2:  return CivicaColors.warningAmber
        case .gig: return CivicaColors.graphite
        }
    }

    private var benefitTextColor: Color {
        switch type {
        case .fws: return CivicaColors.accentTeal
        case .w2, .gig: return CivicaColors.ink
        }
    }

    private var pill: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(dotColor)
                .frame(width: 5, height: 5)
            Text(pillText)
                .font(CivicaTypography.support)
                .foregroundStyle(pillColor)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, 3)
        .background(
            Capsule().fill(CivicaColors.surfaceSecondary)
        )
    }

    private var benefitLine: some View {
        Group {
            if let amount = benefitAmount {
                CivicaMoney(amount: amount, denominator: "mo", font: CivicaTypography.body)
                    .foregroundStyle(benefitTextColor)
            } else {
                Text(benefitText)
                    .font(CivicaTypography.body)
                    .foregroundStyle(benefitTextColor)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
        }
    }

    private var accessibilityLabel: String {
        "\(title). \(meta). \(pillText). \(benefitText)"
    }
}

#Preview("FWS row") {
    VStack(spacing: 0) {
        JobMatchRow(
            title: "Library Assistant",
            meta: "12 hr/wk · $18/hr · M/W/F afternoons",
            type: .fws,
            pillText: "Work-study · doesn't count",
            benefitText: "Benefit stays $292",
            benefitAmount: 292,
            onTap: {}
        )
        Divider()
        JobMatchRow(
            title: "Dining Services",
            meta: "16 hr/wk · $17/hr · T/Th evenings",
            type: .w2,
            pillText: "Counts as income",
            benefitText: "Benefit becomes $214",
            benefitAmount: 214,
            onTap: {}
        )
        Divider()
        JobMatchRow(
            title: "DoorDash · flexible hours",
            meta: "Sign-up bonus $600",
            type: .gig,
            pillText: "Counts as OBBBA hours",
            benefitText: "Benefit varies $180–$240",
            onTap: {}
        )
    }
    .background(CivicaColors.paper)
}
