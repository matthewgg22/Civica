import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: detail screen for a single interview question.
struct QuestionDetailView: View {
    let question: InterviewQuestion

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

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("How to answer")
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
                        Text("Especially relevant for")
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.graphite)

                        HStack(spacing: CivicaSpacing.xs) {
                            ForEach(question.archetypeTags) { tag in
                                chip(text: tag.label, tint: CivicaColors.brickPrimary.opacity(0.12), foreground: CivicaColors.brickPrimary)
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
        .navigationTitle("Practice question")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var chipRow: some View {
        HStack(spacing: CivicaSpacing.xs) {
            chip(text: question.scenario.label,
                 tint: CivicaColors.accentTeal.opacity(0.12),
                 foreground: CivicaColors.accentTeal)
            chip(text: question.category.label,
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
}
