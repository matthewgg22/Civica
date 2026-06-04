import CivicaDesignSystem
import SwiftUI

// Forward-looking calendar of documents that need refreshing before
// the next recertification. Composes against the Document Vault as a
// read-only consumer (SNAPDocumentVaultReader).
//
// Rendering choices:
// - One row per action, ordered by dueBy ascending
// - Date group headers ("This week", "Next 30 days", "By recert")
// - Each row tappable to deep-link into the document capture flow
//   for that type. Today the action callback is owned by the parent
//   surface (RecertCompanionRoot) so we don't reach across modules
//   for navigation.

struct ExpirationCalendarView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @StateObject private var viewModel: ExpirationCalendarViewModel

    /// Tapped row → caller decides how to launch document capture.
    /// Passing the callback in (rather than navigating here) keeps the
    /// view's module dependencies minimal.
    let onCaptureDocument: (SNAPDocumentType) -> Void

    init(
        stateCode: String,
        nextRecertDate: Date,
        onCaptureDocument: @escaping (SNAPDocumentType) -> Void
    ) {
        _viewModel = StateObject(
            wrappedValue: ExpirationCalendarViewModel(
                stateCode: stateCode,
                nextRecertDate: nextRecertDate
            )
        )
        self.onCaptureDocument = onCaptureDocument
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(RecertCompanionStrings.calendarHeader.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)

            if let forecast = viewModel.forecast {
                if forecast.isStateUnconfigured {
                    unconfiguredStateCard
                } else if forecast.upcomingActions.isEmpty {
                    emptyStateCard
                } else {
                    actionList(actions: forecast.upcomingActions)
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, CivicaSpacing.xl)
            }
        }
        .onAppear {
            viewModel.refresh()
            RecertCompanionAnalytics.trackCalendarViewed()
        }
    }

    // MARK: - Pieces

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(CivicaColors.amberPrimary)
                Text(RecertCompanionStrings.calendarEmptyState.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
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

    private var unconfiguredStateCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(ExpirationCalendarStrings.unconfiguredStateTitle.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(ExpirationCalendarStrings.unconfiguredStateBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
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

    private func actionList(actions: [DocumentExpirationAction]) -> some View {
        VStack(spacing: CivicaSpacing.sm) {
            ForEach(actions, id: \.self) { action in
                Button {
                    RecertCompanionAnalytics.trackExpirationActionTaken(
                        documentType: action.document.rawValue
                    )
                    onCaptureDocument(action.document)
                } label: {
                    actionRow(action: action)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func actionRow(action: DocumentExpirationAction) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: action.reason == .missing ? "doc.badge.plus" : "arrow.triangle.2.circlepath")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.pinePrimary.opacity(0.12))
                )
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(action.document.label)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                let dueByLabel = RecertCompanionStrings.actionDueBy.value(in: language)
                let dueByDate = formatted(action.dueBy)
                let reasonLabel = reasonText(action.reason).value(in: language)
                Text("\(dueByLabel) \(dueByDate) · \(reasonLabel)")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .lineLimit(2)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(action.document.label). Due by \(formatted(action.dueBy)).")
    }

    private func formatted(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func reasonText(_ reason: DocumentExpirationAction.ReasonCode) -> CivicaText {
        switch reason {
        case .missing: return ExpirationCalendarStrings.reasonMissing
        case .staleAtRecert: return ExpirationCalendarStrings.reasonStale
        case .cadenceDue: return ExpirationCalendarStrings.reasonCadence
        }
    }
}

enum ExpirationCalendarStrings {
    static let unconfiguredStateTitle = CivicaText(
        "We don't have rules for your state yet",
        es: "Aún no tenemos reglas para tu estado",
        vi: "Chúng tôi chưa có quy tắc cho tiểu bang của bạn",
        tl: "Wala pa kaming mga patakaran para sa iyong estado"
    )
    static let unconfiguredStateBody = CivicaText(
        "We'll add document refresh dates for your state soon. In the meantime, ask your caseworker which documents your state will need fresh at recert.",
        es: "Pronto agregaremos fechas de renovación para tu estado. Mientras tanto, pregunta a tu trabajador social qué documentos necesitará tu estado en la recertificación.",
        vi: "Chúng tôi sẽ sớm thêm ngày làm mới giấy tờ cho tiểu bang của bạn. Trong lúc đó, hãy hỏi nhân viên phụ trách hồ sơ của bạn về những giấy tờ nào tiểu bang sẽ cần làm mới khi tái xét.",
        tl: "Idaragdag namin agad ang mga petsa ng pag-renew ng dokumento para sa iyong estado. Pansamantala, tanungin mo ang iyong caseworker kung anong mga dokumento ang kakailanganing bago ng iyong estado sa recert."
    )
    static let reasonMissing = CivicaText(
        "Not yet uploaded",
        es: "Aún no subido",
        vi: "Chưa tải lên",
        tl: "Hindi pa na-upload"
    )
    static let reasonStale = CivicaText(
        "Too old for recert",
        es: "Demasiado antiguo para recertificación",
        vi: "Quá cũ cho tái xét",
        tl: "Masyadong luma para sa recert"
    )
    static let reasonCadence = CivicaText(
        "Due for a fresh copy",
        es: "Necesita una copia nueva",
        vi: "Cần một bản sao mới",
        tl: "Kailangan na ng bagong kopya"
    )
}

#if DEBUG
struct ExpirationCalendarView_Previews: PreviewProvider {
    static var previews: some View {
        ExpirationCalendarView(
            stateCode: "MA",
            nextRecertDate: Calendar.current.date(byAdding: .day, value: 60, to: Date()) ?? Date(),
            onCaptureDocument: { _ in }
        )
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
