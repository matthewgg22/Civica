import CivicaDesignSystem
import Combine
import SwiftUI

// Proof of the one-question-per-screen cadence using
// CivicaQuestionScreen. Reshapes the "household basics" step from the
// legacy multi-field card into 3 sequential single-question screens.
//
// Order matters: household size is asked first because it's the
// strongest gate on every downstream calculation, then the two
// "special status" yes/nos that unlock SNAP's elderly/disabled
// deductions and child-related deductions.
//
// Not wired into SNAPRouter yet — the legacy SNAPApplicationView
// remains the active path. This file is the working template the
// remaining 8 application steps will follow when the migration
// commit lands.

/// BenefitsCal ABMRS marital-status options. Optional throughout —
/// an applicant who prefers not to say still passes through. The
/// extension maps each case to the state portal's matching label.
enum SNAPMaritalStatus: String, Codable, CaseIterable, Equatable {
    case single
    case married
    case domesticPartnership
    case separated
    case divorced
    case widowed
    case preferNotToSay
}

/// BenefitsCal ABNSN reasons for not having an SSN. Tier A only —
/// captured as a CHOICE, never as digits. See the privacy-firewall
/// note above `SNAPHouseholdAnswers.hasSSN` and issue #423 Phase 1.
///
/// Mirrors the BenefitsCal "Why don't you have a Social Security
/// Number?" options. Optional throughout — an applicant who has an
/// SSN never sees this question (the flow skips `.noSSNReason`).
enum SNAPNoSSNReason: String, Codable, CaseIterable, Equatable {
    case usCitizenNeverApplied
    case nonCitizenExempt
    case religiousObjection
    case other
    case preferNotToSay
}

// ─── PRIVACY FIREWALL — read this before adding ANY field below ──────────
//
// Civica holds the minimum PII required to fill the BenefitsCal form.
// SSN policy (issue #423, decided 2026-05-31):
//
//   Tier A: capture only the BenefitsCal METADATA — "Do you have an
//           SSN?" (Y/N/Applied for one) and, if "No", the no-SSN
//           reason. NEVER the digits. Lives in `hasSSN` +
//           `noSSNReason` below. This is what Phase 1 ships.
//
//   Tier B: SSN digits live in iOS Keychain only, Face-ID-gated,
//           NEVER synced to Civica servers. Phase 2; gated on legal
//           review and OWNED by Settings → Privacy, not by this
//           intake draft. The `SNAPApplicationDraft` packet payload
//           explicitly EXCLUDES any SSN digit field.
//
//   Tier 3: server-side SSN storage of any kind — INDEFINITELY
//           DEFERRED. Default of "no" stands.
//
// ENFORCEMENT: adding any property to `SNAPHouseholdAnswers` (or to
// any other SNAP*Answers / SNAPApplicationDraft type) that stores
// SSN DIGITS — even encrypted, even hashed — REQUIRES the commit
// message to include the marker `[privacy-review:ssn]` AND an
// explicit sign-off from legal. This comment is the canonical
// guardrail; the marker is the audit hook. If you find yourself
// considering such a field without that marker, stop and re-read
// the issue.
//
// ────────────────────────────────────────────────────────────────────────

struct SNAPHouseholdAnswers: Equatable, Codable {
    var householdSize: String?              // choice from buckets
    var hasMinorInHousehold: Bool?
    // OBBBA §10102(a) (FNS memo Oct 3 2025): dependent-child ABAWD exception
    // narrowed from under-18 to under-14. Populated only when hasMinorInHousehold
    // == true; nil when no minors are present (question is skipped).
    var hasChildUnder14InHousehold: Bool?
    var hasElderlyOrDisabled: Bool? = false
    /// Tier A SSN metadata (issue #423 Phase 1). Mirrors the
    /// BenefitsCal ABSSN choice — "Yes / No / Applied for one".
    /// Captured as METADATA ONLY — NEVER the digits. Optional so
    /// an applicant who prefers not to answer can pass through.
    /// See the PRIVACY FIREWALL block above for the full policy.
    var hasSSN: SNAPTri?
    /// Tier A no-SSN reason (BenefitsCal ABNSN). Asked only when
    /// `hasSSN == .no`; nil otherwise (the flow skips the screen).
    var noSSNReason: SNAPNoSSNReason?
    /// Migrant or seasonal farmworker status. With low liquid resources,
    /// satisfies 7 CFR 273.2(i)(1)(ii) (migrant/seasonal destitute) and
    /// the household qualifies for expedited service regardless of
    /// income. Asked as Tri because "not sure" is common.
    var migrantSeasonalFarmworker: SNAPTri?
    /// Wave 4 — BenefitsCal ABMRS. Optional. Used to autofill the
    /// state portal's marital-status field.
    var maritalStatus: SNAPMaritalStatus?
    /// Wave 5 — BenefitsCal ABBPF, aggregated. The state portal asks
    /// per-household-member; Civica asks once at the household level
    /// to keep the privacy posture (no per-member PII). When
    /// `householdSize > 1` and this is `.no`, the SNAP household unit
    /// may be smaller than the residence — a determination that
    /// affects benefit math. When household size is 1, the question
    /// is skipped (trivially yes).
    var everyoneBuysPreparesFoodTogether: SNAPTri?

    // Categorical eligibility inputs (7 CFR 273.2(j)). The question
    // flow does not yet ask these directly -- they're plumbed
    // through so SNAPRulesRegistry / SNAPLocalEligibilityEvaluator
    // can short-circuit income/asset tests when populated. Until
    // dedicated screens land, these stay nil and the evaluator
    // treats them as "unknown" rather than "no".
    var receivesTANF: Bool?
    var receivesSSI: Bool?
    var receivesGeneralAssistance: Bool?

    var isComplete: Bool {
        // hasSSN + noSSNReason are intentionally NOT required for
        // completeness — Tier A is optional metadata that improves
        // the BenefitsCal autofill but does not gate packet
        // generation. Same posture as maritalStatus / buyPrepareFood.
        householdSize != nil
            && hasMinorInHousehold != nil
            && (hasMinorInHousehold != true || hasChildUnder14InHousehold != nil)
            && hasElderlyOrDisabled != nil
            && migrantSeasonalFarmworker != nil
    }
}

@MainActor
final class SNAPHouseholdQuestionFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case size
        case minors
        case childrenUnder14    // shown only when hasMinorInHousehold == true
        case elderlyOrDisabled
        case ssnIntent          // Phase 1 (#423) — Tier A: hasSSN tri
        case noSSNReason        // Phase 1 (#423) — shown only when hasSSN == .no
        case migrantFarmworker
        case maritalStatus      // Wave 4 — always asked, optional
        case buyPrepareFood     // Wave 5 — shown only when householdSize > 1

        static let total = Self.allCases.count
        var oneBasedIndex: Int { rawValue + 1 }
    }

    @Published var step: Step = .size
    @Published var answers: SNAPHouseholdAnswers

    /// Per-change write-back closure (issue #425). When provided, fires
    /// on every mutation of `answers` so the orchestrator can mirror
    /// the slice into its draft as the user types — not only on
    /// section-complete. Nil-default keeps unit tests and previews
    /// (which construct the VM directly) working unchanged.
    var onAnswersChange: ((SNAPHouseholdAnswers) -> Void)?
    private var answersWatch: AnyCancellable?

    /// Seed prior answers so resume / edit round-trips preserve state.
    init(
        answers: SNAPHouseholdAnswers = .init(),
        onAnswersChange: ((SNAPHouseholdAnswers) -> Void)? = nil
    ) {
        self.answers = answers
        self.onAnswersChange = onAnswersChange
        // dropFirst() skips the initial @Published emission so the
        // orchestrator isn't told about the seeded value — only true
        // mid-flow edits flow back.
        self.answersWatch = $answers.dropFirst().sink { [weak self] new in
            self?.onAnswersChange?(new)
        }
    }

    func advance() {
        switch step {
        case .minors:
            // Skip childrenUnder14 when no minors in the household.
            step = answers.hasMinorInHousehold == true ? .childrenUnder14 : .elderlyOrDisabled
        case .ssnIntent:
            // Phase 1 #423: only ask the no-SSN reason when the
            // applicant said "No". "Applied for one" + "Yes" both
            // skip directly to migrant farmworker.
            step = answers.hasSSN == .no ? .noSSNReason : .migrantFarmworker
        case .maritalStatus:
            // Wave 5 — skip buyPrepareFood for single-person
            // households (trivially Yes). Household size buckets
            // include "1 person" as a discrete value.
            let isSingle = answers.householdSize == "1" || answers.householdSize?.lowercased() == "just me"
            if isSingle {
                answers.everyoneBuysPreparesFoodTogether = .yes
                // Done — no further steps after buyPrepareFood.
                return
            }
            step = .buyPrepareFood
        default:
            if let next = Step(rawValue: step.rawValue + 1) { step = next }
        }
    }

    func goBack() {
        switch step {
        case .elderlyOrDisabled:
            step = answers.hasMinorInHousehold == true ? .childrenUnder14 : .minors
        case .migrantFarmworker:
            // If we skipped noSSNReason on the way forward (hasSSN != .no),
            // skip it on the way back too.
            step = answers.hasSSN == .no ? .noSSNReason : .ssnIntent
        default:
            if let prev = Step(rawValue: step.rawValue - 1) { step = prev }
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .size: return answers.householdSize != nil
        case .minors: return answers.hasMinorInHousehold != nil
        case .childrenUnder14: return answers.hasChildUnder14InHousehold != nil
        case .elderlyOrDisabled: return answers.hasElderlyOrDisabled != nil
        case .ssnIntent: return answers.hasSSN != nil
        case .noSSNReason: return answers.noSSNReason != nil
        case .migrantFarmworker: return answers.migrantSeasonalFarmworker != nil
        case .maritalStatus: return answers.maritalStatus != nil
        case .buyPrepareFood: return answers.everyoneBuysPreparesFoodTogether != nil
        }
    }

    var isAtFirstStep: Bool { step == .size }
    var isAtLastStep: Bool { step == .migrantFarmworker }
}

struct SNAPHouseholdQuestionFlowView: View {
    @StateObject var viewModel: SNAPHouseholdQuestionFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPHouseholdAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPHouseholdQuestionFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPHouseholdAnswers) -> Void,
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
                    if viewModel.isAtFirstStep {
                        Button(action: onExit) {
                            Image(systemName: "xmark")
                                .foregroundStyle(CivicaColors.ink)
                        }
                        .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                    } else {
                        Button {
                            civicaWithAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
                        } label: {
                            Image(systemName: "chevron.left")
                                .foregroundStyle(CivicaColors.ink)
                        }
                        .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .size: sizeScreen
        case .minors: minorsScreen
        case .childrenUnder14: childrenUnder14Screen
        case .elderlyOrDisabled: elderlyOrDisabledScreen
        case .ssnIntent: ssnIntentScreen
        case .noSSNReason: noSSNReasonScreen
        case .migrantFarmworker: migrantFarmworkerScreen
        case .maritalStatus: maritalStatusScreen
        case .buyPrepareFood: buyPrepareFoodScreen
        }
    }

    // MARK: - Screen 1: household size

    /// Canonical stored values — must match
    /// SNAPLocalEligibilityEvaluator.parseHouseholdSize ("Just me" → 1,
    /// "N people" → N).
    private static let sizeJustMe = "Just me"
    private static let sizeTwo = "2 people"
    private static let sizeThree = "3 people"
    /// Max the 4+ stepper goes to. Beyond the calculator's 1...8 range
    /// the federal allotment extrapolates per additional person, so a
    /// larger exact count is still meaningful for eligibility.
    private static let sizeStepperMax = 12

    /// Parsed integer of the current stored size (0 when unset).
    private var currentSizeCount: Int {
        guard let raw = viewModel.answers.householdSize else { return 0 }
        if raw == Self.sizeJustMe { return 1 }
        return Int(String(raw.prefix(while: \.isNumber))) ?? 0
    }

    /// True once the user is in the "4 or more" exact-count path.
    private var isFourPlusSelected: Bool { currentSizeCount >= 4 }

    private var sizeScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .size),
            title: SNAPHouseholdQuestionStrings.sizeTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.sizeHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(spacing: CivicaSpacing.sm) {
                sizeRow(
                    label: SNAPHouseholdQuestionStrings.sizeOptionJustMe.value(in: language),
                    isSelected: viewModel.answers.householdSize == Self.sizeJustMe
                ) { viewModel.answers.householdSize = Self.sizeJustMe }
                sizeRow(
                    label: SNAPHouseholdQuestionStrings.sizeOptionTwo.value(in: language),
                    isSelected: viewModel.answers.householdSize == Self.sizeTwo
                ) { viewModel.answers.householdSize = Self.sizeTwo }
                sizeRow(
                    label: SNAPHouseholdQuestionStrings.sizeOptionThree.value(in: language),
                    isSelected: viewModel.answers.householdSize == Self.sizeThree
                ) { viewModel.answers.householdSize = Self.sizeThree }

                // "4 or more" — tapping selects it (defaults to 4) and
                // reveals a stepper to set the exact count, which is
                // what the benefit math actually needs (a flat "4"
                // under-counts a household of 6).
                sizeRow(
                    label: SNAPHouseholdQuestionStrings.sizeOptionFourPlus.value(in: language),
                    isSelected: isFourPlusSelected
                ) {
                    if !isFourPlusSelected {
                        viewModel.answers.householdSize = "4 people"
                    }
                }

                if isFourPlusSelected {
                    fourPlusStepper
                }
            }
        }
    }

    /// Single tappable size option, ink-selection styling (matches
    /// CivicaQuestionChoices after the §2.2 color pass).
    private func sizeRow(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(isSelected ? CivicaColors.pinePrimary : CivicaColors.graphite.opacity(0.6))
                    .accessibilityHidden(true)
                Text(label)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 56)
            .background(isSelected ? CivicaColors.surfaceSecondary : CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(isSelected ? CivicaColors.ink : CivicaColors.hairline,
                                  lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    /// +/- stepper for the exact count once "4 or more" is chosen.
    private var fourPlusStepper: some View {
        let count = max(4, currentSizeCount)
        return HStack(spacing: CivicaSpacing.md) {
            Text(SNAPHouseholdQuestionStrings.sizeStepperLabel.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            Spacer()
            Stepper(
                value: Binding(
                    get: { count },
                    set: { viewModel.answers.householdSize = "\($0) people" }
                ),
                in: 4...Self.sizeStepperMax
            ) {
                Text("\(count)\(count == Self.sizeStepperMax ? "+" : "")")
                    .font(CivicaTypography.cardTitle.monospacedDigit())
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityLabel(
                        SNAPHouseholdQuestionStrings.sizeStepperAccessibility(count: count, language: language)
                    )
            }
            .labelsHidden()
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.ink, lineWidth: 2)
        )
    }

    // MARK: - Screen 2: minors present?

    private var minorsScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .minors),
            title: SNAPHouseholdQuestionStrings.minorsTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.minorsHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasMinorInHousehold,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Screen 3: any children under 14? (shown only when hasMinorInHousehold == true)

    private var childrenUnder14Screen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .childrenUnder14),
            title: SNAPHouseholdQuestionStrings.childrenUnder14Title.value(in: language),
            helper: SNAPHouseholdQuestionStrings.childrenUnder14Helper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasChildUnder14InHousehold,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Screen 4: migrant or seasonal farmworker?

    // MARK: - Wave 5: buy & prepare food together (BenefitsCal ABBPF, aggregated)

    private var buyPrepareFoodScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .buyPrepareFood),
            title: SNAPHouseholdQuestionStrings.buyPrepareFoodTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.buyPrepareFoodHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.everyoneBuysPreparesFoodTogether.map {
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.everyoneBuysPreparesFoodTogether = options.first { tri in
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Wave 4: marital status (BenefitsCal ABMRS)

    private var maritalStatusScreen: some View {
        let options = SNAPMaritalStatus.allCases
        return CivicaQuestionScreen(
            progress: progress(for: .maritalStatus),
            title: SNAPHouseholdQuestionStrings.maritalStatusTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.maritalStatusHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.maritalStatusLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.maritalStatus.map {
                            SNAPHouseholdQuestionStrings.maritalStatusLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.maritalStatus = options.first { status in
                            SNAPHouseholdQuestionStrings.maritalStatusLabel(for: status, language: language) == label
                        }
                    }
                )
            )
        }
    }

    private var migrantFarmworkerScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .migrantFarmworker),
            title: SNAPHouseholdQuestionStrings.migrantFarmworkerTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.migrantFarmworkerHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.migrantSeasonalFarmworker.map {
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.migrantSeasonalFarmworker = options.first { tri in
                            SNAPHouseholdQuestionStrings.migrantTriLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Screen: SSN intent (Phase 1 #423, Tier A metadata only)

    /// Tier A "Do you have an SSN?" — Yes / No / Applied for one.
    /// CAPTURES METADATA ONLY. The applicant never types digits;
    /// digits never leave the device (Phase 2 / Keychain only).
    /// See the privacy-firewall block above `SNAPHouseholdAnswers`.
    private var ssnIntentScreen: some View {
        let options: [SNAPTri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: .ssnIntent),
            title: SNAPHouseholdQuestionStrings.ssnIntentTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.ssnIntentHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.ssnIntentLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.hasSSN.map {
                            SNAPHouseholdQuestionStrings.ssnIntentLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.hasSSN = options.first { tri in
                            SNAPHouseholdQuestionStrings.ssnIntentLabel(for: tri, language: language) == label
                        }
                        // Clear noSSNReason if the applicant changes
                        // their answer away from "No" — keeps the
                        // draft model consistent with the flow's
                        // conditional skip in `advance()`.
                        if viewModel.answers.hasSSN != .no {
                            viewModel.answers.noSSNReason = nil
                        }
                    }
                )
            )
        }
    }

    /// Tier A no-SSN reason (BenefitsCal ABNSN). Shown only when
    /// hasSSN == .no. Never asks for digits.
    private var noSSNReasonScreen: some View {
        let options = SNAPNoSSNReason.allCases
        return CivicaQuestionScreen(
            progress: progress(for: .noSSNReason),
            title: SNAPHouseholdQuestionStrings.noSSNReasonTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.noSSNReasonHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map {
                    SNAPHouseholdQuestionStrings.noSSNReasonLabel(for: $0, language: language)
                },
                selection: Binding(
                    get: {
                        viewModel.answers.noSSNReason.map {
                            SNAPHouseholdQuestionStrings.noSSNReasonLabel(for: $0, language: language)
                        }
                    },
                    set: { label in
                        viewModel.answers.noSSNReason = options.first { reason in
                            SNAPHouseholdQuestionStrings.noSSNReasonLabel(for: reason, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Screen 3: elderly / disabled in household?

    private var elderlyOrDisabledScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .elderlyOrDisabled),
            title: SNAPHouseholdQuestionStrings.elderlyOrDisabledTitle.value(in: language),
            helper: SNAPHouseholdQuestionStrings.elderlyOrDisabledHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: $viewModel.answers.hasElderlyOrDisabled,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPHouseholdQuestionFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPHouseholdQuestionFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.household.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.household.title(in: language)
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

// Strings live alongside the flow so each question's exact wording is
// reviewable in one place. EN/ES parity held.
enum SNAPHouseholdQuestionStrings {

    static let sizeTitle = CivicaText(
        "How many people live in your household?",
        es: "¿Cuántas personas viven en tu hogar?",
        zh: "你家里有多少人?",
        vi: "Có bao nhiêu người sống trong gia đình bạn?",
        tl: "Ilan ang nakatira sa iyong sambahayan?"
    )
    static let sizeHelper = CivicaText(
        "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
        es: "Incluye a cualquiera que comparta comestibles contigo — pareja, hijos o compañeros de casa que comen juntos.",
        zh: "把所有和你一起买菜的人都算进去 — 伴侣、孩子、一起吃饭的室友。",
        vi: "Tính cả những người cùng chia sẻ thực phẩm với bạn — bạn đời, con cái, bạn cùng nhà ăn chung.",
        tl: "Isama ang sinumang kasama mong bumibili ng pagkain — partner, mga anak, o mga kasama sa bahay na sabay kayong kumakain."
    )
    static let sizeOptionJustMe = CivicaText("Just me", es: "Solo yo", zh: "只有我", vi: "Chỉ mình tôi", tl: "Ako lang")
    static let sizeOptionTwo = CivicaText("2 people", es: "2 personas", zh: "2 人", vi: "2 người", tl: "2 tao")
    static let sizeOptionThree = CivicaText("3 people", es: "3 personas", zh: "3 人", vi: "3 người", tl: "3 tao")
    static let sizeOptionFourPlus = CivicaText("4 or more", es: "4 o más", zh: "4 人或更多", vi: "4 người trở lên", tl: "4 o higit pa")
    static let sizeStepperLabel = CivicaText(
        "How many people total?",
        es: "¿Cuántas personas en total?",
        zh: "总共多少人?",
        vi: "Tổng cộng bao nhiêu người?",
        tl: "Ilang tao lahat?"
    )
    static func sizeStepperAccessibility(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(count) people in your household"
        case .mandarin: return "你家里有 \(count) 人"
        case .spanish: return "\(count) personas en tu hogar"
        case .vietnamese: return "\(count) người trong gia đình bạn"
        case .tagalog: return "\(count) tao sa iyong sambahayan"
        }
    }

    static let minorsTitle = CivicaText(
        "Is anyone in your household 18 or under?",
        es: "¿Hay alguien en tu hogar de 18 años o menos?",
        zh: "你家里有人 18 岁或以下吗?",
        vi: "Trong gia đình bạn có ai từ 18 tuổi trở xuống không?",
        tl: "May 18 anyos o mas bata ba sa iyong sambahayan?"
    )
    static let minorsHelper = CivicaText(
        "Children in the household can unlock extra SNAP deductions and may make you eligible for expedited service.",
        es: "Los menores en el hogar pueden desbloquear deducciones adicionales de SNAP y pueden hacer que califiques para servicio expedito.",
        zh: "家里有孩子可以解锁额外的 SNAP 扣除额,还可能让你符合加急办理的条件。",
        vi: "Trẻ em trong gia đình có thể mở thêm các khoản khấu trừ SNAP và có thể giúp bạn đủ điều kiện được xử lý nhanh.",
        tl: "Ang mga bata sa sambahayan ay maaaring magbukas ng dagdag na SNAP deductions at maaaring gawin kang kuwalipikado para sa mabilis na proseso."
    )

    // OBBBA §10102(a): shown only when hasMinorInHousehold == true
    static let childrenUnder14Title = CivicaText(
        "Are any of those children under 14?",
        es: "¿Alguno de esos niños tiene menos de 14 años?",
        zh: "这些孩子里有人不满 14 岁吗?",
        vi: "Trong số những trẻ đó có em nào dưới 14 tuổi không?",
        tl: "May wala pang 14 anyos ba sa mga batang iyon?"
    )
    static let childrenUnder14Helper = CivicaText(
        "This determines who in your household needs to meet SNAP's work requirement for able-bodied adults.",
        es: "Esto determina quién en tu hogar necesita cumplir con el requisito de trabajo de SNAP para adultos capaces.",
        zh: "这决定了你家里哪些人需要满足 SNAP 对健全成年人的工作要求。",
        vi: "Điều này xác định ai trong gia đình bạn cần đáp ứng yêu cầu làm việc của SNAP dành cho người lớn có đủ sức khỏe lao động.",
        tl: "Ito ang nagtatakda kung sino sa iyong sambahayan ang kailangang tumupad sa work requirement ng SNAP para sa mga adultong may kakayahang magtrabaho."
    )

    static let elderlyOrDisabledTitle = CivicaText(
        "Is anyone 60 or older, or living with a disability?",
        es: "¿Hay alguien de 60 años o más, o que vive con una discapacidad?",
        zh: "家里有人 60 岁或以上,或者有残疾吗?",
        vi: "Trong gia đình có ai từ 60 tuổi trở lên, hoặc đang sống với khuyết tật không?",
        tl: "May 60 anyos pataas ba, o may kapansanan, sa sambahayan?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "This matters for SNAP — older adults and people with disabilities get extra deductions and don't face an asset test in Massachusetts.",
        es: "Esto importa para SNAP — los adultos mayores y las personas con discapacidad reciben deducciones adicionales y no enfrentan una prueba de bienes en Massachusetts.",
        zh: "这对 SNAP 很重要 — 老年人和残障人士可以获得额外的扣除额,在 Massachusetts 也不需要做资产审查。",
        vi: "Điều này quan trọng với SNAP — người lớn tuổi và người khuyết tật được khấu trừ thêm và không phải làm kiểm tra tài sản ở Massachusetts.",
        tl: "Mahalaga ito para sa SNAP — ang mga nakatatanda at mga taong may kapansanan ay nakakakuha ng dagdag na deductions at hindi dumaranas ng asset test sa Massachusetts."
    )

    // Wave 5 — aggregate buy-prepare-food (BenefitsCal ABBPF, household-level)
    static let buyPrepareFoodTitle = CivicaText(
        "Does everyone in your household buy and prepare food together?",
        es: "¿Todos en tu hogar compran y preparan la comida juntos?",
        zh: "你家里所有人都一起买菜、做饭吗?",
        vi: "Mọi người trong gia đình bạn có cùng mua và nấu ăn chung không?",
        tl: "Sabay-sabay ba kayong bumibili at naghahanda ng pagkain sa iyong sambahayan?"
    )
    static let buyPrepareFoodHelper = CivicaText(
        "SNAP counts people who share food costs as one household — even if they're not related. Roommates who buy and cook separately may be separate SNAP cases.",
        es: "SNAP cuenta a las personas que comparten los costos de comida como un solo hogar — aunque no estén emparentadas. Compañeros de cuarto que compran y cocinan por separado pueden ser casos de SNAP separados.",
        zh: "SNAP 把分摊伙食开销的人算作同一个家庭 — 就算没有亲属关系也一样。分开买菜、分开做饭的室友可能是各自独立的 SNAP 案件。",
        vi: "SNAP tính những người cùng chia sẻ chi phí thực phẩm là một gia đình — ngay cả khi họ không có quan hệ họ hàng. Bạn cùng nhà mua và nấu ăn riêng có thể là các hồ sơ SNAP riêng biệt.",
        tl: "Itinuturing ng SNAP na isang sambahayan ang mga taong naghahatian sa gastos sa pagkain — kahit hindi sila magkamag-anak. Ang mga kasama sa bahay na hiwalay bumibili at nagluluto ay maaaring magkahiwalay na SNAP cases."
    )

    // Wave 4 — marital status (BenefitsCal ABMRS)
    static let maritalStatusTitle = CivicaText(
        "What's your marital status?",
        es: "¿Cuál es tu estado civil?",
        zh: "你的婚姻状况是什么?",
        vi: "Tình trạng hôn nhân của bạn là gì?",
        tl: "Ano ang iyong marital status?"
    )
    static let maritalStatusHelper = CivicaText(
        "California asks this on the SNAP application. Pick what fits — \"Prefer not to say\" is a valid answer and your benefits aren't affected by your choice.",
        es: "California pregunta esto en la solicitud de SNAP. Elige lo que aplica — \"Prefiero no decir\" es una respuesta válida y tus beneficios no se ven afectados por tu elección.",
        zh: "California 在 SNAP 申请表上会问这个问题。选一个适合你的 — 「不想说」也是有效答案,你的选择不会影响福利。",
        vi: "California hỏi điều này trên đơn xin SNAP. Chọn câu phù hợp — \u{201C}Không muốn nói\u{201D} là câu trả lời hợp lệ và lựa chọn của bạn không ảnh hưởng đến quyền lợi của bạn.",
        tl: "Itinatanong ito ng California sa SNAP application. Piliin ang akma sa iyo — \u{201C}Ayaw kong sabihin\u{201D} ay tanggap na sagot at hindi naaapektuhan ng pinili mo ang iyong mga benepisyo."
    )

    static func maritalStatusLabel(for value: SNAPMaritalStatus, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.single, .english): return "Single"
        case (.single, .mandarin): return "单身"
        case (.single,              .spanish): return "Soltero/a"
        case (.single, .vietnamese): return "Độc thân"
        case (.single, .tagalog): return "Walang asawa"
        case (.married, .english): return "Married"
        case (.married, .mandarin): return "已婚"
        case (.married,             .spanish): return "Casado/a"
        case (.married, .vietnamese): return "Đã kết hôn"
        case (.married, .tagalog): return "May asawa"
        case (.domesticPartnership, .english): return "Domestic partnership"
        case (.domesticPartnership, .mandarin): return "同居伴侣关系"
        case (.domesticPartnership, .spanish): return "Unión doméstica"
        case (.domesticPartnership, .vietnamese): return "Quan hệ chung sống"
        case (.domesticPartnership, .tagalog): return "Domestic partnership"
        case (.separated, .english): return "Separated"
        case (.separated, .mandarin): return "分居"
        case (.separated,           .spanish): return "Separado/a"
        case (.separated, .vietnamese): return "Ly thân"
        case (.separated, .tagalog): return "Hiwalay"
        case (.divorced, .english): return "Divorced"
        case (.divorced, .mandarin): return "离异"
        case (.divorced,            .spanish): return "Divorciado/a"
        case (.divorced, .vietnamese): return "Đã ly hôn"
        case (.divorced, .tagalog): return "Diborsiyado"
        case (.widowed, .english): return "Widowed"
        case (.widowed, .mandarin): return "丧偶"
        case (.widowed,             .spanish): return "Viudo/a"
        case (.widowed, .vietnamese): return "Góa"
        case (.widowed, .tagalog): return "Balo"
        case (.preferNotToSay, .english): return "Prefer not to say"
        case (.preferNotToSay, .mandarin): return "不想说"
        case (.preferNotToSay,      .spanish): return "Prefiero no decir"
        case (.preferNotToSay, .vietnamese): return "Không muốn nói"
        case (.preferNotToSay, .tagalog): return "Ayaw kong sabihin"
        }
    }

    static let migrantFarmworkerTitle = CivicaText(
        "Is anyone in your household a migrant or seasonal farmworker?",
        es: "¿Alguien en tu hogar es trabajador agrícola migrante o de temporada?",
        zh: "你家里有人是流动农工或季节性农工吗?",
        vi: "Trong gia đình bạn có ai là lao động nông nghiệp di trú hoặc theo mùa không?",
        tl: "May migrant o seasonal farmworker ba sa iyong sambahayan?"
    )
    static let migrantFarmworkerHelper = CivicaText(
        "Yes if someone works in crops, livestock, or food processing on a seasonal or traveling basis. SNAP has a separate expedited path for farmworker households.",
        es: "Sí si alguien trabaja en cultivos, ganadería o procesamiento de alimentos de manera estacional o viajando. SNAP tiene una vía expedita aparte para hogares de trabajadores agrícolas.",
        zh: "如果有人按季节或随处迁移地从事种植、养殖或食品加工,就选「是」。SNAP 为农工家庭设有单独的加急通道。",
        vi: "Chọn Có nếu ai đó làm việc về trồng trọt, chăn nuôi hoặc chế biến thực phẩm theo mùa hoặc phải di chuyển nhiều nơi. SNAP có một lối xử lý nhanh riêng cho các gia đình lao động nông nghiệp.",
        tl: "Oo kung may nagtatrabaho sa pananim, hayupan, o food processing nang pana-panahon o naglalakbay. May hiwalay na mabilis na proseso ang SNAP para sa mga sambahayan ng farmworker."
    )

    static func migrantTriLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english):     return "Yes"
        case (.yes, .mandarin):    return "是"
        case (.yes, .spanish):     return "Sí"
        case (.yes, .vietnamese):  return "Có"
        case (.yes, .tagalog):     return "Oo"
        case (.no, .english):      return "No"
        case (.no, .mandarin):     return "否"
        case (.no, .spanish):      return "No"
        case (.no, .vietnamese):   return "Không"
        case (.no, .tagalog):      return "Hindi"
        case (.notSure, .english): return "I'm not sure"
        case (.notSure, .mandarin): return "我不确定"
        case (.notSure, .spanish): return "No estoy seguro"
        case (.notSure, .vietnamese): return "Tôi không chắc"
        case (.notSure, .tagalog): return "Hindi ako sigurado"
        }
    }

    // MARK: - SSN intent + reason (Tier A only — never digits)
    // Phase 1 of issue #423. See the PRIVACY FIREWALL comment block
    // in this file above `SNAPHouseholdAnswers` for the policy.

    static let ssnIntentTitle = CivicaText(
        "Do you have a Social Security Number?",
        es: "¿Tienes un número de Seguro Social?"
    )
    static let ssnIntentHelper = CivicaText(
        "We never ask for or store the digits. We only ask whether you have one so the SNAP application can be filled out correctly.",
        es: "Nunca pedimos ni guardamos los dígitos. Solo preguntamos si tienes uno para que la solicitud de SNAP pueda completarse correctamente."
    )

    static func ssnIntentLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english), (.yes, .mandarin), (.yes, .vietnamese), (.yes, .tagalog):     return "Yes"
        case (.yes, .spanish):     return "Sí"
        case (.no, .english), (.no, .mandarin), (.no, .vietnamese), (.no, .tagalog):      return "No"
        case (.no, .spanish):      return "No"
        // The third option ("Applied for one") reuses the .notSure
        // case from SNAPTri to avoid a parallel enum that doesn't
        // carry any extra meaning. Label text is the BenefitsCal-
        // accurate phrasing.
        case (.notSure, .english), (.notSure, .mandarin), (.notSure, .vietnamese), (.notSure, .tagalog): return "I've applied for one"
        case (.notSure, .spanish): return "He solicitado uno"
        }
    }

    static let noSSNReasonTitle = CivicaText(
        "Why don't you have a Social Security Number?",
        es: "¿Por qué no tienes un número de Seguro Social?"
    )
    static let noSSNReasonHelper = CivicaText(
        "California asks this to know which path the SNAP application should follow. You can pick \"Prefer not to say\" — your benefits aren't affected by which option you choose.",
        es: "California pregunta esto para saber qué vía debe seguir la solicitud de SNAP. Puedes elegir \"Prefiero no decir\" — tus beneficios no se ven afectados por la opción que elijas."
    )

    static func noSSNReasonLabel(for value: SNAPNoSSNReason, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.usCitizenNeverApplied, .english), (.usCitizenNeverApplied, .mandarin), (.usCitizenNeverApplied, .vietnamese), (.usCitizenNeverApplied, .tagalog):
            return "U.S. citizen who has never applied"
        case (.usCitizenNeverApplied, .spanish):
            return "Ciudadano/a estadounidense que nunca ha solicitado uno"
        case (.nonCitizenExempt, .english), (.nonCitizenExempt, .mandarin), (.nonCitizenExempt, .vietnamese), (.nonCitizenExempt, .tagalog):
            return "Non-citizen who isn't required to have one"
        case (.nonCitizenExempt, .spanish):
            return "No ciudadano/a que no está obligado/a a tener uno"
        case (.religiousObjection, .english), (.religiousObjection, .mandarin), (.religiousObjection, .vietnamese), (.religiousObjection, .tagalog):
            return "Religious objection"
        case (.religiousObjection, .spanish):
            return "Objeción religiosa"
        case (.other, .english), (.other, .mandarin), (.other, .vietnamese), (.other, .tagalog):
            return "Another reason"
        case (.other, .spanish):
            return "Otra razón"
        case (.preferNotToSay, .english), (.preferNotToSay, .mandarin), (.preferNotToSay, .vietnamese), (.preferNotToSay, .tagalog):
            return "Prefer not to say"
        case (.preferNotToSay, .spanish):
            return "Prefiero no decir"
        }
    }
}

#if DEBUG
struct SNAPHouseholdQuestionFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPHouseholdQuestionFlowView(
                viewModel: SNAPHouseholdQuestionFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
