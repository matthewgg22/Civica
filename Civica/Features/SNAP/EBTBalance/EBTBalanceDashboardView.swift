import CivicaDesignSystem
import SwiftUI

// The linked-state dashboard for the Check EBT Balance feature: the
// hero balance card (with a locked banner when card-lock is on), the
// next-deposit row, the recent-activity list, a card-security row,
// and the always-visible demo disclosure. Shown by EBTBalanceRootView
// once the store's linkState is .linked.
//
// Phase 1 introduced the hero card; Phase 2 extracted it; Phase 3
// added recent activity + pull-to-refresh; Phase 4 added the locked
// banner and the card-security row.

struct EBTBalanceDashboardView: View {
    @ObservedObject var store: EBTBalanceStore
    let language: CivicaLanguage

    var body: some View {
        ScrollView {
            if let account = store.account {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    heroCard(account)
                    if !account.transactions.isEmpty {
                        recentActivitySection(account.transactions)
                    }
                    cardSecurityRow
                    demoDisclosure
                    unlinkLink
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .refreshable { await store.refresh() }
    }

    // MARK: - Hero balance card

    private func heroCard(_ account: EBTAccount) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            if store.isCardLocked {
                lockedBanner
            }

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

            Text(lastUpdatedLine(account))
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
        .animation(.easeInOut(duration: 0.25), value: store.isCardLocked)
    }

    private var lockedBanner: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "lock.fill")
                .foregroundStyle(CivicaColors.brickPrimary)
                .accessibilityHidden(true)
            Text(EBTBalanceStrings.lockedBannerText.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickPrimary.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .accessibilityElement(children: .combine)
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

    // MARK: - Recent activity

    private func recentActivitySection(_ transactions: [EBTTransaction]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(EBTBalanceStrings.recentActivityEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
                .padding(.horizontal, CivicaSpacing.xs)

            VStack(spacing: 0) {
                ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                    transactionRow(transaction)
                    if index < transactions.count - 1 {
                        Divider().overlay(CivicaColors.hairline)
                    }
                }
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private func transactionRow(_ transaction: EBTTransaction) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.merchant)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(shortDate(transaction.date))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: CivicaSpacing.sm)
            transactionAmount(transaction)
        }
        .padding(CivicaSpacing.lg)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func transactionAmount(_ transaction: EBTTransaction) -> some View {
        if transaction.isDeposit {
            HStack(spacing: 1) {
                Text("+")
                CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.accentTeal)
        } else {
            // Negative amount — CivicaMoney renders the leading minus.
            CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    // MARK: - Card security row

    private var cardSecurityRow: some View {
        NavigationLink {
            EBTCardLockView(store: store, language: language)
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: store.isCardLocked ? "lock.fill" : "lock.open")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(store.isCardLocked ? CivicaColors.brickPrimary : CivicaColors.graphite)
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                Text(EBTBalanceStrings.securityRowTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer(minLength: CivicaSpacing.sm)
                Text(store.isCardLocked
                     ? EBTBalanceStrings.securityStatusLocked.value(in: language)
                     : EBTBalanceStrings.securityStatusUnlocked.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(store.isCardLocked ? CivicaColors.brickPrimary : CivicaColors.graphite)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Demo disclosure + unlink

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

    private var unlinkLink: some View {
        Button(action: { store.unlink() }) {
            Text(EBTBalanceStrings.unlinkLink.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .underline()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Formatting

    private func lastUpdatedLine(_ account: EBTAccount) -> String {
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

    /// Compact transaction date: "Today" / "Yesterday" / "May 5".
    private func shortDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return EBTBalanceStrings.nextDepositTiming(days: 0, language: language).capitalized
        }
        if calendar.isDateInYesterday(date) {
            return language == .spanish ? "Ayer" : "Yesterday"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }
}
