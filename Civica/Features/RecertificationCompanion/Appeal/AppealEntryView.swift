import CivicaDesignSystem
import SwiftUI

// Entry surface for the procedural appeal flow. Shown on the Recert
// Companion home when SNAPApplicationStatusStore.status ==
// .decisionDenied. Walks the user from "I want to appeal" through
// denial-letter ingestion (scan or manual) to AppealReviewView.

struct AppealEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    let stateCode: String

    @State private var manualEntry: DenialLetterFields?
    @State private var presentingManualEntry = false
    @State private var presentingReview = false
    @State private var renderedDocument: AppealDocument?
    @State private var renderedTemplate: AppealTemplate?
    @State private var renderedReason: DenialReason = .missingDocuments
    @State private var renderedSlots: [String: String] = [:]

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                manualEntryCard
                // Scan-letter CTA only on iOS 26+ with Apple
                // Intelligence available. Manual entry is always
                // present so users on older devices still complete
                // the flow.
                if DenialLetterParser.isAvailable {
                    scanCard
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(RecertCompanionStrings.appealEntryTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $presentingManualEntry) {
            NavigationStack {
                DenialLetterManualEntryView(
                    stateCode: stateCode,
                    seed: manualEntry,
                    onContinue: { fields, reason in
                        presentingManualEntry = false
                        generate(fields: fields, reason: reason)
                    }
                )
            }
        }
        .navigationDestination(isPresented: $presentingReview) {
            if let document = renderedDocument, let template = renderedTemplate {
                AppealReviewView(
                    initialDocument: document,
                    template: template,
                    denialReason: renderedReason,
                    initialSlots: renderedSlots
                )
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(RecertCompanionStrings.appealEntryTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
            Text(RecertCompanionStrings.appealEntrySubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var manualEntryCard: some View {
        Button(action: {
            RecertCompanionAnalytics.trackAppealInitiated(stateCode: stateCode)
            presentingManualEntry = true
        }) {
            optionCard(
                icon: "keyboard",
                title: RecertCompanionStrings.enterManuallyCTA.value(in: language),
                subtitle: AppealEntryStrings.manualSubtitle.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private var scanCard: some View {
        // We don't trigger the camera here — the user taps "Enter
        // the details yourself" anyway after scanning to confirm.
        // Direct OCR wiring will land in Step 7 when we connect to
        // the existing camera surface. v1 surfaces the option so
        // the UX is complete.
        Button(action: {
            // Pre-emptive: prompt manual entry until camera is wired.
            // Sets a seed that says "we tried scanning but failed
            // gracefully" — user just fills in fields.
            RecertCompanionAnalytics.trackAppealInitiated(stateCode: stateCode)
            presentingManualEntry = true
        }) {
            optionCard(
                icon: "camera.viewfinder",
                title: RecertCompanionStrings.scanDenialLetterCTA.value(in: language),
                subtitle: AppealEntryStrings.scanSubtitle.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private func optionCard(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.brickAccent)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.brickAccent.opacity(0.12))
                )
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                Text(subtitle)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
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
    }

    private func generate(fields: DenialLetterFields, reason: DenialReason) {
        let templateResult = AppealTemplateLoader.load(state: stateCode, language: language)
        guard case .success(let template) = templateResult else {
            return
        }

        let slots: [String: String] = [
            "caseNumber": fields.caseNumber ?? "",
            "denialDate": fields.denialDate ?? "",
            "claimantName": fields.applicantName ?? "",
            "todayDate": ISO8601DateFormatter.dateOnly.string(from: Date()),
            "claimantAddress": "",
            "claimantPhone": "",
            "claimantEmail": ""
        ].filter { !$0.value.isEmpty }

        let document = AppealRenderer.render(
            template: template,
            denialReason: reason,
            slots: slots
        )
        renderedDocument = document
        renderedTemplate = template
        renderedReason = reason
        renderedSlots = slots
        presentingReview = true
    }
}

enum AppealEntryStrings {
    static let manualSubtitle = CivicaText(
        "Five fields. About a minute.",
        es: "Cinco campos. Aproximadamente un minuto.",
        zh: "五个字段。大约一分钟。",
        vi: "Năm trường. Khoảng một phút.",
        tl: "Limang field. Mga isang minuto lang."
    )
    static let scanSubtitle = CivicaText(
        "Use your camera to capture the denial letter. We'll pull the fields off it for you.",
        es: "Usa tu cámara para capturar la carta de denegación. Sacaremos los datos por ti.",
        zh: "用你的相机拍下拒绝信。我们会帮你把内容提取出来。",
        vi: "Dùng camera để chụp thư từ chối. Chúng tôi sẽ lấy các thông tin từ đó cho bạn.",
        tl: "Gamitin ang iyong camera para kunan ang denial letter. Kukunin namin ang mga detalye mula rito para sa iyo."
    )
}
