import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: detail screen for a single interview question.
//
// The question's prompt + guidance render in the language they exist in
// the JSON corpus (English only at v1). All surrounding chrome --
// "How to answer", "Especially relevant for", nav title, chips --
// localizes from InterviewCoachStrings. A Spanish-only notice flags
// the mismatch when language is .spanish.
struct QuestionDetailView: View {
    let question: InterviewQuestion

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    chipRow

                    Text(question.prompt)
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if language == .spanish {
                    englishOnlyNotice
                }

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(InterviewCoachStrings.howToAnswer.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.graphite)

                    Text(question.guidance)
                        .font(CivicaTypography.body)
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

                if !question.archetypeTags.isEmpty {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text(InterviewCoachStrings.especiallyRelevantFor.value(in: language))
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.graphite)

                        HStack(spacing: CivicaSpacing.xs) {
                            ForEach(question.archetypeTags) { tag in
                                chip(text: tag.localizedLabel(in: language),
                                     tint: CivicaColors.brickPrimary.opacity(0.12),
                                     foreground: CivicaColors.brickPrimary)
                            }
                        }
                    }
                }

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navPracticeQuestion.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var chipRow: some View {
        HStack(spacing: CivicaSpacing.xs) {
            chip(text: question.scenario.localizedLabel(in: language),
                 tint: CivicaColors.accentTeal.opacity(0.12),
                 foreground: CivicaColors.accentTeal)
            chip(text: question.category.localizedLabel(in: language),
                 tint: CivicaColors.brickPrimary.opacity(0.12),
                 foreground: CivicaColors.brickPrimary)
        }
    }

    private func chip(text: String, tint: Color, foreground: Color) -> some View {
        Text(text)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(foreground)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .background(
                Capsule().fill(tint)
            )
    }

    private var englishOnlyNotice: some View {
        Text(InterviewCoachStrings.englishOnlyNotice.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, CivicaSpacing.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                    .fill(CivicaColors.tealSurface.opacity(0.4))
            )
    }
}
