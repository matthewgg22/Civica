import CivicaDesignSystem
import SwiftUI

struct SupportVoteView: View {
    @Environment(\.locale) private var locale
    private let pageBackground = CivicaColors.supportPageBackground
    private let warmSupportYellow = CivicaColors.supportWarmSurface

    private enum PresetAmount: Hashable, CaseIterable {
        case five
        case fifteen
        case twentyFive
        case fifty
        case custom

        var title: String {
            switch self {
            case .five: return "$5"
            case .fifteen: return "$15"
            case .twentyFive: return "$25"
            case .fifty: return "$50"
            case .custom: return "app.support_vote.amount.custom"
            }
        }

        var value: Decimal? {
            switch self {
            case .five: return 5
            case .fifteen: return 15
            case .twentyFive: return 25
            case .fifty: return 50
            case .custom: return nil
            }
        }
    }

    @StateObject private var applePayManager = ApplePayDonationManager()
    @State private var selectedAmount: PresetAmount = .fifteen
    @State private var customAmountText: String = ""
    @FocusState private var isCustomAmountFocused: Bool

    private var resolvedAmount: Decimal? {
        if let value = selectedAmount.value {
            return value
        }
        return decimalFromCustomInput
    }

    private var decimalFromCustomInput: Decimal? {
        let raw = customAmountText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        let cleaned = raw.filter { $0.isNumber || $0 == "." }
        guard !cleaned.isEmpty else { return nil }
        return Decimal(string: cleaned, locale: Locale(identifier: "en_US_POSIX"))
    }

    private var isAmountValid: Bool {
        guard let amount = resolvedAmount else { return false }
        return amount >= 1 && amount <= 500
    }

    private var donationButtonEnabled: Bool {
        isAmountValid && !applePayManager.isProcessing && applePayManager.canMakePayments()
    }

    var body: some View {
        ZStack {
            pageBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    PageHeader(title: Text(l("app.support_vote.page_title", "Support Civica")))

                    missionCard
                    donationCard
                    disruptCard
                    supportCard

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.sm)
                .padding(.bottom, CivicaSpacing.xl)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var missionCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.support_vote.mission.title", "Empower Americans Vote!"))
                .font(CivicaTypography.cardTitle)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(l("app.support_vote.mission.body", "Civica's mission is to empower every American to vote by being the least friction companion to support participation. We believe that reducing logistical friction-deadlines, locations, ID rules, and confusing steps-is essential to authentic voting help."))
                .font(.body)
                .foregroundStyle(CivicaColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.canvasBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.textPrimary.opacity(0.08), lineWidth: 1)
        )
    }

    private var supportCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.support_vote.supports.title", "What your donation supports"))
                .font(CivicaTypography.sectionHeaderBold)
                .foregroundStyle(CivicaColors.warningAmber)

            Text(l("app.support_vote.supports.body", "As a college-founded civic startup, we rely on community support to keep voter tools accessible."))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.textSecondary)

            supportBullet(l("app.support_vote.supports.bullet_1", "No ads or paywalls"))
            supportBullet(l("app.support_vote.supports.bullet_2", "Nonpartisan voting logistics"))
            supportBullet(l("app.support_vote.supports.bullet_3", "Fast, accessible UX improvements"))
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(warmSupportYellow)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.warningAmber.opacity(0.58), lineWidth: 1)
        )
    }

    private func supportBullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Text("•")
                .font(CivicaTypography.sectionHeader)
            Text(text)
                .font(CivicaTypography.subhead)
        }
    }

    private var donationCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(l("app.support_vote.amount.title", "Choose amount"))
                .font(CivicaTypography.sectionHeader)

            amountPickerGrid

            if selectedAmount == .custom {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    TextField(l("app.support_vote.amount.custom_placeholder", "Enter amount (USD)"), text: $customAmountText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .focused($isCustomAmountFocused)
                        .accessibilityLabel(l("app.support_vote.amount.custom_accessibility", "Custom donation amount in dollars"))

                    Text(l("app.support_vote.amount.range_hint", "Minimum $1, maximum $500"))
                        .font(CivicaTypography.caption)
                        .foregroundStyle(CivicaColors.textSecondary)
                }
            }

            if let amount = resolvedAmount {
                Text("\(l("app.support_vote.amount.selected_prefix", "Donation amount:")) \(formattedCurrency(amount))")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(isAmountValid ? CivicaColors.textPrimary : CivicaColors.ctaRed)
            } else {
                Text(l("app.support_vote.amount.select_to_continue", "Select an amount to continue."))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.textSecondary)
            }

            // Current rollout uses an Apple Pay donation flow from this page.
            ApplePayButton(type: .donate, style: .black, cornerRadius: CivicaRadius.lg) {
                guard let amount = resolvedAmount else { return }
                Task {
                    await applePayManager.startDonation(amount: amount)
                }
            }
            .frame(height: 48)
            .opacity(donationButtonEnabled ? 1 : 0.45)
            .allowsHitTesting(donationButtonEnabled)
            .accessibilityHint(l("app.support_vote.amount.apple_pay_hint", "Double tap to donate with Apple Pay"))

            if !applePayManager.canMakePayments() {
                Text(l("app.support_vote.amount.apple_pay_unavailable", "Apple Pay is not available on this device."))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.textSecondary)
            }

            if let error = applePayManager.errorMessage, !error.isEmpty {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ctaRed)
                    .padding(CivicaSpacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(CivicaColors.statusErrorSurface)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
            }

            if let success = applePayManager.successMessage, !success.isEmpty {
                Label(success, systemImage: "checkmark.circle.fill")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.successGreen)
                    .padding(CivicaSpacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(CivicaColors.statusSuccessSurface)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
            }

        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(warmSupportYellow)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.warningAmber.opacity(0.58), lineWidth: 1)
        )
    }

    private var disruptCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.support_vote.disrupt.title", "Disrupt the Status Quo by empowering voters, not campaigns."))
                .font(CivicaTypography.sectionHeaderBold)

            Text(l("app.support_vote.disrupt.body", "Most voter outreach in America is not funded by voters. It is funded by PACs and Super PACs. That means:"))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            supportBullet(l("app.support_vote.disrupt.bullet_1", "Messaging is designed to move votes for a side"))
            supportBullet(l("app.support_vote.disrupt.bullet_2", "Outreach spikes where races are close (and money is flowing)"))
            supportBullet(l("app.support_vote.disrupt.bullet_3", "Voters become targets, not long-term users"))
            supportBullet(l("app.support_vote.disrupt.bullet_4", "The system optimizes for winning - not serving"))

            Text(l("app.support_vote.disrupt.footer", "Civica is built around servicing YOU, the voter."))
                .font(CivicaTypography.subheadStrong)
                .padding(.top, CivicaSpacing.xs)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.canvasBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.textPrimary.opacity(0.08), lineWidth: 1)
        )
    }

    private var amountPickerGrid: some View {
        HStack(spacing: CivicaSpacing.sm) {
            ForEach(PresetAmount.allCases, id: \.self) { preset in
                Button {
                    selectedAmount = preset
                    if preset != .custom {
                        isCustomAmountFocused = false
                    }
                } label: {
                    Text(preset.title.hasPrefix("app.")
                         ? l(preset.title, "Custom")
                         : preset.title)
                        .font(CivicaTypography.footnoteStrong)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .fill(selectedAmount == preset ? CivicaColors.ctaBlue : CivicaColors.infoSurfaceBlue)
                        )
                        .foregroundStyle(selectedAmount == preset ? CivicaColors.surfacePrimary : CivicaColors.textPrimary)
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .stroke(selectedAmount == preset ? CivicaColors.ctaBlue : CivicaColors.textPrimary.opacity(0.08), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    preset.title.hasPrefix("app.")
                    ? lf("app.support_vote.amount.accessibility.option", "Donation amount %@", l(preset.title, "Custom"))
                    : lf("app.support_vote.amount.accessibility.option", "Donation amount %@", preset.title)
                )
            }
        }
    }

    private func formattedCurrency(_ value: Decimal) -> String {
        let number = NSDecimalNumber(decimal: value)
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 2
        return formatter.string(from: number) ?? "$\(number)"
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private func lf(_ key: String, _ fallback: String, _ args: CVarArg...) -> String {
        let format = l(key, fallback)
        return String(format: format, locale: locale, arguments: args)
    }
}

#Preview {
    SupportVoteView()
}
