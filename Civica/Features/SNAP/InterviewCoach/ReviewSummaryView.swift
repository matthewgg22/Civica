import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: review-summary screen.
// Renders the three rubric axes as labeled progress bars with the model's
// per-axis summary, plus per-turn notes. No persistence -- the score lives
// in PracticeSessionViewModel for the session lifetime only.
struct ReviewSummaryView: View {
    let score: InterviewScoreResponseDTO

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text("Session feedback")
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)

                Text("These scores reflect how a caseworker would likely read your answers. Lower accuracy-risk and lower missing-context are better; higher completeness is better.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)

                axisCard(title: "Completeness",
                         axis: score.completeness,
                         interpretation: .higherIsBetter,
                         hint: "Did you address what was asked?")

                axisCard(title: "Accuracy risk",
                         axis: score.accuracyRisk,
                         interpretation: .lowerIsBetter,
                         hint: "How likely are your answers to be misread as fraud or contradiction?")

                axisCard(title: "Missing context",
                         axis: score.missingContext,
                         interpretation: .lowerIsBetter,
                         hint: "Did you leave out information that would help your case?")

                if !score.perTurnNotes.isEmpty {
                    perTurnSection
                }

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Feedback")
        .navigationBarTitleDisplayMode(.inline)
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
            Text("Per-turn notes")
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            ForEach(score.perTurnNotes, id: \.turnIndex) { note in
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("Turn \(note.turnIndex + 1)")
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
