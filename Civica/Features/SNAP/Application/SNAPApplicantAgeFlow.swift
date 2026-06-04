import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "applicantAgeStep" multi-field card from
// SNAPApplicationView into the one-question-per-screen cadence.
// Single question — applicant date of birth — using
// CivicaQuestionScreen with an inline DatePicker affordance.
//
// Why DOB instead of "how old are you?": SNAP eligibility cares
// about exact age (60+ unlocks elderly deductions; under-18 routes
// through a guardian's case). DOB is the source-of-truth that the
// official application asks for too, so we mirror it.
//
// Not wired into SNAPRouter yet — see SNAPWhereApplyingFlow.swift
// for the migration-cutover rationale.

struct SNAPApplicantAgeAnswers: Equatable, Codable {
    var dateOfBirth: Date?

    var derivedAge: Int? {
        guard let dateOfBirth else { return nil }
        let components = Calendar.current.dateComponents([.year], from: dateOfBirth, to: Date())
        return components.year
    }

    var isComplete: Bool { dateOfBirth != nil }
}

@MainActor
final class SNAPApplicantAgeFlowViewModel: ObservableObject {
    @Published var answers: SNAPApplicantAgeAnswers

    /// Default DOB shown when the user first lands on the picker —
    /// 30 years ago is roughly the median U.S. SNAP applicant age and
    /// keeps the wheel near a useful position rather than at "today".
    @Published var pickerDate: Date

    /// True once the user has interacted with the picker. Used to
    /// distinguish "I haven't answered yet" from "I picked today's
    /// date" — the former blocks Continue, the latter doesn't.
    @Published var hasInteracted: Bool

    init(answers: SNAPApplicantAgeAnswers = .init()) {
        self.answers = answers
        // Seed the picker + interacted flag from prior answers so a
        // returning user sees their previous DOB on the wheel rather
        // than the 30-years-ago default.
        if let dob = answers.dateOfBirth {
            self.pickerDate = dob
            self.hasInteracted = true
        } else {
            self.pickerDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
            self.hasInteracted = false
        }
    }

    var canAdvance: Bool {
        guard hasInteracted else { return false }
        guard let dob = answers.dateOfBirth else { return false }
        // No DOB in the future, none implausibly old (≥120 years).
        let now = Date()
        let cutoff = Calendar.current.date(byAdding: .year, value: -120, to: now) ?? .distantPast
        return dob <= now && dob >= cutoff
    }

    func recordInteraction(_ newDate: Date) {
        hasInteracted = true
        pickerDate = newDate
        answers.dateOfBirth = newDate
    }
}

struct SNAPApplicantAgeFlowView: View {
    @StateObject var viewModel: SNAPApplicantAgeFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPApplicantAgeAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPApplicantAgeFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPApplicantAgeAnswers) -> Void,
        onExit: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
    }

    var body: some View {
        CivicaQuestionScreen(
            progress: .init(
                current: 1,
                total: 1,
                sectionIndex: SNAPApplicationSection.applicantAge.oneBasedIndex,
                sectionCount: SNAPApplicationSection.count,
                sectionTitle: SNAPApplicationSection.applicantAge.title(in: language)
            ),
            title: SNAPApplicantAgeStrings.title.value(in: language),
            helper: SNAPApplicantAgeStrings.helper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvance,
            onPrimary: { onComplete(viewModel.answers) },
            language: language
        ) {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                ageReadout
                datePicker
                // Wave C — ID-scan to pre-fill DOB. Hidden on
                // devices without on-device extraction available.
                // Name extraction is intentionally DROPPED here per
                // Civica's privacy firewall; only the DOB lands.
                SNAPInlineDocScanCTA(
                    documentType: .photoID,
                    ctaLabel: SNAPApplicantAgeStrings.scanIDCTA.value(in: language),
                    onExtracted: { result in
                        if let dob = result.dateOfBirthDate {
                            viewModel.recordInteraction(dob)
                        }
                    }
                )
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onExit) {
                    Image(systemName: "xmark")
                        .foregroundStyle(CivicaColors.ink)
                }
                .accessibilityLabel(CivicaQuestionStrings.backLabel.value(in: language))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Live readout of the derived age so the user can sanity-check
    /// the wheel as they spin it. Quiet styling — no big number, just
    /// a footnote that updates.
    @ViewBuilder
    private var ageReadout: some View {
        if viewModel.hasInteracted, let age = viewModel.answers.derivedAge {
            Text(SNAPApplicantAgeStrings.ageReadout(age: age, language: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    private var datePicker: some View {
        DatePicker(
            SNAPApplicantAgeStrings.title.value(in: language),
            selection: Binding(
                get: { viewModel.pickerDate },
                set: { viewModel.recordInteraction($0) }
            ),
            in: oldestPlausibleDate...Date(),
            displayedComponents: .date
        )
        .datePickerStyle(.wheel)
        .labelsHidden()
        // Fixed height is REQUIRED. A .wheel DatePicker has no intrinsic
        // height, and CivicaQuestionScreen renders its content inside a
        // ScrollView — an unbounded wheel proposes an ambiguous/NaN
        // height to its rows, which spams "invalid numeric value (NaN)
        // to CoreGraphics" on every scroll tick and triggers gesture-
        // gate timeouts + hangs (device QA). Bounding the height makes
        // the wheel's internal layout deterministic and stops the NaN.
        .frame(maxWidth: .infinity)
        .frame(height: 200)
        // Keep the scroll gesture inside the wheel from fighting the
        // parent ScrollView during a spin.
        .contentShape(Rectangle())
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var oldestPlausibleDate: Date {
        Calendar.current.date(byAdding: .year, value: -120, to: Date()) ?? .distantPast
    }
}

// MARK: - Strings

enum SNAPApplicantAgeStrings {

    static let title = CivicaText(
        "When were you born?",
        es: "¿Cuándo naciste?",
        zh: "你的出生日期是？",
        vi: "Bạn sinh ngày nào?",
        tl: "Kailan ka ipinanganak?"
    )
    // Wave C — ID-scan affordance for DOB only (name dropped per
    // privacy firewall).
    static let scanIDCTA = CivicaText(
        "Scan your ID to fill DOB",
        es: "Escanea tu identificación para llenar la fecha",
        zh: "扫描你的身份证件来填写出生日期",
        vi: "Quét giấy tờ tùy thân để điền ngày sinh",
        tl: "I-scan ang iyong ID para mapunan ang petsa ng kapanganakan"
    )

    static let helper = CivicaText(
        "Your exact age changes which SNAP deductions you can get. We don't share your birth date with anyone.",
        es: "Tu edad exacta cambia qué deducciones de SNAP puedes recibir. No compartimos tu fecha de nacimiento con nadie.",
        zh: "你的准确年龄会影响你能获得哪些 SNAP 扣减项目。我们不会把你的出生日期分享给任何人。",
        vi: "Tuổi chính xác của bạn quyết định bạn được hưởng những khoản khấu trừ SNAP nào. Chúng tôi không chia sẻ ngày sinh của bạn với bất kỳ ai.",
        tl: "Ang eksaktong edad mo ang magtatakda kung anong mga SNAP deduction ang puwede mong makuha. Hindi namin ibinabahagi ang petsa ng kapanganakan mo kahit kanino."
    )

    /// "You're 34" / "Tienes 34 años". Caller passes the derived age.
    static func ageReadout(age: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "You're \(age)"
        case .mandarin: return "你 \(age) 岁"
        case .spanish: return "Tienes \(age) años"
        case .vietnamese: return "Bạn \(age) tuổi"
        case .tagalog: return "\(age) ka"
        }
    }
}

#if DEBUG
struct SNAPApplicantAgeFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPApplicantAgeFlowView(
                viewModel: SNAPApplicantAgeFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
