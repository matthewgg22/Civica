import CivicaDesignSystem
import SwiftUI

// Fallback denial-letter form for devices without on-device OCR.
// Also shown to users who prefer to type details instead of
// scanning. Every field the appeal generator needs is collected
// here so the appeal flow can complete end-to-end without OCR.

struct DenialLetterManualEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @State private var caseNumber: String
    @State private var denialDate: Date
    @State private var applicantName: String
    @State private var reason: DenialReason

    let stateCode: String
    let onContinue: (DenialLetterFields, DenialReason) -> Void

    init(
        stateCode: String,
        seed: DenialLetterFields? = nil,
        onContinue: @escaping (DenialLetterFields, DenialReason) -> Void
    ) {
        self.stateCode = stateCode
        _caseNumber = State(initialValue: seed?.caseNumber ?? "")
        _applicantName = State(initialValue: seed?.applicantName ?? "")

        if let isoDate = seed?.denialDate,
           let parsed = ISO8601DateFormatter.dateOnly.date(from: isoDate) {
            _denialDate = State(initialValue: parsed)
        } else {
            _denialDate = State(initialValue: Date())
        }

        _reason = State(initialValue: seed?.denialReasonCategory ?? .missingDocuments)
        self.onContinue = onContinue
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                Text(DenialLetterManualEntryStrings.title.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityAddTraits(.isHeader)

                field(label: DenialLetterManualEntryStrings.caseNumberLabel, value: $caseNumber)
                field(label: DenialLetterManualEntryStrings.applicantNameLabel, value: $applicantName)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(DenialLetterManualEntryStrings.denialDateLabel.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                    DatePicker(
                        "",
                        selection: $denialDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .tint(CivicaColors.brickAccent)
                }

                reasonPicker

                Button(action: continueTapped) {
                    Text(DenialLetterManualEntryStrings.continueCTA.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(continueEnabled ? CivicaColors.brickAccent : CivicaColors.graphite.opacity(0.4))
                        )
                }
                .buttonStyle(.plain)
                .disabled(!continueEnabled)
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(DenialLetterManualEntryStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var continueEnabled: Bool {
        !caseNumber.trimmingCharacters(in: .whitespaces).isEmpty &&
        !applicantName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    @ViewBuilder
    private func field(label: CivicaText, value: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(label.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            TextField("", text: value)
                .textFieldStyle(.roundedBorder)
        }
    }

    private var reasonPicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(DenialLetterManualEntryStrings.reasonLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
            // Four labels can't fit a segmented picker on iPhone
            // width without truncation, so we render a vertical list
            // of radio rows — every option's full label is visible
            // and tappable without a hidden affordance.
            VStack(spacing: CivicaSpacing.xs) {
                ForEach(DenialReason.allCases, id: \.self) { value in
                    Button(action: { reason = value }) {
                        HStack(spacing: CivicaSpacing.sm) {
                            Image(systemName: reason == value ? "largecircle.fill.circle" : "circle")
                                .foregroundStyle(reason == value ? CivicaColors.brickAccent : CivicaColors.graphite)
                            Text(reasonLabel(for: value).value(in: language))
                                .font(CivicaTypography.body)
                                .foregroundStyle(CivicaColors.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer()
                        }
                        .padding(CivicaSpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(CivicaColors.surfacePrimary)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.card)
                                .strokeBorder(
                                    reason == value ? CivicaColors.brickAccent : CivicaColors.hairline,
                                    lineWidth: reason == value ? 2 : 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func reasonLabel(for reason: DenialReason) -> CivicaText {
        switch reason {
        case .missedInterview: return RecertCompanionStrings.denialReasonMissedInterview
        case .missingDocuments: return RecertCompanionStrings.denialReasonMissingDocuments
        case .noResponse: return RecertCompanionStrings.denialReasonNoResponse
        case .otherProcedural: return RecertCompanionStrings.denialReasonOther
        }
    }

    private func continueTapped() {
        let iso = ISO8601DateFormatter.dateOnly.string(from: denialDate)
        let fields = DenialLetterFields(
            caseNumber: caseNumber.trimmingCharacters(in: .whitespaces),
            denialDate: iso,
            applicantName: applicantName.trimmingCharacters(in: .whitespaces),
            stateCode: stateCode,
            denialReasonText: nil,
            denialReasonCategory: reason
        )
        onContinue(fields, reason)
    }
}

enum DenialLetterManualEntryStrings {
    static let title = CivicaText(
        "Tell us about the denial",
        es: "Cuéntanos sobre la denegación",
        zh: "告诉我们关于这次拒绝的情况",
        vi: "Cho chúng tôi biết về việc từ chối",
        tl: "Sabihin mo sa amin ang tungkol sa pagtanggi"
    )
    static let caseNumberLabel = CivicaText("Case number", es: "Número de caso", zh: "案件编号", vi: "Số hồ sơ", tl: "Case number")
    static let applicantNameLabel = CivicaText("Your full name", es: "Tu nombre completo", zh: "你的全名", vi: "Họ và tên đầy đủ của bạn", tl: "Buong pangalan mo")
    static let denialDateLabel = CivicaText("Date of the denial letter", es: "Fecha de la carta de denegación", zh: "拒绝信的日期", vi: "Ngày trên thư từ chối", tl: "Petsa ng denial letter")
    static let reasonLabel = CivicaText("Reason for denial", es: "Motivo de la denegación", zh: "拒绝的原因", vi: "Lý do bị từ chối", tl: "Dahilan ng pagtanggi")
    static let continueCTA = CivicaText("Continue", es: "Continuar", zh: "继续", vi: "Tiếp tục", tl: "Magpatuloy")
}

extension ISO8601DateFormatter {
    /// Shared date-only formatter for the YYYY-MM-DD strings the
    /// denial fields use over the wire.
    static let dateOnly: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()
}
