import CivicaDesignSystem
import SwiftUI

// Sheet for editing the user's next recert date.
//
// Default value: the current effective date (override or computed).
// Save → writes a user override. Use Default → clears the override.

struct RecertScheduleEditView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @Environment(\.dismiss) private var dismiss

    @ObservedObject var store: RecertScheduleStore

    /// The approval milestone passed in by the parent surface — used
    /// to compute the "Use default" date when the user clears the
    /// override. Optional because some users may not have an approved
    /// case yet (e.g. case manager helping a new applicant plan).
    let approvedAt: Date?

    @State private var pickedDate: Date

    init(store: RecertScheduleStore, approvedAt: Date?) {
        self.store = store
        self.approvedAt = approvedAt
        let initial = store.effectiveDate(approvedAt: approvedAt)
            ?? Calendar.current.date(byAdding: .month, value: 12, to: Date())
            ?? Date()
        _pickedDate = State(initialValue: initial)
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var defaultDate: Date? {
        RecertScheduleStore.defaultDate(approvedAt: approvedAt)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    Text(RecertScheduleEditStrings.title.value(in: language))
                        .font(CivicaTypography.pageTitle)
                        .foregroundStyle(CivicaColors.ink)
                        .accessibilityAddTraits(.isHeader)

                    Text(RecertScheduleEditStrings.subtitle.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)

                    DatePicker(
                        RecertScheduleEditStrings.pickerLabel.value(in: language),
                        selection: $pickedDate,
                        in: Date()...,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(CivicaColors.pinePrimary)

                    if let defaultDate {
                        Button(action: {
                            pickedDate = defaultDate
                        }) {
                            HStack(spacing: CivicaSpacing.sm) {
                                Image(systemName: "arrow.uturn.backward")
                                Text(RecertScheduleEditStrings.useDefault.value(in: language))
                                    .font(CivicaTypography.footnoteStrong)
                            }
                            .foregroundStyle(CivicaColors.pinePrimary)
                        }
                    }

                    Button(action: save) {
                        Text(RecertScheduleEditStrings.save.value(in: language))
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
                }
                .padding(CivicaSpacing.xl)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(RecertScheduleEditStrings.cancel.value(in: language)) {
                        dismiss()
                    }
                }
            }
        }
    }

    private func save() {
        store.setOverride(pickedDate)
        dismiss()
    }
}

enum RecertScheduleEditStrings {
    static let title = CivicaText(
        "When is your next recertification?",
        es: "¿Cuándo es tu próxima recertificación?",
        zh: "你下次复审是什么时候?",
        vi: "Lần tái xét duyệt kế tiếp của bạn là khi nào?",
        tl: "Kailan ang susunod mong recertification?"
    )
    static let subtitle = CivicaText(
        "We start preparing you 60 days out. If your state sets a different date, edit it here.",
        es: "Empezamos a prepararte 60 días antes. Si tu estado fija otra fecha, edítala aquí.",
        zh: "我们会在 60 天前开始帮你准备。如果你所在的州定了不同的日期,就在这里改一下。",
        vi: "Chúng tôi bắt đầu giúp bạn chuẩn bị trước 60 ngày. Nếu tiểu bang của bạn ấn định ngày khác, hãy sửa tại đây.",
        tl: "Sinisimulan ka naming ihanda 60 araw bago pa. Kung ibang petsa ang itinakda ng estado mo, i-edit mo dito."
    )
    static let pickerLabel = CivicaText(
        "Recert date",
        es: "Fecha de recertificación",
        zh: "复审日期",
        vi: "Ngày tái xét duyệt",
        tl: "Petsa ng recert"
    )
    static let useDefault = CivicaText(
        "Use 12-month default",
        es: "Usar predeterminado de 12 meses",
        zh: "使用 12 个月默认值",
        vi: "Dùng mặc định 12 tháng",
        tl: "Gamitin ang 12-buwan na default"
    )
    static let save = CivicaText("Save", es: "Guardar", zh: "保存", vi: "Lưu", tl: "I-save")
    static let cancel = CivicaText("Cancel", es: "Cancelar", zh: "取消", vi: "Hủy", tl: "Kanselahin")
}

#if DEBUG
struct RecertScheduleEditView_Previews: PreviewProvider {
    static var previews: some View {
        RecertScheduleEditView(
            store: RecertScheduleStore(),
            approvedAt: Calendar.current.date(byAdding: .month, value: -2, to: Date())
        )
    }
}
#endif
