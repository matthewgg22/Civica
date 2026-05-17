import CivicaDesignSystem
import SwiftUI

// Magic-link / OTP recovery for an in-progress SNAP application.
//
// Why this exists: per the locked persistence decision, sessions live
// in Supabase tied to an anonymous session id. If the user uninstalls
// the app, switches phones, or wipes their device mid-application,
// they have nothing to log back in with. This flow resolves that
// "uninstall = lost progress" cliff identified in the original plan.
//
// Three-step HANDOFF cadence using CivicaQuestionScreen:
//   1. Channel  — phone or email?
//   2. Contact  — the actual phone number / email
//   3. Code     — six-digit one-time code from the SMS / email
//
// Network shape today: requestRecoveryCode is stubbed in the view
// model (Task.sleep) until POST /snap/sessions/recover/request lands
// on the backend. Redeem already calls the real (or mock) endpoint
// via SNAPNetworkClient.recoverSession(token:).

@MainActor
final class SNAPRecoveryViewModel: ObservableObject {
    enum Channel: String, CaseIterable, Equatable {
        case phone, email
        var isPhone: Bool { self == .phone }
    }

    enum Step: Int, CaseIterable {
        case channel
        case contact
        case code

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    enum NetworkPhase: Equatable {
        case idle
        case sending
        case redeeming
        case error(String)
    }

    @Published var step: Step = .channel
    @Published var channel: Channel?
    @Published var contactValue: String = ""
    @Published var codeValue: String = ""
    @Published private(set) var phase: NetworkPhase = .idle

    private let client: SNAPNetworkClient
    private let onRecovered: @MainActor (SNAPStartSessionResponse) -> Void
    private let onCancel: @MainActor () -> Void
    let language: CivicaLanguage

    init(
        client: SNAPNetworkClient,
        language: CivicaLanguage = .english,
        onRecovered: @escaping @MainActor (SNAPStartSessionResponse) -> Void,
        onCancel: @escaping @MainActor () -> Void
    ) {
        self.client = client
        self.language = language
        self.onRecovered = onRecovered
        self.onCancel = onCancel
    }

    // MARK: - Per-step validity

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .channel:
            return channel != nil
        case .contact:
            return isContactValid
        case .code:
            return isCodeValid
        }
    }

    var isContactValid: Bool {
        let trimmed = contactValue.trimmingCharacters(in: .whitespaces)
        switch channel ?? .phone {
        case .phone:
            return trimmed.filter(\.isNumber).count >= 10
        case .email:
            return trimmed.contains("@") && trimmed.contains(".")
        }
    }

    var isCodeValid: Bool {
        codeValue.filter(\.isNumber).count == 6
    }

    var isAtFirstStep: Bool { step == .channel }
    var isAtLastStep: Bool { step == .code }

    // MARK: - Navigation

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
            // Clear any error from the next step when stepping back.
            phase = .idle
        } else {
            onCancel()
        }
    }

    /// Drives the step machine. Channel → Contact is a pure local
    /// transition. Contact → Code requests the OTP. Code → done
    /// redeems the OTP for a recovered session.
    func advance() async {
        switch step {
        case .channel:
            step = .contact
        case .contact:
            await requestCode()
        case .code:
            await redeemCode()
        }
    }

    // MARK: - Network

    private func requestCode() async {
        guard isContactValid else { return }
        phase = .sending
        // Phase D wrap-up: POST /snap/sessions/recover/request lands
        // with the backend HTTP layer. For now this is a deterministic
        // stub so the flow can be exercised in builds without the
        // backend running.
        try? await Task.sleep(nanoseconds: 600_000_000)
        phase = .idle
        step = .code
    }

    private func redeemCode() async {
        guard isCodeValid else { return }
        phase = .redeeming
        do {
            let response = try await client.recoverSession(token: codeValue)
            phase = .idle
            onRecovered(response)
        } catch {
            phase = .error(SNAPRecoveryStrings.redeemErrorBadCode.value(in: language))
        }
    }

    /// Re-trigger the code send without backing out of the code step.
    func resendCode() async {
        phase = .sending
        try? await Task.sleep(nanoseconds: 600_000_000)
        phase = .idle
    }
}

// MARK: - View

struct SNAPRecoveryView: View {
    @StateObject var viewModel: SNAPRecoveryViewModel

    var body: some View {
        currentScreen
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: viewModel.goBack) {
                        Image(systemName: viewModel.isAtFirstStep ? "xmark" : "chevron.left")
                            .foregroundStyle(CivicaColors.ink)
                    }
                    .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: viewModel.language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .channel: channelScreen
        case .contact: contactScreen
        case .code: codeScreen
        }
    }

    // MARK: - Screen 1: channel

    private var channelScreen: some View {
        let lang = viewModel.language
        return CivicaQuestionScreen(
            progress: progress(for: .channel),
            title: SNAPRecoveryStrings.channelTitle.value(in: lang),
            helper: SNAPRecoveryStrings.channelHelper.value(in: lang),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: lang),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: { Task { await viewModel.advance() } },
            language: lang
        ) {
            CivicaQuestionChoices(
                options: [
                    SNAPRecoveryStrings.channelOptionPhone.value(in: lang),
                    SNAPRecoveryStrings.channelOptionEmail.value(in: lang)
                ],
                selection: Binding(
                    get: { mappedChannelOption(for: viewModel.channel, language: lang) },
                    set: { viewModel.channel = channelFromOption($0, language: lang) }
                )
            )
        }
    }

    // MARK: - Screen 2: contact

    private var contactScreen: some View {
        let lang = viewModel.language
        let isPhone = (viewModel.channel ?? .phone).isPhone
        return CivicaQuestionScreen(
            progress: progress(for: .contact),
            title: isPhone
                ? SNAPRecoveryStrings.contactTitlePhone.value(in: lang)
                : SNAPRecoveryStrings.contactTitleEmail.value(in: lang),
            helper: isPhone
                ? SNAPRecoveryStrings.contactHelperPhone.value(in: lang)
                : SNAPRecoveryStrings.contactHelperEmail.value(in: lang),
            primaryActionTitle: viewModel.phase == .sending
                ? SNAPRecoveryStrings.sending.value(in: lang)
                : CivicaQuestionStrings.continueLabel.value(in: lang),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep && viewModel.phase != .sending,
            onPrimary: { Task { await viewModel.advance() } },
            language: lang
        ) {
            contactField(isPhone: isPhone, language: lang)
        }
    }

    private func contactField(isPhone: Bool, language: CivicaLanguage) -> some View {
        TextField(
            isPhone
                ? SNAPRecoveryStrings.contactPlaceholderPhone.value(in: language)
                : SNAPRecoveryStrings.contactPlaceholderEmail.value(in: language),
            text: $viewModel.contactValue
        )
        .font(CivicaTypography.cardTitle.monospacedDigit())
        .foregroundStyle(CivicaColors.ink)
        .keyboardType(isPhone ? .phonePad : .emailAddress)
        .textContentType(isPhone ? .telephoneNumber : .emailAddress)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled(true)
        // Format-as-you-type for the phone branch. Email branch keeps
        // user input verbatim. Recovery's redemption-token network
        // call strips back to digits via USPhoneFormatter.digits.
        .onChange(of: viewModel.contactValue) { _, newValue in
            guard isPhone else { return }
            let formatted = USPhoneFormatter.format(newValue)
            if formatted != newValue {
                viewModel.contactValue = formatted
            }
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Screen 3: code

    private var codeScreen: some View {
        let lang = viewModel.language
        let isPhone = (viewModel.channel ?? .phone).isPhone
        let helper = SNAPRecoveryStrings.codeHelper(
            contact: maskedContact(viewModel.contactValue, isPhone: isPhone),
            isPhone: isPhone,
            language: lang
        )
        return CivicaQuestionScreen(
            progress: progress(for: .code),
            title: SNAPRecoveryStrings.codeTitle.value(in: lang),
            helper: helper,
            primaryActionTitle: viewModel.phase == .redeeming
                ? SNAPRecoveryStrings.redeeming.value(in: lang)
                : CivicaQuestionStrings.continueLabel.value(in: lang),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep && viewModel.phase != .redeeming,
            onPrimary: { Task { await viewModel.advance() } },
            secondaryActionTitle: SNAPRecoveryStrings.codeResend.value(in: lang),
            onSecondary: { Task { await viewModel.resendCode() } },
            language: lang
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                codeField(language: lang)
                if case .error(let message) = viewModel.phase {
                    Text(message)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func codeField(language: CivicaLanguage) -> some View {
        TextField(
            SNAPRecoveryStrings.codePlaceholder.value(in: language),
            text: $viewModel.codeValue
        )
        .font(CivicaTypography.currencyHero)
        .foregroundStyle(CivicaColors.ink)
        .keyboardType(.numberPad)
        .textContentType(.oneTimeCode)
        .multilineTextAlignment(.center)
        .kerning(8)
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 72)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func progress(for step: SNAPRecoveryViewModel.Step)
        -> CivicaQuestionScreen<EmptyView>.Progress
    {
        .init(current: step.oneBasedIndex, total: SNAPRecoveryViewModel.Step.total)
    }

    /// Maps the enum value to the localized choice label and back. Keeps
    /// the view's binding declarative without storing the localized
    /// string on the view model.
    private func mappedChannelOption(for channel: SNAPRecoveryViewModel.Channel?, language: CivicaLanguage) -> String? {
        switch channel {
        case .phone: return SNAPRecoveryStrings.channelOptionPhone.value(in: language)
        case .email: return SNAPRecoveryStrings.channelOptionEmail.value(in: language)
        case nil:    return nil
        }
    }

    private func channelFromOption(_ option: String?, language: CivicaLanguage) -> SNAPRecoveryViewModel.Channel? {
        guard let option else { return nil }
        if option == SNAPRecoveryStrings.channelOptionPhone.value(in: language) {
            return .phone
        }
        if option == SNAPRecoveryStrings.channelOptionEmail.value(in: language) {
            return .email
        }
        return nil
    }

    /// Mask the contact so we don't echo a full phone number / email
    /// back at the user on the code screen. "(555) 123-4567" → "(•••) •••-4567",
    /// "user@example.com" → "u••••@example.com".
    private func maskedContact(_ raw: String, isPhone: Bool) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if isPhone {
            let digits = trimmed.filter(\.isNumber)
            guard digits.count >= 4 else { return trimmed }
            let lastFour = String(digits.suffix(4))
            return "•••-•••-\(lastFour)"
        } else {
            guard let atIndex = trimmed.firstIndex(of: "@") else { return trimmed }
            let local = trimmed[trimmed.startIndex..<atIndex]
            let domain = trimmed[atIndex...]
            guard let first = local.first else { return trimmed }
            return "\(first)••••\(domain)"
        }
    }
}

// MARK: - Flow wrapper

/// Wraps SNAPRecoveryView with network-client wiring and the navigation
/// chrome (title, dismiss behavior). Mirrors SNAPConversationFlowView's
/// pattern: callers don't need to know about the network protocol —
/// they push this view and provide onRecovered / onClose.
struct SNAPRecoveryFlowView: View {
    let language: CivicaLanguage
    let onRecovered: @MainActor (SNAPStartSessionResponse) -> Void
    let onClose: () -> Void

    @StateObject private var viewModel: SNAPRecoveryViewModel

    init(
        language: CivicaLanguage = .english,
        onRecovered: @escaping @MainActor (SNAPStartSessionResponse) -> Void,
        onClose: @escaping () -> Void,
        client: SNAPNetworkClient? = nil
    ) {
        self.language = language
        self.onRecovered = onRecovered
        self.onClose = onClose
        let resolvedClient = client ?? SNAPConversationFlowView.defaultClient()
        _viewModel = StateObject(
            wrappedValue: SNAPRecoveryViewModel(
                client: resolvedClient,
                language: language,
                onRecovered: onRecovered,
                onCancel: onClose
            )
        )
    }

    var body: some View {
        SNAPRecoveryView(viewModel: viewModel)
    }
}

#if DEBUG
struct SNAPRecoveryView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPRecoveryView(
                viewModel: SNAPRecoveryViewModel(
                    client: MockSNAPNetworkClient(),
                    language: .english,
                    onRecovered: { _ in },
                    onCancel: {}
                )
            )
        }
    }
}
#endif
