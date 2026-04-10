import SwiftUI

struct SupportVoteView: View {
    @Environment(\.locale) private var locale
    private let pageBackground = Color(red: 172.0 / 255.0, green: 213.0 / 255.0, blue: 227.0 / 255.0) // #ACD5E3
    private let warmSupportYellow = Color(hex: "#F3D487")

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
                VStack(alignment: .leading, spacing: 18) {
                    PageHeader(title: Text(l("app.support_vote.page_title", "Support VoteNow")))

                    missionCard
                    donationCard
                    disruptCard
                    supportCard

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 24)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var missionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.support_vote.mission.title", "Empower Americans Vote!"))
                .font(.title3.weight(.bold))
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(l("app.support_vote.mission.body", "VoteNow's mission is to empower every American to vote by being the least friction companion to support participation. We believe that reducing logistical friction-deadlines, locations, ID rules, and confusing steps-is essential to authentic voting help."))
                .font(.body)
                .foregroundStyle(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.background)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
    }

    private var supportCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.support_vote.supports.title", "What your donation supports"))
                .font(.headline.weight(.bold))
                .foregroundStyle(VoteNowColors.warningAmber)

            Text(l("app.support_vote.supports.body", "As a college-founded civic startup, we rely on community support to keep voter tools accessible."))
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.mutedText)

            supportBullet(l("app.support_vote.supports.bullet_1", "No ads or paywalls"))
            supportBullet(l("app.support_vote.supports.bullet_2", "Nonpartisan voting logistics"))
            supportBullet(l("app.support_vote.supports.bullet_3", "Fast, accessible UX improvements"))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(warmSupportYellow)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.warningAmber.opacity(0.58), lineWidth: 1)
        )
    }

    private func supportBullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
                .font(.headline)
            Text(text)
                .font(.subheadline)
        }
    }

    private var donationCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(l("app.support_vote.amount.title", "Choose amount"))
                .font(.headline)

            amountPickerGrid

            if selectedAmount == .custom {
                VStack(alignment: .leading, spacing: 6) {
                    TextField(l("app.support_vote.amount.custom_placeholder", "Enter amount (USD)"), text: $customAmountText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .focused($isCustomAmountFocused)
                        .accessibilityLabel(l("app.support_vote.amount.custom_accessibility", "Custom donation amount in dollars"))

                    Text(l("app.support_vote.amount.range_hint", "Minimum $1, maximum $500"))
                        .font(.caption)
                        .foregroundStyle(VoteNowColors.mutedText)
                }
            }

            if let amount = resolvedAmount {
                Text("\(l("app.support_vote.amount.selected_prefix", "Donation amount:")) \(formattedCurrency(amount))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(isAmountValid ? .primary : .red)
            } else {
                Text(l("app.support_vote.amount.select_to_continue", "Select an amount to continue."))
                    .font(.subheadline)
                    .foregroundStyle(VoteNowColors.mutedText)
            }

            // Current rollout uses an Apple Pay donation flow from this page.
            ApplePayButton(type: .donate, style: .black, cornerRadius: 12) {
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
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.mutedText)
            }

            if let error = applePayManager.errorMessage, !error.isEmpty {
                Text(error)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(VoteNowColors.richRed)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(VoteNowColors.richRed.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            if let success = applePayManager.successMessage, !success.isEmpty {
                Text(success)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.green)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.green.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(warmSupportYellow)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.warningAmber.opacity(0.58), lineWidth: 1)
        )
    }

    private var disruptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.support_vote.disrupt.title", "Disrupt the Status Quo by empowering voters, not campaigns."))
                .font(.headline.weight(.bold))

            Text(l("app.support_vote.disrupt.body", "Most voter outreach in America is not funded by voters. It is funded by PACs and Super PACs. That means:"))
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            supportBullet(l("app.support_vote.disrupt.bullet_1", "Messaging is designed to move votes for a side"))
            supportBullet(l("app.support_vote.disrupt.bullet_2", "Outreach spikes where races are close (and money is flowing)"))
            supportBullet(l("app.support_vote.disrupt.bullet_3", "Voters become targets, not long-term users"))
            supportBullet(l("app.support_vote.disrupt.bullet_4", "The system optimizes for winning - not serving"))

            Text(l("app.support_vote.disrupt.footer", "VoteNow is built around servicing YOU, the voter."))
                .font(.subheadline.weight(.semibold))
                .padding(.top, 4)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.background)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
    }

    private var amountPickerGrid: some View {
        HStack(spacing: 8) {
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
                        .font(.footnote.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(selectedAmount == preset ? VoteNowColors.richBlue : VoteNowColors.infoSurfaceBlue)
                        )
                        .foregroundStyle(selectedAmount == preset ? VoteNowColors.surfaceWhite : VoteNowColors.primaryText)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(selectedAmount == preset ? VoteNowColors.richBlue : VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
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
