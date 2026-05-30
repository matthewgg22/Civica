import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: end-of-session feedback screen.
// Renders the overall readiness score, strengths, improvements, and a
// bilingual one-paragraph summary returned by POST .../practice/:sessionId/score.
// UI chrome is bilingual via InterviewCoachStrings; the LLM-generated
// content (strengths/improvements/summary) comes back already-translated.
// MARK: - AccessibilityElement = parent
struct ReviewSummaryView: View {
    let score: InterviewScoreResponseDTO

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var localizedSummary: String {
        switch language {
        case .english: return score.summaryEn
        case .spanish: return score.summaryEs
        }
    }

    private var scoreTint: Color {
        if score.overallScore >= 70 { return CivicaColors.amberPrimary }
        if score.overallScore >= 50 { return CivicaColors.pinePrimary }
        return CivicaColors.destructive
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    Text(InterviewCoachStrings.sessionFeedbackTitle.value(in: language))
                        .font(CivicaTypography.pageTitle)
                        .foregroundStyle(CivicaColors.ink)

                    Spacer(minLength: CivicaSpacing.sm)

                    CivicaAIBadge()
                }

                Text(InterviewCoachStrings.sessionFeedbackIntro.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)

                overallScoreCard

                if !localizedSummary.isEmpty {
                    Text(localizedSummary)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
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

                bulletSection(
                    header: InterviewCoachStrings.strengthsHeader.value(in: language),
                    bullets: score.strengths,
                    tint: CivicaColors.amberPrimary
                )

                bulletSection(
                    header: InterviewCoachStrings.improvementsHeader.value(in: language),
                    bullets: score.improvements,
                    tint: CivicaColors.pinePrimary
                )

                InterviewCoachDisclaimer(language: language)

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navFeedback.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            InterviewCoachAnalytics.track(.feedbackViewed, parameters: [
                "overall_score_bucket": InterviewCoachAnalytics.bucket(Double(score.overallScore) / 100.0),
                "engine_version":       score.engineVersion
            ])
        }
    }

    private var overallScoreCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(InterviewCoachStrings.overallScoreLabel.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            HStack(alignment: .lastTextBaseline, spacing: CivicaSpacing.xs) {
                Text("\(score.overallScore)")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .foregroundStyle(scoreTint)
                Text("/ 100")
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }

            ProgressView(value: Double(min(100, max(0, score.overallScore))) / 100.0)
                .tint(scoreTint)
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

    private func bulletSection(header: String, bullets: [String], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(header)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            ForEach(Array(bullets.enumerated()), id: \.offset) { _, bullet in
                HStack(alignment: .top, spacing: CivicaSpacing.xs) {
                    Circle()
                        .fill(tint)
                        .frame(width: 6, height: 6)
                        .padding(.top, 7)
                        .accessibilityHidden(true)

                    Text(bullet)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
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
