import CivicaDesignSystem
import SwiftUI

// Entry surface for the Check EBT Balance feature (Propel-style
// balance dashboard).
//
// Phase 1: a static hero balance card driven by EBTBalanceFixtures —
// the big CalFresh balance, a "last updated" trust line, and the next
// scheduled deposit. Later phases layer in the mock card-linking flow,
// transaction history, and card-lock security.
//
// Demo scope: California only. The feature simulates a connected
// CalFresh account from fixtures; it does not integrate with a real
// state EBT system — hence the always-visible demo disclosure.

struct EBTBalanceRootView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private let account: EBTAccount = EBTBalanceFixtures.demoAccount

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                heroCard
                demoDisclosure
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTBalanceStrings.screenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Hero balance card

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(EBTBalanceStrings.balanceEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                CivicaMoney(amount: account.foodBalance, font: CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                Text(EBTBalanceStrings.balanceRemainingSuffix.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.graphite)
            }

            Text(lastUpdatedLine)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)

            if let deposit = account.nextDeposit {
                Divider()
                    .overlay(CivicaColors.hairline)
                    .padding(.vertical, CivicaSpacing.xs)
                nextDepositRow(deposit)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func nextDepositRow(_ deposit: EBTDeposit) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
            Text(EBTBalanceStrings.nextDepositLabel.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.ink)
            Spacer(minLength: CivicaSpacing.sm)
            CivicaMoney(amount: deposit.amount, font: CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.accentTeal)
            Text("· " + EBTBalanceStrings.nextDepositTiming(
                days: daysUntil(deposit.expectedDate),
                language: language
            ))
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
        }
    }

    // MARK: - Demo disclosure

    private var demoDisclosure: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(EBTBalanceStrings.demoDisclosure.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Formatting

    private var lastUpdatedLine: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.unitsStyle = .full
        let relative = formatter.localizedString(for: account.lastUpdated, relativeTo: Date())
        return EBTBalanceStrings.lastUpdatedPrefix.value(in: language) + " " + relative
    }

    private func daysUntil(_ date: Date) -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: date)
        return calendar.dateComponents([.day], from: start, to: end).day ?? 0
    }
}

#if DEBUG
struct EBTBalanceRootView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            EBTBalanceRootView()
        }
    }
}
#endif
