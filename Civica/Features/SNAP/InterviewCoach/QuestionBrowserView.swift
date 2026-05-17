import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: state-aware question browser for the Interview
// Coach. Phase 1 supports MA only; other states render greyed in the picker
// so the surface signals future coverage without claiming false support.
//
// Civica-side adaptation: VoteNow shipped per-state flag imagesets
// (StateFlag_MA etc.) and used them in both the picker and the state
// header. Civica's asset catalog doesn't include those flags; both
// surfaces fall back to a code-in-a-pill until the flag bundle lands.
//
// Bilingual UI chrome via InterviewCoachStrings. The question prompts
// themselves stay in the language of the JSON corpus (English at v1);
// the Spanish-only banner flags this for non-English users.
struct QuestionBrowserView: View {
    @ObservedObject var bank: InterviewQuestionBank

    @State private var selectedStateCode: String = "MA"
    @State private var selectedCategory: QuestionCategory? = nil

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                statePicker
                stateHeader
                if language == .spanish {
                    englishOnlyNotice
                }
                categoryFilter
                questionList

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navPracticeQuestions.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            InterviewCoachAnalytics.track(.browserViewed, parameters: [
                "state_code": selectedStateCode,
                "language": InterviewCoachAnalytics.languageCode(language)
            ])
        }
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

    private var statePicker: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(InterviewCoachStrings.pickYourState.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: CivicaSpacing.sm) {
                    ForEach(Self.allStates, id: \.code) { state in
                        stateChip(state: state)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func stateChip(state: StateOption) -> some View {
        let isSupported = bank.supportedStateCodes.contains(state.code)
        let isSelected = selectedStateCode == state.code
        let supportedSuffix = isSupported
            ? (language == .spanish ? "disponible" : "available")
            : (language == .spanish ? "próximamente" : "coming soon")

        return Button {
            guard isSupported else { return }
            selectedStateCode = state.code
        } label: {
            Text(state.code)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(isSelected
                                 ? CivicaColors.brickPrimary
                                 : (isSupported ? CivicaColors.ink : CivicaColors.muted))
                .frame(width: 44, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(isSelected
                              ? CivicaColors.brickPrimary.opacity(0.12)
                              : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .stroke(isSelected ? CivicaColors.brickPrimary : CivicaColors.hairline,
                                lineWidth: 1)
                )
                .opacity(isSupported ? 1.0 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!isSupported)
        .accessibilityLabel(Text("\(state.name) — \(supportedSuffix)"))
    }

    private var stateHeader: some View {
        let name = Self.allStates.first(where: { $0.code == selectedStateCode })?.name ?? selectedStateCode
        let supported = bank.supportedStateCodes.contains(selectedStateCode)

        return HStack(spacing: CivicaSpacing.sm) {
            Text(name)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            if !supported {
                Text(InterviewCoachStrings.comingSoon.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(CivicaColors.hairline))
            }
        }
    }

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: CivicaSpacing.xs) {
                filterChip(label: InterviewCoachStrings.allCategories.value(in: language),
                           isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }
                ForEach(QuestionCategory.allCases) { category in
                    filterChip(label: category.localizedLabel(in: language),
                               isSelected: selectedCategory == category) {
                        selectedCategory = category
                    }
                }
            }
        }
    }

    private func filterChip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(isSelected ? Color.white : CivicaColors.brickPrimary)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, CivicaSpacing.xs)
                .background(
                    Capsule()
                        .fill(isSelected ? CivicaColors.brickPrimary : CivicaColors.brickPrimary.opacity(0.10))
                )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var questionList: some View {
        let questions = bank.questions(forState: selectedStateCode, category: selectedCategory)
        if questions.isEmpty {
            emptyState
        } else {
            VStack(spacing: CivicaSpacing.sm) {
                ForEach(questions) { question in
                    NavigationLink(value: question) {
                        questionRow(question)
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationDestination(for: InterviewQuestion.self) { question in
                QuestionDetailView(question: question)
            }
        }
    }

    private func questionRow(_ question: InterviewQuestion) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(question.prompt)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                    .multilineTextAlignment(.leading)

                HStack(spacing: CivicaSpacing.xs) {
                    Text(question.scenario.localizedLabel(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.accentTeal)
                    Text("·")
                        .foregroundStyle(CivicaColors.graphite)
                    Text(question.category.localizedLabel(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.brickPrimary)
                }
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.subheadline)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
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

    private var emptyState: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.title)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(InterviewCoachStrings.emptyResults.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 160)
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .fill(CivicaColors.surfacePrimary.opacity(0.5))
        )
    }
}

private struct StateOption {
    let code: String
    let name: String
}

private extension QuestionBrowserView {
    static let allStates: [StateOption] = [
        .init(code: "AL", name: "Alabama"), .init(code: "AK", name: "Alaska"),
        .init(code: "AZ", name: "Arizona"), .init(code: "AR", name: "Arkansas"),
        .init(code: "CA", name: "California"), .init(code: "CO", name: "Colorado"),
        .init(code: "CT", name: "Connecticut"), .init(code: "DE", name: "Delaware"),
        .init(code: "DC", name: "District of Columbia"), .init(code: "FL", name: "Florida"),
        .init(code: "GA", name: "Georgia"), .init(code: "HI", name: "Hawaii"),
        .init(code: "ID", name: "Idaho"), .init(code: "IL", name: "Illinois"),
        .init(code: "IN", name: "Indiana"), .init(code: "IA", name: "Iowa"),
        .init(code: "KS", name: "Kansas"), .init(code: "KY", name: "Kentucky"),
        .init(code: "LA", name: "Louisiana"), .init(code: "ME", name: "Maine"),
        .init(code: "MD", name: "Maryland"), .init(code: "MA", name: "Massachusetts"),
        .init(code: "MI", name: "Michigan"), .init(code: "MN", name: "Minnesota"),
        .init(code: "MS", name: "Mississippi"), .init(code: "MO", name: "Missouri"),
        .init(code: "MT", name: "Montana"), .init(code: "NE", name: "Nebraska"),
        .init(code: "NV", name: "Nevada"), .init(code: "NH", name: "New Hampshire"),
        .init(code: "NJ", name: "New Jersey"), .init(code: "NM", name: "New Mexico"),
        .init(code: "NY", name: "New York"), .init(code: "NC", name: "North Carolina"),
        .init(code: "ND", name: "North Dakota"), .init(code: "OH", name: "Ohio"),
        .init(code: "OK", name: "Oklahoma"), .init(code: "OR", name: "Oregon"),
        .init(code: "PA", name: "Pennsylvania"), .init(code: "RI", name: "Rhode Island"),
        .init(code: "SC", name: "South Carolina"), .init(code: "SD", name: "South Dakota"),
        .init(code: "TN", name: "Tennessee"), .init(code: "TX", name: "Texas"),
        .init(code: "UT", name: "Utah"), .init(code: "VT", name: "Vermont"),
        .init(code: "VA", name: "Virginia"), .init(code: "WA", name: "Washington"),
        .init(code: "WV", name: "West Virginia"), .init(code: "WI", name: "Wisconsin"),
        .init(code: "WY", name: "Wyoming")
    ]
}
