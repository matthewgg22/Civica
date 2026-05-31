import CivicaDesignSystem
import SwiftUI

// IA-4 (audit 2026-05-29): app-wide settings sheet, opened from the
// gear in CivicaRootView's toolbar (present on every status surface).
//
// Before this, language / AI-transparency were reachable only by
// drilling into the EBT dashboard — invisible to anyone without a
// linked card, including users whose first language isn't English and
// who missed the onboarding picker. The gear makes settings a standard,
// always-present iOS affordance and removes the EBT-gating entirely.
//
// Sections shipped: Language, AI transparency, Sign out (when
// authenticated), About + version. Notifications (push / SMS opt-in)
// is intentionally deferred — it needs a preferences store + APNs/SMS
// plumbing that doesn't exist yet. Tracked in docs/runbooks/wiring-todo.md.

struct SNAPSettingsSheet: View {
    /// Bound to CivicaRootView's @AppStorage language preference so a
    /// switch here re-renders every surface immediately.
    @Binding var languageRaw: String
    @ObservedObject var auth: CivicaEnrollmentAuth

    @Environment(\.dismiss) private var dismiss
    @State private var confirmingSignOut = false

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var appVersion: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "—"
        let build = info?["CFBundleVersion"] as? String
        return build.map { "\(short) (\($0))" } ?? short
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    languageSection
                    transparencySection
                    if auth.state.isAuthenticated {
                        signOutSection
                    }
                    aboutSection
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(SNAPSettingsStrings.title.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(SNAPSettingsStrings.done.value(in: language)) { dismiss() }
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
        }
        .tint(CivicaColors.pinePrimary)
    }

    // MARK: - Language

    private var languageSection: some View {
        settingsGroup(SNAPSettingsStrings.languageHeading.value(in: language)) {
            ForEach(Array(CivicaLanguage.allCases.enumerated()), id: \.element) { index, lang in
                Button {
                    languageRaw = lang.rawValue
                } label: {
                    HStack(spacing: CivicaSpacing.md) {
                        Text(lang.displayName)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.ink)
                        Spacer(minLength: 0)
                        if lang == language {
                            Image(systemName: "checkmark")
                                .imageScale(.large)
                                .font(.body)
                                .foregroundStyle(CivicaColors.pinePrimary)
                                .accessibilityHidden(true)
                        }
                    }
                    .padding(CivicaSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(lang == language ? [.isButton, .isSelected] : .isButton)
                if index < CivicaLanguage.allCases.count - 1 {
                    Divider().overlay(CivicaColors.hairline)
                }
            }
        }
    }

    // MARK: - AI transparency

    private var transparencySection: some View {
        settingsGroup(SNAPSettingsStrings.transparencyHeading.value(in: language)) {
            NavigationLink {
                CivicaAITransparencyView()
            } label: {
                settingsRowLabel(
                    icon: "sparkles",
                    title: SNAPSettingsStrings.transparencyRow.value(in: language),
                    showChevron: true
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Sign out

    private var signOutSection: some View {
        settingsGroup(nil) {
            Button(role: .destructive) {
                confirmingSignOut = true
            } label: {
                settingsRowLabel(
                    icon: "rectangle.portrait.and.arrow.right",
                    title: SNAPSettingsStrings.signOut.value(in: language),
                    tint: CivicaColors.brickAccent
                )
            }
            .buttonStyle(.plain)
            .confirmationDialog(
                SNAPSettingsStrings.signOutConfirm.value(in: language),
                isPresented: $confirmingSignOut,
                titleVisibility: .visible
            ) {
                Button(SNAPSettingsStrings.signOut.value(in: language), role: .destructive) {
                    Task {
                        await auth.signOut()
                        dismiss()
                    }
                }
                Button(SNAPSettingsStrings.cancel.value(in: language), role: .cancel) {}
            }
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        settingsGroup(SNAPSettingsStrings.aboutHeading.value(in: language)) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack {
                    Text(SNAPSettingsStrings.versionLabel.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer(minLength: 0)
                    Text(appVersion)
                        .font(CivicaTypography.body.monospacedDigit())
                        .foregroundStyle(CivicaColors.graphite)
                }
                Text(SNAPSettingsStrings.openSourceNotice.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Building blocks

    @ViewBuilder
    private func settingsGroup<Content: View>(
        _ heading: String?,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if let heading {
                Text(heading)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
            }
            VStack(spacing: 0) { content() }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private func settingsRowLabel(
        icon: String,
        title: String,
        tint: Color = CivicaColors.ink,
        showChevron: Bool = false
    ) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(tint)
                .frame(width: 24, alignment: .leading)
                .accessibilityHidden(true)
            Text(title)
                .font(CivicaTypography.body)
                .foregroundStyle(tint)
            Spacer(minLength: 0)
            if showChevron {
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

// MARK: - Strings

enum SNAPSettingsStrings {
    static let title = CivicaText("Settings", es: "Ajustes")
    static let done = CivicaText("Done", es: "Listo")
    static let cancel = CivicaText("Cancel", es: "Cancelar")

    static let languageHeading = CivicaText("Language", es: "Idioma")

    static let transparencyHeading = CivicaText("Transparency", es: "Transparencia")
    static let transparencyRow = CivicaText("What Civica uses AI for", es: "Para qué Civica usa IA")

    static let signOut = CivicaText("Sign out", es: "Cerrar sesión")
    static let signOutConfirm = CivicaText(
        "Sign out of Civica? Your saved progress stays on this device.",
        es: "¿Cerrar sesión en Civica? Tu progreso guardado permanece en este dispositivo."
    )

    static let aboutHeading = CivicaText("About", es: "Acerca de")
    static let versionLabel = CivicaText("Version", es: "Versión")
    static let openSourceNotice = CivicaText(
        "Civica is built with open-source software. Civica does not make benefit decisions — your state agency does.",
        es: "Civica está construido con software de código abierto. Civica no toma decisiones de beneficios — tu agencia estatal lo hace."
    )
}

#if DEBUG
struct SNAPSettingsSheet_Previews: PreviewProvider {
    static var previews: some View {
        SNAPSettingsSheet(
            languageRaw: .constant(CivicaLanguage.english.rawValue),
            auth: CivicaEnrollmentAuth()
        )
    }
}
#endif
