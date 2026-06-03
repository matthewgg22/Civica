import CivicaDesignSystem
import SwiftUI

// 3-state amber banner driven by ExpeditedTriageResult.
//
//   .high       — full-strength banner with bolt icon, lede, and the
//                 rationale list (which hard rule fired, or the top
//                 soft signals).
//   .uncertain  — softer banner inviting the user to answer one more
//                 question. The prompt comes from
//                 clarifyingQuestion(for:draft:); tap routes back to
//                 the relevant section via onEditSection.
//   .low        — hidden (zero-height, no layout shift).
//
// Used by SNAPDecisionMathView and SNAPWaitingRoomView. Pass
// `result: nil` (e.g., before the first section finishes) to hide.

struct SNAPExpeditedBanner: View {
    let result: ExpeditedTriageResult?
    let draft: SNAPApplicationDraft?
    let language: CivicaLanguage
    let onEditSection: ((SNAPApplicationSection) -> Void)?

    init(
        result: ExpeditedTriageResult?,
        draft: SNAPApplicationDraft? = nil,
        language: CivicaLanguage = .english,
        onEditSection: ((SNAPApplicationSection) -> Void)? = nil
    ) {
        self.result = result
        self.draft = draft
        self.language = language
        self.onEditSection = onEditSection
    }

    var body: some View {
        switch result?.state {
        case .high:
            if let result { highBanner(result) }
        case .uncertain:
            if let result { uncertainBanner(result) }
        case .low, .none:
            EmptyView()
        }
    }

    // MARK: - High-confidence banner

    private func highBanner(_ result: ExpeditedTriageResult) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "bolt.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 24, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPExpeditedBannerStrings.highEyebrow.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPExpeditedBannerStrings.highBody.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if !result.rationale.isEmpty {
                rationaleList(result.rationale)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(highAccessibilityLabel(result))
    }

    private func rationaleList(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: CivicaSpacing.xs) {
                    Text("•")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                    Text(item)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 24 + CivicaSpacing.md)
    }

    // MARK: - Uncertain-confidence banner

    private func uncertainBanner(_ result: ExpeditedTriageResult) -> some View {
        let clarifying: (section: SNAPApplicationSection, prompt: String)? =
            draft.flatMap { clarifyingQuestion(for: result, draft: $0) }
                .map { (section: $0.0, prompt: $0.1) }
        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "questionmark.circle.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.warningAmber)
                    .frame(width: 24, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPExpeditedBannerStrings.uncertainEyebrow.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    if let clarifying {
                        Text(clarifying.prompt)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text(SNAPExpeditedBannerStrings.uncertainFallback.value(in: language))
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            if let clarifying, let onEditSection {
                Button {
                    onEditSection(clarifying.section)
                } label: {
                    Text(SNAPExpeditedBannerStrings.uncertainCta.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
                .buttonStyle(.plain)
                .padding(.leading, 24 + CivicaSpacing.md)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.warningAmber.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .combine)
    }

    private func highAccessibilityLabel(_ result: ExpeditedTriageResult) -> String {
        var parts: [String] = [
            SNAPExpeditedBannerStrings.highEyebrow.value(in: language),
            SNAPExpeditedBannerStrings.highBody.value(in: language)
        ]
        parts.append(contentsOf: result.rationale)
        return parts.joined(separator: ". ")
    }
}

// MARK: - Strings

enum SNAPExpeditedBannerStrings {
    static let highEyebrow = CivicaText(
        "You may qualify for expedited SNAP service",
        es: "Puedes calificar para servicio expedito de SNAP",
        zh: "你可能符合 SNAP 加急服务的资格"
    )
    static let highBody = CivicaText(
        "Expedited service means a decision in 7 days instead of 30. Tell the caseworker the rule you may qualify under.",
        es: "Servicio expedito significa una decisión en 7 días en lugar de 30. Dile al trabajador del caso la regla bajo la que puedes calificar.",
        zh: "加急服务意味着 7 天内出结果,而不是 30 天。告诉个案工作员你可能符合的那条规则。"
    )
    // Compliance Q3/Q2.4: registry id "expedited_banner_almost" — .pendingSignoff.
    // Flip to .approved in the registry to activate the replacement below.
    static let uncertainEyebrow = CivicaText(
        SNAPComplianceCopyRegistry.approvedEnglish(for: "expedited_banner_almost") ?? "Almost — one more answer could speed this up",
        es: SNAPComplianceCopyRegistry.approvedSpanish(for: "expedited_banner_almost") ?? "Casi — una respuesta más podría acelerar esto",
        zh: "就差一点 — 再回答一个问题就能加快这件事"
    )
    static let uncertainFallback = CivicaText(
        "Your answers point partway toward expedited service. Review your application and confirm key fields with your caseworker.",
        es: "Tus respuestas apuntan en parte hacia servicio expedito. Revisa tu solicitud y confirma los campos clave con tu trabajador del caso.",
        zh: "你的回答部分指向加急服务。检查你的申请,并和个案工作员确认关键栏位。"
    )
    static let uncertainCta = CivicaText(
        "Answer this question",
        es: "Responde esta pregunta",
        zh: "回答这个问题"
    )
}

#if DEBUG
struct SNAPExpeditedBanner_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            SNAPExpeditedBanner(result: .init(
                firedHardRules: [.lowIncomeLowResources],
                softConfidence: 0.0,
                combinedConfidence: 1.0,
                state: .high,
                rationale: ["Very low income and resources (7 CFR 273.2(i)(1)(i))"]
            ))
            var uncertainDraft = SNAPApplicationDraft()
            let _ = (uncertainDraft.household.hasMinorInHousehold = true)
            let _ = (uncertainDraft.income.incomeChangesMonthToMonth = .yes)
            SNAPExpeditedBanner(
                result: .init(
                    firedHardRules: [],
                    softConfidence: 0.55,
                    combinedConfidence: 0.55,
                    state: .uncertain,
                    rationale: []
                ),
                draft: uncertainDraft,
                onEditSection: { _ in }
            )
            SNAPExpeditedBanner(result: .init(
                firedHardRules: [],
                softConfidence: 0.2,
                combinedConfidence: 0.2,
                state: .low,
                rationale: []
            ))
        }
        .padding()
        .background(CivicaColors.paper)
    }
}
#endif
