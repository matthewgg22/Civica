import SwiftUI

struct SupportVoteView: View {
    private let pageBackground = Color(red: 172.0 / 255.0, green: 213.0 / 255.0, blue: 227.0 / 255.0) // #ACD5E3

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
            case .custom: return "Custom"
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
    @State private var feedbackInput: String = ""
    @State private var feedbackMessages: [FeedbackMessage] = []
    @FocusState private var isCustomAmountFocused: Bool
    @FocusState private var isFeedbackInputFocused: Bool

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
        NavigationStack {
            ZStack {
                pageBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        PageHeader(title: "Support Americans Vote!")

                        missionCard
                        supportCard
                        feedbackCard
                        donationCard

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
    }

    private var missionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Support Americans Vote!")
                .font(.title3.weight(.bold))
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("VoteNow is built to be the lowest-friction voting companion possible: no ads, no partisanship, and no paywalls. We believe that reducing logistical friction—deadlines, locations, ID rules, and confusing steps—is essential to authentic voting help.\nIf you’d like to support this work, you can donate below.")
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
            Text("What your donation supports")
                .font(.headline)

            supportBullet("No ads or tracking")
            supportBullet("Nonpartisan voting logistics")
            supportBullet("Fast, accessible UX improvements")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.richBlue.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.richBlue.opacity(0.22), lineWidth: 1)
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
            Text("Choose amount")
                .font(.headline)

            amountPickerGrid

            if selectedAmount == .custom {
                VStack(alignment: .leading, spacing: 6) {
                    TextField("Enter amount (USD)", text: $customAmountText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .focused($isCustomAmountFocused)
                        .accessibilityLabel("Custom donation amount in dollars")

                    Text("Minimum $1, maximum $500")
                        .font(.caption)
                        .foregroundStyle(VoteNowColors.mutedText)
                }
            }

            if let amount = resolvedAmount {
                Text("Donation amount: \(formattedCurrency(amount))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(isAmountValid ? .primary : .red)
            } else {
                Text("Select an amount to continue.")
                    .font(.subheadline)
                    .foregroundStyle(VoteNowColors.mutedText)
            }

            ApplePayButton(type: .donate, style: .black, cornerRadius: 12) {
                guard let amount = resolvedAmount else { return }
                Task {
                    await applePayManager.startDonation(amount: amount)
                }
            }
            .frame(height: 48)
            .opacity(donationButtonEnabled ? 1 : 0.45)
            .allowsHitTesting(donationButtonEnabled)
            .accessibilityHint("Double tap to donate with Apple Pay")

            if !applePayManager.canMakePayments() {
                Text("Apple Pay is not available on this device.")
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
                .fill(VoteNowColors.background)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
    }

    private var feedbackCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Feedback")
                .font(.headline)

            Text("As a college startup, we have lots of ways to improve, learn, and grow with U.S. voters. We would love any feedback, friction points, or experiences you have in the U.S. voting process.")
                .font(.subheadline)
                .foregroundStyle(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 8) {
                if feedbackMessages.isEmpty {
                    Text("Chat with us:")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(VoteNowColors.mutedText)
                    Text("Share what felt confusing, frustrating, or helpful.")
                        .font(.caption)
                        .foregroundStyle(VoteNowColors.mutedText)
                } else {
                    ForEach(feedbackMessages) { message in
                        HStack {
                            if message.isUser { Spacer(minLength: 24) }
                            Text(message.text)
                                .font(.subheadline)
                                .foregroundStyle(message.isUser ? .white : .primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                                .background(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(message.isUser ? VoteNowColors.richBlue : VoteNowColors.infoSurfaceBlue)
                                )
                            if !message.isUser { Spacer(minLength: 24) }
                        }
                    }
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VoteNowColors.background)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
            )

            HStack(spacing: 8) {
                TextField("Share your thoughts...", text: $feedbackInput)
                    .textFieldStyle(.roundedBorder)
                    .focused($isFeedbackInputFocused)
                    .submitLabel(.send)
                    .onSubmit {
                        sendFeedbackMessage()
                    }

                Button("Send") {
                    sendFeedbackMessage()
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(feedbackSendEnabled ? VoteNowColors.richBlue : VoteNowColors.borderWarm.opacity(0.5))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .disabled(!feedbackSendEnabled)
            }
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

    private var feedbackSendEnabled: Bool {
        !feedbackInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendFeedbackMessage() {
        let trimmed = feedbackInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        feedbackMessages.append(FeedbackMessage(isUser: true, text: trimmed))
        feedbackInput = ""
        isFeedbackInputFocused = false

        feedbackMessages.append(
            FeedbackMessage(
                isUser: false,
                text: "Thanks for sharing this. We are listening and using feedback like this to improve VoteNow."
            )
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
                    Text(preset.title)
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
                .accessibilityLabel("Donation amount \(preset.title)")
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
}

private struct FeedbackMessage: Identifiable {
    let id = UUID()
    let isUser: Bool
    let text: String
}

#Preview {
    SupportVoteView()
}
