import CivicaDesignSystem
import SwiftUI

// Gate shown when the user selects an application state Civica's
// SNAP screener isn't tuned for yet. The supported-state list is
// owned by SNAPCoveragePolicy.supportedStateCodes ({"CA", "MA"} as
// of the 2026-05-13 launch); any code outside that set (including
// the "Another US state" bucket from SNAPWhereApplyingFlow) routes
// here instead of continuing into the eligibility/calculator flow.
//
// Enforced at the orchestrator level (see SNAPApplicationFlowOrchestratorView)
// so deep links into later sections can't bypass it: the orchestrator
// reads the saved draft's whereApplying.stateCode on every render and
// switches to this view when the code is set and out-of-scope.

struct SNAPUnsupportedStateView: View {
    @Environment(\.openURL) private var openURL
    let stateCode: String
    let language: CivicaLanguage
    let onChangeState: () -> Void
    let onExit: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    Text(SNAPUnsupportedStateStrings.eyebrow.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    Text(titleText)
                        .font(CivicaTypography.pageTitle)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text(SNAPUnsupportedStateStrings.body.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                if let agency = agencyLine {
                    agencyCard(agencyLine: agency)
                }

                VStack(spacing: CivicaSpacing.sm) {
                    Button(action: onChangeState) {
                        Text(SNAPUnsupportedStateStrings.changeStateCTA.value(in: language))
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())
                    .accessibilityLabel(SNAPUnsupportedStateStrings.changeStateCTA.value(in: language))

                    HStack(spacing: CivicaSpacing.lg) {
                        Button {
                            if let url = URL(string: SNAPStateResources.usdaStateDirectoryURL) {
                                openURL(url)
                            }
                        } label: {
                            Text(SNAPUnsupportedStateStrings.openDirectoryCTA.value(in: language))
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundStyle(CivicaColors.pinePrimary)
                        }
                        .buttonStyle(.plain)

                        Button(action: onExit) {
                            Text(SNAPUnsupportedStateStrings.backToHomeCTA.value(in: language))
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundStyle(CivicaColors.graphite)
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    private var titleText: String {
        let stateName = SNAPStateResources.administeringStateName(for: stateCode)
            ?? stateCode
        return SNAPUnsupportedStateStrings.title(stateName: stateName, language: language)
    }

    private var agencyLine: String? {
        SNAPStateResources.administeringAgencyName(for: stateCode)
    }

    @ViewBuilder
    private func agencyCard(agencyLine: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPUnsupportedStateStrings.agencyHeader.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(agencyLine)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }
}

enum SNAPUnsupportedStateStrings {
    static let eyebrow = CivicaText(
        "Not yet available",
        es: "Aún no disponible",
        zh: "尚未支持"
    )

    static func title(stateName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Civica doesn't cover \(stateName) yet."
        case .mandarin: return "Civica 目前还不支持 \(stateName)。"
        case .spanish: return "Civica aún no cubre \(stateName)."
        }
    }

    static let body = CivicaText(
        "Your state runs its own SNAP application process. Use the USDA directory to find your state's official application site.",
        es: "Tu estado tiene su propio proceso de solicitud de SNAP. Usa el directorio de USDA para encontrar el sitio oficial de solicitud de tu estado.",
        zh: "你所在的州有自己的 SNAP 申请流程。用 USDA 目录找到你所在州的官方申请网站。"
    )
    static let agencyHeader = CivicaText(
        "Your state's SNAP agency",
        es: "Agencia de SNAP de tu estado",
        zh: "你所在州的 SNAP 机构"
    )
    static let openDirectoryCTA = CivicaText(
        "USDA state directory ↗",
        es: "Directorio estatal de USDA ↗",
        zh: "USDA 州目录 ↗"
    )
    static let changeStateCTA = CivicaText(
        "Change my state",
        es: "Cambiar mi estado",
        zh: "更改我所在的州"
    )
    static let backToHomeCTA = CivicaText(
        "Back to home",
        es: "Volver al inicio",
        zh: "返回首页"
    )
}

#if DEBUG
struct SNAPUnsupportedStateView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPUnsupportedStateView(
                stateCode: "CA",
                language: .english,
                onChangeState: {},
                onExit: {}
            )
        }
    }
}
#endif
