import CivicaDesignSystem
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

    /// Seed prior answers so resume / edit round-trips preserve state.
    init(answers: SNAPHouseholdAnswers = .init()) {
        self.answers = answers
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
        es: "¿Cuántas personas viven en tu hogar?"
    )
    static let sizeHelper = CivicaText(
        "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
        es: "Incluye a cualquiera que comparta comestibles contigo — pareja, hijos o compañeros de casa que comen juntos."
    )
    static let sizeOptionJustMe = CivicaText("Just me", es: "Solo yo")
    static let sizeOptionTwo = CivicaText("2 people", es: "2 personas")
    static let sizeOptionThree = CivicaText("3 people", es: "3 personas")
    static let sizeOptionFourPlus = CivicaText("4 or more", es: "4 o más")
    static let sizeStepperLabel = CivicaText(
        "How many people total?",
        es: "¿Cuántas personas en total?"
    )
    static func sizeStepperAccessibility(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "\(count) people in your household"
        case .spanish: return "\(count) personas en tu hogar"
        }
    }

    static let minorsTitle = CivicaText(
        "Is anyone in your household 18 or under?",
        es: "¿Hay alguien en tu hogar de 18 años o menos?"
    )
    static let minorsHelper = CivicaText(
        "Children in the household can unlock extra SNAP deductions and may make you eligible for expedited service.",
        es: "Los menores en el hogar pueden desbloquear deducciones adicionales de SNAP y pueden hacer que califiques para servicio expedito."
    )

    // OBBBA §10102(a): shown only when hasMinorInHousehold == true
    static let childrenUnder14Title = CivicaText(
        "Are any of those children under 14?",
        es: "¿Alguno de esos niños tiene menos de 14 años?"
    )
    static let childrenUnder14Helper = CivicaText(
        "This determines who in your household needs to meet SNAP's work requirement for able-bodied adults.",
        es: "Esto determina quién en tu hogar necesita cumplir con el requisito de trabajo de SNAP para adultos capaces."
    )

    static let elderlyOrDisabledTitle = CivicaText(
        "Is anyone 60 or older, or living with a disability?",
        es: "¿Hay alguien de 60 años o más, o que vive con una discapacidad?"
    )
    static let elderlyOrDisabledHelper = CivicaText(
        "This matters for SNAP — older adults and people with disabilities get extra deductions and don't face an asset test in Massachusetts.",
        es: "Esto importa para SNAP — los adultos mayores y las personas con discapacidad reciben deducciones adicionales y no enfrentan una prueba de bienes en Massachusetts."
    )

    // Wave 5 — aggregate buy-prepare-food (BenefitsCal ABBPF, household-level)
    static let buyPrepareFoodTitle = CivicaText(
        "Does everyone in your household buy and prepare food together?",
        es: "¿Todos en tu hogar compran y preparan la comida juntos?"
    )
    static let buyPrepareFoodHelper = CivicaText(
        "SNAP counts people who share food costs as one household — even if they're not related. Roommates who buy and cook separately may be separate SNAP cases.",
        es: "SNAP cuenta a las personas que comparten los costos de comida como un solo hogar — aunque no estén emparentadas. Compañeros de cuarto que compran y cocinan por separado pueden ser casos de SNAP separados."
    )

    // Wave 4 — marital status (BenefitsCal ABMRS)
    static let maritalStatusTitle = CivicaText(
        "What's your marital status?",
        es: "¿Cuál es tu estado civil?"
    )
    static let maritalStatusHelper = CivicaText(
        "California asks this on the SNAP application. Pick what fits — \"Prefer not to say\" is a valid answer and your benefits aren't affected by your choice.",
        es: "California pregunta esto en la solicitud de SNAP. Elige lo que aplica — \"Prefiero no decir\" es una respuesta válida y tus beneficios no se ven afectados por tu elección."
    )

    static func maritalStatusLabel(for value: SNAPMaritalStatus, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.single, .english), (.single, .mandarin), (.single, .vietnamese), (.single, .tagalog): return "Single"
        case (.single,              .spanish): return "Soltero/a"
        case (.married, .english), (.married, .mandarin), (.married, .vietnamese), (.married, .tagalog): return "Married"
        case (.married,             .spanish): return "Casado/a"
        case (.domesticPartnership, .english), (.domesticPartnership, .mandarin), (.domesticPartnership, .vietnamese), (.domesticPartnership, .tagalog): return "Domestic partnership"
        case (.domesticPartnership, .spanish): return "Unión doméstica"
        case (.separated, .english), (.separated, .mandarin), (.separated, .vietnamese), (.separated, .tagalog): return "Separated"
        case (.separated,           .spanish): return "Separado/a"
        case (.divorced, .english), (.divorced, .mandarin), (.divorced, .vietnamese), (.divorced, .tagalog): return "Divorced"
        case (.divorced,            .spanish): return "Divorciado/a"
        case (.widowed, .english), (.widowed, .mandarin), (.widowed, .vietnamese), (.widowed, .tagalog): return "Widowed"
        case (.widowed,             .spanish): return "Viudo/a"
        case (.preferNotToSay, .english), (.preferNotToSay, .mandarin), (.preferNotToSay, .vietnamese), (.preferNotToSay, .tagalog): return "Prefer not to say"
        case (.preferNotToSay,      .spanish): return "Prefiero no decir"
        }
    }

    static let migrantFarmworkerTitle = CivicaText(
        "Is anyone in your household a migrant or seasonal farmworker?",
        es: "¿Alguien en tu hogar es trabajador agrícola migrante o de temporada?"
    )
    static let migrantFarmworkerHelper = CivicaText(
        "Yes if someone works in crops, livestock, or food processing on a seasonal or traveling basis. SNAP has a separate expedited path for farmworker households.",
        es: "Sí si alguien trabaja en cultivos, ganadería o procesamiento de alimentos de manera estacional o viajando. SNAP tiene una vía expedita aparte para hogares de trabajadores agrícolas."
    )

    static func migrantTriLabel(for value: SNAPTri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english), (.yes, .mandarin), (.yes, .vietnamese), (.yes, .tagalog):     return "Yes"
        case (.yes, .spanish):     return "Sí"
        case (.no, .english), (.no, .mandarin), (.no, .vietnamese), (.no, .tagalog):      return "No"
        case (.no, .spanish):      return "No"
        case (.notSure, .english), (.notSure, .mandarin), (.notSure, .vietnamese), (.notSure, .tagalog): return "I'm not sure"
        case (.notSure, .spanish): return "No estoy seguro"
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
