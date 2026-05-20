import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "reviewDraftStep" — the terminal summary
// before packet generation. Aggregates every per-step answer block
// from the migrated flows (where applying, age, household, contact,
// income, student status, expenses, documents), renders each as a
// reviewable section with a status badge and an "Edit" callback so
// the user can jump back into the relevant flow.
//
// Not wired into SNAPRouter yet — the router-cutover commit will
// stand up an orchestrator that owns a SNAPApplicationDraft, walks
// the user through each sub-flow in order, and feeds the assembled
// draft to this view at the end.
//
// Primary CTA is "Generate my application packet" — caller wires
// it to the PDF generator (SNAPApplicationGeneratorView). Secondary
// is implicit via the per-section Edit links.

/// Aggregates the per-step answer types into one draft model. Each
/// field defaults to an empty value object so partial drafts render
/// without crashing — sections with no answers show as Not Started.
struct SNAPApplicationDraft: Equatable, Codable {
    var whereApplying: SNAPWhereApplyingAnswers = .init()
    var applicantAge: SNAPApplicantAgeAnswers = .init()
    var household: SNAPHouseholdAnswers = .init()
    var contact: SNAPContactAnswers = .init()
    var income: SNAPIncomeAnswers = .init()
    var studentStatus: SNAPStudentStatusAnswers = .init()
    var expenses: SNAPExpensesAnswers = .init()
    var documentsChecklist: SNAPDocumentsChecklistAnswers = .init()
}

/// Stable identifier for which flow to jump back into when the user
/// taps Edit on a review section.
enum SNAPApplicationSection: String, CaseIterable, Identifiable, Codable {
    case whereApplying
    case applicantAge
    case household
    case contact
    case income
    case studentStatus
    case expenses
    case documentsChecklist

    var id: String { rawValue }

    var isRequired: Bool {
        switch self {
        case .contact, .documentsChecklist: return false
        default: return true
        }
    }

    /// 1-based position of this section in the canonical application
    /// order. Drives the "Section 3 of 8" label on the per-question
    /// overall-progress bar. Stable across the app — adding a new
    /// section means adding it to `allCases` in the right order;
    /// reordering is intentional behavior.
    var oneBasedIndex: Int {
        (Self.allCases.firstIndex(of: self) ?? 0) + 1
    }

    /// Total number of sections in the canonical application order.
    /// Exposed so per-question screens don't each have to hardcode "8".
    static let count: Int = Self.allCases.count

    /// Short localized title for the section, used by the
    /// per-question progress bar's "Section 3 of 8 · Income" label.
    /// Kept concise (one or two words) so the chip stays scannable.
    func title(in language: CivicaLanguage) -> String {
        switch (self, language) {
        case (.whereApplying, .english):       return "Where you're applying"
        case (.whereApplying, .spanish):       return "Dónde solicitas"
        case (.applicantAge, .english):        return "About you"
        case (.applicantAge, .spanish):        return "Sobre ti"
        case (.household, .english):           return "Your household"
        case (.household, .spanish):           return "Tu hogar"
        case (.contact, .english):             return "Staying in touch"
        case (.contact, .spanish):             return "Mantenerse en contacto"
        case (.income, .english):              return "Income"
        case (.income, .spanish):              return "Ingresos"
        case (.studentStatus, .english):       return "Student status"
        case (.studentStatus, .spanish):       return "Estatus estudiantil"
        case (.expenses, .english):            return "Expenses"
        case (.expenses, .spanish):            return "Gastos"
        case (.documentsChecklist, .english):  return "Documents"
        case (.documentsChecklist, .spanish):  return "Documentos"
        }
    }
}

struct SNAPReviewDraftFlowView: View {
    let draft: SNAPApplicationDraft
    let language: CivicaLanguage
    let onEdit: (SNAPApplicationSection) -> Void
    let onGeneratePacket: () -> Void
    let onStartOver: (() -> Void)?
    let onExit: () -> Void

    // T16 Gap #7: Shelter QC flags. Evaluated once per render from the
    // draft — advisory only, never block submission.
    // `county` is read from draft.whereApplying.county; the caller may
    // pass `onCampus: true` when a Banner housing assignment confirms
    // on-campus residence (low/zero rent + no utilities is expected).
    let onCampus: Bool

    // T16 Gap #6: Mid-period change detection.
    // When the orchestrator has a prior snapshot of whereApplying (taken
    // at the last packet generation), passing it here enables the
    // mid-period change banner. nil = first-time review, no banner shown.
    let priorWhereApplying: SNAPWhereApplyingAnswers?

    init(
        draft: SNAPApplicationDraft,
        language: CivicaLanguage,
        onEdit: @escaping (SNAPApplicationSection) -> Void,
        onGeneratePacket: @escaping () -> Void,
        onStartOver: (() -> Void)? = nil,
        onExit: @escaping () -> Void,
        onCampus: Bool = false,
        priorWhereApplying: SNAPWhereApplyingAnswers? = nil
    ) {
        self.draft = draft
        self.language = language
        self.onEdit = onEdit
        self.onGeneratePacket = onGeneratePacket
        self.onStartOver = onStartOver
        self.onExit = onExit
        self.onCampus = onCampus
        self.priorWhereApplying = priorWhereApplying
    }

    var body: some View {
        CivicaQuestionScreen(
            title: SNAPReviewDraftStrings.title.value(in: language),
            helper: progressSummary,
            primaryActionTitle: SNAPReviewDraftStrings.primaryAction.value(in: language),
            primaryActionEnabled: requiredSectionsAllComplete,
            onPrimary: onGeneratePacket,
            secondaryActionTitle: onStartOver != nil
                ? SNAPReviewDraftStrings.startOverLabel.value(in: language)
                : nil,
            onSecondary: onStartOver,
            language: language
        ) {
            VStack(spacing: CivicaSpacing.md) {
                // T16 Gap #6: Mid-period change banner (shown when the
                // user re-edits whereApplying after generating a packet).
                if let prior = priorWhereApplying, housingLocationChanged(prior: prior) {
                    midPeriodChangeBanner
                }

                ForEach(SNAPApplicationSection.allCases) { section in
                    sectionCard(section)
                    // T16 Gap #7: Shelter QC advisory flags shown below
                    // the expenses section card.
                    if section == .expenses {
                        shelterQCFlagsView
                    }
                }
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

    // MARK: - Section card

    private func sectionCard(_ section: SNAPApplicationSection) -> some View {
        let status = sectionStatus(section)
        let summary = sectionSummaryRows(section)
        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text(SNAPReviewDraftStrings.sectionTitle(section, language: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                statusBadge(status)
                Spacer()
                Button {
                    onEdit(section)
                } label: {
                    Text(SNAPReviewDraftStrings.editLabel.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.brickPrimary)
                }
                .buttonStyle(.plain)
            }

            if summary.isEmpty {
                Text(SNAPReviewDraftStrings.nothingYet.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            } else {
                ForEach(Array(summary.enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                        Text(row.label)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.graphite)
                        Spacer(minLength: CivicaSpacing.sm)
                        Text(row.value)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.ink)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - T16 Gap #7: Shelter QC advisory flags

    /// Advisory shelter data-quality flags derived from the current draft.
    /// Renders as zero-height (EmptyView) when there are no flags — never
    /// injects padding into the card stack when clean.
    @ViewBuilder
    private var shelterQCFlagsView: some View {
        let flags = ShelterQCHeuristics.evaluate(
            draft: draft,
            county: draft.whereApplying.county,
            onCampus: onCampus
        )
        if !flags.isEmpty {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                HStack(spacing: CivicaSpacing.xs) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(CivicaColors.warningAmber)
                        .imageScale(.small)
                    Text(SNAPReviewDraftStrings.shelterFlagsHeader.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.warningAmber)
                }

                ForEach(Array(flags.enumerated()), id: \.offset) { _, flag in
                    HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                        Circle()
                            .fill(CivicaColors.warningAmber)
                            .frame(width: 4, height: 4)
                            .padding(.top, 6)
                        Text(SNAPReviewDraftStrings.shelterFlagPrompt(flag, language: language))
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Button {
                    onEdit(.expenses)
                } label: {
                    Text(SNAPReviewDraftStrings.shelterFlagsEditAction.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.brickPrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.warningAmber.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.warningAmber.opacity(0.35), lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                SNAPReviewDraftStrings.shelterFlagsAccessibilityLabel(
                    count: flags.count,
                    language: language
                )
            )
        }
    }

    // MARK: - T16 Gap #6: Mid-period change banner

    /// True when the user has changed their housing status or county
    /// since the last packet was generated — triggers mid-period change
    /// reporting prompt (7 CFR 273.12).
    private func housingLocationChanged(prior: SNAPWhereApplyingAnswers) -> Bool {
        prior.housingStatus != draft.whereApplying.housingStatus
            || prior.county != draft.whereApplying.county
    }

    private var midPeriodChangeBanner: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "info.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(CivicaColors.accentTeal)
                    .imageScale(.small)
                Text(SNAPReviewDraftStrings.midPeriodChangeHeader.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.accentTeal)
            }
            Text(SNAPReviewDraftStrings.midPeriodChangeBody.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.tealSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.teal.opacity(0.35), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    // Pills only fire on incomplete sections — the rows the user
    // still has work on. Complete sections collapse to a quiet teal
    // checkmark so the eye naturally lands on amber/muted pills
    // instead of scanning a wall of "COMPLETE" chips on a finished
    // draft. Accessibility label is preserved on the icon so
    // VoiceOver still reads "Complete" for done sections.
    @ViewBuilder
    private func statusBadge(_ status: SectionStatus) -> some View {
        switch status {
        case .complete:
            Image(systemName: "checkmark.circle.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(CivicaColors.accentTeal)
                .imageScale(.medium)
                .accessibilityLabel(SNAPStatusHomeStrings.statusComplete.value(in: language))
        case .inProgress, .notStarted:
            let (label, fill, ink) = pillStyle(status)
            Text(label)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(ink)
                .textCase(.uppercase)
                .kerning(1.0)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, 2)
                .background(fill)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.pill))
        }
    }

    private func pillStyle(_ status: SectionStatus) -> (String, Color, Color) {
        switch status {
        case .complete:
            // Unreachable — complete renders as an icon, not a pill.
            return ("", .clear, .clear)
        case .inProgress:
            return (SNAPStatusHomeStrings.statusInProgress.value(in: language),
                    CivicaColors.warningAmber.opacity(0.16),
                    CivicaColors.warningAmber)
        case .notStarted:
            return (SNAPReviewDraftStrings.statusNotStarted.value(in: language),
                    CivicaColors.hairline.opacity(0.5),
                    CivicaColors.graphite)
        }
    }

    // MARK: - Status / summary projection

    private enum SectionStatus { case notStarted, inProgress, complete }

    private struct SummaryRow: Equatable {
        let label: String
        let value: String
    }

    private var progressSummary: String {
        let completed = SNAPApplicationSection.allCases.filter { sectionStatus($0) == .complete }.count
        let total = SNAPApplicationSection.allCases.count
        return SNAPReviewDraftStrings.progressLine(
            completed: completed,
            total: total,
            language: language
        )
    }

    private var requiredSectionsAllComplete: Bool {
        SNAPApplicationSection.allCases
            .filter(\.isRequired)
            .allSatisfy { sectionStatus($0) == .complete }
    }

    private func sectionStatus(_ section: SNAPApplicationSection) -> SectionStatus {
        switch section {
        case .whereApplying:
            if draft.whereApplying.stateCode != nil && draft.whereApplying.housingStatus != nil { return .complete }
            if draft.whereApplying.stateCode != nil || draft.whereApplying.housingStatus != nil { return .inProgress }
            return .notStarted
        case .applicantAge:
            return draft.applicantAge.isComplete ? .complete : .notStarted
        case .household:
            if draft.household.isComplete { return .complete }
            if draft.household.householdSize != nil
                || draft.household.hasMinorInHousehold != nil
                || draft.household.hasElderlyOrDisabled != nil {
                return .inProgress
            }
            return .notStarted
        case .contact:
            // Contact is optional; we mark complete the moment user
            // either provided any contact info OR explicitly skipped
            // (preferredMethod = nil and no contact = treated as skipped).
            if draft.contact.hasAnyContact || draft.contact.preferredMethod != nil { return .complete }
            return .complete  // optional, so a passed-through empty is also complete
        case .income:
            // Earning + variability + unearned all answered, OR
            // earning=no + unearned answered (the skipped path).
            let earning = draft.income.anyoneEarning
            let unearned = draft.income.hasUnearnedIncome
            if earning == .no, unearned != nil { return .complete }
            if earning != nil,
               draft.income.grossMonthlyIncome != nil,
               draft.income.incomeChangesMonthToMonth != nil,
               unearned != nil {
                return .complete
            }
            if earning != nil { return .inProgress }
            return .notStarted
        case .studentStatus:
            if draft.studentStatus.enrolledInHigherEd == false { return .complete }
            if draft.studentStatus.enrolledInHigherEd == true,
               draft.studentStatus.enrolledHalfTime != nil,
               draft.studentStatus.works20PlusHours != nil,
               draft.studentStatus.inWorkStudy != nil,
               draft.studentStatus.responsibleForDependentChild != nil {
                return .complete
            }
            if draft.studentStatus.enrolledInHigherEd != nil { return .inProgress }
            return .notStarted
        case .expenses:
            // At minimum rent + utilities should be answered for the
            // shelter deduction to compute. Childcare + medical are
            // truly optional.
            if draft.expenses.monthlyRentOrHousing != nil && draft.expenses.monthlyUtilities != nil {
                return .complete
            }
            if draft.expenses.monthlyRentOrHousing != nil || draft.expenses.monthlyUtilities != nil {
                return .inProgress
            }
            return .notStarted
        case .documentsChecklist:
            return .complete  // optional checklist — always passes
        }
    }

    private func sectionSummaryRows(_ section: SNAPApplicationSection) -> [SummaryRow] {
        switch section {
        case .whereApplying:
            var rows: [SummaryRow] = []
            if let code = draft.whereApplying.stateCode {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowState.value(in: language),
                    value: code
                ))
            }
            if let housing = draft.whereApplying.housingStatus {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowHousing.value(in: language),
                    value: SNAPWhereApplyingStrings.housingLabel(for: housing, language: language)
                ))
            }
            return rows
        case .applicantAge:
            if let age = draft.applicantAge.derivedAge {
                return [.init(
                    label: SNAPReviewDraftStrings.rowAge.value(in: language),
                    value: "\(age)"
                )]
            }
            return []
        case .household:
            var rows: [SummaryRow] = []
            if let size = draft.household.householdSize {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowHouseholdSize.value(in: language),
                    value: size
                ))
            }
            if let minor = draft.household.hasMinorInHousehold {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowMinors.value(in: language),
                    value: minor
                        ? CivicaQuestionStrings.yesLabel.value(in: language)
                        : CivicaQuestionStrings.noLabel.value(in: language)
                ))
            }
            if let elder = draft.household.hasElderlyOrDisabled {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowElderlyOrDisabled.value(in: language),
                    value: elder
                        ? CivicaQuestionStrings.yesLabel.value(in: language)
                        : CivicaQuestionStrings.noLabel.value(in: language)
                ))
            }
            return rows
        case .contact:
            var rows: [SummaryRow] = []
            if let email = draft.contact.email {
                rows.append(.init(label: SNAPReviewDraftStrings.rowEmail.value(in: language), value: email))
            }
            if let phone = draft.contact.phone {
                rows.append(.init(label: SNAPReviewDraftStrings.rowPhone.value(in: language), value: phone))
            }
            if let method = draft.contact.preferredMethod {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowPreferred.value(in: language),
                    value: SNAPContactStrings.methodLabel(for: method, language: language)
                ))
            }
            return rows
        case .income:
            var rows: [SummaryRow] = []
            if let earning = draft.income.anyoneEarning {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowEarning.value(in: language),
                    value: SNAPIncomeStrings.triLabel(for: earning, language: language)
                ))
            }
            if let gross = draft.income.grossMonthlyIncome {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowGrossIncome.value(in: language),
                    value: "$\(NSDecimalNumber(decimal: gross).stringValue)/mo"
                ))
            }
            if let variability = draft.income.incomeChangesMonthToMonth {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowVariability.value(in: language),
                    value: SNAPIncomeStrings.triLabel(for: variability, language: language)
                ))
            }
            if let unearned = draft.income.hasUnearnedIncome {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowUnearned.value(in: language),
                    value: SNAPIncomeStrings.triLabel(for: unearned, language: language)
                ))
            }
            return rows
        case .studentStatus:
            var rows: [SummaryRow] = []
            if let enrolled = draft.studentStatus.enrolledInHigherEd {
                rows.append(.init(
                    label: SNAPReviewDraftStrings.rowEnrolled.value(in: language),
                    value: enrolled
                        ? CivicaQuestionStrings.yesLabel.value(in: language)
                        : CivicaQuestionStrings.noLabel.value(in: language)
                ))
            }
            if draft.studentStatus.enrolledInHigherEd == true {
                let exceptions = [
                    draft.studentStatus.works20PlusHours == true ? "20+ hr/wk" : nil,
                    draft.studentStatus.inWorkStudy == true ? "work-study" : nil,
                    draft.studentStatus.responsibleForDependentChild == true ? "child" : nil
                ].compactMap { $0 }
                if !exceptions.isEmpty {
                    rows.append(.init(
                        label: SNAPReviewDraftStrings.rowStudentExceptions.value(in: language),
                        value: exceptions.joined(separator: ", ")
                    ))
                }
            }
            return rows
        case .expenses:
            func render(_ value: Decimal?) -> String {
                guard let value else { return "—" }
                return "$\(NSDecimalNumber(decimal: value).stringValue)/mo"
            }
            return [
                .init(label: SNAPReviewDraftStrings.rowRent.value(in: language),
                      value: render(draft.expenses.monthlyRentOrHousing)),
                .init(label: SNAPReviewDraftStrings.rowUtilities.value(in: language),
                      value: render(draft.expenses.monthlyUtilities)),
                .init(label: SNAPReviewDraftStrings.rowChildcare.value(in: language),
                      value: render(draft.expenses.monthlyChildcare)),
                .init(label: SNAPReviewDraftStrings.rowMedical.value(in: language),
                      value: render(draft.expenses.monthlyMedical))
            ].filter { $0.value != "—" }
        case .documentsChecklist:
            let count = draft.documentsChecklist.documentsAvailable.count
            return [.init(
                label: SNAPReviewDraftStrings.rowDocumentsCount.value(in: language),
                value: "\(count)"
            )]
        }
    }
}

// MARK: - Strings

enum SNAPReviewDraftStrings {

    static let title = CivicaText(
        "Review your application",
        es: "Revisa tu solicitud"
    )
    static let primaryAction = CivicaText(
        "Generate my application packet",
        es: "Generar mi paquete de solicitud"
    )
    static let editLabel = CivicaText("Edit", es: "Editar")
    static let nothingYet = CivicaText(
        "Nothing here yet — tap Edit to add.",
        es: "Nada aquí todavía — toca Editar para añadir."
    )
    static let statusNotStarted = CivicaText("Not started", es: "No iniciado")
    static let startOverLabel = CivicaText(
        "Clear my answers and start over",
        es: "Borrar mis respuestas y empezar de nuevo"
    )

    static func progressLine(completed: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return "\(completed) of \(total) sections done. Tap Edit on any section to update it."
        case .spanish:
            return "\(completed) de \(total) secciones completas. Toca Editar en cualquier sección para actualizarla."
        }
    }

    static func sectionTitle(_ section: SNAPApplicationSection, language: CivicaLanguage) -> String {
        switch (section, language) {
        case (.whereApplying, .english):     return "Where applying"
        case (.whereApplying, .spanish):     return "Dónde solicitas"
        case (.applicantAge, .english):      return "Applicant age"
        case (.applicantAge, .spanish):      return "Edad del solicitante"
        case (.household, .english):         return "Household"
        case (.household, .spanish):         return "Hogar"
        case (.contact, .english):           return "Contact info"
        case (.contact, .spanish):           return "Información de contacto"
        case (.income, .english):            return "Income"
        case (.income, .spanish):            return "Ingresos"
        case (.studentStatus, .english):     return "Student status"
        case (.studentStatus, .spanish):     return "Estado estudiantil"
        case (.expenses, .english):          return "Monthly expenses"
        case (.expenses, .spanish):          return "Gastos mensuales"
        case (.documentsChecklist, .english): return "Documents on hand"
        case (.documentsChecklist, .spanish): return "Documentos a la mano"
        }
    }

    // Row labels — one per draft field surfaced in summary
    static let rowState = CivicaText("State", es: "Estado")
    static let rowHousing = CivicaText("Housing", es: "Vivienda")
    static let rowAge = CivicaText("Age", es: "Edad")
    static let rowHouseholdSize = CivicaText("Household size", es: "Tamaño del hogar")
    static let rowMinors = CivicaText("Anyone 18 or under", es: "Alguien de 18 años o menos")
    static let rowElderlyOrDisabled = CivicaText("60+ or disabled in household", es: "60+ o discapacidad en el hogar")
    static let rowEmail = CivicaText("Email", es: "Correo electrónico")
    static let rowPhone = CivicaText("Phone", es: "Teléfono")
    static let rowPreferred = CivicaText("Preferred contact", es: "Contacto preferido")
    static let rowEarning = CivicaText("Anyone earning", es: "Alguien gana")
    static let rowGrossIncome = CivicaText("Gross monthly income", es: "Ingreso mensual bruto")
    static let rowVariability = CivicaText("Changes month-to-month", es: "Cambia mes a mes")
    static let rowUnearned = CivicaText("Has unearned income", es: "Tiene ingresos no laborales")
    static let rowEnrolled = CivicaText("Enrolled in higher ed", es: "Inscrito en educación superior")
    static let rowStudentExceptions = CivicaText("SNAP student exception", es: "Excepción estudiantil de SNAP")
    static let rowRent = CivicaText("Rent or housing", es: "Renta o vivienda")
    static let rowUtilities = CivicaText("Utilities", es: "Servicios")
    static let rowChildcare = CivicaText("Childcare", es: "Cuidado infantil")
    static let rowMedical = CivicaText("Medical", es: "Médico")
    static let rowDocumentsCount = CivicaText("Documents marked", es: "Documentos marcados")

    // MARK: - T16 Gap #7: Shelter QC flag strings

    static let shelterFlagsHeader = CivicaText(
        "Check before submitting",
        es: "Verifica antes de enviar"
    )
    static let shelterFlagsEditAction = CivicaText(
        "Update expenses →",
        es: "Actualizar gastos →"
    )

    static func shelterFlagsAccessibilityLabel(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(count) shelter data \(count == 1 ? "question" : "questions") to review before submitting"
        case .spanish: return "\(count) \(count == 1 ? "pregunta" : "preguntas") sobre gastos de vivienda para revisar antes de enviar"
        }
    }

    /// Student-facing prompt text for each advisory flag.
    /// Softer than the navigator-facing `navigatorSummary` on ShelterQCFlag —
    /// framed as a question to invite correction rather than an accusation.
    static func shelterFlagPrompt(_ flag: ShelterQCFlag, language: CivicaLanguage) -> String {
        switch (flag, language) {
        case (.rentBelowCountyFloor, .english):
            return "That rent seems low for a solo renter in your area — is that your full rent, or your share with roommates?"
        case (.rentBelowCountyFloor, .spanish):
            return "Esa renta parece baja para alquilar solo en tu área — ¿es tu renta completa o tu parte con compañeros?"
        case (.rentExceedsIncome, .english):
            return "Your rent appears higher than your reported income — confirm both amounts are correct before submitting."
        case (.rentExceedsIncome, .spanish):
            return "Tu renta parece ser mayor que tu ingreso reportado — confirma que ambas cantidades sean correctas antes de enviar."
        case (.noUtilitiesOffCampus, .english):
            return "You didn't select any utilities — are they included in your rent? If not, go back and add them."
        case (.noUtilitiesOffCampus, .spanish):
            return "No seleccionaste ningún servicio — ¿están incluidos en tu renta? Si no, regresa y agrégalos."
        case (.rentSuggestsUnproratedLease, .english):
            return "That rent is high for a single person in your area — are you splitting it with roommates who aren't on your case?"
        case (.rentSuggestsUnproratedLease, .spanish):
            return "Esa renta es alta para una sola persona en tu área — ¿la compartes con compañeros que no están en tu caso?"
        }
    }

    // MARK: - T16 Gap #6: Mid-period change strings

    static let midPeriodChangeHeader = CivicaText(
        "Your housing situation changed",
        es: "Tu situación de vivienda cambió"
    )
    static let midPeriodChangeBody = CivicaText(
        "You changed your housing status or county since your last packet. You may need to report this change to your SNAP caseworker within 10 days (7 CFR 273.12). Contact your county office to report a mid-period change.",
        es: "Cambiaste tu estado de vivienda o condado desde tu último paquete. Es posible que debas reportar este cambio a tu trabajador social de SNAP dentro de 10 días (7 CFR 273.12). Comunícate con tu oficina del condado para reportar un cambio de período intermedio."
    )
}

#if DEBUG
struct SNAPReviewDraftFlowView_Previews: PreviewProvider {
    static var previews: some View {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        draft.whereApplying.housingStatus = .stableHome
        draft.applicantAge.dateOfBirth = Calendar.current.date(byAdding: .year, value: -34, to: Date())
        draft.household.householdSize = "3 people"
        draft.household.hasMinorInHousehold = true
        draft.household.hasElderlyOrDisabled = false
        draft.income.anyoneEarning = .yes
        draft.income.grossMonthlyIncome = 1800
        draft.income.incomeChangesMonthToMonth = .no
        draft.income.hasUnearnedIncome = .no
        draft.expenses.monthlyRentOrHousing = 1400
        draft.expenses.monthlyUtilities = 180

        return NavigationStack {
            SNAPReviewDraftFlowView(
                draft: draft,
                language: .english,
                onEdit: { _ in },
                onGeneratePacket: {},
                onExit: {}
            )
        }
    }
}
#endif
