import CivicaDesignSystem
import SwiftUI

// Host surface for the Phantom Recert flow.
//
// Composition:
//   1. Construct a SNAPApplicationFlowOrchestratorViewModel against
//      the phantom draft slot, seeded with a clone of the live draft
//      so prior answers pre-populate.
//   2. Mount the same SNAPApplicationFlowOrchestratorView the live
//      flow uses, but route its onGeneratePacket callback to push
//      our summary screen instead of advancing application status.
//   3. After the user views the summary, they can either dismiss
//      (clears the phantom draft, leaves live untouched) or jump to
//      the live recertification flow.

struct PhantomRecertFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore

    @StateObject private var orchestrator: SNAPApplicationFlowOrchestratorViewModel

    @State private var summaryDraft: SNAPApplicationDraft?
    @State private var presentingSummary = false

    let language: CivicaLanguage
    let stateCode: String
    let nextRecertDate: Date

    init(
        language: CivicaLanguage,
        stateCode: String,
        nextRecertDate: Date
    ) {
        self.language = language
        self.stateCode = stateCode
        self.nextRecertDate = nextRecertDate
        // Seed phantom draft from the live draft so the user only
        // touches what's changed. The orchestrator's init handles
        // the case where the phantom slot already has a saved
        // mid-flow state — that takes precedence over the seed.
        let liveStore = SNAPApplicationDraftStore(storageKey: SNAPApplicationDraftStore.liveDraftKey)
        let liveDraft = liveStore.load()?.draft ?? SNAPApplicationDraft()
        let phantomStore = SNAPApplicationDraftStore(storageKey: SNAPApplicationDraftStore.phantomDraftKey)
        let vm = SNAPApplicationFlowOrchestratorViewModel(
            store: phantomStore,
            isPhantomMode: true,
            seedDraft: liveDraft
        )
        _orchestrator = StateObject(wrappedValue: vm)
    }

    var body: some View {
        VStack(spacing: 0) {
            phantomBanner
            SNAPApplicationFlowOrchestratorView(
                viewModel: orchestrator,
                language: language,
                onGeneratePacket: { draft in
                    // Phantom-mode end-of-flow: never advance status,
                    // never write to the live store. Push the summary.
                    summaryDraft = draft
                    presentingSummary = true
                    RecertCompanionAnalytics.trackPhantomCompleted()
                },
                onDismiss: {
                    // Fires when the user backs out from the first
                    // section (or otherwise reaches the orchestrator's
                    // top-level dismiss path) WITHOUT having reached
                    // the summary. Treat as abandon.
                    if !presentingSummary {
                        RecertCompanionAnalytics.trackPhantomAbandoned(
                            lastStepName: phantomLastStepName,
                            stepIndex: phantomLastStepIndex
                        )
                    }
                    dismiss()
                }
            )
        }
        .navigationTitle(PhantomRecertFlowStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $presentingSummary) {
            if let draft = summaryDraft {
                PhantomRecertSummaryView(
                    phantomDraft: draft,
                    language: language,
                    stateCode: stateCode,
                    nextRecertDate: nextRecertDate,
                    onClose: {
                        // Clear phantom draft + dismiss back to home.
                        SNAPApplicationDraftStore(
                            storageKey: SNAPApplicationDraftStore.phantomDraftKey
                        ).clear()
                        presentingSummary = false
                        dismiss()
                    },
                    onStartRealRecert: {
                        SNAPApplicationDraftStore(
                            storageKey: SNAPApplicationDraftStore.phantomDraftKey
                        ).clear()
                        // Switching to the real recert is owned by
                        // the parent (RecertCompanionRoot) — it sets
                        // isRecertInProgress and navigates. We just
                        // dismiss back to home; the caller will see
                        // the user landed there and offer the live
                        // CTA.
                        UserDefaults.standard.set(true, forKey: CivicaAppStorageKeys.recertInProgress)
                        presentingSummary = false
                        dismiss()
                    }
                )
            }
        }
    }

    /// Last section the user was on, derived from the orchestrator's
    /// mode. Used in the abandonment analytics event.
    private var phantomLastStepName: String {
        switch orchestrator.mode {
        case .phantom(let section), .sequential(let section), .editing(let section):
            return section.rawValue
        case .review:
            return "review"
        case .idScanOffer:
            return "id_scan_offer"
        }
    }

    private var phantomLastStepIndex: Int {
        switch orchestrator.mode {
        case .phantom(let section), .sequential(let section), .editing(let section):
            return (SNAPApplicationSection.allCases.firstIndex(of: section) ?? -1) + 1
        case .review:
            return SNAPApplicationSection.allCases.count + 1
        case .idScanOffer:
            return 0
        }
    }

    private var phantomBanner: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "wand.and.stars")
                .foregroundStyle(CivicaColors.pinePrimary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(PhantomRecertFlowStrings.bannerTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(PhantomRecertFlowStrings.bannerBody.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.brickSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

enum PhantomRecertFlowStrings {
    static let title = CivicaText(
        "Dry run",
        es: "Práctica",
        zh: "演练",
        vi: "Chạy thử",
        tl: "Pagsubok"
    )
    static let bannerTitle = CivicaText(
        "This is a dry run",
        es: "Esto es una práctica",
        zh: "这是一次演练",
        vi: "Đây là một lần chạy thử",
        tl: "Pagsubok lang ito"
    )
    static let bannerBody = CivicaText(
        "Nothing is sent to your state. Walk through your answers and we'll show you what's changed and what to gather.",
        es: "No se envía nada a tu estado. Revisa tus respuestas y te mostraremos qué cambió y qué reunir.",
        zh: "不会向你所在的州提交任何内容。过一遍你的答案,我们会告诉你哪些有变化、需要准备什么材料。",
        vi: "Không có gì được gửi đến tiểu bang của bạn. Hãy xem lại các câu trả lời của bạn và chúng tôi sẽ chỉ cho bạn biết những gì đã thay đổi và cần chuẩn bị những gì.",
        tl: "Walang ipapadala sa iyong estado. Balikan mo ang iyong mga sagot at ipapakita namin kung ano ang nagbago at kung ano ang dapat ihanda."
    )
}
