import CivicaDesignSystem
import SwiftUI

/// Step-by-step intake wizard for SNAP applicants without a written lease.
///
/// Drives the 11-question informal housing question bank from
/// `packages/snap-rules/src/informal-housing/questions.ts`, mirrored in
/// `InformalHousingModels.swift`. Questions are shown one at a time;
/// branching is evaluated on every answer so the sequence adapts to the
/// applicant's situation. The DV shelter path is never asked for location
/// or address — the question bank already omits those keys, and this view
/// renders a visible safety banner when `dv_shelter` is selected.
///
/// On completion the answers are POSTed to the enrollment API via
/// `EnrollmentAPIClient.submitInformalHousingAnswers(packetId:answers:)`.
/// The wizard is designed to be presented as a sheet from the enrollment flow.
///
/// Usage:
/// ```swift
/// .sheet(isPresented: $showHousingWizard) {
///     InformalHousingWizardView(
///         packetId: activePacketId,
///         apiClient: enrollmentAuth.makeEnrollmentAPIClient()
///     )
/// }
/// ```
struct InformalHousingWizardView: View {

    let packetId: String
    let apiClient: (any EnrollmentAPIClient)?

    init(
        packetId: String = "",
        apiClient: (any EnrollmentAPIClient)? = nil
    ) {
        self.packetId = packetId
        self.apiClient = apiClient
    }

    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    // MARK: - Wizard state

    /// Current answers keyed by question.key.
    @State private var answers: [String: String] = [:]

    /// Index into the current visible question sequence.
    @State private var currentIndex: Int = 0

    /// Tracks multi-select toggles for the active question.
    @State private var multiSelectBuffer: Set<String> = []

    /// Text/currency/name input value for the active question.
    @State private var textBuffer: String = ""

    @State private var isSubmitting = false
    @State private var submitError: String?
    @State private var isComplete = false

    // MARK: - Derived

    private var visibleQuestions: [IHQuestion] {
        IHQuestionBank.visibleQuestions(for: answers)
    }

    private var currentQuestion: IHQuestion? {
        guard currentIndex < visibleQuestions.count else { return nil }
        return visibleQuestions[currentIndex]
    }

    private var totalSteps: Int { visibleQuestions.count }

    private var progressFraction: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(currentIndex) / Double(totalSteps)
    }

    private var isLastQuestion: Bool {
        currentIndex == visibleQuestions.count - 1
    }

    /// True when the current question has a non-empty answer ready to commit.
    private var canAdvance: Bool {
        guard let q = currentQuestion else { return false }
        switch q.kind {
        case .multiSelect:
            return !multiSelectBuffer.isEmpty
        case .text, .personName, .money:
            return !textBuffer.trimmingCharacters(in: .whitespaces).isEmpty
        case .singleSelect, .boolean:
            return answers[q.key] != nil
        }
    }

    /// True when the current soft question can be skipped.
    private var canSkip: Bool {
        guard let q = currentQuestion else { return false }
        return !q.required
    }

    private var isDVShelter: Bool {
        answers["ih_arrangement"] == "dv_shelter"
    }

    private var detectedArrangement: IHArrangementKind? {
        guard let raw = answers["ih_arrangement"] else { return nil }
        return IHArrangementKind(rawValue: raw)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Group {
                if isComplete {
                    completionScreen
                } else {
                    wizardContent
                }
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(InformalHousingStrings.pageTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if currentIndex == 0 && !isComplete {
                        Button(InformalHousingStrings.cancelButton.value(in: language)) {
                            dismiss()
                        }
                        .foregroundStyle(CivicaColors.pinePrimary)
                    } else if !isComplete {
                        Button {
                            goBack()
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                    .imageScale(.small)
                                Text(InformalHousingStrings.backButton.value(in: language))
                            }
                            .foregroundStyle(CivicaColors.pinePrimary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Wizard content

    private var wizardContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                progressBar
                if isDVShelter {
                    dvSafetyBanner
                }
                if let question = currentQuestion {
                    questionCard(question)
                }
                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .safeAreaInset(edge: .bottom) {
            navigationButtons
                .padding(CivicaSpacing.xl)
                .background(CivicaColors.paper)
        }
        .onChange(of: currentIndex) { _, _ in syncBuffers() }
        .onAppear { syncBuffers() }
    }

    // MARK: - Progress bar

    private var progressBar: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(InformalHousingStrings.stepOf(currentIndex + 1, of: max(totalSteps, 1), language: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityLabel(InformalHousingStrings.progressBarLabel.value(in: language))

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(CivicaColors.hairline)
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(CivicaColors.pinePrimary)
                        .frame(width: max(geo.size.width * progressFraction, 8), height: 4)
                        .civicaAnimation(CivicaAnimation.slow, value: progressFraction)
                }
            }
            .frame(height: 4)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(
            InformalHousingStrings.stepOf(currentIndex + 1, of: max(totalSteps, 1), language: language)
        )
    }

    // MARK: - DV safety banner

    private var dvSafetyBanner: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "lock.shield.fill")
                    .foregroundStyle(CivicaColors.pinePrimary)
                Text(InformalHousingStrings.dvSafetyTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
            }
            Text(InformalHousingStrings.dvSafetyBody.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.pinePrimary.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.pinePrimary.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Question card

    private func questionCard(_ question: IHQuestion) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            // Prompt + optional helper
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(question.prompt)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)

                if let helper = question.helper {
                    Text(helper)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            // Input renderer by kind
            switch question.kind {
            case .singleSelect, .boolean:
                singleSelectRenderer(question)
            case .multiSelect:
                multiSelectRenderer(question)
            case .money:
                currencyRenderer(question)
            case .text, .personName:
                textRenderer(question)
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Single-select renderer

    @ViewBuilder
    private func singleSelectRenderer(_ question: IHQuestion) -> some View {
        VStack(spacing: CivicaSpacing.sm) {
            ForEach(question.options) { option in
                let isSelected = answers[question.key] == option.value
                Button {
                    // Tap immediately commits answer and advances if it's a leaf
                    answers[question.key] = option.value
                    // Re-evaluate branches: reset downstream answers that no longer apply
                    pruneStaleAnswers(afterChanging: question.key)
                } label: {
                    HStack {
                        Text(option.label)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                        if isSelected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(CivicaColors.pinePrimary)
                                .accessibilityLabel(InformalHousingStrings.optionSelectedHint.value(in: language))
                        } else {
                            Circle()
                                .strokeBorder(CivicaColors.graphite.opacity(0.4), lineWidth: 1.5)
                                .frame(width: 22, height: 22)
                        }
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        isSelected
                            ? CivicaColors.pinePrimary.opacity(0.07)
                            : CivicaColors.surfacePrimary
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .stroke(
                                isSelected ? CivicaColors.pinePrimary : CivicaColors.hairline,
                                lineWidth: isSelected ? 1.5 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
    }

    // MARK: - Multi-select renderer

    @ViewBuilder
    private func multiSelectRenderer(_ question: IHQuestion) -> some View {
        VStack(spacing: CivicaSpacing.sm) {
            ForEach(question.options) { option in
                let isChecked = multiSelectBuffer.contains(option.value)
                Button {
                    if isChecked {
                        multiSelectBuffer.remove(option.value)
                    } else {
                        multiSelectBuffer.insert(option.value)
                    }
                } label: {
                    HStack(alignment: .top, spacing: CivicaSpacing.md) {
                        Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                            .foregroundStyle(
                                isChecked ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.5)
                            )
                            .imageScale(.large)
                            .font(.body)
                            .frame(width: 28, alignment: .center)

                        Text(option.label)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)

                        Spacer()
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        isChecked
                            ? CivicaColors.pinePrimary.opacity(0.07)
                            : CivicaColors.surfacePrimary
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .stroke(
                                isChecked ? CivicaColors.pinePrimary : CivicaColors.hairline,
                                lineWidth: isChecked ? 1.5 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(isChecked ? [.isSelected] : [])
            }
        }
    }

    // MARK: - Currency renderer

    @ViewBuilder
    private func currencyRenderer(_ question: IHQuestion) -> some View {
        HStack(spacing: CivicaSpacing.sm) {
            Text("$")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)

            TextField(InformalHousingStrings.dollarPlaceholder.value(in: language), text: $textBuffer)
                .keyboardType(.decimalPad)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Text / name renderer

    @ViewBuilder
    private func textRenderer(_ question: IHQuestion) -> some View {
        TextField("", text: $textBuffer)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.ink)
            .autocorrectionDisabled(question.kind == .personName)
            .textContentType(question.kind == .personName ? .name : .none)
            .padding(CivicaSpacing.md)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
    }

    // MARK: - Navigation buttons

    private var navigationButtons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            if let error = submitError {
                Text(error)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: CivicaSpacing.md) {
                // Skip button (soft questions only)
                if canSkip, let q = currentQuestion, answers[q.key] == nil {
                    Button(InformalHousingStrings.skipButton.value(in: language)) {
                        advanceWithoutAnswer()
                    }
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 56)
                    .background(CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
                }

                if isLastQuestion {
                    submitButton
                } else {
                    nextButton
                }
            }
        }
    }

    private var nextButton: some View {
        Button {
            commitAndAdvance()
        } label: {
            Text(InformalHousingStrings.nextButton.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 56)
        }
        .background(canAdvance ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        .disabled(!canAdvance)
    }

    private var submitButton: some View {
        let validation = IHQuestionBank.validate(answers: answers)
        let ready = validation.isComplete && !isSubmitting

        return Button {
            commitCurrentAnswer()
            Task { await submit() }
        } label: {
            Group {
                if isSubmitting {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(CivicaColors.onPrimaryText)
                } else {
                    Text(InformalHousingStrings.submitButton.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                }
            }
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
        }
        .background(ready ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        .disabled(!ready)
    }

    // MARK: - Completion screen

    private var completionScreen: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                completionHeader
                if let kind = detectedArrangement {
                    shelterEffectCard(kind.shelterEffect)
                }
                doneButton
                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var completionHeader: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(CivicaColors.pinePrimary)
                Text(InformalHousingStrings.completeTitle.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(InformalHousingStrings.completeSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func shelterEffectCard(_ effect: IHShelterEffect) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {

            if let kind = detectedArrangement {
                effectRow(
                    label: InformalHousingStrings.arrangementLabel.value(in: language),
                    value: kind.displayLabel,
                    icon: "house.fill"
                )
                Divider()
            }

            effectRow(
                label: InformalHousingStrings.homelessDeductionLabel.value(in: language),
                value: effect.homelessDeductionEligible
                    ? InformalHousingStrings.homelessDeductionEligible.value(in: language)
                    : InformalHousingStrings.homelessDeductionNotEligible.value(in: language),
                icon: effect.homelessDeductionEligible ? "checkmark.circle.fill" : "minus.circle",
                valueColor: effect.homelessDeductionEligible ? CivicaColors.pinePrimary : CivicaColors.graphite
            )

            Divider()

            effectRow(
                label: InformalHousingStrings.hasShelterCostLabel.value(in: language),
                value: effect.hasShelterCost
                    ? InformalHousingStrings.hasShelterCostYes.value(in: language)
                    : InformalHousingStrings.hasShelterCostNo.value(in: language),
                icon: effect.hasShelterCost ? "dollarsign.circle.fill" : "dollarsign.circle",
                valueColor: effect.hasShelterCost ? CivicaColors.ink : CivicaColors.graphite
            )

            Divider()

            effectRow(
                label: InformalHousingStrings.suaLabel.value(in: language),
                value: effect.suaEligible
                    ? InformalHousingStrings.suaEligible.value(in: language)
                    : InformalHousingStrings.suaNotEligible.value(in: language),
                icon: "bolt.fill",
                valueColor: effect.suaEligible ? CivicaColors.pinePrimary : CivicaColors.graphite
            )

            Divider()

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(InformalHousingStrings.navigatorNoteLabel.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(0.8)
                Text(effect.note)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func effectRow(
        label: String,
        value: String,
        icon: String,
        valueColor: Color = CivicaColors.ink
    ) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .foregroundStyle(valueColor)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.graphite)
                Text(value)
                    .font(CivicaTypography.body)
                    .foregroundStyle(valueColor)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
    }

    private var doneButton: some View {
        Button {
            dismiss()
        } label: {
            Text(InformalHousingStrings.doneButton.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 56)
        }
        .background(CivicaColors.pinePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
    }

    // MARK: - Navigation logic

    /// Commit the current answer from the buffer and advance to the next step.
    private func commitAndAdvance() {
        commitCurrentAnswer()
        advanceIndex()
    }

    /// Advance without recording an answer (skip a soft question).
    private func advanceWithoutAnswer() {
        advanceIndex()
    }

    private func advanceIndex() {
        let nextVisible = IHQuestionBank.visibleQuestions(for: answers)
        let nextIndex = currentIndex + 1
        if nextIndex < nextVisible.count {
            currentIndex = nextIndex
        }
        // If we've walked past all visible questions, check if complete
        if IHQuestionBank.nextUnanswered(for: answers) == nil {
            // All required answers are in — ready to submit (last question already committed)
        }
    }

    private func commitCurrentAnswer() {
        guard let q = currentQuestion else { return }
        switch q.kind {
        case .multiSelect:
            if !multiSelectBuffer.isEmpty {
                answers[q.key] = multiSelectBuffer.sorted().joined(separator: ",")
            }
        case .text, .personName, .money:
            let trimmed = textBuffer.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                answers[q.key] = trimmed
            }
        case .singleSelect, .boolean:
            // Already committed on tap; nothing to do here
            break
        }
    }

    private func goBack() {
        guard currentIndex > 0 else { return }
        currentIndex -= 1
    }

    /// When the root `ih_arrangement` changes, clear all downstream answers whose
    /// `show_when` condition is no longer satisfied, so stale data doesn't linger.
    private func pruneStaleAnswers(afterChanging key: String) {
        guard key == "ih_arrangement" else { return }
        let updated = answers
        for q in IHQuestionBank.all where q.key != "ih_arrangement" {
            guard let condition = q.showWhen else { continue }
            if !condition.isSatisfied(by: updated) {
                answers.removeValue(forKey: q.key)
            }
        }
        // Reset multi-select buffer since the next question may have changed
        multiSelectBuffer = []
        textBuffer = ""
    }

    /// Sync the text/multi-select buffers to match any pre-existing answer
    /// for the question we just navigated to (supports back-navigation editing).
    private func syncBuffers() {
        guard let q = currentQuestion else { return }
        switch q.kind {
        case .multiSelect:
            if let stored = answers[q.key], !stored.isEmpty {
                multiSelectBuffer = Set(stored.split(separator: ",").map(String.init))
            } else {
                multiSelectBuffer = []
            }
        case .text, .personName, .money:
            textBuffer = answers[q.key] ?? ""
        case .singleSelect, .boolean:
            break
        }
    }

    // MARK: - Submit

    private func submit() async {
        guard let api = apiClient else { return }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        // Build answer payload from current answers × visible question labels
        let questionsByKey = Dictionary(
            uniqueKeysWithValues: IHQuestionBank.all.map { ($0.key, $0) }
        )
        let payload = IHSubmitRequest(
            answers: answers.compactMap { key, value in
                guard let q = questionsByKey[key] else { return nil }
                return IHSubmitRequest.Answer(
                    question_key: key,
                    question_label: q.prompt,
                    applicant_answer: value
                )
            }
            .sorted { $0.question_key < $1.question_key }
        )

        do {
            try await api.submitInformalHousingAnswers(packetId: packetId, answers: payload)
            isComplete = true
        } catch {
            submitError = InformalHousingStrings.submitError.value(in: language)
                + " (\(error.localizedDescription))"
        }
    }
}

// MARK: - Concrete EnrollmentAPIClient implementations
//
// The protocol requirement + default no-op live in EnrollmentAPIClient.swift.
// HTTP and mock overrides are here, co-located with the wizard that calls them.

extension HTTPEnrollmentAPIClient {
    func submitInformalHousingAnswers(
        packetId: String,
        answers: IHSubmitRequest
    ) async throws {
        // POST /v1/enrollment/me/packets/:packetId/informal-housing-answers
        // Inlines the HTTP pattern from the private `post` helper — the helper
        // is private to HTTPEnrollmentAPIClient so we replicate it here.
        guard let token = await tokenProvider() else {
            throw EnrollmentAPIError.unauthenticated
        }
        guard let url = URL(
            string: "/me/packets/\(packetId)/informal-housing-answers",
            relativeTo: baseURL
        ) else {
            throw EnrollmentAPIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(answers)
        let (_, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse,
           !(200..<300).contains(http.statusCode) {
            throw EnrollmentAPIError.unexpectedStatus(http.statusCode, body: "")
        }
    }
}

extension MockEnrollmentAPIClient {
    func submitInformalHousingAnswers(
        packetId: String,
        answers: IHSubmitRequest
    ) async throws {
        if shouldFailNext {
            shouldFailNext = false
            throw EnrollmentAPIError.unexpectedStatus(500, body: "mock error")
        }
        // No-op in mock; answers are discarded.
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Wizard — empty") {
    InformalHousingWizardView()
}

#Preview("Wizard — with mock client") {
    InformalHousingWizardView(
        packetId: "mock-packet-123",
        apiClient: MockEnrollmentAPIClient()
    )
}

#Preview("Wizard — Spanish") {
    InformalHousingWizardView(
        packetId: "mock-packet-123",
        apiClient: MockEnrollmentAPIClient()
    )
    .onAppear {
        UserDefaults.standard.set(
            CivicaLanguage.spanish.rawValue,
            forKey: CivicaLanguage.defaultStorageKey
        )
    }
}
#endif
