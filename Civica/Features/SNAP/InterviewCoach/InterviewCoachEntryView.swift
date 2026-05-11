import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE:
// Hub view for the SNAP Interview Coach. Owns the bundled question bank and
// surfaces the available affordances. Phase 1 lights up "Browse practice
// questions". "Start a practice session" stays disabled until Phase 2 wires
// up the backend roleplay loop.
struct InterviewCoachEntryView: View {
    @StateObject private var bank = InterviewQuestionBank()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text("Practice your SNAP interview")
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)

                Text("Rehearse the questions caseworkers actually ask. Pick your state, choose a scenario, and run through the kinds of prompts that decide how quickly your benefits get approved.")
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)

                if let error = bank.loadError {
                    loadErrorBanner(error)
                }

                NavigationLink {
                    QuestionBrowserView(bank: bank)
                } label: {
                    affordanceRow(title: "Browse practice questions",
                                  subtitle: "Read sample interview questions with guidance on how to answer.",
                                  systemImage: "list.bullet.rectangle",
                                  enabled: !bank.allQuestions.isEmpty)
                }
                .buttonStyle(.plain)
                .disabled(bank.allQuestions.isEmpty)

                NavigationLink {
                    PracticeSessionView()
                } label: {
                    affordanceRow(title: "Start a practice session",
                                  subtitle: "Roleplay with a simulated caseworker. Massachusetts initial-application scenario.",
                                  systemImage: "person.wave.2.fill",
                                  enabled: true)
                }
                .buttonStyle(.plain)

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Interview Coach")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func affordanceRow(title: String, subtitle: String, systemImage: String, enabled: Bool) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 36, alignment: .center)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)

                Text(subtitle)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }

            Spacer(minLength: 0)

            if enabled {
                Image(systemName: "chevron.right")
                    .font(.subheadline)
                    .foregroundStyle(CivicaColors.graphite)
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
        .opacity(enabled ? 1.0 : 0.55)
    }

    private func loadErrorBanner(_ error: String) -> some View {
        Text("Couldn't load practice questions: \(error)")
            .font(CivicaTypography.footnoteStrong)
            .foregroundStyle(CivicaColors.destructive)
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.destructive.opacity(0.10))
            )
    }
}
