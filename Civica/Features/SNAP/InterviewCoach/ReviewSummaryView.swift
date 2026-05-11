import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: review-summary screen.
// Renders the three rubric axes as labeled progress bars with the model's
// per-axis summary, plus per-turn notes. UI chrome bilingual via
// InterviewCoachStrings; the LLM-generated axis.summary and note.note
// text comes back in whatever language the backend produced it in
// (currently English-only -- one of the open items in BACKEND_CONTRACT).
struct ReviewSummaryView: View {
    let score: InterviewScoreResponseDTO

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(InterviewCoachStrings.sessionFeedbackTitle.value(in: language))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)

                Text(InterviewCoachStrings.sessionFeedbackIntro.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)

                axisCard(title: InterviewCoachStrings.axisCompleteness.value(in: language),
                         axis: score.completeness,
                         interpretation: .higherIsBetter,
                         hint: InterviewCoachStrings.axisCompletenessHint.value(in: language))

                axisCard(title: InterviewCoachStrings.axisAccuracyRisk.value(in: language),
                         axis: score.accuracyRisk,
                         interpretation: .lowerIsBetter,
                         hint: InterviewCoachStrings.axisAccuracyRiskHint.value(in: language))

                axisCard(title: InterviewCoachStrings.axisMissingContext.value(in: language),
                         axis: score.missingContext,
                         interpretation: .lowerIsBetter,
                         hint: InterviewCoachStrings.axisMissingContextHint.value(in: language))

                if !score.perTurnNotes.isEmpty {
                    perTurnSection
                }

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
                "axis_completeness":     InterviewCoachAnalytics.bucket(score.completeness.score),
                "axis_accuracy_risk":    InterviewCoachAnalytics.bucket(score.accuracyRisk.score),
                "axis_missing_context":  InterviewCoachAnalytics.bucket(score.missingContext.score)
            ])
        }
    }

    private enum AxisInterpretation { case higherIsBetter, lowerIsBetter }

    private func axisCard(title: String,
                          axis: InterviewScoreAxisDTO,
                          interpretation: AxisInterpretation,
                          hint: String) -> some View {
        let tint: Color = {
            switch interpretation {
            case .higherIsBetter: return axis.score >= 0.7 ? CivicaColors.accentTeal : axis.score >= 0.4 ? CivicaColors.brickPrimary : CivicaColors.destructive
            case .lowerIsBetter:  return axis.score <= 0.2 ? CivicaColors.accentTeal : axis.score <= 0.5 ? CivicaColors.brickPrimary : CivicaColors.destructive
            }
        }()

        return VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)

                Spacer(minLength: 0)

                Text(String(format: "%.2f", axis.score))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(tint)
            }

            ProgressView(value: max(0.0, min(1.0, axis.score)))
                .tint(tint)

            Text(hint)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)

            if !axis.summary.isEmpty {
                Text(axis.summary)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, CivicaSpacing.xs)
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

    private var perTurnSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(InterviewCoachStrings.perTurnNotes.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            ForEach(score.perTurnNotes, id: \.turnIndex) { note in
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(InterviewCoachStrings.turnLabel(note.turnIndex + 1, language: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)

                    if !note.applicantText.isEmpty {
                        Text(note.applicantText)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.graphite)
                            .italic()
                    }

                    Text(note.note)
                        .font(CivicaTypography.body)
                        .foregroundStyle(note.note.uppercased() == "OK"
                                         ? CivicaColors.accentTeal
                                         : CivicaColors.ink)
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
    }
}
