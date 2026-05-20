import CivicaDesignSystem
import SwiftUI

// Detail sheet for a single EBT transaction, presented when a row in
// the dashboard's recent-activity list is tapped.
//
// Shows the merchant, category, full date, signed amount, and — the
// realism tell — the running balance immediately after the
// transaction posted. Phase: Tier 1 hyper-realism pass.

struct EBTTransactionDetailSheet: View {
    let transaction: EBTTransaction
    let balanceAfter: Decimal
    let language: CivicaLanguage
    let onDone: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
            header
            VStack(spacing: 0) {
                detailRow(
                    label: EBTBalanceStrings.detailCategoryLabel.value(in: language),
                    valueView: AnyView(categoryValue)
                )
                Divider().overlay(CivicaColors.hairline)
                detailRow(
                    label: EBTBalanceStrings.detailDateLabel.value(in: language),
                    valueView: AnyView(
                        Text(fullDate)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.ink)
                    )
                )
                Divider().overlay(CivicaColors.hairline)
                detailRow(
                    label: EBTBalanceStrings.detailAmountLabel.value(in: language),
                    valueView: AnyView(amountValue)
                )
                Divider().overlay(CivicaColors.hairline)
                detailRow(
                    label: EBTBalanceStrings.detailBalanceAfterLabel.value(in: language),
                    valueView: AnyView(
                        CivicaMoney(amount: balanceAfter, font: CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.ink)
                    )
                )
            }
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            Spacer()
            doneButton
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: CivicaSpacing.md) {
            avatar
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(EBTBalanceStrings.detailSheetTitle.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(transaction.merchant)
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // Merchant-monogram avatar, matching the activity-row treatment;
    // deposits get a distinct down-arrow.
    private var avatar: some View {
        let tint = transaction.isDeposit ? CivicaColors.wheatPrimary : CivicaColors.brickAccent
        return ZStack {
            RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                .fill(tint.opacity(0.12))
            if transaction.isDeposit {
                Image(systemName: "arrow.down")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(tint)
            } else {
                Text(transaction.monogram)
                    .font(CivicaTypography.bodyStrong)
                    .foregroundStyle(tint)
            }
        }
        .frame(width: 48, height: 48)
        .accessibilityHidden(true)
    }

    private var categoryValue: some View {
        HStack(spacing: CivicaSpacing.xs) {
            Image(systemName: transaction.category.iconName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(EBTBalanceStrings.categoryLabel(transaction.category, language: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    @ViewBuilder
    private var amountValue: some View {
        if transaction.isDeposit {
            HStack(spacing: 1) {
                Text("+")
                CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.accentTeal)
        } else {
            CivicaMoney(amount: transaction.amount, font: CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    private func detailRow(label: String, valueView: AnyView) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.md) {
            Text(label)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            Spacer(minLength: CivicaSpacing.sm)
            valueView
        }
        .padding(CivicaSpacing.lg)
        .accessibilityElement(children: .combine)
    }

    private var doneButton: some View {
        Button(action: onDone) {
            Text(EBTBalanceStrings.detailDoneButton.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.pinePrimary)
                )
        }
        .buttonStyle(.plain)
    }

    private var fullDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: transaction.date)
    }
}
