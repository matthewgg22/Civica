import CivicaDesignSystem
import SwiftUI

// Final screen of the Phantom Recert flow. Three sections, in order:
//   1. Fresh estimate — runs SNAPLocalEligibilityEvaluator against
//      the phantom draft. Same math the live flow uses, no separate
//      forecasting path.
//   2. Change list — diffs the phantom draft against the live draft
//      and renders per-section changes.
//   3. Prep checklist — combines the change list with the expiration
//      forecast to produce a single ordered to-do.
//
// Two CTAs:
//   - "I'll come back later" → clear the phantom draft, dismiss
//   - "Start the real recert" → clear the phantom draft, set the
//     recert-in-progress flag, dismiss. Parent CivicaRootView routes
//     to the live recert flow on next launch.

struct PhantomRecertSummaryView: View {
    let phantomDraft: SNAPApplicationDraft
    let language: CivicaLanguage
    let stateCode: String
    let nextRecertDate: Date

    let onClose: () -> Void
    let onStartRealRecert: () -> Void

    private var liveDraft: SNAPApplicationDraft {
        SNAPApplicationDraftStore(storageKey: SNAPApplicationDraftStore.liveDraftKey)
            .load()?.draft ?? SNAPApplicationDraft()
    }

    private var changes: [PhantomChange] {
        PhantomChangeDetector.diff(live: liveDraft, phantom: phantomDraft)
    }

    private var forecast: DocumentExpirationForecast {
        let vault = Dictionary(uniqueKeysWithValues:
            SNAPDocumentVaultReader.allCaptured().map { ($0.type, $0.capturedAt) }
        )
        return DocumentExpirationPredictor.forecast(.init(
            today: Date(),
            nextRecertDate: nextRecertDate,
            vault: vault,
            stateCode: stateCode
        ))
    }

    private var checklist: [PhantomChecklistItem] {
        PhantomPrepChecklist.build(changes: changes, forecast: forecast)
    }

    private var freshEstimate: SNAPEligibilityResult {
        SNAPLocalEligibilityEvaluator.evaluate(phantomDraft)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                estimateCard
                if !changes.isEmpty {
                    changesSection
                }
                if !checklist.isEmpty {
                    checklistSection
                }
                ctaStack
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(PhantomRecertFlowStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(RecertCompanionStrings.phantomSummaryTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
            Text(RecertCompanionStrings.phantomSummarySubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var estimateCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(PhantomSummaryStrings.estimateHeader.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(estimateDisplay)
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var estimateDisplay: String {
        let result = freshEstimate
        if let amount = result.monthlyBenefit {
            let formatter = NumberFormatter()
            formatter.numberStyle = .currency
            formatter.maximumFractionDigits = 0
            formatter.locale = Locale(identifier: language == .spanish ? "es_US" : "en_US")
            let rendered = formatter.string(from: amount as NSDecimalNumber) ?? "—"
            return PhantomSummaryStrings.estimateAmountTemplate(amount: rendered).value(in: language)
        }
        return PhantomSummaryStrings.estimateUnavailable.value(in: language)
    }

    private var changesSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(RecertCompanionStrings.phantomChangesHeader.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            VStack(spacing: CivicaSpacing.xs) {
                ForEach(changes, id: \.self) { change in
                    HStack(spacing: CivicaSpacing.sm) {
                        Image(systemName: iconForChange(change.kind))
                            .foregroundStyle(CivicaColors.pinePrimary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(sectionLabel(change.section).value(in: language))
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.ink)
                            Text(changeKindLabel(change.kind).value(in: language))
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.graphite)
                        }
                        Spacer()
                    }
                    .padding(.vertical, CivicaSpacing.xs)
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var checklistSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(RecertCompanionStrings.phantomChecklistHeader.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            VStack(spacing: CivicaSpacing.xs) {
                ForEach(checklist, id: \.self) { item in
                    HStack(spacing: CivicaSpacing.sm) {
                        Image(systemName: "circle")
                            .foregroundStyle(CivicaColors.graphite)
                        Text(checklistLabel(item))
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                    }
                    .padding(.vertical, CivicaSpacing.xs)
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
    }

    private var ctaStack: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Button(action: onStartRealRecert) {
                Text(RecertCompanionStrings.phantomStartRealCTA.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(CivicaColors.pinePrimary)
                    )
            }
            .buttonStyle(.plain)

            Button(action: onClose) {
                Text(RecertCompanionStrings.phantomCloseCTA.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Labels

    private func sectionLabel(_ section: SNAPApplicationSection) -> CivicaText {
        switch section {
        case .whereApplying: return PhantomSummaryStrings.sectionWhereApplying
        case .applicantAge: return PhantomSummaryStrings.sectionApplicantAge
        case .household: return PhantomSummaryStrings.sectionHousehold
        case .contact: return PhantomSummaryStrings.sectionContact
        case .income: return PhantomSummaryStrings.sectionIncome
        case .studentStatus: return PhantomSummaryStrings.sectionStudentStatus
        case .expenses: return PhantomSummaryStrings.sectionExpenses
        case .documentsChecklist: return PhantomSummaryStrings.sectionDocumentsChecklist
        }
    }

    private func changeKindLabel(_ kind: PhantomChange.Kind) -> CivicaText {
        switch kind {
        case .modified: return PhantomSummaryStrings.changeModified
        case .filled: return PhantomSummaryStrings.changeFilled
        case .cleared: return PhantomSummaryStrings.changeCleared
        }
    }

    private func iconForChange(_ kind: PhantomChange.Kind) -> String {
        switch kind {
        case .modified: return "pencil"
        case .filled: return "plus.circle"
        case .cleared: return "minus.circle"
        }
    }

    private func checklistLabel(_ item: PhantomChecklistItem) -> String {
        switch item.kind {
        case .documentUpload(let type):
            return PhantomSummaryStrings.checklistUpload(label: type.label).value(in: language)
        case .answerReview(let section, let change):
            return PhantomSummaryStrings.checklistAnswerReview(
                sectionLabel: sectionLabel(section).value(in: language),
                changeLabel: changeKindLabel(change).value(in: language)
            ).value(in: language)
        }
    }
}

enum PhantomSummaryStrings {
    static let estimateHeader = CivicaText(
        "Fresh estimate",
        es: "Estimación nueva",
        zh: "新估算",
        vi: "Ước tính mới"
    )
    static let estimateUnavailable = CivicaText(
        "We couldn't calculate a benefit amount with these answers.",
        es: "No pudimos calcular un monto con estas respuestas.",
        zh: "根据这些答案，我们无法计算出福利金额。",
        vi: "Chúng tôi không thể tính ra số tiền trợ cấp với những câu trả lời này."
    )

    static func estimateAmountTemplate(amount: String) -> CivicaText {
        CivicaText(
            "About \(amount) / month",
            es: "Aproximadamente \(amount) / mes",
            zh: "每月大约 \(amount)",
            vi: "Khoảng \(amount) / tháng"
        )
    }

    static let changeModified = CivicaText(
        "Changed since last recert",
        es: "Cambió desde la última recertificación",
        zh: "自上次重新认证以来有变动",
        vi: "Đã thay đổi từ lần tái xác nhận trước"
    )
    static let changeFilled = CivicaText(
        "Newly filled in",
        es: "Recién completado",
        zh: "新填写的内容",
        vi: "Mới được điền vào"
    )
    static let changeCleared = CivicaText(
        "Cleared",
        es: "Borrado",
        zh: "已清空",
        vi: "Đã xóa"
    )

    static let sectionWhereApplying = CivicaText("Where you're applying", es: "Dónde solicitas", zh: "你申请的地点", vi: "Nơi bạn đang nộp đơn")
    static let sectionApplicantAge = CivicaText("Applicant age", es: "Edad del solicitante", zh: "申请人年龄", vi: "Tuổi của người nộp đơn")
    static let sectionHousehold = CivicaText("Household", es: "Hogar", zh: "家庭", vi: "Hộ gia đình")
    static let sectionContact = CivicaText("Contact info", es: "Información de contacto", zh: "联系方式", vi: "Thông tin liên lạc")
    static let sectionIncome = CivicaText("Income", es: "Ingresos", zh: "收入", vi: "Thu nhập")
    static let sectionStudentStatus = CivicaText("Student status", es: "Estado de estudiante", zh: "学生身份", vi: "Tình trạng sinh viên")
    static let sectionExpenses = CivicaText("Expenses", es: "Gastos", zh: "支出", vi: "Chi phí")
    static let sectionDocumentsChecklist = CivicaText("Documents", es: "Documentos", zh: "文件", vi: "Giấy tờ")

    static func checklistUpload(label: String) -> CivicaText {
        CivicaText(
            "Upload a fresh \(label.lowercased())",
            es: "Sube un/a nuevo/a \(label.lowercased())",
            zh: "上传一份新的 \(label.lowercased())",
            vi: "Tải lên \(label.lowercased()) mới"
        )
    }

    static func checklistAnswerReview(sectionLabel: String, changeLabel: String) -> CivicaText {
        CivicaText(
            "Confirm \(sectionLabel) (\(changeLabel))",
            es: "Confirma \(sectionLabel) (\(changeLabel))",
            zh: "确认 \(sectionLabel)（\(changeLabel)）",
            vi: "Xác nhận \(sectionLabel) (\(changeLabel))"
        )
    }
}
