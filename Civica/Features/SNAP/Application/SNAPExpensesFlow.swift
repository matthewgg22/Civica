import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "expensesStep" multi-field card. Captures the
// four dollar fields that affect SNAP deductions:
//
//   • Rent / housing payment
//   • Utilities (electricity, heat, gas, water, phone)
//   • Childcare costs (dependent-care deduction)
//   • Out-of-pocket medical costs (medical deduction for 60+ /
//     disabled members)
//
// All four are technically optional from a flow perspective —
// leaving a screen blank means "$0," which is a valid answer (an
// unhoused applicant has $0 rent). The rules engine treats empty
// as $0 and skips the corresponding deduction. The helper copy on
// each screen names what counts so users don't have to guess.

struct SNAPExpensesAnswers: Equatable, Codable {
    var monthlyRentOrHousing: Decimal?

    // T16 — Gap #1/#2/#3: Per-utility intake replaces the single Bool.
    //
    // selectedUtilities drives SUA tier determination. An empty set means
    // utilities are included in rent (or the household has none), which
    // maps to SUATier.none → zero SUA deduction in the calculator.
    //
    // paysUtilitiesSeparately is now a computed property (Bool, not Bool?)
    // so all downstream callers (document checklist, rules engine key
    // lookup, voice extraction) keep working without modification.
    var selectedUtilities: Set<UtilityType> = []

    /// Computed SUA tier from the selected utility types.
    /// Feeds directly into SNAPBenefitCalculator — the calculator reads
    /// this instead of defaulting to .heatingCooling.
    var suaTier: SUATier { SUATier.determineTier(for: selectedUtilities) }

    /// Backward-compatible computed property: true when any utility
    /// type is selected. Replaces the stored Bool? — all callers that
    /// previously read `paysUtilitiesSeparately == true` continue to
    /// work unchanged (Bool is == comparable without Optional unwrap).
    var paysUtilitiesSeparately: Bool { !selectedUtilities.isEmpty }

    /// Actual monthly dollar spend across all selected utilities.
    /// Used as the lower bound in the SUA substitution: the calculator
    /// takes max(monthlyUtilities, suaValue) so a low reported amount
    /// never penalises a household that qualifies for a higher SUA tier.
    /// Kept as `monthlyUtilities` (not renamed) to avoid breaking voice
    /// extraction and other callers.
    var monthlyUtilities: Decimal?

    /// Whether the household has received a utility-shutoff notice —
    /// a strong soft signal for expedited need, asked right after
    /// utilities cost while the user is in that frame of mind.
    var utilityShutoffNotice: SNAPTri?

    // T16 Gap #4: Shared housing pro-rate.
    //
    // CCC students frequently share apartments with roommates who are NOT
    // on their SNAP case. The lease shows total rent (e.g. $1,600 for a
    // 4-person apartment) but SNAP counts only the applicant's pro-rated
    // share ($400). Without this question, Civica over-states shelter cost
    // by up to 4x — a direct QC error source.
    //
    // When sharedHousingOccupants is set (>1), the calculator divides
    // monthlyRentOrHousing by the total occupant count. Setting it to 1
    // (or leaving it nil) means the full rent is counted — correct for
    // solo renters or households where all members are on the SNAP case.
    var sharedHousingOccupants: Int?   // nil = not shared / all on case

    var monthlyChildcare: Decimal?
    var monthlyMedical: Decimal?

    // Wave 3 — Court-ordered support deductions (BenefitsCal ABCOC + ABSSQ).
    //
    // SNAP deducts court-ordered child support and spousal support paid
    // OUTSIDE the household from gross income (7 CFR 273.9(d)(5)). An
    // applicant paying $400/mo court-ordered child support to an ex
    // partner currently gets a worse benefit estimate from Civica
    // because we never asked. New Y/N gate (`paysCourtOrderedSupport`)
    // branches into two amount fields when affirmative.
    var paysCourtOrderedSupport: SNAPTri?
    var monthlyChildSupportPaid: Decimal?
    var monthlySpousalSupportPaid: Decimal?
}

@MainActor
final class SNAPExpensesFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        // T16 P0: .paysUtilitiesSeparately replaced by .utilityTypes.
        // T16 P1: .sharedHousing added after rent — shown only when
        //         housingStatus is NOT .unhoused (unhoused students don't
        //         have a lease to pro-rate).
        case rent, sharedHousing, utilityTypes, utilities, utilityShutoff, childcare, medical
        // Wave 3 — court-ordered support (BenefitsCal ABCOC + ABSSQ)
        case courtOrderedSupportGate, childSupportAmount, spousalSupportAmount

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .rent
    @Published var rentField: String
    @Published var utilitiesField: String
    @Published var childcareField: String
    @Published var medicalField: String
    @Published var childSupportField: String = ""
    @Published var spousalSupportField: String = ""
    /// Wave A — true once the rent field has been populated by a lease
    /// scan in the current session. Surfaces a pine pre-fill note so
    /// the applicant knows where the value came from and can change
    /// it. Reset on flow re-entry (ephemeral, not persisted).
    @Published var rentPrefilledFromScan: Bool = false
    /// Wave B — true once the utilities field has been populated by a
    /// utility-bill scan. Same ephemeral semantics as
    /// `rentPrefilledFromScan`.
    @Published var utilitiesPrefilledFromScan: Bool = false
    @Published var answers: SNAPExpensesAnswers

    private let hasMinorInHousehold: Bool
    private let hasElderlyOrDisabled: Bool
    /// Passed in from the WhereApplying answers so the flow can gate
    /// the shared-housing step (unhoused applicants skip it — they
    /// don't have a lease to pro-rate).
    private let housingStatus: HousingStatus?

    /// Recomputed on every access so screens appear/disappear immediately
    /// when the user changes answers — without restarting the flow.
    var effectiveSteps: [Step] {
        var steps: [Step] = [.rent]
        // T16 Gap #4: skip sharedHousing for unhoused applicants
        if housingStatus != .unhoused {
            steps.append(.sharedHousing)
        }
        steps.append(.utilityTypes)
        if !answers.selectedUtilities.isEmpty {
            steps.append(.utilities)
            steps.append(.utilityShutoff)
        }
        if hasMinorInHousehold { steps.append(.childcare) }
        if hasElderlyOrDisabled { steps.append(.medical) }
        // Wave 3 — court-ordered support gate, always asked. When
        // the answer is Yes, branch into the per-type amount pages.
        steps.append(.courtOrderedSupportGate)
        if answers.paysCourtOrderedSupport == .yes {
            steps.append(.childSupportAmount)
            steps.append(.spousalSupportAmount)
        }
        return steps
    }

    init(
        answers: SNAPExpensesAnswers = .init(),
        hasMinorInHousehold: Bool = false,
        hasElderlyOrDisabled: Bool = false,
        housingStatus: HousingStatus? = nil
    ) {
        self.answers = answers
        self.hasMinorInHousehold = hasMinorInHousehold
        self.hasElderlyOrDisabled = hasElderlyOrDisabled
        self.housingStatus = housingStatus

        func render(_ value: Decimal?) -> String {
            guard let value else { return "" }
            return NSDecimalNumber(decimal: value).stringValue
        }
        self.rentField = render(answers.monthlyRentOrHousing)
        self.utilitiesField = render(answers.monthlyUtilities)
        self.childcareField = render(answers.monthlyChildcare)
        self.medicalField = render(answers.monthlyMedical)
        self.childSupportField = render(answers.monthlyChildSupportPaid)
        self.spousalSupportField = render(answers.monthlySpousalSupportPaid)
    }

    func recordCurrentField() {
        switch step {
        case .rent:          answers.monthlyRentOrHousing = decimalValue(rentField)
        case .sharedHousing: break  // sharedHousingOccupants bound directly
        case .utilityTypes:  break  // selectedUtilities bound directly via toggle callbacks
        case .utilities:     answers.monthlyUtilities     = decimalValue(utilitiesField)
        case .utilityShutoff: break  // bound directly into answers.utilityShutoffNotice
        case .childcare:     answers.monthlyChildcare     = decimalValue(childcareField)
        case .medical:       answers.monthlyMedical       = decimalValue(medicalField)
        case .courtOrderedSupportGate: break  // Tri bound directly
        case .childSupportAmount:   answers.monthlyChildSupportPaid   = decimalValue(childSupportField)
        case .spousalSupportAmount: answers.monthlySpousalSupportPaid = decimalValue(spousalSupportField)
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .rent, .utilities, .childcare, .medical,
             .childSupportAmount, .spousalSupportAmount:
            return true  // empty = $0, always a valid answer
        case .sharedHousing, .utilityTypes:
            return true  // no required selection
        case .utilityShutoff:
            return answers.utilityShutoffNotice != nil
        case .courtOrderedSupportGate:
            return answers.paysCourtOrderedSupport != nil
        }
    }

    func advance() {
        recordCurrentField()
        // When the user clears all utility selections, purge the downstream
        // data so previous entries don't ghost into the draft.
        if step == .utilityTypes && answers.selectedUtilities.isEmpty {
            answers.monthlyUtilities = nil
            answers.utilityShutoffNotice = nil
        }
        if let i = effectiveSteps.firstIndex(of: step), i + 1 < effectiveSteps.count {
            step = effectiveSteps[i + 1]
        }
    }

    func goBack() {
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    var isAtFirstStep: Bool { step == .rent }
    /// Last step is whichever Step is currently last in effectiveSteps —
    /// NOT a hard-coded `.medical`. When the household has no minors
    /// and no elderly/disabled members, `.medical` and `.childcare` are
    /// pruned, so the real terminal step is `.utilityShutoff` (or
    /// `.utilityTypes` if no utilities were selected). Hard-coding
    /// `.medical` here caused Continue to silently no-op on the shutoff
    /// screen for childless / non-elderly applicants.
    var isAtLastStep: Bool { step == effectiveSteps.last }

    // Empty / non-numeric input is intentionally "no answer" rather
    // than $0 — that distinction lets the rules engine flag missing
    // data separately from "$0 is the real answer."
    private func decimalValue(_ raw: String) -> Decimal? {
        let cleaned = raw
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "")
        guard !cleaned.isEmpty else { return nil }
        return Decimal(string: cleaned)
    }
}

struct SNAPExpensesFlowView: View {
    @StateObject var viewModel: SNAPExpensesFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPExpensesAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPExpensesFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPExpensesAnswers) -> Void,
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
        case .rent:          rentScreen      // Wave A — money screen + lease scan CTA
        case .sharedHousing: sharedHousingScreen
        case .utilityTypes:  utilityTypesScreen
        case .utilities:     utilitiesScreen     // Wave B — money screen + utility-bill scan CTA
        case .utilityShutoff: utilityShutoffScreen
        case .childcare:     moneyScreen(.childcare, binding: $viewModel.childcareField)
        case .medical:       moneyScreen(.medical, binding: $viewModel.medicalField)
        // Wave 3 — court-ordered support (BenefitsCal ABCOC + ABSSQ)
        case .courtOrderedSupportGate: courtOrderedSupportGateScreen
        case .childSupportAmount:      moneyScreen(.childSupportAmount, binding: $viewModel.childSupportField)
        case .spousalSupportAmount:    moneyScreen(.spousalSupportAmount, binding: $viewModel.spousalSupportField)
        }
    }

    // MARK: - Wave 3: court-ordered support gate

    private var courtOrderedSupportGateScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .courtOrderedSupportGate),
            title: SNAPExpensesStrings.courtOrderedSupportTitle.value(in: language),
            helper: SNAPExpensesStrings.courtOrderedSupportHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: [
                    CivicaQuestionStrings.yesLabel.value(in: language),
                    CivicaQuestionStrings.noLabel.value(in: language),
                ],
                selection: Binding(
                    get: {
                        switch viewModel.answers.paysCourtOrderedSupport {
                        case .yes: return CivicaQuestionStrings.yesLabel.value(in: language)
                        case .no:  return CivicaQuestionStrings.noLabel.value(in: language)
                        default:   return nil
                        }
                    },
                    set: { label in
                        let yes = CivicaQuestionStrings.yesLabel.value(in: language)
                        viewModel.answers.paysCourtOrderedSupport = (label == yes) ? .yes : .no
                    }
                )
            )
        }
    }

    // T16 Gap #4: Shared housing pro-rate.
    // Stepper: 2 through 8 occupants. Selecting "Not sharing" stores nil
    // (full rent counts). Stepper is disabled until user taps it or taps
    // the row to activate sharing mode.
    private var sharedHousingScreen: some View {
        let displayCount: Int = viewModel.answers.sharedHousingOccupants ?? 2
        return CivicaQuestionScreen(
            progress: progress(for: .sharedHousing),
            title: SNAPExpensesStrings.title(for: .sharedHousing, language: language),
            helper: SNAPExpensesStrings.helper(for: .sharedHousing, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(spacing: CivicaSpacing.md) {
                // "Not sharing" pill — clears the occupant count
                Button {
                    viewModel.answers.sharedHousingOccupants = nil
                } label: {
                    HStack {
                        Text(SNAPExpensesStrings.notSharingLabel(language: language))
                            .font(CivicaTypography.body)
                            .foregroundStyle(viewModel.answers.sharedHousingOccupants == nil
                                ? CivicaColors.ink : CivicaColors.graphite)
                        Spacer()
                        if viewModel.answers.sharedHousingOccupants == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(CivicaColors.amberPrimary)
                        }
                    }
                    .padding(.horizontal, CivicaSpacing.lg)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(viewModel.answers.sharedHousingOccupants == nil
                        ? CivicaColors.amberSurface : CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(
                            viewModel.answers.sharedHousingOccupants == nil
                                ? CivicaColors.amberPrimary : CivicaColors.hairline,
                            lineWidth: viewModel.answers.sharedHousingOccupants == nil ? 2 : 1
                        ))
                }
                .buttonStyle(.plain)

                // Stepper row — tap to activate sharing, then adjust count
                HStack(spacing: CivicaSpacing.md) {
                    Text(SNAPExpensesStrings.totalOccupantsLabel(language: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer()
                    Stepper(
                        value: Binding(
                            get: { viewModel.answers.sharedHousingOccupants ?? 2 },
                            set: { viewModel.answers.sharedHousingOccupants = $0 }
                        ),
                        in: 2...8
                    ) {
                        Text("\(displayCount)")
                            .font(CivicaTypography.bodyStrong)
                            .foregroundStyle(CivicaColors.ink)
                            .monospacedDigit()
                            .frame(minWidth: 28, alignment: .trailing)
                    }
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.vertical, CivicaSpacing.md)
                .background(viewModel.answers.sharedHousingOccupants != nil
                    ? CivicaColors.surfacePrimary : CivicaColors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                .overlay(RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1))
                .opacity(viewModel.answers.sharedHousingOccupants == nil ? 0.4 : 1)
                .civicaAnimation(.easeInOut(duration: 0.15), value: viewModel.answers.sharedHousingOccupants)
                .disabled(viewModel.answers.sharedHousingOccupants == nil)
                .onTapGesture {
                    if viewModel.answers.sharedHousingOccupants == nil {
                        viewModel.answers.sharedHousingOccupants = 2
                    }
                }
            }
        }
    }

    // T16 Gap #1/#3: Multi-select utility type checklist.
    // Replaces the yes/no paysUtilitiesSeparately toggle.
    // Selecting .cooling (AC) alone yields the full SUA in CA —
    // Gap #3 (A/C question) closes for free here.
    private var utilityTypesScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .utilityTypes),
            title: SNAPExpensesStrings.title(for: .utilityTypes, language: language),
            helper: SNAPExpensesStrings.helper(for: .utilityTypes, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(spacing: CivicaSpacing.sm) {
                ForEach(UtilityType.allCases) { utilityType in
                    utilityTypeRow(utilityType)
                }
            }
        }
    }

    private func utilityTypeRow(_ utilityType: UtilityType) -> some View {
        let isSelected = viewModel.answers.selectedUtilities.contains(utilityType)
        return Button {
            if isSelected {
                viewModel.answers.selectedUtilities.remove(utilityType)
            } else {
                viewModel.answers.selectedUtilities.insert(utilityType)
            }
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(isSelected ? CivicaColors.amberPrimary : CivicaColors.graphite)
                    .frame(width: 28)
                Text(utilityType.displayName(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .background(isSelected ? CivicaColors.amberSurface : CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(
                        isSelected ? CivicaColors.amberPrimary : CivicaColors.hairline,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .civicaAnimation(CivicaAnimation.fast, value: isSelected)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityLabel(utilityType.displayName(in: language))
        .accessibilityHint(isSelected
            ? SNAPExpensesStrings.deselectHint(language: language)
            : SNAPExpensesStrings.selectHint(language: language)
        )
    }

    private var utilityShutoffScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .utilityShutoff),
            title: SNAPExpensesStrings.title(for: .utilityShutoff, language: language),
            helper: SNAPExpensesStrings.helper(for: .utilityShutoff, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPExpensesStrings.triLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        viewModel.answers.utilityShutoffNotice.map {
                            SNAPExpensesStrings.triLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.utilityShutoffNotice = options.first { tri in
                            SNAPExpensesStrings.triLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Wave A: rent screen with lease-scan CTA

    /// Wraps the shared `moneyScreen` for `.rent` and adds an inline
    /// "Scan your lease to autofill" affordance below the input. On
    /// extract, populates the rent field directly — the applicant
    /// can still edit the value in the same field, preserving the
    /// "applicant is always the source of truth" property.
    private var rentScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .rent),
            title: SNAPExpensesStrings.title(for: .rent, language: language),
            helper: SNAPExpensesStrings.helper(for: .rent, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                moneyAffordance(
                    binding: $viewModel.rentField,
                    suffix: SNAPExpensesStrings.suffix(for: .rent, language: language)
                )
                SNAPInlineDocScanCTA(
                    documentType: .rentOrHousingCostProof,
                    ctaLabel: SNAPExpensesStrings.scanLeaseCTA.value(in: language),
                    onExtracted: { result in
                        if let amount = result.primaryAmount, !amount.isEmpty {
                            viewModel.rentField = amount
                            viewModel.rentPrefilledFromScan = true
                        }
                    }
                )
                if viewModel.rentPrefilledFromScan {
                    Text(SNAPExpensesStrings.scanPrefilledNote.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: - Wave B: utilities screen with utility-bill scan CTA

    /// Mirrors `rentScreen`: shared money input + inline scan CTA.
    /// Wave B intentionally scans only the AMOUNT — the utility-type
    /// selection on the prior `utilityTypes` screen stays declaration-
    /// first because a single bill rarely covers all the types a
    /// household pays, and over-claiming the SUA tier on an OCR
    /// guess would be a real error class.
    private var utilitiesScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .utilities),
            title: SNAPExpensesStrings.title(for: .utilities, language: language),
            helper: SNAPExpensesStrings.helper(for: .utilities, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                moneyAffordance(
                    binding: $viewModel.utilitiesField,
                    suffix: SNAPExpensesStrings.suffix(for: .utilities, language: language)
                )
                SNAPInlineDocScanCTA(
                    documentType: .utilityBill,
                    ctaLabel: SNAPExpensesStrings.scanUtilityCTA.value(in: language),
                    onExtracted: { result in
                        if let amount = result.primaryAmount, !amount.isEmpty {
                            viewModel.utilitiesField = amount
                            viewModel.utilitiesPrefilledFromScan = true
                        }
                    }
                )
                if viewModel.utilitiesPrefilledFromScan {
                    Text(SNAPExpensesStrings.scanUtilityPrefilledNote.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: - Shared money-screen affordance

    private func moneyScreen(
        _ step: SNAPExpensesFlowViewModel.Step,
        binding: Binding<String>
    ) -> some View {
        CivicaQuestionScreen(
            progress: progress(for: step),
            title: SNAPExpensesStrings.title(for: step, language: language),
            helper: SNAPExpensesStrings.helper(for: step, language: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: true,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            moneyAffordance(
                binding: binding,
                suffix: SNAPExpensesStrings.suffix(for: step, language: language)
            )
        }
    }

    private func moneyAffordance(binding: Binding<String>, suffix: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(CivicaTypography.currencyHero)
                    .foregroundStyle(CivicaColors.graphite)
                CivicaCurrencyField(
                    text: binding,
                    placeholder: CivicaQuestionStrings.amountPlaceholder.value(in: language),
                    font: CivicaTypography.currencyHero
                )
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 72)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            Text(suffix)
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPExpensesFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPExpensesFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.expenses.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.expenses.title(in: language)
        )
    }

    private func advanceOrComplete() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            viewModel.recordCurrentField()
            if viewModel.isAtLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
        }
    }
}

// MARK: - Strings

enum SNAPExpensesStrings {

    static func title(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english), (.rent, .tagalog):
            return "About how much is your rent or housing payment each month?"
        case (.rent, .mandarin):
            return "你每月的房租或住房费用大约是多少?"
        case (.rent, .vietnamese):
            return "Tiền thuê nhà hoặc chi phí nhà ở mỗi tháng của bạn khoảng bao nhiêu?"
        case (.rent, .spanish):
            return "¿Cuánto es tu renta o pago de vivienda cada mes?"
        // T16 Gap #4
        case (.sharedHousing, .english), (.sharedHousing, .tagalog):
            return "Do you share your home with people who are NOT on your SNAP case?"
        case (.sharedHousing, .mandarin):
            return "你是否和不在你 SNAP 案件里的人一起住?"
        case (.sharedHousing, .vietnamese):
            return "Bạn có ở chung nhà với những người KHÔNG nằm trong hồ sơ SNAP của bạn không?"
        case (.sharedHousing, .spanish):
            return "¿Compartes tu hogar con personas que NO están en tu caso de SNAP?"
        // T16: replaces paysUtilitiesSeparately yes/no
        case (.utilityTypes, .english), (.utilityTypes, .tagalog):
            return "Which utilities do you pay on your own — not included in rent?"
        case (.utilityTypes, .mandarin):
            return "哪些水电费是你自己付的 — 没有包含在房租里?"
        case (.utilityTypes, .vietnamese):
            return "Bạn tự trả những tiện ích nào — không bao gồm trong tiền thuê nhà?"
        case (.utilityTypes, .spanish):
            return "¿Cuáles servicios pagas tú directamente, sin incluirlos en la renta?"
        case (.utilities, .english), (.utilities, .tagalog):
            return "About how much do you spend on those utilities each month?"
        case (.utilities, .mandarin):
            return "你每月在这些水电费上大约花多少?"
        case (.utilities, .vietnamese):
            return "Mỗi tháng bạn chi khoảng bao nhiêu cho những tiện ích đó?"
        case (.utilities, .spanish):
            return "¿Cuánto gastas en esos servicios cada mes?"
        case (.utilityShutoff, .english), (.utilityShutoff, .tagalog):
            return "Have you received a shutoff notice from any utility?"
        case (.utilityShutoff, .mandarin):
            return "你有收到任何水电公司的停止供应通知吗?"
        case (.utilityShutoff, .vietnamese):
            return "Bạn có nhận được thông báo cắt dịch vụ từ bất kỳ công ty tiện ích nào không?"
        case (.utilityShutoff, .spanish):
            return "¿Has recibido un aviso de corte de algún servicio?"
        case (.childcare, .english), (.childcare, .tagalog):
            return "Do you pay for childcare?"
        case (.childcare, .mandarin):
            return "你有支付托儿费用吗?"
        case (.childcare, .vietnamese):
            return "Bạn có trả tiền giữ trẻ không?"
        case (.childcare, .spanish):
            return "¿Pagas por el cuidado infantil?"
        case (.medical, .english), (.medical, .tagalog):
            return "Any out-of-pocket medical costs each month?"
        case (.medical, .mandarin):
            return "每月有自费的医疗开销吗?"
        case (.medical, .vietnamese):
            return "Mỗi tháng có chi phí y tế tự trả nào không?"
        case (.medical, .spanish):
            return "¿Algún gasto médico de tu bolsillo cada mes?"
        // Wave 3 — court-ordered support (BenefitsCal ABCOC + ABSSQ)
        case (.courtOrderedSupportGate, _):
            return ""  // gate uses its own dedicated strings
        case (.childSupportAmount, .english), (.childSupportAmount, .tagalog):
            return "How much child support do you pay each month?"
        case (.childSupportAmount, .mandarin):
            return "你每月支付多少子女抚养费?"
        case (.childSupportAmount, .vietnamese):
            return "Mỗi tháng bạn trả bao nhiêu tiền cấp dưỡng con?"
        case (.childSupportAmount, .spanish):
            return "¿Cuánta manutención de hijos pagas cada mes?"
        case (.spousalSupportAmount, .english), (.spousalSupportAmount, .tagalog):
            return "How much spousal support or alimony do you pay each month?"
        case (.spousalSupportAmount, .mandarin):
            return "你每月支付多少配偶赡养费或离婚赡养费?"
        case (.spousalSupportAmount, .vietnamese):
            return "Mỗi tháng bạn trả bao nhiêu tiền cấp dưỡng vợ/chồng hoặc tiền chu cấp?"
        case (.spousalSupportAmount, .spanish):
            return "¿Cuánta manutención conyugal o pensión alimenticia pagas cada mes?"
        }
    }

    static func helper(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english), (.rent, .tagalog):
            return "Include rent, mortgage, or anything you pay regularly to live where you live. Estimate is fine. Enter 0 if you don't pay rent right now."
        case (.rent, .mandarin):
            return "包括房租、房贷,或任何你为现在住的地方定期支付的费用。估算就可以。如果你现在不付房租,填 0。"
        case (.rent, .vietnamese):
            return "Bao gồm tiền thuê nhà, tiền vay mua nhà, hoặc bất cứ khoản nào bạn trả thường xuyên để ở nơi bạn đang sống. Ước tính là được. Nhập 0 nếu hiện tại bạn không trả tiền thuê nhà."
        case (.rent, .spanish):
            return "Incluye renta, hipoteca o cualquier pago regular por donde vives. Una estimación está bien. Pon 0 si no pagas renta ahora mismo."
        // T16 Gap #4
        case (.sharedHousing, .english), (.sharedHousing, .tagalog):
            return "If roommates or family members share your address but are NOT on your SNAP case, only your share of the rent counts. Select 'Not sharing' if you live alone or everyone at your address is on your case."
        case (.sharedHousing, .mandarin):
            return "如果室友或家人和你住同一个地址,但不在你的 SNAP 案件里,只有你那部分房租算数。如果你一个人住,或地址里所有人都在你的案件里,选「不合住」。"
        case (.sharedHousing, .vietnamese):
            return "Nếu bạn cùng phòng hoặc người thân ở chung địa chỉ với bạn nhưng KHÔNG nằm trong hồ sơ SNAP của bạn, chỉ phần tiền thuê của bạn được tính. Chọn “Không ở chung” nếu bạn sống một mình hoặc mọi người ở địa chỉ của bạn đều nằm trong hồ sơ của bạn."
        case (.sharedHousing, .spanish):
            return "Si compañeros de cuarto o familiares comparten tu domicilio pero NO están en tu caso de SNAP, solo tu parte de la renta cuenta. Selecciona 'No comparto' si vives solo o todos en tu domicilio están en tu caso."
        // T16: replaces paysUtilitiesSeparately yes/no helper
        case (.utilityTypes, .english), (.utilityTypes, .tagalog):
            return "Select everything that applies. If utilities are included in your rent, leave everything unchecked. Air conditioning counts in California. Internet is not counted by SNAP."
        case (.utilityTypes, .mandarin):
            return "把符合的都选上。如果水电费已经包含在房租里,就全部不选。空调在加州算数。SNAP 不算网络费。"
        case (.utilityTypes, .vietnamese):
            return "Chọn tất cả những gì phù hợp. Nếu tiện ích đã bao gồm trong tiền thuê nhà, hãy để trống tất cả. Máy lạnh được tính ở California. SNAP không tính tiền internet."
        case (.utilityTypes, .spanish):
            return "Selecciona todo lo que aplique. Si los servicios están incluidos en tu renta, deja todo sin marcar. El aire acondicionado cuenta en California. Internet no cuenta para SNAP."
        case (.utilities, .english), (.utilities, .tagalog):
            return "Add up a typical month for the utilities you selected. Estimate is fine — the total is what matters."
        case (.utilities, .mandarin):
            return "把你选的那些水电费按一个典型月份加起来。估算就可以 — 总额才是关键。"
        case (.utilities, .vietnamese):
            return "Cộng lại một tháng điển hình cho các tiện ích bạn đã chọn. Ước tính là được — tổng số mới là điều quan trọng."
        case (.utilities, .spanish):
            return "Suma un mes típico de los servicios que seleccionaste. Una estimación está bien — el total es lo que importa."
        case (.utilityShutoff, .english), (.utilityShutoff, .tagalog):
            return "A written or paper notice that power, gas, water, or heat will be cut off if you don't pay. This can speed up your SNAP application."
        case (.utilityShutoff, .mandarin):
            return "一份书面或纸质通知,说如果你不付款,会停电、停气、停水或停暖。这可以加快你的 SNAP 申请。"
        case (.utilityShutoff, .vietnamese):
            return "Một thông báo bằng văn bản hoặc giấy báo rằng điện, gas, nước hoặc sưởi sẽ bị cắt nếu bạn không trả tiền. Điều này có thể đẩy nhanh đơn xin SNAP của bạn."
        case (.utilityShutoff, .spanish):
            return "Un aviso escrito o en papel de que cortarán la luz, el gas, el agua o la calefacción si no pagas. Esto puede acelerar tu solicitud de SNAP."
        case (.childcare, .english), (.childcare, .tagalog):
            return "Daycare, after-school, or anything that lets a working adult in your household keep working. Enter 0 if none."
        case (.childcare, .mandarin):
            return "日托、课后班,或任何能让家里在工作的大人继续工作的费用。没有就填 0。"
        case (.childcare, .vietnamese):
            return "Nhà trẻ, chương trình sau giờ học, hoặc bất cứ thứ gì giúp một người lớn đang đi làm trong hộ gia đình của bạn tiếp tục làm việc. Nhập 0 nếu không có."
        case (.childcare, .spanish):
            return "Guardería, programas después de la escuela, o cualquier cosa que permita a un adulto trabajador del hogar seguir trabajando. Pon 0 si no aplica."
        case (.medical, .english), (.medical, .tagalog):
            return "Only counts if someone in your household is 60+ or has a disability. We're asking about co-pays, prescriptions, dental, or insurance premiums you pay out of pocket. Don't share diagnoses."
        case (.medical, .mandarin):
            return "只有当你家里有人 60 岁或以上,或者有残障时才算。我们问的是你自费的挂号费、处方药、牙科或保险费。不用告诉我们诊断结果。"
        case (.medical, .vietnamese):
            return "Chỉ được tính nếu có người trong hộ gia đình của bạn từ 60 tuổi trở lên hoặc bị khuyết tật. Chúng tôi hỏi về các khoản đồng trả, thuốc theo toa, nha khoa, hoặc phí bảo hiểm mà bạn tự trả. Không cần chia sẻ chẩn đoán."
        case (.medical, .spanish):
            return "Solo cuenta si alguien en tu hogar tiene 60 años o más o vive con una discapacidad. Preguntamos por copagos, medicamentos, dentista o primas de seguro que pagas de tu bolsillo. No compartas diagnósticos."
        // Wave 3 — court-ordered support
        case (.courtOrderedSupportGate, _):
            return ""  // gate uses its own dedicated strings
        case (.childSupportAmount, .english), (.childSupportAmount, .tagalog):
            return "Court-ordered child support paid to someone OUTSIDE your household. SNAP deducts this from your gross income before calculating benefits."
        case (.childSupportAmount, .mandarin):
            return "法院命令支付给你家庭以外的人的子女抚养费。SNAP 在计算福利前会从你的总收入中扣除这部分。"
        case (.childSupportAmount, .vietnamese):
            return "Tiền cấp dưỡng con theo lệnh tòa trả cho người NGOÀI hộ gia đình của bạn. SNAP khấu trừ khoản này khỏi tổng thu nhập của bạn trước khi tính trợ cấp."
        case (.childSupportAmount, .spanish):
            return "Manutención de hijos ordenada por la corte que pagas a alguien FUERA de tu hogar. SNAP deduce esto de tu ingreso bruto antes de calcular los beneficios."
        case (.spousalSupportAmount, .english), (.spousalSupportAmount, .tagalog):
            return "Court-ordered spousal support or alimony. SNAP deducts this from your gross income too."
        case (.spousalSupportAmount, .mandarin):
            return "法院命令支付的配偶赡养费或离婚赡养费。SNAP 也会从你的总收入中扣除这部分。"
        case (.spousalSupportAmount, .vietnamese):
            return "Tiền cấp dưỡng vợ/chồng hoặc tiền chu cấp theo lệnh tòa. SNAP cũng khấu trừ khoản này khỏi tổng thu nhập của bạn."
        case (.spousalSupportAmount, .spanish):
            return "Manutención conyugal o pensión alimenticia ordenada por la corte. SNAP también deduce esto de tu ingreso bruto."
        }
    }

    static func suffix(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Per month"
        case .mandarin: return "每月"
        case .vietnamese: return "Mỗi tháng"
        case .spanish: return "Por mes"
        }
    }

    static func fieldAccessibilityLabel(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english), (.rent, .tagalog):         return "Monthly rent or housing payment, in dollars"
        case (.rent, .mandarin):        return "每月房租或住房费用,以美元计"
        case (.rent, .vietnamese):      return "Tiền thuê nhà hoặc chi phí nhà ở hàng tháng, tính bằng đô la"
        case (.rent, .spanish):         return "Pago mensual de renta o vivienda, en dólares"
        case (.utilities, .english), (.utilities, .tagalog):    return "Monthly utilities total, in dollars"
        case (.utilities, .mandarin):   return "每月水电费总额,以美元计"
        case (.utilities, .vietnamese): return "Tổng tiền tiện ích hàng tháng, tính bằng đô la"
        case (.utilities, .spanish):    return "Total de servicios mensuales, en dólares"
        case (.childcare, .english), (.childcare, .tagalog):    return "Monthly childcare costs, in dollars"
        case (.childcare, .mandarin):   return "每月托儿费用,以美元计"
        case (.childcare, .vietnamese): return "Chi phí giữ trẻ hàng tháng, tính bằng đô la"
        case (.childcare, .spanish):    return "Costos mensuales de cuidado infantil, en dólares"
        case (.medical, .english), (.medical, .tagalog):      return "Monthly out-of-pocket medical costs, in dollars"
        case (.medical, .mandarin):     return "每月自费医疗开销,以美元计"
        case (.medical, .vietnamese):   return "Chi phí y tế tự trả hàng tháng, tính bằng đô la"
        case (.medical, .spanish):      return "Gastos médicos mensuales de bolsillo, en dólares"
        case (.utilityShutoff, _):      return ""
        case (.utilityTypes, _):        return ""  // each row has its own accessibilityLabel
        case (.sharedHousing, _):       return ""  // stepper and pill have their own labels
        case (.courtOrderedSupportGate, _): return ""
        case (.childSupportAmount, .english), (.childSupportAmount, .tagalog):  return "Monthly child support paid, in dollars"
        case (.childSupportAmount, .mandarin):  return "每月支付的子女抚养费,以美元计"
        case (.childSupportAmount, .vietnamese): return "Tiền cấp dưỡng con trả hàng tháng, tính bằng đô la"
        case (.childSupportAmount, .spanish):  return "Manutención mensual de hijos pagada, en dólares"
        case (.spousalSupportAmount, .english), (.spousalSupportAmount, .tagalog): return "Monthly spousal support paid, in dollars"
        case (.spousalSupportAmount, .mandarin): return "每月支付的配偶赡养费,以美元计"
        case (.spousalSupportAmount, .vietnamese): return "Tiền cấp dưỡng vợ/chồng trả hàng tháng, tính bằng đô la"
        case (.spousalSupportAmount, .spanish): return "Manutención mensual conyugal pagada, en dólares"
        }
    }

    // Wave A — lease-scan affordance strings
    static let scanLeaseCTA = CivicaText(
        "Scan your lease to autofill",
        es: "Escanea tu contrato para autollenar",
        zh: "扫描你的租约自动填写",
        vi: "Quét hợp đồng thuê nhà để tự động điền"
    )
    static let scanPrefilledNote = CivicaText(
        "Pre-filled from your lease — change above if needed.",
        es: "Pre-llenado desde tu contrato — cámbialo arriba si es necesario.",
        zh: "已从你的租约预填 — 如有需要可在上方修改。",
        vi: "Đã điền sẵn từ hợp đồng thuê nhà của bạn — sửa ở trên nếu cần."
    )

    // Wave B — utility-bill-scan affordance strings
    static let scanUtilityCTA = CivicaText(
        "Scan a utility bill to autofill",
        es: "Escanea una factura de servicios para autollenar",
        zh: "扫描一张水电账单自动填写",
        vi: "Quét hóa đơn tiện ích để tự động điền"
    )
    static let scanUtilityPrefilledNote = CivicaText(
        "Pre-filled from your bill — change above if needed.",
        es: "Pre-llenado desde tu factura — cámbialo arriba si es necesario.",
        zh: "已从你的账单预填 — 如有需要可在上方修改。",
        vi: "Đã điền sẵn từ hóa đơn của bạn — sửa ở trên nếu cần."
    )

    // Wave 3 — court-ordered support gate strings
    static let courtOrderedSupportTitle = CivicaText(
        "Do you pay court-ordered child or spousal support?",
        es: "¿Pagas manutención de hijos o conyugal ordenada por la corte?",
        zh: "你有支付法院命令的子女抚养费或配偶赡养费吗?",
        vi: "Bạn có trả tiền cấp dưỡng con hoặc vợ/chồng theo lệnh tòa không?"
    )
    static let courtOrderedSupportHelper = CivicaText(
        "Only what's court-ordered, paid to someone OUTSIDE your household. SNAP deducts these payments from your gross income — answering Yes can increase your benefit estimate.",
        es: "Solo lo ordenado por la corte que pagas a alguien FUERA de tu hogar. SNAP deduce estos pagos de tu ingreso bruto — responder Sí puede aumentar tu estimación de beneficios.",
        zh: "只算法院命令的、支付给你家庭以外的人的费用。SNAP 会从你的总收入中扣除这些支付 — 回答「是」可能会提高你的福利估算。",
        vi: "Chỉ tính khoản theo lệnh tòa, trả cho người NGOÀI hộ gia đình của bạn. SNAP khấu trừ các khoản này khỏi tổng thu nhập của bạn — trả lời Có có thể làm tăng ước tính trợ cấp của bạn."
    )

    static func notSharingLabel(language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Not sharing — this rent is just mine"
        case .mandarin: return "不合住 — 这房租只是我的"
        case .vietnamese: return "Không ở chung — tiền thuê này chỉ là của tôi"
        case .spanish: return "No comparto — esta renta es solo mía"
        }
    }

    static func totalOccupantsLabel(language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Total people at this address"
        case .mandarin: return "这个地址总共住几个人"
        case .vietnamese: return "Tổng số người tại địa chỉ này"
        case .spanish: return "Total de personas en este domicilio"
        }
    }

    static func selectHint(language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Double tap to select"
        case .mandarin: return "双击选择"
        case .vietnamese: return "Nhấn đúp để chọn"
        case .spanish: return "Toca dos veces para seleccionar"
        }
    }

    static func deselectHint(language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Double tap to deselect"
        case .mandarin: return "双击取消选择"
        case .vietnamese: return "Nhấn đúp để bỏ chọn"
        case .spanish: return "Toca dos veces para deseleccionar"
        }
    }

    static func triLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english), (.yes, .tagalog):     return "Yes"
        case (.yes, .mandarin):    return "是"
        case (.yes, .vietnamese):  return "Có"
        case (.yes, .spanish):     return "Sí"
        case (.no, .english), (.no, .tagalog):      return "No"
        case (.no, .mandarin):     return "否"
        case (.no, .vietnamese):   return "Không"
        case (.no, .spanish):      return "No"
        case (.notSure, .english), (.notSure, .tagalog): return "I'm not sure"
        case (.notSure, .mandarin): return "我不确定"
        case (.notSure, .vietnamese): return "Tôi không chắc"
        case (.notSure, .spanish): return "No estoy seguro"
        }
    }
}

#if DEBUG
struct SNAPExpensesFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPExpensesFlowView(
                viewModel: SNAPExpensesFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
