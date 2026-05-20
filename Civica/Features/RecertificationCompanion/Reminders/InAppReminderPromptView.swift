import CivicaDesignSystem
import SwiftUI

// In-app reminder card. Surfaces the same matter-of-fact prompt that
// the push notification would show, when the user is already inside
// the app on the day a document needs refreshing. Mirrors the system
// notification copy so the experience is consistent regardless of
// channel.

struct InAppReminderPromptView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    let documentType: SNAPDocumentType
    let recertDate: Date
    let reason: DocumentExpirationAction.ReasonCode

    let onUpload: () -> Void
    let onDismiss: () -> Void

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "bell.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(CivicaColors.pinePrimary)
                Text(promptTitle)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(promptBody)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: CivicaSpacing.sm) {
                Button(action: {
                    RecertCompanionAnalytics.trackReminderActedOn(
                        documentType: documentType.rawValue
                    )
                    onUpload()
                }) {
                    Text(InAppReminderStrings.uploadCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(.white)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(CivicaColors.pinePrimary)
                        )
                }
                .buttonStyle(.plain)

                Button(action: onDismiss) {
                    Text(InAppReminderStrings.dismissCTA.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .padding(.horizontal, CivicaSpacing.md)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.pinePrimary.opacity(0.4), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(promptTitle). \(promptBody)")
    }

    private var promptTitle: String {
        switch reason {
        case .missing:
            return DocumentReminderStrings.titleMissing(documentLabel: documentType.label).value(in: language)
        case .staleAtRecert:
            return DocumentReminderStrings.titleStale(documentLabel: documentType.label).value(in: language)
        case .cadenceDue:
            return DocumentReminderStrings.titleCadence(documentLabel: documentType.label).value(in: language)
        }
    }

    private var promptBody: String {
        let monthFormatter = DateFormatter()
        monthFormatter.dateFormat = "MMMM"
        return DocumentReminderStrings.body(
            documentLabel: documentType.label,
            recertMonth: monthFormatter.string(from: recertDate)
        ).value(in: language)
    }
}

enum InAppReminderStrings {
    static let uploadCTA = CivicaText(
        "Upload now",
        es: "Subir ahora"
    )
    static let dismissCTA = CivicaText(
        "Later",
        es: "Más tarde"
    )
}

#if DEBUG
struct InAppReminderPromptView_Previews: PreviewProvider {
    static var previews: some View {
        InAppReminderPromptView(
            documentType: .proofOfIncome,
            recertDate: Calendar.current.date(byAdding: .month, value: 2, to: Date()) ?? Date(),
            reason: .staleAtRecert,
            onUpload: {},
            onDismiss: {}
        )
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
