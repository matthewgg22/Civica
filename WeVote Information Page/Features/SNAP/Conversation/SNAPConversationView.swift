import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: chat-style SNAP screener UI.
// Wraps SNAPConversationViewModel; adapts the input control to the
// expected_input_type returned by the backend Script-Writer stage.

struct SNAPConversationView: View {
    @StateObject var viewModel: SNAPConversationViewModel
    @State private var pendingFreeText: String = ""
    @State private var pendingNumeric: String = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            transcriptScroll
            inputArea
        }
        .background(CivicaColors.canvasBackground.ignoresSafeArea())
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
                    if case .error(let message) = viewModel.phase {
                        errorBanner(message).id("error")
                    }
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.lg)
            }
            .onChange(of: viewModel.transcript.count) { _ in
                if let last = viewModel.transcript.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
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
                    .background(CivicaColors.ctaBlue)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg))
            }
        case .assistant(let turn, _):
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(turn.assistantQuestion)
                    .font(CivicaTypography.body)
                    .foregroundColor(CivicaColors.textPrimary)
                if let helper = turn.helperText, !helper.isEmpty {
                    Text(helper)
                        .font(CivicaTypography.footnote)
                        .foregroundColor(CivicaColors.textSecondary)
                }
            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.vertical, CivicaSpacing.sm)
            .background(CivicaColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg))
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var thinkingIndicator: some View {
        HStack(spacing: CivicaSpacing.sm) {
            ProgressView()
            Text("Thinking…")
                .font(CivicaTypography.footnote)
                .foregroundColor(CivicaColors.textSecondary)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.sm)
    }

    private func verdictCard(_ result: SNAPEligibilityResult) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack {
                Image(systemName: result.status == .eligible ? "checkmark.seal.fill" : "info.circle.fill")
                    .foregroundColor(result.status == .eligible ? CivicaColors.successGreen : CivicaColors.warningAmber)
                Text(verdictHeadline(result))
                    .font(CivicaTypography.cardTitle)
                    .foregroundColor(CivicaColors.textPrimary)
            }
            if !result.requiredVerifications.isEmpty {
                Text("You'll need:")
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.textPrimary)
                ForEach(result.requiredVerifications, id: \.code) { v in
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Image(systemName: "doc.text")
                            .foregroundColor(CivicaColors.textSecondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(v.labelEn)
                                .font(CivicaTypography.subhead)
                                .foregroundColor(CivicaColors.textPrimary)
                            Text(v.explanationEn)
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.textSecondary)
                        }
                    }
                }
            }
            if let reason = result.ineligibilityReason {
                Text(reason)
                    .font(CivicaTypography.body)
                    .foregroundColor(CivicaColors.textSecondary)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.xl))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.xl)
                .strokeBorder(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    private func verdictHeadline(_ result: SNAPEligibilityResult) -> String {
        switch result.status {
        case .eligible:
            if let benefit = result.monthlyBenefit {
                return "Likely eligible — about $\(benefit.formattedAsWholeDollars())/month"
            }
            return "Likely eligible"
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
            Text(message)
                .font(CivicaTypography.subhead)
                .foregroundColor(CivicaColors.textPrimary)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.statusErrorSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md))
    }

    // MARK: - Adaptive input

    @ViewBuilder
    private var inputArea: some View {
        if case .terminal = viewModel.phase {
            EmptyView()
        } else if case .error = viewModel.phase {
            Button("Retry") {
                Task {
                    if viewModel.sessionId == nil {
                        await viewModel.start()
                    }
                }
            }
            .padding(CivicaSpacing.lg)
        } else {
            inputControl
                .padding(CivicaSpacing.lg)
                .background(CivicaColors.surfacePrimary)
                .overlay(alignment: .top) {
                    Rectangle().fill(CivicaColors.borderSubtle).frame(height: 1)
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
                .foregroundColor(style == .primary ? CivicaColors.onPrimaryText : CivicaColors.textPrimary)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.sm)
                .background(
                    style == .primary
                        ? (enabled ? CivicaColors.ctaBlue : CivicaColors.ctaBlueDisabled)
                        : CivicaColors.secondaryButtonFill
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.md)
                        .strokeBorder(
                            style == .primary ? .clear : CivicaColors.secondaryButtonBorder,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md))
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
