import CivicaDesignSystem
import SwiftUI

// Gate shown when the user selects an application state Civica's
// SNAP screener isn't tuned for yet. The MA-only beta posture means
// any state other than MA (including the "Another US state" bucket
// from SNAPWhereApplyingFlow) routes here instead of continuing
// into the eligibility/calculator flow.
//
// Enforced at the orchestrator level (see SNAPApplicationFlowOrchestratorView)
// so deep links into later sections can't bypass it: the orchestrator
// reads the saved draft's whereApplying.stateCode on every render and
// switches to this view when the code is set and non-MA.

struct SNAPUnsupportedStateView: View {
    @Environment(\.openURL) private var openURL
    let stateCode: String
    let language: CivicaLanguage
    let onChangeState: () -> Void
    let onExit: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(SNAPUnsupportedStateStrings.title.value(in: language))
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)

                Text(SNAPUnsupportedStateStrings.body.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                if let agency = agencyLine {
                    agencyCard(agencyLine: agency)
                }

                VStack(spacing: CivicaSpacing.sm) {
                    Button {
                        if let url = URL(string: SNAPStateResources.usdaStateDirectoryURL) {
                            openURL(url)
                        }
                    } label: {
                        Text(SNAPUnsupportedStateStrings.openDirectoryCTA.value(in: language))
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())

                    Button(action: onChangeState) {
                        Text(SNAPUnsupportedStateStrings.changeStateCTA.value(in: language))
                    }
                    .buttonStyle(CivicaSecondaryCTAButtonStyle())

                    Button(action: onExit) {
                        Text(SNAPUnsupportedStateStrings.backToHomeCTA.value(in: language))
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.brickPrimary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.tealSurface.ignoresSafeArea())
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
    static let title = CivicaText(
        "Civica's SNAP screener is currently available for Massachusetts",
        es: "El asistente de SNAP de Civica está disponible actualmente solo para Massachusetts"
    )
    static let body = CivicaText(
        "For other states, use the official state SNAP application directory. Each state's agency runs its own application process and decides eligibility.",
        es: "Para otros estados, usa el directorio oficial de solicitud de SNAP del estado. La agencia de cada estado tiene su propio proceso de solicitud y decide la elegibilidad."
    )
    static let agencyHeader = CivicaText(
        "Your state's SNAP agency",
        es: "Agencia de SNAP de tu estado"
    )
    static let openDirectoryCTA = CivicaText(
        "Open the USDA state directory",
        es: "Abrir el directorio estatal de USDA"
    )
    static let changeStateCTA = CivicaText(
        "Change my state",
        es: "Cambiar mi estado"
    )
    static let backToHomeCTA = CivicaText(
        "Back to Civica home",
        es: "Volver al inicio de Civica"
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
