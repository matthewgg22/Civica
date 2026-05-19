import CivicaDesignSystem
import SwiftUI

/// Sheet presented when a navigator taps "Report a problem" on Screen 05
/// (SNAPPlacementUpdateView). Provides a mailto: link to support.
///
/// The Supabase `report-problem` edge function does not exist yet;
/// email is the v1 contact path. Wire the network call here when the
/// function ships.
struct SNAPReportProblemView: View {

    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    // MARK: - Strings

    private var titleText: String {
        language == .spanish ? "Reportar un problema" : "Report a Problem"
    }

    private var bodyText: String {
        language == .spanish
            ? "Describe el problema con tu oferta de trabajo o colocación. Nuestro equipo lo revisará dentro de 1 día hábil."
            : "Describe the issue with your job offer or placement. Our team will review it within 1 business day."
    }

    private var emailLinkLabel: String {
        language == .spanish ? "Enviar correo electrónico" : "Send email"
    }

    private var cancelLabel: String {
        language == .spanish ? "Cancelar" : "Cancel"
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {

                    Text(bodyText)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)

                    emailCTA

                    Spacer(minLength: CivicaSpacing.xl)
                }
                .padding(CivicaSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationTitle(titleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(cancelLabel) { dismiss() }
                        .foregroundStyle(CivicaColors.brickPrimary)
                }
            }
        }
    }

    // MARK: - Email CTA

    private var emailCTA: some View {
        Link(destination: URL(string: "mailto:support@civica.app?subject=Marketplace%20Issue")!) {
            HStack {
                Image(systemName: "envelope")
                    .font(.system(size: 16, weight: .medium))
                Text(emailLinkLabel)
                    .font(CivicaTypography.subheadStrong)
            }
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
            .background(CivicaColors.brickPrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        }
    }
}

// MARK: - Preview

#if DEBUG
#Preview("English") {
    SNAPReportProblemView()
}

#Preview("Spanish") {
    SNAPReportProblemView()
        .onAppear {
            UserDefaults.standard.set(CivicaLanguage.spanish.rawValue,
                                      forKey: CivicaLanguage.defaultStorageKey)
        }
}
#endif
