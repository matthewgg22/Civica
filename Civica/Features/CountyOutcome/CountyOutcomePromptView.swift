import CivicaDesignSystem
import SwiftUI

// The applicant-facing screen the user lands on when they tap the
// +14d "did you hear back from CalFresh?" notification, or open this
// from a deep link inside the app.
//
// Three buttons, no emoji, plain language per docs/brand_voice.md.
// After a selection, swap the buttons for a single confirmation line
// (also from CountyOutcomeStrings) so a second tap on the same notif
// shows the user's prior answer rather than re-prompting.

struct CountyOutcomePromptView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    let packetId: String
    var onClose: () -> Void = {}

    @State private var existingRecord: CountyOutcomeRecord?
    @State private var isSubmitting = false

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            header

            if let record = existingRecord {
                confirmation(for: record.selection)
            } else {
                buttons
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.paper)
        .task {
            existingRecord = CountyOutcomeClient.shared.storedRecord(forPacketId: packetId)
        }
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(CountyOutcomeStrings.promptTitle.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(CountyOutcomeStrings.promptSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var buttons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                CountyOutcomeStrings.buttonApproved.value(in: language),
                isEnabled: !isSubmitting,
                action: { submit(.approved) }
            )
            CivicaPrimaryButton(
                CountyOutcomeStrings.buttonDenied.value(in: language),
                isEnabled: !isSubmitting,
                action: { submit(.denied) }
            )
            CivicaPrimaryButton(
                CountyOutcomeStrings.buttonNotYet.value(in: language),
                isEnabled: !isSubmitting,
                action: { submit(.pendingDecision) }
            )
        }
    }

    private func confirmation(for selection: CountyOutcomeSelection) -> some View {
        let text: String
        switch selection {
        case .approved:
            text = CountyOutcomeStrings.afterApproved.value(in: language)
        case .denied:
            text = CountyOutcomeStrings.afterDenied.value(in: language)
        case .pendingDecision:
            text = CountyOutcomeStrings.afterNotYet.value(in: language)
        }
        return Text(text)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("countyOutcome.confirmation")
    }

    // MARK: - Actions

    private func submit(_ selection: CountyOutcomeSelection) {
        guard !isSubmitting else { return }
        isSubmitting = true
        Task {
            let record = await CountyOutcomeClient.shared.submit(
                packetId: packetId,
                selection: selection
            )
            existingRecord = record
            isSubmitting = false
        }
    }
}

#if DEBUG
struct CountyOutcomePromptView_Previews: PreviewProvider {
    static var previews: some View {
        CountyOutcomePromptView(packetId: "preview-packet")
    }
}
#endif
