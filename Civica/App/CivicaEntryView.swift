import CivicaDesignSystem
import SwiftUI

// Minimal first-time entry tile for the Civica iOS target. Replaces
// the legacy SNAPEntryView, which carries VoteNow-specific
// PlanViewModel / MyRepsViewModel / address-prefill dependencies
// the new flow doesn't need.
//
// Surfaces two tiles:
//   • SNAP — "Apply for SNAP" — pushes the orchestrator chain
//   • Find help — pushes the map module
//
// Subsequent-launch routing (returning user, waiting room, denial,
// recert) lives in CivicaRootView's status-aware rootSurface; this
// view is what users see ONLY when status is .notStarted.

struct CivicaEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                snapTile
                findHelpTile
                Spacer(minLength: CivicaSpacing.xl)
                privacyFooterLink
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Quiet footer link to the data + privacy surface. Lives at the
    /// bottom of the entry tile so it's available on every launch
    /// without competing for attention with the primary actions.
    /// App Store reviewers expect this kind of self-service data
    /// access + deletion to be reachable from anywhere in the app.
    private var privacyFooterLink: some View {
        NavigationLink {
            SNAPDataPrivacyView(language: language)
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(CivicaEntryStrings.privacyLink.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .underline()
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(CivicaEntryStrings.privacyLink.value(in: language))
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(CivicaEntryStrings.eyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(CivicaEntryStrings.title.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(CivicaEntryStrings.subtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - SNAP tile

    private var snapTile: some View {
        NavigationLink {
            CivicaSNAPFlowView(language: language)
        } label: {
            tileCard(
                icon: "leaf.fill",
                iconAccent: CivicaColors.brickPrimary,
                title: CivicaEntryStrings.snapTitle.value(in: language),
                subtitle: CivicaEntryStrings.snapSubtitle.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Find help tile

    private var findHelpTile: some View {
        NavigationLink {
            FindHelpRootView()
        } label: {
            tileCard(
                icon: "map.fill",
                iconAccent: CivicaColors.accentTeal,
                title: CivicaEntryStrings.findHelpTitle.value(in: language),
                subtitle: CivicaEntryStrings.findHelpSubtitle.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private func tileCard(icon: String, iconAccent: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(iconAccent)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(iconAccent.opacity(0.12))
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(subtitle)")
    }
}

enum CivicaEntryStrings {
    static let eyebrow = CivicaText(
        "Civica",
        es: "Civica"
    )
    static let title = CivicaText(
        "Apply for help with food.",
        es: "Solicita ayuda con la comida."
    )
    static let subtitle = CivicaText(
        "Walk through a SNAP application at your own pace. Save your answers anytime.",
        es: "Haz una solicitud de SNAP a tu ritmo. Guarda tus respuestas en cualquier momento."
    )
    static let snapTitle = CivicaText(
        "Apply for SNAP",
        es: "Solicitar SNAP"
    )
    static let snapSubtitle = CivicaText(
        "Massachusetts food assistance — typically about 15 minutes.",
        es: "Asistencia alimentaria en Massachusetts — usualmente unos 15 minutos."
    )
    static let findHelpTitle = CivicaText(
        "Find help near you",
        es: "Encuentra ayuda cerca de ti"
    )
    static let findHelpSubtitle = CivicaText(
        "Food banks, pantries, and SNAP navigators within walking distance.",
        es: "Bancos de alimentos, despensas y asesores de SNAP a distancia caminable."
    )
    static let privacyLink = CivicaText(
        "Your data + privacy",
        es: "Tus datos y privacidad"
    )
}

#if DEBUG
struct CivicaEntryView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            CivicaEntryView()
                .environmentObject(SNAPApplicationStatusStore())
        }
    }
}
#endif
