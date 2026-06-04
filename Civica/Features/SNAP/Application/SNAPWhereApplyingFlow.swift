import CivicaDesignSystem
import Combine
import SwiftUI

// Migrates the legacy "whereApplyingFromStep" multi-field card from
// SNAPApplicationView into the one-question-per-screen cadence.
// Two sequential screens — state, then housing status — using the
// CivicaQuestionScreen primitive.
//
// Ordering rationale: state gates every downstream rules-engine call
// (federal-only vs federal + MA-specific BBCE / shelter standard).
// Housing status changes the deduction picture (unhoused vs stable
// home affects the homeless shelter deduction).
//
// Not wired into SNAPRouter yet — the legacy multi-field flow
// remains the active path until all 8 legacy steps are migrated
// and the router cuts over in one switch commit.

struct SNAPWhereApplyingAnswers: Equatable, Codable {
    /// Two-letter US state code ("MA", "NY", etc.) or "OTHER" when
    /// the user selected a state Civica doesn't tune for yet.
    var stateCode: String?
    var housingStatus: HousingStatus?
    /// County name within the active state, when known. CalFresh
    /// is county-administered: the right hotline, the right office,
    /// and the right Restaurant Meals Program participation all
    /// depend on county. Derived by zip-code lookup
    /// (`CACountyResolver.county(forZIP:)` etc.) at the point the
    /// user enters a ZIP, then persisted here so downstream surfaces
    /// don't re-resolve. Free-form string so future states can use
    /// their own naming (e.g. "Suffolk", "Los Angeles", "San Mateo").
    var county: String?

    var isComplete: Bool { stateCode != nil && housingStatus != nil }
}

@MainActor
final class SNAPWhereApplyingFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case state, housing

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .state
    @Published var answers: SNAPWhereApplyingAnswers

    /// Per-change write-back closure (issue #425). See
    /// SNAPHouseholdQuestionFlowViewModel for the canonical comment.
    var onAnswersChange: ((SNAPWhereApplyingAnswers) -> Void)?
    private var answersWatch: AnyCancellable?

    init(
        answers: SNAPWhereApplyingAnswers = .init(),
        onAnswersChange: ((SNAPWhereApplyingAnswers) -> Void)? = nil
    ) {
        self.answers = answers
        self.onAnswersChange = onAnswersChange
        self.answersWatch = $answers.dropFirst().sink { [weak self] new in
            self?.onAnswersChange?(new)
        }
    }

    func advance() {
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .state:   return answers.stateCode != nil
        case .housing: return answers.housingStatus != nil
        }
    }

    var isAtFirstStep: Bool { step == .state }
    var isAtLastStep: Bool { step == .housing }
}

struct SNAPWhereApplyingFlowView: View {
    @StateObject var viewModel: SNAPWhereApplyingFlowViewModel
    /// Geo-suggester for the state question. Asks for while-using
    /// location permission lazily on first appearance of the state
    /// screen, then reverse-geocodes to derive the user's state. The
    /// suggestion renders as a one-tap token above the picker; the
    /// picker itself still works fully if the user declines or the
    /// suggestion can't be resolved.
    @StateObject private var stateSuggester = SNAPStateSuggester()
    let language: CivicaLanguage
    let onComplete: (SNAPWhereApplyingAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPWhereApplyingFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPWhereApplyingAnswers) -> Void,
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
        case .state: stateScreen
        case .housing: housingScreen
        }
    }

    // MARK: - Screen 1: state

    private var stateScreen: some View {
        let options = SNAPWhereApplyingStrings.stateOptionsOrdered(language: language)
        return CivicaQuestionScreen(
            progress: progress(for: .state),
            title: SNAPWhereApplyingStrings.stateTitle.value(in: language),
            helper: SNAPWhereApplyingStrings.stateHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                if let stateName = stateSuggester.suggestedStateName,
                   let stateCode = stateSuggester.suggestedStateCode {
                    SNAPStateSuggestionToken(
                        stateName: stateName,
                        isAlreadySelected: viewModel.answers.stateCode == stateCode,
                        language: language,
                        onTap: {
                            civicaWithAnimation(.easeInOut(duration: 0.18)) {
                                viewModel.answers.stateCode = stateCode
                            }
                        }
                    )
                }
                CivicaQuestionChoices(
                    options: options.map(\.label),
                    selection: Binding(
                        get: {
                            options.first(where: { $0.code == viewModel.answers.stateCode })?.label
                        },
                        set: { label in
                            viewModel.answers.stateCode = options.first(where: { $0.label == label })?.code
                        }
                    )
                )
            }
        }
        .onAppear { stateSuggester.start() }
    }

    // MARK: - Screen 2: housing status

    private var housingScreen: some View {
        let options = HousingStatus.allCases
        return CivicaQuestionScreen(
            progress: progress(for: .housing),
            title: SNAPWhereApplyingStrings.housingTitle.value(in: language),
            helper: SNAPWhereApplyingStrings.housingHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPWhereApplyingStrings.housingLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        viewModel.answers.housingStatus.map {
                            SNAPWhereApplyingStrings.housingLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.housingStatus = options.first { option in
                            SNAPWhereApplyingStrings.housingLabel(for: option, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPWhereApplyingFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPWhereApplyingFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.whereApplying.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.whereApplying.title(in: language)
        )
    }

    private func advanceOrComplete() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.isAtLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
        }
    }
}

// MARK: - Suggestion token

/// Pine-tinted pill above the state picker. Renders the resolved
/// state from `SNAPStateSuggester` with a "Use this" CTA; once the
/// user taps (or the picker matches), the pill flips to a quieter
/// "Pre-filled" affirmation rather than disappearing, so it never
/// looks like the suggestion was lost.
struct SNAPStateSuggestionToken: View {
    let stateName: String
    let isAlreadySelected: Bool
    let language: CivicaLanguage
    let onTap: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: CivicaSpacing.sm) {
            Image(systemName: isAlreadySelected ? "checkmark.circle.fill" : "location.fill")
                .imageScale(.medium)
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            Text(
                isAlreadySelected
                    ? SNAPWhereApplyingStrings.suggestionTokenSelected(stateName: stateName, language: language)
                    : SNAPWhereApplyingStrings.suggestionTokenLooksLike(stateName: stateName, language: language)
            )
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.ink)
            .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            if !isAlreadySelected {
                Button(SNAPWhereApplyingStrings.suggestionTokenCTA.value(in: language)) {
                    onTap()
                }
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityLabel(
                    SNAPWhereApplyingStrings.suggestionTokenLooksLike(stateName: stateName, language: language)
                )
            }
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .fill(CivicaColors.pinePrimary.opacity(0.10))
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.pinePrimary.opacity(0.22), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            // Tap anywhere on the pill (not just the CTA) flips the
            // selection — bigger hit target for one-handed entry.
            if !isAlreadySelected { onTap() }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Strings

enum SNAPWhereApplyingStrings {

    static let stateTitle = CivicaText(
        "Which state are you applying in?",
        es: "¿En qué estado estás solicitando?",
        zh: "你在哪个州申请?",
        vi: "Bạn đang nộp đơn ở tiểu bang nào?",
        tl: "Saang estado ka nag-a-apply?"
    )
    // State-neutral helper. Earlier copy named Massachusetts
    // specifically, which became wrong once California and New York
    // ship their own tuned packets. The neutral version respects every
    // supported state equally and just explains the why.
    static let stateHelper = CivicaText(
        "SNAP rules and timelines vary by state. Pick the state where you're applying so the rest of the application fits your situation.",
        es: "Las reglas y plazos de SNAP varían según el estado. Elige el estado donde estás solicitando para que el resto de la solicitud se ajuste a tu situación.",
        zh: "SNAP 的规则和时间安排因州而异。选择你申请所在的州,这样后面的申请内容才能贴合你的情况。",
        vi: "Quy định và thời hạn của SNAP khác nhau tùy tiểu bang. Hãy chọn tiểu bang nơi bạn đang nộp đơn để phần còn lại của đơn phù hợp với hoàn cảnh của bạn.",
        tl: "Iba-iba ang mga panuntunan at timeline ng SNAP depende sa estado. Piliin ang estado kung saan ka nag-a-apply para tumugma sa sitwasyon mo ang natitirang bahagi ng aplikasyon."
    )

    /// Geo-suggestion token copy. The state name is interpolated at the
    /// call site; the surrounding sentence respects EN+ES parity.
    static func suggestionTokenLooksLike(stateName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Looks like you're in \(stateName)"
        case .mandarin: return "看起来你在 \(stateName)"
        case .spanish: return "Parece que estás en \(stateName)"
        case .vietnamese: return "Có vẻ như bạn đang ở \(stateName)"
        case .tagalog: return "Mukhang nasa \(stateName) ka"
        }
    }

    /// Confirmation copy once the suggestion is selected. Same string
    /// shape so the token can stay in place after tap as a stable
    /// "yes, we got you" affirmation rather than disappearing.
    static func suggestionTokenSelected(stateName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Pre-filled \(stateName) — change above if needed"
        case .mandarin: return "已预填 \(stateName) — 如需更改,请在上方修改"
        case .spanish: return "\(stateName) pre-seleccionado — cámbialo arriba si es necesario"
        case .vietnamese: return "Đã điền sẵn \(stateName) — thay đổi ở trên nếu cần"
        case .tagalog: return "Naka-pre-fill na ang \(stateName) — palitan sa itaas kung kailangan"
        }
    }

    static let suggestionTokenCTA = CivicaText(
        "Use this",
        es: "Usar esto",
        zh: "使用这个",
        vi: "Dùng cái này",
        tl: "Gamitin ito"
    )

    struct StateOption: Equatable {
        let code: String
        let label: String
    }

    /// MA first because Civica is MA-tuned. The "Another US state"
    /// row collapses the remaining 49 — refined to full state pickers
    /// once we add per-state rules engines.
    static func stateOptionsOrdered(language: CivicaLanguage) -> [StateOption] {
        switch language {
        case .english:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "New York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Another US state")
            ]
        case .tagalog:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "New York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Ibang estado sa US")
            ]
        case .vietnamese:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "New York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Tiểu bang khác của Hoa Kỳ")
            ]
        case .mandarin:
            return [
                .init(code: "MA", label: "马萨诸塞州"),
                .init(code: "NY", label: "纽约州"),
                .init(code: "CA", label: "加利福尼亚州"),
                .init(code: "OTHER", label: "美国其他州")
            ]
        case .spanish:
            return [
                .init(code: "MA", label: "Massachusetts"),
                .init(code: "NY", label: "Nueva York"),
                .init(code: "CA", label: "California"),
                .init(code: "OTHER", label: "Otro estado de EE. UU.")
            ]
        }
    }

    static let housingTitle = CivicaText(
        "How would you describe your housing right now?",
        es: "¿Cómo describirías tu vivienda en este momento?",
        zh: "你现在的住房情况怎么描述?",
        vi: "Bạn mô tả tình trạng nhà ở của mình ngay lúc này như thế nào?",
        tl: "Paano mo ilalarawan ang tirahan mo ngayon?"
    )
    static let housingHelper = CivicaText(
        "This shapes which SNAP deductions can apply. It doesn't disqualify anyone.",
        es: "Esto afecta qué deducciones de SNAP pueden aplicarse. No descalifica a nadie.",
        zh: "这会影响哪些 SNAP 扣除项可以适用。不会让任何人失去资格。",
        vi: "Điều này quyết định những khoản khấu trừ SNAP nào có thể áp dụng. Nó không loại ai khỏi điều kiện cả.",
        tl: "Nakakaapekto ito sa kung aling mga SNAP deduction ang puwedeng mag-apply. Hindi nito tinatanggalan ng kuwalipikasyon ang sinuman."
    )

    static func housingLabel(for status: HousingStatus, language: CivicaLanguage) -> String {
        switch (status, language) {
        case (.stableHome, .english):         return "Stable home"
        case (.stableHome, .mandarin):         return "稳定的住所"
        case (.stableHome, .spanish):         return "Hogar estable"
        case (.stableHome, .vietnamese):         return "Nhà ở ổn định"
        case (.stableHome, .tagalog):         return "May matatag na tirahan"
        case (.temporaryHousing, .english):   return "Temporary housing"
        case (.temporaryHousing, .mandarin):   return "临时住房"
        case (.temporaryHousing, .spanish):   return "Vivienda temporal"
        case (.temporaryHousing, .vietnamese):   return "Nhà ở tạm thời"
        case (.temporaryHousing, .tagalog):   return "Pansamantalang tirahan"
        case (.stayingWithOthers, .english):  return "Staying with someone else"
        case (.stayingWithOthers, .mandarin):  return "和别人住在一起"
        case (.stayingWithOthers, .spanish):  return "Quedándome con alguien"
        case (.stayingWithOthers, .vietnamese):  return "Đang ở nhờ người khác"
        case (.stayingWithOthers, .tagalog):  return "Nakikitira sa iba"
        case (.unhoused, .english):           return "Unhoused right now"
        case (.unhoused, .mandarin):           return "目前没有住所"
        case (.unhoused, .spanish):           return "Sin hogar en este momento"
        case (.unhoused, .vietnamese):           return "Hiện không có nhà ở"
        case (.unhoused, .tagalog):           return "Walang tirahan sa ngayon"
        }
    }
}

#if DEBUG
struct SNAPWhereApplyingFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPWhereApplyingFlowView(
                viewModel: SNAPWhereApplyingFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
