import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE:
// Hub view for the SNAP Interview Coach. Owns the bundled question bank
// and surfaces the available affordances. Localized via
// InterviewCoachStrings (UI chrome bilingual; question corpus
// English-only until SME-reviewed Spanish JSON ships).
struct InterviewCoachEntryView: View {
    @StateObject private var bank = InterviewQuestionBank()
    @State private var showAITransparency = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                    Text(InterviewCoachStrings.entryTitle.value(in: language))
                        .font(CivicaTypography.pageTitle)
                        .foregroundStyle(CivicaColors.ink)

                    Spacer(minLength: CivicaSpacing.sm)

                    CivicaAIBadge {
                        showAITransparency = true
                    }
                    .padding(.top, CivicaSpacing.xs)
                }

                Text(InterviewCoachStrings.entryBody.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)

                if let error = bank.loadError {
                    loadErrorBanner(error)
                }

                NavigationLink {
                    QuestionBrowserView(bank: bank)
                } label: {
                    affordanceRow(title: InterviewCoachStrings.browseTitle.value(in: language),
                                  subtitle: InterviewCoachStrings.browseSubtitle.value(in: language),
                                  systemImage: "list.bullet.rectangle",
                                  enabled: !bank.allQuestions.isEmpty)
                }
                .buttonStyle(.plain)
                .disabled(bank.allQuestions.isEmpty)

                NavigationLink {
                    PracticeSessionView()
                } label: {
                    affordanceRow(title: InterviewCoachStrings.practiceTitle.value(in: language),
                                  subtitle: InterviewCoachStrings.practiceSubtitle.value(in: language),
                                  systemImage: "person.wave.2.fill",
                                  enabled: true)
                }
                .buttonStyle(.plain)

                InterviewCoachDisclaimer(language: language)
                    .padding(.top, CivicaSpacing.sm)

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navInterviewCoach.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            InterviewCoachAnalytics.track(.entryViewed, parameters: [
                "language": InterviewCoachAnalytics.languageCode(language)
            ])
        }
        .sheet(isPresented: $showAITransparency) {
            NavigationStack {
                CivicaAITransparencyView(presentedAsSheet: true)
            }
        }
    }

    private func affordanceRow(title: String, subtitle: String, systemImage: String, enabled: Bool) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 36, alignment: .center)
                .accessibilityHidden(true)

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
                    .accessibilityHidden(true)
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
        Text("\(InterviewCoachStrings.loadErrorPrefix.value(in: language)) \(error)")
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
