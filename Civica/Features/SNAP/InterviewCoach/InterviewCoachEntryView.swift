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

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth
    @EnvironmentObject private var recertContext: RecertContextStore

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

                practiceAffordance

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
        .task(id: enrollmentAuth.state.isAuthenticated) {
            await recertContext.refresh(auth: enrollmentAuth, language: language)
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
                .foregroundStyle(CivicaColors.pinePrimary)
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

    @ViewBuilder
    private var practiceAffordance: some View {
        switch recertContext.state {
        case .loading:
            HStack(spacing: CivicaSpacing.sm) {
                ProgressView().controlSize(.small)
                Text(InterviewCoachStrings.practiceTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.graphite)
                Spacer(minLength: 0)
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

        case .ready(let recert):
            NavigationLink {
                PracticeSessionView(recertId: recert.recertId, auth: enrollmentAuth)
            } label: {
                affordanceRow(title: InterviewCoachStrings.practiceTitle.value(in: language),
                              subtitle: InterviewCoachStrings.practiceSubtitle.value(in: language),
                              systemImage: "person.wave.2.fill",
                              enabled: true)
            }
            .buttonStyle(.plain)

        case .none, .unauthenticated, .failed:
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(InterviewCoachStrings.practiceTitle.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(noRecertSubtitle)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
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
            .opacity(0.85)
        }
    }

    private var noRecertSubtitle: String {
        switch recertContext.state {
        case .unauthenticated:
            return language == .spanish
                ? "Inicia sesión para practicar tu entrevista."
                : "Sign in to practice your interview."
        case .failed(let msg):
            return msg
        default:
            return language == .spanish
                ? "Aún no hay una recertificación activa. Inicia una para practicar tu entrevista."
                : "No active recertification yet. Start one to practice your interview."
        }
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
