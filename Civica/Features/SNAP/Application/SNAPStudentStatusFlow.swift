import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "studentStatusStep" card. SNAP student rules
// (7 CFR 273.5) are real: most enrolled higher-ed students don't
// qualify unless they meet a specific exception — working 20+ hours
// a week, doing federal/state work-study, caring for a dependent
// under 6 (or under 12 with no adequate childcare), participating in
// an employment & training / student-support program, etc. This flow
// asks the gating yes/no plus follow-ups, one per conversational screen.
//
// Skip logic: if the user is not enrolled in higher ed, screen 1 is
// the only screen. The follow-ups (half-time / CA-LPIE degree program /
// 20-hr / work-study / dependent-child / job-training program) only
// render for enrolled students; the CA LPIE fast-path can short-circuit
// before the federal exception screens.

struct SNAPStudentStatusAnswers: Equatable, Codable {
    var enrolledInHigherEd: Bool?
    var enrolledHalfTime: Bool?
    var works20PlusHours: Bool?
    var inWorkStudy: Bool?
    var responsibleForDependentChild: Bool?
    /// Session A — CA LPIE override input. True when the applicant is
    /// enrolled in a degree or certificate program at a CA Community
    /// College, CSU, or UC. When combined with enrolledHalfTime == true
    /// AND the server-side `lpie_auto_exempt_enabled` flag is on,
    /// CAStateRules.studentExemption returns .exempted(reason: .lpie)
    /// without consulting the federal 5-path checklist.
    var degreeOrCertificateProgram: Bool?
    /// True when the applicant participates in a federal or state
    /// employment & training or student-support program: SNAP E&T, WIOA,
    /// on-the-job training, or a state program (CA EOPS/CARE, CalWORKs/
    /// Cal Grant work component, career/adult-ed pathways). A 7 CFR
    /// 273.5(b) student exemption the intake previously didn't ask — so
    /// these students were wrongly screened as disqualified. The state's
    /// BenefitsCal application surfaces these on its student checklist;
    /// Civica's own InterviewCoach already documents them. See
    /// PARITY-AUDIT.md Gap 1.
    var inApprovedJobProgram: Bool?
}

@MainActor
final class SNAPStudentStatusFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case enrollment
        case halfTime
        // CA LPIE — asked after halfTime so we can short-circuit before
        // the federal 5-path checklist when the LPIE exemption applies.
        // Session A: "Is your program a degree or certificate program at
        // a CA Community College, CSU, or UC system?"
        case degreeProgram
        case twentyHours
        case workStudy
        case dependentChild
        // Employment & training / student-support program exemption
        // (SNAP E&T, WIOA, CA EOPS/CARE, CalWORKs/Cal Grant, etc.).
        // Last federal screen; LPIE short-circuits before it.
        case jobProgram

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    @Published var step: Step = .enrollment
    @Published var answers: SNAPStudentStatusAnswers
    @Published var lpieExemptionFired: Bool = false

    init(answers: SNAPStudentStatusAnswers = .init()) {
        self.answers = answers
    }

    func advance() {
        if step == .enrollment && answers.enrolledInHigherEd == false {
            // Non-students are done at screen 1 — no follow-ups apply.
            isComplete = true
            return
        }
        if step == .halfTime && answers.enrolledHalfTime == false {
            // Not half-time: skip degreeProgram (LPIE requires half-time)
            // and go straight to the federal exception screens.
            answers.degreeOrCertificateProgram = nil  // clear any stale value
            step = .twentyHours
            return
        }
        if step == .degreeProgram {
            // LPIE fast-path: half-time + CCC/CSU/UC degree/cert program
            // + flag enabled → exempt immediately, skip federal checklist.
            if answers.enrolledHalfTime == true
                && answers.degreeOrCertificateProgram == true
                && LPIEFeatureFlag.isEnabled {
                lpieExemptionFired = true
                isComplete = true
                return
            }
            // Not LPIE-eligible: continue to federal screens.
            step = .twentyHours
            return
        }
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        } else {
            isComplete = true
        }
    }

    func goBack() {
        if step == .twentyHours && answers.enrolledHalfTime == false {
            // The user came from halfTime=no (skipped degreeProgram).
            step = .halfTime
            return
        }
        if step == .twentyHours {
            // Came from degreeProgram (LPIE not triggered).
            step = .degreeProgram
            return
        }
        if let prev = Step(rawValue: step.rawValue - 1) {
            step = prev
        }
    }

    @Published var isComplete: Bool = false

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .enrollment:     return answers.enrolledInHigherEd != nil
        case .halfTime:       return answers.enrolledHalfTime != nil
        case .degreeProgram:  return answers.degreeOrCertificateProgram != nil
        case .twentyHours:    return answers.works20PlusHours != nil
        case .workStudy:      return answers.inWorkStudy != nil
        case .dependentChild: return answers.responsibleForDependentChild != nil
        case .jobProgram:     return answers.inApprovedJobProgram != nil
        }
    }

    var isAtFirstStep: Bool { step == .enrollment }

    /// Functional last step accounts for LPIE short-circuit and
    /// non-student short-circuit.
    var isAtFunctionalLastStep: Bool {
        if step == .enrollment && answers.enrolledInHigherEd == false {
            return true
        }
        // degreeProgram can be last if LPIE fires (handled in advance()).
        return step == .jobProgram
    }

    /// True when the LPIE exemption would fire on the current answers.
    /// Used to show the "You automatically qualify" callout on the
    /// degreeProgram screen before the user taps Continue.
    var lpieWouldFire: Bool {
        LPIEFeatureFlag.isEnabled
            && answers.enrolledHalfTime == true
            && answers.degreeOrCertificateProgram == true
    }

    /// Total screens for the progress chip.
    /// Six when full student-flow applies; one when non-student.
    var visibleTotal: Int {
        answers.enrolledInHigherEd == false ? 1 : Step.total
    }
}

struct SNAPStudentStatusFlowView: View {
    @StateObject var viewModel: SNAPStudentStatusFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPStudentStatusAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPStudentStatusFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPStudentStatusAnswers) -> Void,
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
                    .accessibilityLabel(viewModel.isAtFirstStep
                        ? CivicaQuestionStrings.closeLabel.value(in: language)
                        : CivicaQuestionStrings.backLabel.value(in: language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch viewModel.step {
        case .enrollment:     enrollmentScreen
        case .halfTime:       halfTimeScreen
        case .degreeProgram:  degreeProgramScreen
        case .twentyHours:    twentyHoursScreen
        case .workStudy:      workStudyScreen
        case .dependentChild: dependentChildScreen
        case .jobProgram:     jobProgramScreen
        }
    }

    // MARK: - Screens

    private var enrollmentScreen: some View {
        yesNoScreen(
            step: .enrollment,
            title: SNAPStudentStatusStrings.enrollmentTitle.value(in: language),
            helper: SNAPStudentStatusStrings.enrollmentHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.enrolledInHigherEd },
                set: { viewModel.answers.enrolledInHigherEd = $0 }
            )
        )
    }

    private var halfTimeScreen: some View {
        yesNoScreen(
            step: .halfTime,
            title: SNAPStudentStatusStrings.halfTimeTitle.value(in: language),
            helper: SNAPStudentStatusStrings.halfTimeHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.enrolledHalfTime },
                set: { viewModel.answers.enrolledHalfTime = $0 }
            )
        )
    }

    // CA LPIE: asks whether the program is a degree/certificate at a
    // CCC, CSU, or UC. When yes + half-time + flag enabled, renders an
    // "automatically qualifies" callout and lets the user skip the
    // federal exception screens entirely.
    private var degreeProgramScreen: some View {
        CivicaQuestionScreen(
            progress: .init(
                current: SNAPStudentStatusFlowViewModel.Step.degreeProgram.oneBasedIndex,
                total: viewModel.visibleTotal,
                sectionIndex: SNAPApplicationSection.studentStatus.oneBasedIndex,
                sectionCount: SNAPApplicationSection.count,
                sectionTitle: SNAPApplicationSection.studentStatus.title(in: language)
            ),
            title: SNAPStudentStatusStrings.degreeProgramTitle.value(in: language),
            helper: SNAPStudentStatusStrings.degreeProgramHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            VStack(spacing: CivicaSpacing.md) {
                CivicaQuestionYesNo(
                    selection: Binding(
                        get: { viewModel.answers.degreeOrCertificateProgram },
                        set: { viewModel.answers.degreeOrCertificateProgram = $0 }
                    ),
                    yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                    noLabel: CivicaQuestionStrings.noLabel.value(in: language)
                )
                // LPIE callout — shown as soon as the user selects "Yes"
                // so they see the good news before tapping Continue.
                if viewModel.lpieWouldFire {
                    lpieAutoExemptCallout
                }
            }
        }
    }

    private var lpieAutoExemptCallout: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "checkmark.seal.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(CivicaColors.amberPrimary)
                .imageScale(.large)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPStudentStatusStrings.lpieCalloutTitle.value(in: language))
                    .font(CivicaTypography.bodyStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(SNAPStudentStatusStrings.lpieCalloutBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.amberSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .transition(.opacity.combined(with: .move(edge: .top))
            .animation(.easeInOut(duration: 0.2)))
        .accessibilityElement(children: .combine)
    }

    private var twentyHoursScreen: some View {
        yesNoScreen(
            step: .twentyHours,
            title: SNAPStudentStatusStrings.twentyHoursTitle.value(in: language),
            helper: SNAPStudentStatusStrings.twentyHoursHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.works20PlusHours },
                set: { viewModel.answers.works20PlusHours = $0 }
            )
        )
    }

    private var workStudyScreen: some View {
        yesNoScreen(
            step: .workStudy,
            title: SNAPStudentStatusStrings.workStudyTitle.value(in: language),
            helper: SNAPStudentStatusStrings.workStudyHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.inWorkStudy },
                set: { viewModel.answers.inWorkStudy = $0 }
            )
        )
    }

    private var dependentChildScreen: some View {
        yesNoScreen(
            step: .dependentChild,
            title: SNAPStudentStatusStrings.dependentChildTitle.value(in: language),
            helper: SNAPStudentStatusStrings.dependentChildHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.responsibleForDependentChild },
                set: { viewModel.answers.responsibleForDependentChild = $0 }
            )
        )
    }

    private var jobProgramScreen: some View {
        yesNoScreen(
            step: .jobProgram,
            title: SNAPStudentStatusStrings.jobProgramTitle.value(in: language),
            helper: SNAPStudentStatusStrings.jobProgramHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.inApprovedJobProgram },
                set: { viewModel.answers.inApprovedJobProgram = $0 }
            )
        )
    }

    // MARK: - Shared yes/no affordance

    private func yesNoScreen(
        step: SNAPStudentStatusFlowViewModel.Step,
        title: String,
        helper: String,
        value: Binding<Bool?>
    ) -> some View {
        CivicaQuestionScreen(
            progress: .init(
                current: step.oneBasedIndex,
                total: viewModel.visibleTotal,
                sectionIndex: SNAPApplicationSection.studentStatus.oneBasedIndex,
                sectionCount: SNAPApplicationSection.count,
                sectionTitle: SNAPApplicationSection.studentStatus.title(in: language)
            ),
            title: title,
            helper: helper,
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: value.wrappedValue != nil,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionYesNo(
                selection: value,
                yesLabel: CivicaQuestionStrings.yesLabel.value(in: language),
                noLabel: CivicaQuestionStrings.noLabel.value(in: language)
            )
        }
    }

    private func advanceOrComplete() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.isAtFunctionalLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
                if viewModel.isComplete {
                    onComplete(viewModel.answers)
                }
            }
        }
    }
}

// MARK: - Strings

enum SNAPStudentStatusStrings {

    static let enrollmentTitle = CivicaText(
        "Are you currently in college or another higher-ed program?",
        es: "¿Estás actualmente en la universidad o en otro programa de educación superior?",
        zh: "你目前在上大学或其他高等教育项目吗?",
        vi: "Bạn hiện đang học đại học hoặc một chương trình giáo dục bậc cao khác không?",
        tl: "Kasalukuyan ka bang nag-aaral sa kolehiyo o iba pang higher-ed na programa?"
    )
    static let enrollmentHelper = CivicaText(
        "This includes college, grad school, trade school, certificate programs, GED, or adult basic education. SNAP has special rules for students.",
        es: "Esto incluye universidad, posgrado, escuela técnica, programas de certificado, GED o educación básica para adultos. SNAP tiene reglas especiales para estudiantes.",
        zh: "这包括大学、研究生院、技术学校、证书项目、GED 或成人基础教育。SNAP 对学生有特殊规定。",
        vi: "Điều này bao gồm đại học, cao học, trường dạy nghề, chương trình cấp chứng chỉ, GED, hoặc giáo dục cơ bản cho người lớn. SNAP có quy định riêng cho sinh viên.",
        tl: "Kasama dito ang kolehiyo, grad school, trade school, certificate programs, GED, o adult basic education. May espesyal na patakaran ang SNAP para sa mga estudyante."
    )

    static let halfTimeTitle = CivicaText(
        "Are you enrolled at least half-time?",
        es: "¿Estás inscrito al menos a medio tiempo?",
        zh: "你至少是半日制注册吗?",
        vi: "Bạn có ghi danh ít nhất bán thời gian không?",
        tl: "Naka-enroll ka ba nang hindi bababa sa half-time?"
    )
    static let halfTimeHelper = CivicaText(
        "Use your school's definition. If you're not sure, pick the closer answer — you can confirm later.",
        es: "Usa la definición de tu escuela. Si no estás seguro, elige la respuesta más cercana — puedes confirmar después.",
        zh: "以你学校的定义为准。如果不确定,选择最接近的答案 —— 之后可以再确认。",
        vi: "Dùng định nghĩa của trường bạn. Nếu không chắc, hãy chọn câu trả lời gần đúng nhất — bạn có thể xác nhận lại sau.",
        tl: "Gamitin ang depinisyon ng iyong eskwela. Kung hindi ka sigurado, piliin ang pinakamalapit na sagot — puwede mong kumpirmahin mamaya."
    )

    static let twentyHoursTitle = CivicaText(
        "Do you work at least 20 hours a week?",
        es: "¿Trabajas al menos 20 horas a la semana?",
        zh: "你每周工作至少 20 小时吗?",
        vi: "Bạn có làm việc ít nhất 20 giờ một tuần không?",
        tl: "Nagtatrabaho ka ba nang hindi bababa sa 20 oras kada linggo?"
    )
    static let twentyHoursHelper = CivicaText(
        "Use your usual weekly hours across all jobs. Working 20+ hours is one of the main SNAP student exceptions.",
        es: "Usa tus horas semanales habituales en todos tus trabajos. Trabajar más de 20 horas es una de las principales excepciones estudiantiles de SNAP.",
        zh: "把你所有工作的常规每周工时加起来。每周工作 20 小时以上是 SNAP 学生例外的主要情形之一。",
        vi: "Tính tổng số giờ làm việc hàng tuần thông thường của bạn ở tất cả công việc. Làm việc từ 20 giờ trở lên là một trong những trường hợp ngoại lệ chính cho sinh viên của SNAP.",
        tl: "Gamitin ang karaniwang oras mo kada linggo sa lahat ng trabaho. Ang pagtatrabaho nang 20+ oras ay isa sa mga pangunahing exception para sa estudyante sa SNAP."
    )

    static let workStudyTitle = CivicaText(
        "Are you in a work-study program?",
        es: "¿Estás en un programa de estudio y trabajo?",
        zh: "你参加勤工俭学(work-study)项目吗?",
        vi: "Bạn có tham gia chương trình vừa học vừa làm (work-study) không?",
        tl: "Kasali ka ba sa isang work-study na programa?"
    )
    static let workStudyHelper = CivicaText(
        "A federal or state work-study placement counts as a SNAP student exception even if it's part-time.",
        es: "Una colocación de estudio y trabajo federal o estatal cuenta como excepción estudiantil de SNAP, aunque sea de medio tiempo.",
        zh: "联邦或州的勤工俭学(work-study)安排算作 SNAP 学生例外,即使是兼职也算。",
        vi: "Một vị trí vừa học vừa làm (work-study) của liên bang hoặc tiểu bang được tính là trường hợp ngoại lệ cho sinh viên của SNAP, ngay cả khi là bán thời gian.",
        tl: "Ang isang federal o state na work-study placement ay binibilang na exception para sa estudyante sa SNAP, kahit part-time pa ito."
    )

    static let dependentChildTitle = CivicaText(
        "Are you the parent or guardian of a child?",
        es: "¿Eres padre, madre o tutor de un menor?",
        zh: "你是孩子的父母或监护人吗?",
        vi: "Bạn có phải là cha mẹ hoặc người giám hộ của một đứa trẻ không?",
        tl: "Ikaw ba ang magulang o tagapag-alaga ng isang bata?"
    )
    static let dependentChildHelper = CivicaText(
        "Caring for a child under 6 is a SNAP student exception. Caring for a child under 12 may also qualify if you can't find adequate childcare.",
        es: "Cuidar a un menor de 6 años es una excepción estudiantil de SNAP. Cuidar a un menor de 12 años también puede calificar si no encuentras cuidado infantil adecuado.",
        zh: "照顾 6 岁以下的孩子属于 SNAP 学生例外。如果找不到合适的托儿服务,照顾 12 岁以下的孩子也可能符合条件。",
        vi: "Chăm sóc trẻ dưới 6 tuổi là một trường hợp ngoại lệ cho sinh viên của SNAP. Chăm sóc trẻ dưới 12 tuổi cũng có thể đủ điều kiện nếu bạn không tìm được dịch vụ giữ trẻ phù hợp.",
        tl: "Ang pag-aalaga sa batang wala pang 6 na taon ay isang exception para sa estudyante sa SNAP. Ang pag-aalaga sa batang wala pang 12 na taon ay puwede ring maging kuwalipikado kung wala kang mahanap na sapat na childcare."
    )

    // Employment & training / student-support program exemption
    // (7 CFR 273.5(b)). Program list ported from Civica's own
    // InterviewCoach guidance (InterviewQuestions_CA.json) and the
    // state's BenefitsCal student checklist. Captures the exemption
    // paths the intake previously missed (PARITY-AUDIT.md Gap 1).
    static let jobProgramTitle = CivicaText(
        "Are you in a job-training or college support program?",
        es: "¿Estás en un programa de capacitación laboral o de apoyo estudiantil?",
        zh: "你参加职业培训或学生支持项目吗?",
        vi: "Bạn có tham gia chương trình đào tạo nghề hoặc hỗ trợ sinh viên không?",
        tl: "Kasali ka ba sa isang job-training o college support na programa?"
    )
    static let jobProgramHelper = CivicaText(
        "This includes SNAP Employment & Training (E&T), WIOA, on-the-job training, EOPS or CARE, CalWORKs welfare-to-work, or a Cal Grant work component. Any of these counts as a SNAP student exception, even part-time.",
        es: "Esto incluye Empleo y Capacitación de SNAP (E&T), WIOA, capacitación en el trabajo, EOPS o CARE, el programa welfare-to-work de CalWORKs, o un componente laboral de Cal Grant. Cualquiera de estos cuenta como excepción estudiantil de SNAP, incluso de medio tiempo.",
        zh: "这包括 SNAP 就业与培训(E&T)、WIOA、在职培训、EOPS 或 CARE、CalWORKs 的 welfare-to-work,或 Cal Grant 的工作部分。任何一项都算作 SNAP 学生例外,即使是兼职也算。",
        vi: "Điều này bao gồm chương trình Việc làm & Đào tạo của SNAP (E&T), WIOA, đào tạo tại nơi làm việc, EOPS hoặc CARE, chương trình welfare-to-work của CalWORKs, hoặc phần việc làm của Cal Grant. Bất kỳ chương trình nào trong số này đều được tính là trường hợp ngoại lệ cho sinh viên của SNAP, ngay cả khi là bán thời gian.",
        tl: "Kasama dito ang SNAP Employment & Training (E&T), WIOA, on-the-job training, EOPS o CARE, CalWORKs welfare-to-work, o isang Cal Grant work component. Alinman sa mga ito ay binibilang na exception para sa estudyante sa SNAP, kahit part-time pa."
    )

    // MARK: - CA LPIE strings (Session A)
    // Source: CA CDSS CalFresh LPIE (Low-Income Student Pathway to Improved
    // Enrollment) expansion. All CCC, CSU, and UC half-time degree or
    // certificate students satisfy the student exemption automatically
    // starting June 2026 (pending final ACL — see CAStateRules.swift TODO).

    static let degreeProgramTitle = CivicaText(
        "Is your program at a California Community College, CSU, or UC?",
        es: "¿Tu programa es en un Colegio Comunitario de California, la CSU o la UC?",
        zh: "你的项目是在加州社区学院、CSU 或 UC 吗?",
        vi: "Chương trình của bạn có ở một trường California Community College, CSU, hoặc UC không?",
        tl: "Ang programa mo ba ay nasa isang California Community College, CSU, o UC?"
    )
    static let degreeProgramHelper = CivicaText(
        "Community colleges (City College, Santa Monica College, etc.), Cal State campuses, and UC campuses all qualify. Private colleges, trade schools, and out-of-state schools do not.",
        es: "Los colegios comunitarios (City College, Santa Monica College, etc.), los campus de Cal State y los campus de la UC califican. Los colegios privados, las escuelas técnicas y las escuelas fuera del estado no califican.",
        zh: "社区学院(City College、Santa Monica College 等)、Cal State 各分校和 UC 各分校都符合条件。私立大学、技术学校和加州以外的学校不符合条件。",
        vi: "Các trường community college (City College, Santa Monica College, v.v.), các phân hiệu Cal State, và các phân hiệu UC đều đủ điều kiện. Các trường đại học tư, trường dạy nghề, và trường ngoài tiểu bang thì không.",
        tl: "Kuwalipikado ang mga community college (City College, Santa Monica College, atbp.), mga Cal State campus, at mga UC campus. Ang mga pribadong kolehiyo, trade school, at mga eskwela sa labas ng estado ay hindi."
    )

    static let lpieCalloutTitle = CivicaText(
        "Great news — you may automatically qualify",
        es: "Buenas noticias — es posible que califiques automáticamente",
        zh: "好消息 —— 你可能自动符合条件",
        vi: "Tin vui — bạn có thể tự động đủ điều kiện",
        tl: "Magandang balita — maaaring awtomatiko kang kuwalipikado"
    )
    static let lpieCalloutBody = CivicaText(
        "California's LPIE expansion lets half-time CCC, CSU, and UC students skip the usual work and income checks. Tap Continue to confirm.",
        es: "La expansión LPIE de California permite a los estudiantes de medio tiempo de CCC, CSU y UC omitir las verificaciones habituales de trabajo e ingresos. Toca Continuar para confirmar.",
        zh: "加州的 LPIE 扩展让半日制的 CCC、CSU 和 UC 学生免去常规的工作和收入审查。点击「继续」确认。",
        vi: "Chương trình mở rộng LPIE của California cho phép sinh viên bán thời gian tại CCC, CSU, và UC bỏ qua các bước kiểm tra việc làm và thu nhập thông thường. Nhấn Tiếp tục để xác nhận.",
        tl: "Sa LPIE expansion ng California, puwedeng laktawan ng mga half-time na estudyante sa CCC, CSU, at UC ang karaniwang work at income checks. I-tap ang Continue para kumpirmahin."
    )
}

#if DEBUG
struct SNAPStudentStatusFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPStudentStatusFlowView(
                viewModel: SNAPStudentStatusFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
