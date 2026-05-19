import SwiftUI

/// Entry point card for the student employer marketplace.
///
/// Two states:
/// - Connected: shows current benefit + CTA to browse jobs.
/// - Cold start: Canvas or Argyle not connected; CTA leads to 2-step connector flow.
public struct IncomeOptionsCard: View {

    public enum State {
        case connected(benefitAmount: Decimal, jobCount: Int)
        case coldStart
    }

    public let state: State
    public let onCTA: () -> Void

    public init(state: State, onCTA: @escaping () -> Void) {
        self.state = state
        self.onCTA = onCTA
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            labelRow

            switch state {
            case .connected(let amount, let count):
                connectedContent(amount: amount, count: count)
            case .coldStart:
                coldStartContent
            }

            ctaButton
        }
        .padding(CivicaSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .fill(CivicaColors.tealSurface)
        )
    }

    // MARK: - Private

    private var labelRow: some View {
        Text("Campus jobs")
            .font(CivicaTypography.support)
            .foregroundStyle(CivicaColors.accentTeal)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private func connectedContent(amount: Decimal, count: Int) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text("We rank jobs by what's best for your income, not what's best for employers.")
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.xs) {
                Text("\(count) jobs")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text("matched to your schedule")
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
    }

    private var coldStartContent: some View {
        Text("Connect your school + bank to see jobs that fit.")
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var ctaButton: some View {
        Button(action: onCTA) {
            Text(ctaLabel)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.accentTeal)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(ctaLabel)
    }

    private var ctaLabel: String {
        switch state {
        case .connected: return "See jobs →"
        case .coldStart: return "Connect school + bank →"
        }
    }
}

#Preview("Connected") {
    IncomeOptionsCard(state: .connected(benefitAmount: 292, jobCount: 3), onCTA: {})
        .padding()
        .background(CivicaColors.paper)
}

#Preview("Cold start") {
    IncomeOptionsCard(state: .coldStart, onCTA: {})
        .padding()
        .background(CivicaColors.paper)
}
