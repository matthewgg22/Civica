import CivicaDesignSystem
import SwiftUI

// Civica cold-start home — Phase 1 (Enroll) of the three-phase main
// screen. Rendered by CivicaRootView.rootSurface only when the user
// hasn't yet submitted to the state (status .notStarted, plus the
// active-case-pre-submission states reached via the rootSurface
// .isActiveCase branch when SNAPReturningUserHomeView is replaced).
//
// Replaces the legacy 6-tile column (Apply / Estimator / EBT / Find
// help / Buddy / Interview Coach / Recert) which the May 2026 design
// review flagged as AI-slop — every entry point carried equal visual
// weight, the icon-in-tinted-rectangle pattern was a textbook
// repeating-card grid, and "Apply for SNAP" (the primary action) had
// no more affordance than "Add a buddy" (a coming-soon placeholder).
//
// New shape: one filled-pine hero card that owns "Apply for SNAP"
// outright, an inline estimator off-ramp for the hesitation path,
// and two hairline-separated secondary rows for utility entry points
// (find food today / check EBT balance for existing recipients).
// Buddy and Interview Coach are dropped from cold-start — Buddy
// because its destination is a coming-soon placeholder, Interview
// Coach because it belongs on Phase 2 when status .interviewScheduled.

struct CivicaEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @State private var presentingDebugMenu = false

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    /// True when a persisted draft exists. Flips the hero CTA label
    /// from "Start" to "Resume" so returning-in-progress users land
    /// on continuity, not a fresh "start over" CTA they didn't ask
    /// for.
    private var hasActiveDraft: Bool {
        SNAPApplicationDraftStore().load() != nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                heroCard
                estimatorOffRamp
                hairline
                secondaryRows
                Spacer(minLength: CivicaSpacing.xl)
                privacyFooterLink
                versionFooter
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $presentingDebugMenu) {
            DebugMenuView()
        }
    }

    // MARK: - Hero card (filled pine, owns the primary action)

    private var heroCard: some View {
        NavigationLink {
            CivicaSNAPFlowView(language: language)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(CivicaEntryStrings.heroEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.72))
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .padding(.bottom, CivicaSpacing.sm)

                Text(CivicaEntryStrings.heroTitle.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, CivicaSpacing.sm)

                Text(CivicaEntryStrings.heroBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, CivicaSpacing.md)

                Rectangle()
                    .fill(CivicaColors.onPrimaryText.opacity(0.18))
                    .frame(height: 1)
                    .padding(.bottom, CivicaSpacing.md)

                HStack(spacing: CivicaSpacing.sm) {
                    Text(
                        hasActiveDraft
                            ? CivicaEntryStrings.heroResumeCTA.value(in: language)
                            : CivicaEntryStrings.heroStartCTA.value(in: language)
                    )
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.right")
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: 24)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.pinePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            "\(CivicaEntryStrings.heroTitle.value(in: language)). \(CivicaEntryStrings.heroBody.value(in: language))"
        )
    }

    // MARK: - Estimator off-ramp (inline link, NOT a tile)

    /// Hesitation off-ramp for users who suspect they might not
    /// qualify. Rendered as inline copy with a tappable pine link,
    /// not as a peer-of-Apply tile — the design review surfaced
    /// that giving estimator equal visual weight to the application
    /// itself was costing primary-action conversion. Preserves the
    /// SNAPCoveragePolicy unsupported-state gate from the legacy
    /// estimatorTile.
    private var estimatorOffRamp: some View {
        NavigationLink {
            estimatorDestination
        } label: {
            HStack(spacing: CivicaSpacing.xs) {
                Text(CivicaEntryStrings.estimatorOffRampPrompt.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
                Text(CivicaEntryStrings.estimatorOffRampLink.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var estimatorDestination: some View {
        let persistedState = SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
        if SNAPCoveragePolicy.shouldShowUnsupportedStateGate(for: persistedState) {
            SNAPUnsupportedStateView(
                stateCode: persistedState ?? "",
                language: language,
                onChangeState: {},
                onExit: {}
            )
        } else {
            SNAPEstimatorFlowView(language: language)
        }
    }

    // MARK: - Secondary rows (find help · EBT balance)

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
    }

    private var secondaryRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            findHelpRow
            hairline
            ebtBalanceRow
        }
    }

    private var findHelpRow: some View {
        NavigationLink {
            FindHelpRootView()
        } label: {
            secondaryRowLabel(
                icon: "fork.knife",
                eyebrow: CivicaEntryStrings.findHelpRowEyebrow.value(in: language),
                link: CivicaEntryStrings.findHelpRowLink.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private var ebtBalanceRow: some View {
        NavigationLink {
            // Worktree branched from codex/rebuild-feb18 — EBT root
            // here takes (store, anomalyStore) only. The offers-aware
            // initializer lives on feat/dashboard-caseworker-readiness
            // and will be re-introduced when those features land.
            EBTBalanceRootView()
        } label: {
            secondaryRowLabel(
                icon: "creditcard",
                eyebrow: CivicaEntryStrings.ebtBalanceRowEyebrow.value(in: language),
                link: CivicaEntryStrings.ebtBalanceRowLink.value(in: language)
            )
        }
        .buttonStyle(.plain)
    }

    private func secondaryRowLabel(icon: String, eyebrow: String, link: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(CivicaColors.ink)
                .frame(width: 32, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                Text(link)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(.vertical, CivicaSpacing.md)
        .padding(.horizontal, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(eyebrow). \(link)")
    }

    // MARK: - Privacy footer

    /// Combines the existing "Your data + privacy" entry point with
    /// the "Civica · public-benefit project" trust signal selected
    /// during the C2 design refinement — resolves the
    /// "state-of-California" copy fact-check question with honest,
    /// non-endorsement language.
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
                Text(CivicaEntryStrings.publicBenefitTag.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                Spacer(minLength: 0)
            }
            .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(CivicaEntryStrings.privacyLink.value(in: language))
    }

    // MARK: - Version footer (preserved 5-tap debug menu)

    /// Tiny, low-contrast version stamp. Tapped 5 times in a row it
    /// pops the QA debug menu. Standard iOS hidden-affordance
    /// pattern; not discoverable to normal users. Preserved verbatim
    /// from the legacy entry view — design review D7.
    private var versionFooter: some View {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return HStack {
            Spacer()
            Text("v\(version) (\(build))")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .onTapGesture(count: 5) {
                    presentingDebugMenu = true
                }
                .accessibilityHidden(true)
            Spacer()
        }
        .padding(.top, CivicaSpacing.md)
    }
}

// MARK: - Strings

enum CivicaEntryStrings {
    // ─── Phase 1 hero ──────────────────────────────────────────────

    static let heroEyebrow = CivicaText(
        "Start here",
        es: "Empieza aquí"
    )
    static let heroTitle = CivicaText(
        "Apply for SNAP",
        es: "Solicita SNAP"
    )
    static let heroBody = CivicaText(
        "CalFresh / SNAP food assistance. About 15 minutes. Save anytime, no commitment to submit.",
        es: "Asistencia alimentaria de CalFresh / SNAP. Unos 15 minutos. Guarda en cualquier momento; no hay compromiso de enviar."
    )
    static let heroStartCTA = CivicaText(
        "Start your application",
        es: "Empieza tu solicitud"
    )
    static let heroResumeCTA = CivicaText(
        "Resume your application",
        es: "Continúa tu solicitud"
    )

    // ─── Estimator off-ramp ────────────────────────────────────────

    static let estimatorOffRampPrompt = CivicaText(
        "Not sure if you qualify?",
        es: "¿No estás seguro de si calificas?"
    )
    static let estimatorOffRampLink = CivicaText(
        "Estimate your benefit →",
        es: "Calcula tu beneficio →"
    )

    // ─── Secondary rows ────────────────────────────────────────────

    static let findHelpRowEyebrow = CivicaText(
        "Need food today?",
        es: "¿Necesitas comida hoy?"
    )
    static let findHelpRowLink = CivicaText(
        "Find help nearby",
        es: "Encuentra ayuda cerca"
    )
    static let ebtBalanceRowEyebrow = CivicaText(
        "Already have CalFresh?",
        es: "¿Ya tienes CalFresh?"
    )
    static let ebtBalanceRowLink = CivicaText(
        "Check your EBT balance",
        es: "Consulta tu saldo de EBT"
    )

    // ─── Footer ────────────────────────────────────────────────────

    static let privacyLink = CivicaText(
        "Your data + privacy",
        es: "Tus datos y privacidad"
    )
    static let publicBenefitTag = CivicaText(
        "· Civica · public-benefit project",
        es: "· Civica · proyecto de beneficio público"
    )

    // ─── Legacy keys (kept for now; some may be referenced by other
    // call sites — cleanup pass after a grep audit). The design no
    // longer renders these, but deleting them risks breaking string
    // parity if another view imports the symbol. Safe to remove after
    // a targeted grep confirms zero external uses.
    // ───────────────────────────────────────────────────────────────

    static let eyebrow = CivicaText("Civica", es: "Civica")
    static let title = CivicaText(
        "Apply for help with food.",
        es: "Solicita ayuda con la comida."
    )
    static let subtitle = CivicaText(
        "Walk through a SNAP application at your own pace. Save your answers anytime.",
        es: "Haz una solicitud de SNAP a tu ritmo. Guarda tus respuestas en cualquier momento."
    )
    static let snapTitle = CivicaText("Apply for SNAP", es: "Solicitar SNAP")
    static let snapSubtitle = CivicaText(
        "CalFresh / SNAP food assistance — typically about 15 minutes.",
        es: "Asistencia alimentaria de CalFresh / SNAP — usualmente unos 15 minutos."
    )
    static let ebtBalanceTitle = CivicaText(
        "Check EBT balance",
        es: "Consultar saldo de EBT"
    )
    static let ebtBalanceSubtitle = CivicaText(
        "See your CalFresh balance, recent activity, and next deposit.",
        es: "Consulta tu saldo de CalFresh, actividad reciente y próximo depósito."
    )
    static let findHelpTitle = CivicaText(
        "Find help near you",
        es: "Encuentra ayuda cerca de ti"
    )
    static let findHelpSubtitle = CivicaText(
        "Food banks, pantries, and SNAP navigators within walking distance.",
        es: "Bancos de alimentos, despensas y asesores de SNAP a distancia caminable."
    )
    static let buddyTitle = CivicaText("Add a buddy", es: "Agrega un compañero")
    static let buddySubtitle = CivicaText(
        "Loop in someone you trust to follow along and help with next steps.",
        es: "Incluye a alguien de confianza para que te acompañe y te ayude con los próximos pasos."
    )
    static let buddyComingSoonTitle = CivicaText(
        "Buddy support is almost here",
        es: "El acompañante está casi listo"
    )
    static let buddyComingSoonBody = CivicaText(
        "Soon you'll be able to send a private link to a family member, friend, or navigator. They'll see your status, deadlines, and what's left to do — never your private documents.",
        es: "Pronto podrás enviar un enlace privado a un familiar, amigo o asesor. Verá tu estado, fechas límite y lo que falta por hacer — nunca tus documentos privados."
    )
    static let buddyComingSoonCTA = CivicaText("Got it", es: "Entendido")
    static let interviewCoachTitle = CivicaText(
        "Practice your DTA interview",
        es: "Practica tu entrevista con DTA"
    )
    static let interviewCoachSubtitle = CivicaText(
        "Rehearse with a simulated caseworker before the real call.",
        es: "Ensaya con un trabajador social simulado antes de la llamada real."
    )
    static let recertCompanionTitle = CivicaText(
        "Recertification Companion",
        es: "Acompañante de recertificación"
    )
    static let recertCompanionSubtitle = CivicaText(
        "Preview your recertification, track document deadlines, and draft a procedural appeal if you're denied.",
        es: "Previsualiza tu recertificación, sigue las fechas de tus documentos y redacta una apelación si te niegan."
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
