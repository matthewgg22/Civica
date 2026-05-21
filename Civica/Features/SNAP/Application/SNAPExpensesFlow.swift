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
}

@MainActor
final class SNAPExpensesFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        // T16 P0: .paysUtilitiesSeparately replaced by .utilityTypes.
        // T16 P1: .sharedHousing added after rent — shown only when
        //         housingStatus is NOT .unhoused (unhoused students don't
        //         have a lease to pro-rate).
        case rent, sharedHousing, utilityTypes, utilities, utilityShutoff, childcare, medical

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .rent
    @Published var rentField: String
    @Published var utilitiesField: String
    @Published var childcareField: String
    @Published var medicalField: String
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
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .rent, .utilities, .childcare, .medical:
            return true  // empty = $0, always a valid answer
        case .sharedHousing, .utilityTypes:
            return true  // no required selection
        case .utilityShutoff:
            return answers.utilityShutoffNotice != nil
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
    var isAtLastStep: Bool { step == .medical }

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
            .animation(.easeInOut(duration: 0.18), value: viewModel.step)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        if viewModel.isAtFirstStep {
                            onExit()
                        } else {
                            withAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
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
        case .rent:          moneyScreen(.rent, binding: $viewModel.rentField)
        case .sharedHousing: sharedHousingScreen
        case .utilityTypes:  utilityTypesScreen
        case .utilities:     moneyScreen(.utilities, binding: $viewModel.utilitiesField)
        case .utilityShutoff: utilityShutoffScreen
        case .childcare:     moneyScreen(.childcare, binding: $viewModel.childcareField)
        case .medical:       moneyScreen(.medical, binding: $viewModel.medicalField)
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
                .animation(.easeInOut(duration: 0.15), value: viewModel.answers.sharedHousingOccupants)
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
                    .font(.system(size: 22))
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
            .animation(.easeInOut(duration: 0.12), value: isSelected)
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
                TextField(
                    CivicaQuestionStrings.amountPlaceholder.value(in: language),
                    text: binding
                )
                .font(CivicaTypography.currencyHero)
                .foregroundStyle(CivicaColors.ink)
                .keyboardType(.decimalPad)
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
        withAnimation(.easeInOut(duration: 0.18)) {
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
        case (.rent, .english):
            return "About how much is your rent or housing payment each month?"
        case (.rent, .spanish):
            return "¿Cuánto es tu renta o pago de vivienda cada mes?"
        // T16 Gap #4
        case (.sharedHousing, .english):
            return "Do you share your home with people who are NOT on your SNAP case?"
        case (.sharedHousing, .spanish):
            return "¿Compartes tu hogar con personas que NO están en tu caso de SNAP?"
        // T16: replaces paysUtilitiesSeparately yes/no
        case (.utilityTypes, .english):
            return "Which utilities do you pay on your own — not included in rent?"
        case (.utilityTypes, .spanish):
            return "¿Cuáles servicios pagas tú directamente, sin incluirlos en la renta?"
        case (.utilities, .english):
            return "About how much do you spend on those utilities each month?"
        case (.utilities, .spanish):
            return "¿Cuánto gastas en esos servicios cada mes?"
        case (.utilityShutoff, .english):
            return "Have you received a shutoff notice from any utility?"
        case (.utilityShutoff, .spanish):
            return "¿Has recibido un aviso de corte de algún servicio?"
        case (.childcare, .english):
            return "Do you pay for childcare?"
        case (.childcare, .spanish):
            return "¿Pagas por el cuidado infantil?"
        case (.medical, .english):
            return "Any out-of-pocket medical costs each month?"
        case (.medical, .spanish):
            return "¿Algún gasto médico de tu bolsillo cada mes?"
        }
    }

    static func helper(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english):
            return "Include rent, mortgage, or anything you pay regularly to live where you live. Estimate is fine. Enter 0 if you don't pay rent right now."
        case (.rent, .spanish):
            return "Incluye renta, hipoteca o cualquier pago regular por donde vives. Una estimación está bien. Pon 0 si no pagas renta ahora mismo."
        // T16 Gap #4
        case (.sharedHousing, .english):
            return "If roommates or family members share your address but are NOT on your SNAP case, only your share of the rent counts. Select 'Not sharing' if you live alone or everyone at your address is on your case."
        case (.sharedHousing, .spanish):
            return "Si compañeros de cuarto o familiares comparten tu domicilio pero NO están en tu caso de SNAP, solo tu parte de la renta cuenta. Selecciona 'No comparto' si vives solo o todos en tu domicilio están en tu caso."
        // T16: replaces paysUtilitiesSeparately yes/no helper
        case (.utilityTypes, .english):
            return "Select everything that applies. If utilities are included in your rent, leave everything unchecked. Air conditioning counts in California. Internet is not counted by SNAP."
        case (.utilityTypes, .spanish):
            return "Selecciona todo lo que aplique. Si los servicios están incluidos en tu renta, deja todo sin marcar. El aire acondicionado cuenta en California. Internet no cuenta para SNAP."
        case (.utilities, .english):
            return "Add up a typical month for the utilities you selected. Estimate is fine — the total is what matters."
        case (.utilities, .spanish):
            return "Suma un mes típico de los servicios que seleccionaste. Una estimación está bien — el total es lo que importa."
        case (.utilityShutoff, .english):
            return "A written or paper notice that power, gas, water, or heat will be cut off if you don't pay. This can speed up your SNAP application."
        case (.utilityShutoff, .spanish):
            return "Un aviso escrito o en papel de que cortarán la luz, el gas, el agua o la calefacción si no pagas. Esto puede acelerar tu solicitud de SNAP."
        case (.childcare, .english):
            return "Daycare, after-school, or anything that lets a working adult in your household keep working. Enter 0 if none."
        case (.childcare, .spanish):
            return "Guardería, programas después de la escuela, o cualquier cosa que permita a un adulto trabajador del hogar seguir trabajando. Pon 0 si no aplica."
        case (.medical, .english):
            return "Only counts if someone in your household is 60+ or has a disability. We're asking about co-pays, prescriptions, dental, or insurance premiums you pay out of pocket. Don't share diagnoses."
        case (.medical, .spanish):
            return "Solo cuenta si alguien en tu hogar tiene 60 años o más o vive con una discapacidad. Preguntamos por copagos, medicamentos, dentista o primas de seguro que pagas de tu bolsillo. No compartas diagnósticos."
        }
    }

    static func suffix(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Per month"
        case .spanish: return "Por mes"
        }
    }

    static func fieldAccessibilityLabel(for step: SNAPExpensesFlowViewModel.Step, language: CivicaLanguage) -> String {
        switch (step, language) {
        case (.rent, .english):         return "Monthly rent or housing payment, in dollars"
        case (.rent, .spanish):         return "Pago mensual de renta o vivienda, en dólares"
        case (.utilities, .english):    return "Monthly utilities total, in dollars"
        case (.utilities, .spanish):    return "Total de servicios mensuales, en dólares"
        case (.childcare, .english):    return "Monthly childcare costs, in dollars"
        case (.childcare, .spanish):    return "Costos mensuales de cuidado infantil, en dólares"
        case (.medical, .english):      return "Monthly out-of-pocket medical costs, in dollars"
        case (.medical, .spanish):      return "Gastos médicos mensuales de bolsillo, en dólares"
        case (.utilityShutoff, _):      return ""
        case (.utilityTypes, _):        return ""  // each row has its own accessibilityLabel
        case (.sharedHousing, _):       return ""  // stepper and pill have their own labels
        }
    }

    static func notSharingLabel(language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Not sharing — this rent is just mine"
        case .spanish: return "No comparto — esta renta es solo mía"
        }
    }

    static func totalOccupantsLabel(language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Total people at this address"
        case .spanish: return "Total de personas en este domicilio"
        }
    }

    static func selectHint(language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Double tap to select"
        case .spanish: return "Toca dos veces para seleccionar"
        }
    }

    static func deselectHint(language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Double tap to deselect"
        case .spanish: return "Toca dos veces para deseleccionar"
        }
    }

    static func triLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english):     return "Yes"
        case (.yes, .spanish):     return "Sí"
        case (.no, .english):      return "No"
        case (.no, .spanish):      return "No"
        case (.notSure, .english): return "I'm not sure"
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
