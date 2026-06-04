import CivicaDesignSystem
import Combine
import SwiftUI

// Migrates the legacy "addressContactStep" multi-field card from
// SNAPApplicationView. Despite the legacy name, that step is really
// the contact-info block: email, phone, and preferred contact method.
// (Mailing address lives in the residency / housing block.)
//
// Three screens, all optional — every screen has a "Skip for now"
// secondary so users who don't want to share a contact path can keep
// moving. The preferred-method screen is automatically skipped if
// the user provided neither email nor phone, since there's nothing
// meaningful to prefer.

struct SNAPContactAnswers: Equatable, Codable {
    var email: String?
    var phone: String?
    var preferredMethod: PreferredContactMethod?
    /// Timestamp the user granted TCPA consent for phone calls and SMS
    /// from Civica. Nil means consent has not been given (or has been
    /// revoked). Never auto-populated — only set when the user
    /// explicitly toggles the consent checkbox on the phone step.
    /// Required upstream for Twilio outreach + the interview concierge
    /// CSV export (which filters on consent != nil).
    var tcpaConsentAt: Date?

    var hasAnyContact: Bool {
        let trimmedEmail = (email ?? "").trimmingCharacters(in: .whitespaces)
        let trimmedPhone = (phone ?? "").trimmingCharacters(in: .whitespaces)
        return !trimmedEmail.isEmpty || !trimmedPhone.isEmpty
    }
}

@MainActor
final class SNAPContactFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case email, phone, preferred

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .email
    @Published var emailField: String
    @Published var phoneField: String
    @Published var answers: SNAPContactAnswers

    /// Per-change write-back closure (issue #425). See
    /// SNAPHouseholdQuestionFlowViewModel for the canonical comment.
    var onAnswersChange: ((SNAPContactAnswers) -> Void)?
    private var answersWatch: AnyCancellable?

    init(
        answers: SNAPContactAnswers = .init(),
        onAnswersChange: ((SNAPContactAnswers) -> Void)? = nil
    ) {
        self.answers = answers
        // Seed transient text fields from prior answers so the user
        // sees their saved email / phone on resume + edit.
        self.emailField = answers.email ?? ""
        self.phoneField = answers.phone ?? ""
        self.onAnswersChange = onAnswersChange
        self.answersWatch = $answers.dropFirst().sink { [weak self] new in
            self?.onAnswersChange?(new)
        }
    }

    func recordCurrentField() {
        switch step {
        case .email:
            let trimmed = emailField.trimmingCharacters(in: .whitespaces)
            answers.email = trimmed.isEmpty ? nil : trimmed
        case .phone:
            let trimmed = phoneField.trimmingCharacters(in: .whitespaces)
            answers.phone = trimmed.isEmpty ? nil : trimmed
        case .preferred:
            break
        }
    }

    func advance() {
        recordCurrentField()
        var nextRaw = step.rawValue + 1
        // Skip the preferred-method screen if neither email nor phone
        // was provided — nothing to pick between.
        if nextRaw == Step.preferred.rawValue && !answers.hasAnyContact {
            nextRaw += 1
        }
        if let next = Step(rawValue: nextRaw) {
            step = next
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    func skip() {
        // Clear the current field so it doesn't sneak in as a half-
        // typed value, then advance.
        switch step {
        case .email: emailField = ""; answers.email = nil
        case .phone: phoneField = ""; answers.phone = nil
        case .preferred: answers.preferredMethod = nil
        }
        var nextRaw = step.rawValue + 1
        if nextRaw == Step.preferred.rawValue && !answers.hasAnyContact {
            nextRaw += 1
        }
        if let next = Step(rawValue: nextRaw) {
            step = next
        }
    }

    var isAtFirstStep: Bool { step == .email }

    /// "Last" depends on whether the preferred screen was skipped due
    /// to no contact info — in that case, .phone is effectively last.
    var isAtFunctionalLastStep: Bool {
        switch step {
        case .preferred:
            return true
        case .phone:
            return !answers.hasAnyContact && phoneField.trimmingCharacters(in: .whitespaces).isEmpty
        case .email:
            return false
        }
    }

    var availableMethodsAfterContactCapture: [PreferredContactMethod] {
        var allowed: [PreferredContactMethod] = []
        if answers.phone != nil {
            allowed.append(contentsOf: [.phone, .text])
        }
        if answers.email != nil {
            allowed.append(.email)
        }
        // Mail is always an option — falls back to the residential
        // address captured elsewhere.
        allowed.append(.mail)
        return allowed
    }
}

struct SNAPContactFlowView: View {
    @StateObject var viewModel: SNAPContactFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPContactAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPContactFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPContactAnswers) -> Void,
        onExit: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
    }

    var body: some View {
        currentScreen
            .id(viewModel.step)
            .transition(.opacity.animation(.easeInOut(duration: 0.18)))
            .civicaAnimation(.easeInOut(duration: 0.18), value: viewModel.step)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        if viewModel.isAtFirstStep {
                            onExit()
                        } else {
                            civicaWithAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
                        }
                    } label: {
                        Image(systemName: viewModel.isAtFirstStep ? "xmark" : "chevron.left")
                            .foregroundStyle(CivicaColors.ink)
                    }
                    .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .email: emailScreen
        case .phone: phoneScreen
        case .preferred: preferredScreen
        }
    }

    // MARK: - Screen 1: email

    private var emailScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .email),
            title: SNAPContactStrings.emailTitle.value(in: language),
            helper: SNAPContactStrings.emailHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: completeOrAdvance,
            secondaryActionTitle: CivicaQuestionStrings.skipLabel.value(in: language),
            onSecondary: skipOrComplete,
            language: language
        ) {
            emailField
        }
    }

    private var emailField: some View {
        TextField(
            SNAPContactStrings.emailPlaceholder.value(in: language),
            text: $viewModel.emailField
        )
        .font(CivicaTypography.cardTitle.monospacedDigit())
        .foregroundStyle(CivicaColors.ink)
        .keyboardType(.emailAddress)
        .textContentType(.emailAddress)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled(true)
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

    // MARK: - Screen 2: phone

    private var phoneScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .phone),
            title: SNAPContactStrings.phoneTitle.value(in: language),
            helper: SNAPContactStrings.phoneHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: completeOrAdvance,
            secondaryActionTitle: CivicaQuestionStrings.skipLabel.value(in: language),
            onSecondary: skipOrComplete,
            language: language
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                phoneField
                if !viewModel.phoneField.trimmingCharacters(in: .whitespaces).isEmpty {
                    tcpaConsentRow
                }
            }
        }
    }

    private var tcpaConsentBinding: Binding<Bool> {
        Binding(
            get: { viewModel.answers.tcpaConsentAt != nil },
            set: { granted in
                viewModel.answers.tcpaConsentAt = granted ? Date() : nil
                if granted {
                    SNAPAnalytics.trackTCPAConsentGranted()
                }
            }
        )
    }

    private var tcpaConsentRow: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Toggle("", isOn: tcpaConsentBinding)
                .labelsHidden()
                .tint(CivicaColors.pinePrimary)
                .accessibilityLabel(SNAPContactStrings.tcpaConsentBody.value(in: language))
            Text(SNAPContactStrings.tcpaConsentBody.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var phoneField: some View {
        TextField(
            SNAPContactStrings.phonePlaceholder.value(in: language),
            text: $viewModel.phoneField
        )
        .font(CivicaTypography.cardTitle.monospacedDigit())
        .foregroundStyle(CivicaColors.ink)
        .keyboardType(.phonePad)
        .textContentType(.telephoneNumber)
        // Format-as-you-type — raw digits become "(555) 123-4567"
        // progressively. Persistence stores whatever the user sees;
        // backend submission strips back to digits via USPhoneFormatter.
        .onChange(of: viewModel.phoneField) { _, newValue in
            let formatted = USPhoneFormatter.format(newValue)
            if formatted != newValue {
                viewModel.phoneField = formatted
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

    // MARK: - Screen 3: preferred contact method

    private var preferredScreen: some View {
        let allowed = viewModel.availableMethodsAfterContactCapture
        return CivicaQuestionScreen(
            progress: progress(for: .preferred),
            title: SNAPContactStrings.preferredTitle.value(in: language),
            helper: SNAPContactStrings.preferredHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.answers.preferredMethod != nil,
            onPrimary: { onComplete(viewModel.answers) },
            secondaryActionTitle: CivicaQuestionStrings.skipLabel.value(in: language),
            onSecondary: { onComplete(viewModel.answers) },
            language: language
        ) {
            CivicaQuestionChoices(
                options: allowed.map { SNAPContactStrings.methodLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        viewModel.answers.preferredMethod.map {
                            SNAPContactStrings.methodLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.preferredMethod = allowed.first { method in
                            SNAPContactStrings.methodLabel(for: method, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPContactFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPContactFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.contact.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.contact.title(in: language)
        )
    }

    private func completeOrAdvance() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            viewModel.recordCurrentField()
            if viewModel.isAtFunctionalLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
        }
    }

    private func skipOrComplete() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.isAtFunctionalLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.skip()
            }
        }
    }
}

// MARK: - Strings

enum SNAPContactStrings {

    static let emailTitle = CivicaText(
        "What's the best email to reach you?",
        es: "¿Cuál es el mejor correo para contactarte?",
        zh: "用哪个邮箱联系你最方便?",
        vi: "Email nào liên hệ bạn dễ nhất?",
        tl: "Anong email ang pinakamadaling pang-abot sa iyo?"
    )
    static let emailHelper = CivicaText(
        "Recommended — California's SNAP portal (BenefitsCal) requires a valid email to submit. Leaving it blank means your assister will ask you for it later. Civica only uses it to follow up about your application.",
        es: "Recomendado — el portal de SNAP de California (BenefitsCal) requiere un correo válido para enviar. Si lo dejas en blanco, tu asistente te lo pedirá después. Civica solo lo usa para hacer seguimiento a tu solicitud.",
        zh: "建议填写 — 加州的 SNAP 申请门户 (BenefitsCal) 提交时需要一个有效邮箱。留空的话,协助你的人之后还会再问你要。Civica 只会用它来跟进你的申请。",
        vi: "Nên điền — cổng SNAP của California (BenefitsCal) cần email hợp lệ để nộp hồ sơ. Nếu bỏ trống, người hỗ trợ sẽ hỏi bạn sau. Civica chỉ dùng email để theo dõi hồ sơ của bạn.",
        tl: "Inirerekomenda — kailangan ng valid na email ng SNAP portal ng California (BenefitsCal) para makapag-submit. Kapag iniwan mong blangko, hihingin ito sa iyo ng iyong assister mamaya. Ginagamit lang ito ng Civica para i-follow up ang iyong aplikasyon."
    )
    static let emailPlaceholder = CivicaText(
        "you@example.com",
        es: "tu@ejemplo.com",
        zh: "you@example.com",
        vi: "ban@vidu.com"
    )

    static let phoneTitle = CivicaText(
        "What's your phone number?",
        es: "¿Cuál es tu número de teléfono?",
        zh: "你的电话号码是多少?",
        vi: "Số điện thoại của bạn là gì?",
        tl: "Ano ang numero ng telepono mo?"
    )
    static let phoneHelper = CivicaText(
        "Optional. The state may need to reach you about your application — having a number on file makes that faster.",
        es: "Opcional. El estado puede necesitar contactarte sobre tu solicitud — tener un número a mano lo agiliza.",
        zh: "可选。州政府可能需要就你的申请联系你 — 留个号码会让流程更快。",
        vi: "Không bắt buộc. Tiểu bang có thể cần liên hệ về hồ sơ của bạn — có số điện thoại sẽ nhanh hơn.",
        tl: "Opsyonal. Maaaring kailanganin ng estado na abutin ka tungkol sa iyong aplikasyon — mas mabilis kung may numero na nakatala."
    )
    static let phonePlaceholder = CivicaText(
        "(555) 123-4567",
        es: "(555) 123-4567"
    )

    static let preferredTitle = CivicaText(
        "How would you like Civica to reach you?",
        es: "¿Cómo prefieres que Civica te contacte?",
        zh: "你希望 Civica 用哪种方式联系你?",
        vi: "Bạn muốn Civica liên hệ bằng cách nào?",
        tl: "Paano mo gustong abutin ka ng Civica?"
    )
    static let preferredHelper = CivicaText(
        "Pick whichever feels easiest. You can change this later.",
        es: "Elige la que te resulte más fácil. Puedes cambiarlo después.",
        zh: "选你觉得最方便的一种。之后随时可以改。",
        vi: "Chọn cách nào tiện nhất với bạn. Bạn có thể đổi sau.",
        tl: "Piliin kung alin ang pinakamadali para sa iyo. Pwede mo itong baguhin mamaya."
    )

    // TCPA consent copy. PENDING LEGAL REVIEW before any outbound
    // call or SMS infrastructure ships against this consent record —
    // a one-pager TCPA review by counsel is the gating step.
    static let tcpaConsentBody = CivicaText(
        "I agree to receive phone calls and text messages from Civica about my benefits application, including automated reminders. Standard message and data rates may apply. I can opt out at any time.",
        es: "Acepto recibir llamadas telefónicas y mensajes de texto de Civica sobre mi solicitud de beneficios, incluyendo recordatorios automáticos. Pueden aplicar tarifas estándar de mensajes y datos. Puedo cancelar en cualquier momento.",
        zh: "我同意接收 Civica 关于我福利申请的电话和短信,包括自动提醒。可能产生标准的短信和数据费用。我可以随时取消。",
        vi: "Tôi đồng ý nhận cuộc gọi và tin nhắn từ Civica về hồ sơ phúc lợi của tôi, bao gồm cả lời nhắc tự động. Có thể áp dụng cước tin nhắn và dữ liệu tiêu chuẩn. Tôi có thể hủy bất cứ lúc nào.",
        tl: "Pumapayag akong tumanggap ng mga tawag sa telepono at text message mula sa Civica tungkol sa aking aplikasyon sa benepisyo, kasama ang mga automated na paalala. Maaaring mag-apply ang karaniwang singil sa mensahe at data. Pwede akong mag-opt out anumang oras."
    )

    static func methodLabel(for method: PreferredContactMethod, language: CivicaLanguage) -> String {
        switch (method, language) {
        case (.phone, .english): return "Phone call"
        case (.phone, .mandarin): return "电话"
        case (.phone, .spanish): return "Llamada telefónica"
        case (.phone, .vietnamese): return "Cuộc gọi điện thoại"
        case (.phone, .tagalog): return "Tawag sa telepono"
        case (.text, .english):  return "Text message"
        case (.text, .mandarin): return "短信"
        case (.text, .spanish):  return "Mensaje de texto"
        case (.text, .vietnamese): return "Tin nhắn văn bản"
        case (.text, .tagalog): return "Text message"
        case (.email, .english): return "Email"
        case (.email, .mandarin): return "电子邮件"
        case (.email, .spanish): return "Correo electrónico"
        case (.email, .vietnamese): return "Email"
        case (.email, .tagalog): return "Email"
        case (.mail, .english):  return "Mail"
        case (.mail, .mandarin): return "邮寄"
        case (.mail, .spanish):  return "Correo postal"
        case (.mail, .vietnamese): return "Thư bưu điện"
        case (.mail, .tagalog): return "Sulat sa koreo"
        }
    }
}

#if DEBUG
struct SNAPContactFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPContactFlowView(
                viewModel: SNAPContactFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
