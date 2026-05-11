import CivicaDesignSystem
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

    init(answers: SNAPContactAnswers = .init()) {
        self.answers = answers
        // Seed transient text fields from prior answers so the user
        // sees their saved email / phone on resume + edit.
        self.emailField = answers.email ?? ""
        self.phoneField = answers.phone ?? ""
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
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        viewModel.isAtFirstStep ? onExit() : viewModel.goBack()
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
            phoneField
        }
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
        .init(current: step.oneBasedIndex, total: SNAPContactFlowViewModel.Step.total)
    }

    private func completeOrAdvance() {
        viewModel.recordCurrentField()
        if viewModel.isAtFunctionalLastStep {
            onComplete(viewModel.answers)
        } else {
            viewModel.advance()
        }
    }

    private func skipOrComplete() {
        if viewModel.isAtFunctionalLastStep {
            onComplete(viewModel.answers)
        } else {
            viewModel.skip()
        }
    }
}

// MARK: - Strings

enum SNAPContactStrings {

    static let emailTitle = CivicaText(
        "What's the best email to reach you?",
        es: "¿Cuál es el mejor correo para contactarte?"
    )
    static let emailHelper = CivicaText(
        "Optional. Civica only uses this to follow up about your application — we never share it.",
        es: "Opcional. Civica solo lo usa para hacer seguimiento a tu solicitud — nunca lo compartimos."
    )
    static let emailPlaceholder = CivicaText(
        "you@example.com",
        es: "tu@ejemplo.com"
    )

    static let phoneTitle = CivicaText(
        "What's your phone number?",
        es: "¿Cuál es tu número de teléfono?"
    )
    static let phoneHelper = CivicaText(
        "Optional. The state may need to reach you about your application — having a number on file makes that faster.",
        es: "Opcional. El estado puede necesitar contactarte sobre tu solicitud — tener un número a mano lo agiliza."
    )
    static let phonePlaceholder = CivicaText(
        "(555) 123-4567",
        es: "(555) 123-4567"
    )

    static let preferredTitle = CivicaText(
        "How would you like Civica to reach you?",
        es: "¿Cómo prefieres que Civica te contacte?"
    )
    static let preferredHelper = CivicaText(
        "Pick whichever feels easiest. You can change this later.",
        es: "Elige la que te resulte más fácil. Puedes cambiarlo después."
    )

    static func methodLabel(for method: PreferredContactMethod, language: CivicaLanguage) -> String {
        switch (method, language) {
        case (.phone, .english): return "Phone call"
        case (.phone, .spanish): return "Llamada telefónica"
        case (.text, .english):  return "Text message"
        case (.text, .spanish):  return "Mensaje de texto"
        case (.email, .english): return "Email"
        case (.email, .spanish): return "Correo electrónico"
        case (.mail, .english):  return "Mail"
        case (.mail, .spanish):  return "Correo postal"
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
