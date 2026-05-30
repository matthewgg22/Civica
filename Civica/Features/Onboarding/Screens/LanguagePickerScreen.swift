import CivicaDesignSystem
import SwiftUI

// Screen 1 of onboarding (HANDOFF board 03). Pick a language.
// Deliberately language-neutral on the welcome line so the user can
// orient themselves before any other text renders. The two language
// buttons themselves are the entry point.

struct LanguagePickerScreen: View {
    @ObservedObject var viewModel: OnboardingViewModel
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Spacer()

            // Bilingual welcome — both languages shown so neither user
            // is asked to read a language they can't yet.
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text("Welcome to Civica")
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                Text("Bienvenido a Civica")
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.graphite)
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text("Pick a language to continue.")
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                Text("Elige un idioma para continuar.")
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding(.bottom, CivicaSpacing.md)

            VStack(spacing: CivicaSpacing.md) {
                languageRow(.english, sample: "Continue in English")
                languageRow(.spanish, sample: "Continuar en español")
            }

            // JR-7 (audit 2026-05-29): bilingual users hesitate to switch
            // language mid-journey because nothing tells them their typed
            // answers stay. Set expectation here forward of typing, and
            // again on any in-app language settings sheet when IA-4 lands.
            // Matches the bilingual side-by-side pattern of the welcome
            // and "Pick a language" copy above so neither user is asked
            // to read a language they can't yet.
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text("You can switch anytime. We won't translate answers you've already typed.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Text("Puedes cambiar en cualquier momento. No traduciremos las respuestas que ya hayas escrito.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding(.top, CivicaSpacing.md)
            .accessibilityElement(children: .combine)

            Spacer()
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    private func languageRow(_ language: CivicaLanguage, sample: String) -> some View {
        Button {
            viewModel.language = language
            onContinue()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(language.displayName)
                        .font(CivicaTypography.cardTitle)
                        .foregroundStyle(CivicaColors.ink)
                    Text(sample)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .fill(CivicaColors.surfacePrimary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .accessibilityLabel("\(language.displayName). \(sample)")
        .accessibilityAddTraits(.isButton)
    }
}

#if DEBUG
struct LanguagePickerScreen_Previews: PreviewProvider {
    static var previews: some View {
        LanguagePickerScreen(viewModel: OnboardingViewModel(), onContinue: {})
    }
}
#endif
