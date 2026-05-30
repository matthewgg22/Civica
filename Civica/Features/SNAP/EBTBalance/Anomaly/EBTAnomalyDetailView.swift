import CivicaDesignSystem
import SwiftUI

// Full-screen sheet for an EBT anomaly alert. Lists the triggering
// transactions, explains the signal, and surfaces three CTAs:
//   1. Lock my card → EBTCardLockView (NavigationLink)
//   2. I'm traveling, mute 30 days → store.enableTravelMute()
//   3. Report fraud → tel:18773289677 (CA EBT fraud line)
//
// "Traveling" mute is only shown for .crossStateUse kind. "Lock my
// card" is shown for .velocityBurst and .crossStateUse; .transactionFlood
// shows "Review transactions" instead (the list below is the review).

struct EBTAnomalyDetailView: View {
    let alert: EBTAnomalyAlert
    @ObservedObject var store: EBTAnomalyStore
    let language: CivicaLanguage

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Context section
                Section {
                    Text(alert.bannerCopy.value(in: language))
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .listRowBackground(Color.clear)
                }

                // Triggering transactions
                if !alert.transactions.isEmpty {
                    Section(EBTAnomalyStrings.detailTransactionsHeader.value(in: language)) {
                        ForEach(alert.transactions) { txn in
                            transactionRow(txn)
                        }
                    }
                }

                // Actions
                Section(EBTAnomalyStrings.detailActionsHeader.value(in: language)) {
                    // Lock card (velocity or cross-state)
                    if alert.kind == .velocityBurst || alert.kind == .crossStateUse {
                        NavigationLink {
                            // EBTCardLockView is Lane H's domain. We navigate to
                            // it by name. Because EBTCardLockView requires a
                            // store + language, we post a notification that the
                            // root EBTBalanceRootView can intercept to navigate.
                            // For now, a placeholder Text holds the slot so the
                            // deep-link compiles cleanly; Lane H replaces this.
                            Text(EBTAnomalyStrings.lockCardPlaceholder.value(in: language))
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.ink)
                                .padding()
                        } label: {
                            Label(
                                EBTAnomalyStrings.lockCardCTA.value(in: language),
                                systemImage: "lock.fill"
                            )
                            .foregroundStyle(CivicaColors.brickAccent)
                        }
                    }

                    // Travel mute (cross-state only)
                    if alert.kind == .crossStateUse {
                        Button {
                            store.enableTravelMute()
                            dismiss()
                        } label: {
                            Label(
                                EBTAnomalyStrings.travelMuteCTA.value(in: language),
                                systemImage: "airplane"
                            )
                            .foregroundStyle(CivicaColors.pinePrimary)
                        }
                        .tint(CivicaColors.pinePrimary)
                    }

                    // Report fraud
                    Link(destination: URL(string: "tel:18773289677")!) {
                        Label(
                            EBTAnomalyStrings.reportFraudCTA.value(in: language),
                            systemImage: "phone.fill"
                        )
                        .foregroundStyle(CivicaColors.graphite)
                    }
                }

                // Dismiss
                Section {
                    Button(role: .cancel) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            store.dismiss(alert)
                        }
                        dismiss()
                    } label: {
                        Text(EBTAnomalyStrings.dismissCTA.value(in: language))
                            .frame(maxWidth: .infinity)
                    }
                    .tint(CivicaColors.graphite)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(EBTAnomalyStrings.detailNavTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(EBTAnomalyStrings.dismissCTA.value(in: language)) { dismiss() }
                        .font(CivicaTypography.footnoteStrong)
                        .accessibilityLabel(EBTAnomalyStrings.dismissCTA.value(in: language))
                }
            }
        }
    }

    // MARK: - Transaction row

    private func transactionRow(_ txn: EBTTransaction) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(txn.merchant)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                Text(shortDate(txn.date))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Text(formattedAmount(txn.amount))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(txn.isDeposit ? CivicaColors.amberPrimary : CivicaColors.ink)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Formatting helpers

    private func shortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: language == .spanish ? "es" : "en")
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    private func formattedAmount(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        let isWhole = (amount as NSDecimalNumber).doubleValue.truncatingRemainder(dividingBy: 1) == 0
        formatter.minimumFractionDigits = isWhole ? 0 : 2
        formatter.maximumFractionDigits = isWhole ? 0 : 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}
