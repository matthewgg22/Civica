import SwiftUI
import CivicaDesignSystem

// EXPERIMENTAL SILOED MODULE: persona picker for the practice interview.
//
// The picker sits between InterviewCoachEntryView's "Start a practice
// session" affordance and PracticeSessionView. It surfaces the two
// SessionContext knobs that were previously hardcoded to defaults:
//
//   • CaseworkerArchetype.persona — the interviewer's style
//   • ApplicantArchetype.archetype — the applicant scenario being practiced
//
// The picker enumerates every enum case (so the surface signals what's
// coming, not just what's wired today). CaseworkerArchetype.isImplemented
// drives a "Preview" pill; selecting a preview persona is still allowed
// and the backend gracefully falls back to the friendlyRushed prompt
// until the rest land — keeping demo lift high while we backfill.
//
// State machine: the user must pick BOTH a caseworker and an applicant
// before "Start" enables. "Skip" always works and pushes
// PracticeSessionView with SessionContext.defaultCA.
//
// Bilingual UI chrome via InterviewCoachStrings + the existing
// localizedLabel(in:) extensions on the archetype enums. No new
// translations live outside the strings file.
struct PersonaPickerView: View {
    let recertId: String

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    @State private var selectedCaseworker: CaseworkerArchetype?
    @State private var selectedApplicant: ApplicantArchetype?
    @State private var navigateWithContext: PracticeSessionViewModel.SessionContext?

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var canStart: Bool {
        selectedCaseworker != nil && selectedApplicant != nil
    }

    // Resolved context the user is about to launch with. Falls back to
    // defaultCA when both selections are present (defensive — `canStart`
    // already gates this, but it lets us keep the function pure).
    private var resolvedContext: PracticeSessionViewModel.SessionContext {
        let base = PracticeSessionViewModel.SessionContext.defaultCA
        return PracticeSessionViewModel.SessionContext(
            stateCode: base.stateCode,
            stateName: base.stateName,
            scenario: base.scenario,
            archetype: selectedApplicant ?? base.archetype,
            persona: selectedCaseworker ?? base.persona
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header

                section(title: InterviewCoachStrings.pickerCaseworkerSection.value(in: language)) {
                    LazyVGrid(columns: gridColumns, spacing: CivicaSpacing.sm) {
                        ForEach(CaseworkerArchetype.allCases) { persona in
                            caseworkerCard(persona)
                        }
                    }
                }

                section(title: InterviewCoachStrings.pickerApplicantSection.value(in: language)) {
                    LazyVGrid(columns: gridColumns, spacing: CivicaSpacing.sm) {
                        ForEach(ApplicantArchetype.allCases) { archetype in
                            applicantCard(archetype)
                        }
                    }
                }

                startCTA
                skipCTA

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(InterviewCoachStrings.navPracticeSession.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $navigateWithContext) { context in
            PracticeSessionView(
                recertId: recertId,
                context: context,
                auth: enrollmentAuth
            )
        }
    }

    // MARK: - Layout building blocks

    private var gridColumns: [GridItem] {
        [
            GridItem(.flexible(), spacing: CivicaSpacing.sm),
            GridItem(.flexible(), spacing: CivicaSpacing.sm)
        ]
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(InterviewCoachStrings.pickerTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
            Text(InterviewCoachStrings.pickerSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    private func section<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(title)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            content()
        }
    }

    // MARK: - Cards

    private func caseworkerCard(_ persona: CaseworkerArchetype) -> some View {
        let isSelected = selectedCaseworker == persona
        return Button {
            selectedCaseworker = persona
        } label: {
            personaCardBody(
                icon: icon(for: persona),
                title: persona.localizedLabel(in: language),
                description: description(for: persona).value(in: language),
                showPreviewBadge: !persona.isImplemented,
                isSelected: isSelected
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(persona.localizedLabel(in: language)))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func applicantCard(_ archetype: ApplicantArchetype) -> some View {
        let isSelected = selectedApplicant == archetype
        return Button {
            selectedApplicant = archetype
        } label: {
            personaCardBody(
                icon: icon(for: archetype),
                title: archetype.localizedLabel(in: language),
                description: description(for: archetype).value(in: language),
                showPreviewBadge: false,
                isSelected: isSelected
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(archetype.localizedLabel(in: language)))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func personaCardBody(
        icon: String,
        title: String,
        description: String,
        showPreviewBadge: Bool,
        isSelected: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(alignment: .top, spacing: CivicaSpacing.xs) {
                Image(systemName: icon)
                    .font(.title2)
                    // §2.2: selection glyph uses ink (matches CivicaQuestionChoices); pine reserved for CTAs.
                    .foregroundStyle(CivicaColors.ink)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
                if showPreviewBadge {
                    Text(InterviewCoachStrings.pickerPreviewBadge.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.amberPrimary)
                        .padding(.horizontal, CivicaSpacing.xs)
                        .padding(.vertical, 2)
                        .background(
                            Capsule().fill(CivicaColors.amberSurface)
                        )
                }
            }
            Text(title)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
                .multilineTextAlignment(.leading)
            Text(description)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                // §2.2: selection fill uses surfaceSecondary, not a pine tint
                // (pine = CTAs only; matches CivicaQuestionChoices).
                .fill(isSelected
                      ? CivicaColors.surfaceSecondary
                      : CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                // §2.2: selection border uses ink, not pine.
                .stroke(isSelected ? CivicaColors.ink : CivicaColors.hairline,
                        lineWidth: isSelected ? 2 : 1)
        )
        .contentShape(Rectangle())
    }

    // MARK: - CTAs

    private var startCTA: some View {
        Button {
            navigateWithContext = resolvedContext
        } label: {
            Text(InterviewCoachStrings.pickerStartCTA.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, CivicaSpacing.md)
                .background(
                    Capsule().fill(
                        canStart ? CivicaColors.pinePrimary : CivicaColors.pinePrimary.opacity(0.35)
                    )
                )
        }
        .buttonStyle(.plain)
        .disabled(!canStart)
        .accessibilityHint(Text(canStart
                                ? ""
                                : (language == .spanish
                                   ? "Elige un estilo y un escenario primero."
                                   : "Pick a caseworker style and applicant scenario first.")))
    }

    private var skipCTA: some View {
        Button {
            navigateWithContext = .defaultCA
        } label: {
            Text(InterviewCoachStrings.pickerSkipCTA.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Icons + descriptions
    //
    // Icon and description mapping live in the view (not the domain
    // model) — they're presentation concerns and don't belong on the
    // enum. Static maps so adding a new archetype in the enum surfaces
    // a compile error here via the exhaustive switches.

    private func icon(for persona: CaseworkerArchetype) -> String {
        switch persona {
        case .friendlyRushed:      return "person.crop.circle.badge.clock"
        case .formal:              return "doc.text.fill"
        case .skeptical:           return "magnifyingglass.circle"
        case .languageMismatched:  return "globe"
        case .adversarial:         return "exclamationmark.shield"
        }
    }

    private func description(for persona: CaseworkerArchetype) -> CivicaText {
        switch persona {
        case .friendlyRushed:      return InterviewCoachStrings.caseworkerDescFriendlyRushed
        case .formal:              return InterviewCoachStrings.caseworkerDescFormal
        case .skeptical:           return InterviewCoachStrings.caseworkerDescSkeptical
        case .languageMismatched:  return InterviewCoachStrings.caseworkerDescLanguageMismatched
        case .adversarial:         return InterviewCoachStrings.caseworkerDescAdversarial
        }
    }

    private func icon(for archetype: ApplicantArchetype) -> String {
        switch archetype {
        case .student:     return "graduationcap"
        case .gigWorker:   return "car.front.waves.up"
        case .mixedStatus: return "person.3"
        case .unhoused:    return "house.slash"
        case .senior:      return "figure.walk.motion"
        }
    }

    private func description(for archetype: ApplicantArchetype) -> CivicaText {
        switch archetype {
        case .student:     return InterviewCoachStrings.applicantDescStudent
        case .gigWorker:   return InterviewCoachStrings.applicantDescGigWorker
        case .mixedStatus: return InterviewCoachStrings.applicantDescMixedStatus
        case .unhoused:    return InterviewCoachStrings.applicantDescUnhoused
        case .senior:      return InterviewCoachStrings.applicantDescSenior
        }
    }
}

// MARK: - Hashable conformance for navigationDestination(item:)
//
// `SessionContext` is a value type but doesn't conform to Hashable —
// adding it here scoped to this file keeps the surface area minimal
// (no public API change to PracticeSessionViewModel) while letting us
// use NavigationStack's value-driven push API.
extension PracticeSessionViewModel.SessionContext: Hashable {
    public static func == (
        lhs: PracticeSessionViewModel.SessionContext,
        rhs: PracticeSessionViewModel.SessionContext
    ) -> Bool {
        lhs.stateCode == rhs.stateCode &&
        lhs.stateName == rhs.stateName &&
        lhs.scenario == rhs.scenario &&
        lhs.archetype == rhs.archetype &&
        lhs.persona == rhs.persona
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(stateCode)
        hasher.combine(stateName)
        hasher.combine(scenario)
        hasher.combine(archetype)
        hasher.combine(persona)
    }
}
