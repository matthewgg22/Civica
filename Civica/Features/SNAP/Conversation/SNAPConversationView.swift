import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: chat-style SNAP screener UI.
// Wraps SNAPConversationViewModel; adapts the input control to the
// expected_input_type returned by the backend Script-Writer stage.

struct SNAPConversationView: View {
    @StateObject var viewModel: SNAPConversationViewModel
    @State private var pendingFreeText: String = ""
    @State private var pendingNumeric: String = ""
    @State private var bannerDismissed: Bool = false
    @FocusState private var isInputFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var navigatorPhoneURL: URL? {
        let number = SNAPAgencyDirectory.helplineNumber(for: viewModel.stateCode)
        let digits = number.filter(\.isNumber)
        guard !digits.isEmpty else { return nil }
        return URL(string: "tel:\(digits)")
    }

    var body: some View {
        VStack(spacing: 0) {
            transcriptScroll
            inputArea
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .task {
            if viewModel.phase == .idle {
                await viewModel.start()
            }
        }
    }

    // MARK: - Transcript

    private var transcriptScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    ForEach(viewModel.transcript) { entry in
                        bubble(for: entry).id(entry.id)
                    }
                    if case .sending = viewModel.phase {
                        thinkingIndicator.id("thinking")
                    }
                    if case .terminal(let result) = viewModel.phase, let result {
                        verdictCard(result).id("verdict")
                    }
                    if case .error(let message) = viewModel.phase, !bannerDismissed {
                        errorBanner(message).id("error")
                    }
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.lg)
            }
            .onChange(of: viewModel.transcript.count) {
                if let last = viewModel.transcript.last {
                    withAnimation(reduceMotion ? nil : .default) { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .onChange(of: viewModel.phase) { _, newPhase in
                if case .error = newPhase {
                    bannerDismissed = false
                }
            }
        }
    }

    @ViewBuilder
    private func bubble(for entry: SNAPConversationViewModel.TranscriptEntry) -> some View {
        switch entry {
        case .user(_, let text):
            HStack {
                Spacer(minLength: CivicaSpacing.xl)
                Text(text)
                    .font(CivicaTypography.body)
                    .foregroundColor(CivicaColors.onPrimaryText)
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.vertical, CivicaSpacing.sm)
                    .background(CivicaColors.pinePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            }
        case .assistant(let turn, _):
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(turn.assistantQuestion)
                    .font(CivicaTypography.body)
                    .foregroundColor(CivicaColors.ink)
                if let helper = turn.helperText, !helper.isEmpty {
                    Text(helper)
                        .font(CivicaTypography.footnote)
                        .foregroundColor(CivicaColors.graphite)
                }
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(CivicaColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var thinkingIndicator: some View {
        HStack(spacing: CivicaSpacing.sm) {
            ProgressView()
            Text(SNAPConversationViewStrings.thinking.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundColor(CivicaColors.graphite)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.sm)
    }

    private func verdictCard(_ result: SNAPEligibilityResult) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack {
                Image(systemName: result.status == .eligible ? "checkmark.seal.fill" : "info.circle.fill")
                    .foregroundColor(result.status == .eligible ? CivicaColors.amberPrimary : CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                Text(verdictHeadline(result))
                    .font(CivicaTypography.cardTitle)
                    .foregroundColor(CivicaColors.ink)
            }
            if !result.requiredVerifications.isEmpty {
                Text(SNAPConversationViewStrings.youllNeed.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.ink)
                ForEach(result.requiredVerifications, id: \.code) { v in
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Image(systemName: "doc.text")
                            .foregroundColor(CivicaColors.graphite)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(v.labelEn)
                                .font(CivicaTypography.subhead)
                                .foregroundColor(CivicaColors.ink)
                            Text(v.explanationEn)
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.graphite)
                        }
                    }
                }
            }
            if let reason = result.ineligibilityReason {
                Text(reason)
                    .font(CivicaTypography.body)
                    .foregroundColor(CivicaColors.graphite)
            }

            // "See the math →" — opens the HANDOFF board 23 decision-math
            // view. Visible whenever the rules engine returned a full
            // benefit calculation (i.e. eligible or ineligible-by-math
            // outcomes; not insufficient-information cases).
            if result.benefitCalculation != nil {
                NavigationLink {
                    SNAPDecisionMathView(result: result)
                } label: {
                    HStack(spacing: CivicaSpacing.xs) {
                        Text(SNAPConversationViewStrings.seeTheMath.value(in: language))
                            .font(CivicaTypography.subheadStrong)
                        Image(systemName: "arrow.right")
                            .accessibilityHidden(true)
                    }
                    .foregroundColor(CivicaColors.pinePrimary)
                    .padding(.top, CivicaSpacing.xs)
                }
                .accessibilityHint("Shows every deduction line that produced this benefit estimate.")
            }

            Text({
                let agency = SNAPAgencyDirectory.agencyFullName(for: viewModel.stateCode, language: .english)
                return "This is an estimate. \(agency) reviews your full application and makes the final eligibility determination."
            }())
                .font(CivicaTypography.caption)
                .foregroundColor(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, CivicaSpacing.xs)
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

    private func verdictHeadline(_ result: SNAPEligibilityResult) -> String {
        switch result.status {
        case .eligible:
            if let benefit = result.monthlyBenefit {
                return "You may be eligible — about $\(benefit.formattedAsWholeDollars())/month"
            }
            return "You may be eligible"
        case .ineligible:
            return "Doesn't appear to qualify right now"
        case .eligibleWithConditions:
            return "Eligible with conditions"
        case .insufficientInformation:
            return "Need more info to determine"
        }
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            Text(message)
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                bannerDismissed = true
            } label: {
                Image(systemName: "xmark")
                    .foregroundColor(CivicaColors.graphite)
            }
            .accessibilityLabel(SNAPConversationViewStrings.dismissErrorBanner.value(in: language))
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.statusErrorSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
    }

    // MARK: - Adaptive input

    @ViewBuilder
    private var inputArea: some View {
        if case .terminal = viewModel.phase {
            EmptyView()
        } else if case .error = viewModel.phase {
            HStack(spacing: CivicaSpacing.sm) {
                Button(SNAPConversationViewStrings.retry.value(in: language)) {
                    Task {
                        if viewModel.sessionId == nil {
                            await viewModel.start()
                        }
                    }
                }
                if let phoneURL = navigatorPhoneURL {
                    Text(SNAPConversationViewStrings.orConnector.value(in: language))
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.graphite)
                    Link(destination: phoneURL) {
                        HStack(spacing: CivicaSpacing.xs) {
                            Text(SNAPConversationViewStrings.getHelpByPhone.value(in: language))
                            Image(systemName: "arrow.right")
                                .accessibilityHidden(true)
                        }
                        .font(CivicaTypography.subheadStrong)
                        .foregroundColor(CivicaColors.pinePrimary)
                    }
                    .accessibilityLabel(SNAPConversationViewStrings.callNavigator.value(in: language))
                }
            }
            .padding(CivicaSpacing.lg)
        } else if case .awaitingConfirmation = viewModel.phase {
            confirmationBanner
                .padding(CivicaSpacing.lg)
                .background(CivicaColors.surfacePrimary)
                .overlay(alignment: .top) {
                    Rectangle().fill(CivicaColors.hairline).frame(height: 1)
                }
        } else {
            inputControl
                .padding(CivicaSpacing.lg)
                .background(CivicaColors.surfacePrimary)
                .overlay(alignment: .top) {
                    Rectangle().fill(CivicaColors.hairline).frame(height: 1)
                }
        }
    }

    private var confirmationBanner: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "questionmark.circle.fill")
                    .foregroundStyle(CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                Text(SNAPConversationViewStrings.confirmUnderstanding.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
            }
            HStack(spacing: CivicaSpacing.sm) {
                inputButton("Looks right") {
                    viewModel.confirmTurn()
                }
                inputButton("Let me fix that", style: .secondary) {
                    viewModel.retypeAnswer()
                }
            }
        }
    }

    @ViewBuilder
    private var inputControl: some View {
        switch viewModel.pendingInputType {
        case .yesNo:
            HStack(spacing: CivicaSpacing.md) {
                inputButton("Yes") { Task { await submit("Yes") } }
                inputButton("No") { Task { await submit("No") } }
                inputButton("Not sure", style: .secondary) { Task { await submit("Not sure") } }
            }
        case .choice:
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                ForEach(viewModel.pendingChoiceOptions ?? [], id: \.self) { option in
                    inputButton(option, fullWidth: true) { Task { await submit(option) } }
                }
            }
        case .numericDollars, .integer:
            HStack(spacing: CivicaSpacing.sm) {
                TextField(
                    viewModel.pendingInputType == .numericDollars ? "$0" : "0",
                    text: $pendingNumeric
                )
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
                .focused($isInputFocused)
                inputButton("Send", enabled: !pendingNumeric.isEmpty) {
                    Task {
                        await submit(pendingNumeric)
                        pendingNumeric = ""
                    }
                }
            }
        case .freeText, .date, .none:
            HStack(spacing: CivicaSpacing.sm) {
                TextField("Type your answer", text: $pendingFreeText, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.roundedBorder)
                    .focused($isInputFocused)
                inputButton("Send", enabled: !pendingFreeText.trimmingCharacters(in: .whitespaces).isEmpty) {
                    Task {
                        await submit(pendingFreeText)
                        pendingFreeText = ""
                    }
                }
            }
        }
    }

    private enum InputButtonStyle {
        case primary, secondary
    }

    private func inputButton(
        _ label: String,
        style: InputButtonStyle = .primary,
        fullWidth: Bool = false,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(style == .primary ? CivicaColors.onPrimaryText : CivicaColors.ink)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    style == .primary
                        ? (enabled ? CivicaColors.pinePrimary : CivicaColors.pinePrimaryDisabled)
                        : CivicaColors.secondaryButtonFill
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(
                            style == .primary ? .clear : CivicaColors.secondaryButtonBorder,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        }
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private func submit(_ text: String) async {
        await viewModel.send(text)
    }
}

// MARK: - Decimal formatting helper (kept private to this view)

private extension Decimal {
    func formattedAsWholeDollars() -> String {
        let handler = NSDecimalNumberHandler(
            roundingMode: .plain,
            scale: 0,
            raiseOnExactness: false,
            raiseOnOverflow: false,
            raiseOnUnderflow: false,
            raiseOnDivideByZero: false
        )
        return NSDecimalNumber(decimal: self)
            .rounding(accordingToBehavior: handler)
            .stringValue
    }
}

// MARK: - Preview

#if DEBUG
struct SNAPConversationView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPConversationView(
            viewModel: SNAPConversationViewModel(
                client: MockSNAPNetworkClient(),
                stateCode: "MA",
                language: "en"
            )
        )
        .previewDisplayName("Mock canonical demo")
    }
}
#endif
