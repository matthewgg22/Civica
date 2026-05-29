import CivicaDesignSystem
import SwiftUI

// HANDOFF "single question, big breathing room" cadence. Replaces the
// multi-field step cards that pack 4–6 inputs onto one screen. The
// brief is explicit: applying for benefits is already cognitively
// expensive — give each question its own surface, its own pace, and
// a primary action that says exactly one thing.
//
// Visual cadence (top → bottom):
//   • Small progress chip ("3 of 8") — graphite caption, optional
//   • Question title — cardHero, semibold, 1–2 lines max
//   • Helper paragraph — body, graphite, optional
//   • Affordance — caller provides via @ViewBuilder. Common affordances
//     are exposed as CivicaQuestionChoices / CivicaQuestionYesNo /
//     CivicaQuestionNumberInput / CivicaQuestionFreeText
//   • Continue CTA — sticky at the bottom, brick fill
//   • Optional "I'm not sure" / "Skip" — subhead text link, graphite
//
// Lives in Civica/ today; promote to CivicaDesignSystem once it
// stabilizes and VoteNow needs the same primitive.

/// Hoisted out of `CivicaQuestionScreen` so the type is a single
/// concrete struct across all generic instantiations of the screen.
/// Otherwise `CivicaQuestionScreenProgress` and
/// `CivicaQuestionScreen<CivicaQuestionChoices>.Progress` are
/// distinct types in Swift's type system, and helper functions
/// that return one can't be passed to the other.
///
/// `current` / `total` track position within the active section
/// (e.g. "2 of 4" inside Income). The optional `sectionIndex` /
/// `sectionCount` / `sectionTitle` add section-level context so
/// the screen can render an overall progress bar across the whole
/// application instead of leaving the user wondering "is this the
/// last 4-of-4 or is there more after?". Callers that don't supply
/// section info get the legacy chip-only behavior.
struct CivicaQuestionScreenProgress: Equatable {
    let current: Int
    let total: Int
    let sectionIndex: Int?
    let sectionCount: Int?
    let sectionTitle: String?

    init(
        current: Int,
        total: Int,
        sectionIndex: Int? = nil,
        sectionCount: Int? = nil,
        sectionTitle: String? = nil
    ) {
        self.current = current
        self.total = total
        self.sectionIndex = sectionIndex
        self.sectionCount = sectionCount
        self.sectionTitle = sectionTitle
    }

    /// Overall completion across the full application as a fraction
    /// in 0...1. Returns nil when section metadata isn't supplied
    /// so callers can suppress the bar entirely. Each section is
    /// weighted equally; within the current section the fraction
    /// reflects `(current - 1) / total` (i.e. the bar advances when
    /// the user answers, not when they land on the question).
    var overallFraction: Double? {
        guard let sectionIndex, let sectionCount, sectionCount > 0 else {
            return nil
        }
        let perSection = 1.0 / Double(sectionCount)
        let completedSections = Double(sectionIndex - 1) * perSection
        let intoCurrent = total > 0
            ? perSection * (Double(max(0, current - 1)) / Double(total))
            : 0
        return min(1.0, max(0.0, completedSections + intoCurrent))
    }
}

struct CivicaQuestionScreen<Affordance: View>: View {
    typealias Progress = CivicaQuestionScreenProgress

    let progress: Progress?
    let title: String
    let helper: String?
    let primaryActionTitle: String
    let primaryActionEnabled: Bool
    let onPrimary: () -> Void
    let secondaryActionTitle: String?
    let onSecondary: (() -> Void)?
    let language: CivicaLanguage
    /// Universal contextual-help hook. The marker (`questionmark.circle`)
    /// renders next to every question title; tapping it invokes this
    /// closure with `(title, language)`. The component does NOT present
    /// the explainer sheet itself — the caller wires that up. Default
    /// `nil` keeps every existing caller compiling without changes; when
    /// nil the marker still renders (universal coverage is the visible
    /// product thesis per the v1 design doc) but tapping it is a no-op.
    /// See design doc D5 + T5 + T10 of
    /// `matthewgreer-gentis-claude-dashboard-state-coverage-design-20260529-135546.md`.
    let onHelpRequested: ((String, CivicaLanguage) -> Void)?
    let affordance: () -> Affordance

    /// Drives the overall-progress bar fill + the percent counter.
    /// Initialized to the "previous step's" fraction (one notional
    /// step behind the target) so when the screen appears it has
    /// somewhere to animate FROM. .onAppear bumps it to the target
    /// inside withAnimation; SwiftUI handles the interpolation.
    ///
    /// Each question screen is a new view instance (navigation push
    /// or switch-builder branch swap), so an .animation(value:)
    /// modifier on the bar by itself would never fire — there's no
    /// "previous render" to animate from. This @State + .onAppear
    /// pattern is what gives the bar continuous-feeling fill across
    /// screen pushes.
    @State private var displayedFraction: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        progress: Progress? = nil,
        title: String,
        helper: String? = nil,
        primaryActionTitle: String,
        primaryActionEnabled: Bool = true,
        onPrimary: @escaping () -> Void,
        secondaryActionTitle: String? = nil,
        onSecondary: (() -> Void)? = nil,
        language: CivicaLanguage = .english,
        onHelpRequested: ((String, CivicaLanguage) -> Void)? = nil,
        @ViewBuilder affordance: @escaping () -> Affordance
    ) {
        self.progress = progress
        self.title = title
        self.helper = helper
        self.primaryActionTitle = primaryActionTitle
        self.primaryActionEnabled = primaryActionEnabled
        self.onPrimary = onPrimary
        self.secondaryActionTitle = secondaryActionTitle
        self.onSecondary = onSecondary
        self.language = language
        self.onHelpRequested = onHelpRequested
        self.affordance = affordance
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let progress, progress.overallFraction != nil {
                overallProgressBar(progress)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    if let progress {
                        progressChip(progress)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Text(title)
                            .font(CivicaTypography.cardHero)
                            .foregroundStyle(CivicaColors.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        helpMarker
                    }

                    if let helper, !helper.isEmpty {
                        Text(helper)
                            .font(CivicaTypography.body)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    affordance()
                }
                .padding(CivicaSpacing.xl)
            }

            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .onAppear {
            // Initialize the bar at "one step ago" then spring up to
            // the target fraction. The 0.05s delay lets the screen
            // settle into its layout pass before the animation kicks
            // in — otherwise the spring sometimes fires during the
            // initial render and the user misses the motion.
            let target = progress?.overallFraction ?? 0
            displayedFraction = previousStepFraction(target: target)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                withAnimation(reduceMotion ? nil : .spring(response: 0.7, dampingFraction: 0.82)) {
                    displayedFraction = target
                }
            }
        }
    }

    /// Returns a fraction one notional question-step behind the
    /// target — that is, the bar position the user was at on the
    /// previous screen. Used as the starting value for the
    /// fill-on-appear animation. Falls back to `target` itself
    /// when section metadata isn't supplied (no animation possible).
    private func previousStepFraction(target: Double) -> Double {
        guard target > 0,
              let p = progress,
              let sectionCount = p.sectionCount,
              sectionCount > 0,
              p.total > 0
        else { return target }
        let perSection = 1.0 / Double(sectionCount)
        let perStep = perSection / Double(p.total)
        return max(0, target - perStep)
    }

    /// Thin overall-progress bar pinned to the top of the screen. Only
    /// renders when section metadata is supplied; otherwise the layout
    /// reverts to the legacy chip-only behavior so standalone /
    /// preview callers don't pick up an inaccurate "0% complete" bar.
    ///
    /// Animation policy: the bar fill, the percent count, and the
    /// section label all animate with a single shared spring keyed on
    /// `overallFraction`. The spring is gentle (response 0.55, damping
    /// 0.85) so the bar feels like it's flowing forward rather than
    /// snapping — important per the brand voice doc's "calm landing,
    /// not a celebration" rule. NumericTextContentTransition turns
    /// the percent number into a rolling counter instead of a hard
    /// substitution.
    @ViewBuilder
    private func overallProgressBar(_ p: Progress) -> some View {
        if p.overallFraction != nil {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                // Bound to `displayedFraction` (not the raw target)
                // so the on-appear spring drives the fill from the
                // previous-step value up to the current target.
                // Spring is gentle (response 0.7, damping 0.82) so
                // the user sees the bar moving rather than snapping.
                ProgressView(value: displayedFraction)
                    .progressViewStyle(.linear)
                    .tint(CivicaColors.pinePrimary)
                    .accessibilityLabel(
                        CivicaQuestionStrings.overallProgressAccessibilityLabel(
                            fraction: p.overallFraction ?? 0,
                            sectionIndex: p.sectionIndex ?? 0,
                            sectionCount: p.sectionCount ?? 0,
                            language: language
                        )
                    )
                if let sectionIndex = p.sectionIndex, let sectionCount = p.sectionCount {
                    HStack(spacing: CivicaSpacing.xs) {
                        // Section label crossfades across section
                        // boundaries (id changes on sectionIndex /
                        // title). Within a section the id stays
                        // constant so the label is rock-steady
                        // while the bar fills.
                        Text(CivicaQuestionStrings.sectionLabel(
                            index: sectionIndex,
                            count: sectionCount,
                            title: p.sectionTitle,
                            language: language
                        ))
                            .font(CivicaTypography.captionStrong)
                            .foregroundStyle(CivicaColors.graphite)
                            .textCase(.uppercase)
                            .kerning(1.0)
                            .id("section-label-\(sectionIndex)-\(p.sectionTitle ?? "")")
                            .transition(.opacity.combined(with: .move(edge: .leading)))
                        Spacer(minLength: 0)
                        // Percent counts up alongside the bar fill.
                        // `.contentTransition(.numericText())` gives
                        // each integer tick a rolling-digit crossfade
                        // as the spring drives the displayed fraction
                        // upward.
                        Text(CivicaQuestionStrings.percentLabel(
                            fraction: displayedFraction,
                            language: language
                        ))
                            .font(CivicaTypography.captionStrong.monospacedDigit())
                            .foregroundStyle(CivicaColors.graphite)
                            .contentTransition(.numericText())
                    }
                }
            }
            .padding(.horizontal, CivicaSpacing.xl)
            .padding(.top, CivicaSpacing.md)
            .padding(.bottom, CivicaSpacing.sm)
            .background(CivicaColors.paper)
        }
    }

    private func progressChip(_ p: Progress) -> some View {
        // The in-section "3 OF 4" chip rolls its digit via numeric-
        // text content transition when the same screen re-renders
        // with a new step (within-section progression). Across
        // screen pushes the chip is a new view and the transition
        // doesn't apply — the bar fill handles continuity then.
        Text(CivicaQuestionStrings.progressLabel(current: p.current, total: p.total, language: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
            .contentTransition(.numericText())
            .animation(reduceMotion ? nil : .easeOut(duration: 0.35), value: p.current)
            .accessibilityLabel(CivicaQuestionStrings.progressAccessibilityLabel(current: p.current, total: p.total, language: language))
    }

    /// Universal contextual-help marker rendered next to every question
    /// title. Visual: `questionmark.circle` in `CivicaColors.pinePrimary`.
    /// Tapping calls `onHelpRequested?(title, language)` — the component
    /// does not own the explainer sheet. 32pt minimum tap target meets
    /// HIG; accessibility label is locale-aware ("Help with this question"
    /// in EN, "Ayuda con esta pregunta" in ES).
    ///
    /// The marker ALWAYS renders, even when `onHelpRequested` is nil, so
    /// the marker is a visible promise of help across all 17+ pages of
    /// the SNAP application. Callers wire the closure to present the
    /// `SNAPApplicationContextualHelpSheet` separately.
    private var helpMarker: some View {
        Button {
            onHelpRequested?(title, language)
        } label: {
            Image(systemName: "questionmark.circle")
                .font(.system(size: 22))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(minWidth: 32, minHeight: 32)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(helpMarkerAccessibilityLabel)
    }

    /// Locale-aware accessibility label for the marker. Kept inline so
    /// CivicaQuestionScreen.swift remains the sole edit surface — once
    /// the v1.1 IntakeHelpStrings ships, callers can override at the
    /// sheet level without re-touching this file.
    private var helpMarkerAccessibilityLabel: String {
        switch language {
        case .english: return "Help with this question"
        case .spanish: return "Ayuda con esta pregunta"
        }
    }

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                primaryActionTitle,
                isEnabled: primaryActionEnabled,
                action: onPrimary
            )
            if let secondaryActionTitle, let onSecondary {
                CivicaSecondaryButton(title: secondaryActionTitle, action: onSecondary)
            }
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

// MARK: - Common affordances

/// Vertical stack of mutually-exclusive choice rows. Each row is the
/// full HANDOFF hit target (56pt) with a leading checkmark when
/// selected. Pass `nil` for selection to start unselected.
struct CivicaQuestionChoices: View {
    let options: [String]
    @Binding var selection: String?

    var body: some View {
        VStack(spacing: CivicaSpacing.sm) {
            ForEach(options, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    HStack(spacing: CivicaSpacing.md) {
                        Image(systemName: selection == option ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(selection == option ? CivicaColors.pinePrimary : CivicaColors.graphite)
                            .font(.system(size: 22))
                            .accessibilityHidden(true)
                        Text(option)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, CivicaSpacing.lg)
                    .padding(.vertical, CivicaSpacing.md)
                    .frame(minHeight: 56)
                    .background(CivicaColors.surfacePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(
                                selection == option ? CivicaColors.pinePrimary : CivicaColors.hairline,
                                lineWidth: selection == option ? 2 : 1
                            )
                    )
                }
                .accessibilityLabel(option)
                .accessibilityAddTraits(selection == option ? [.isButton, .isSelected] : .isButton)
            }
        }
    }
}

/// Side-by-side Yes / No pair. Use only when a third option ("I'm not
/// sure") is genuinely not meaningful — most SNAP questions have a
/// real "not sure" branch, in which case use CivicaQuestionChoices
/// with three options instead.
struct CivicaQuestionYesNo: View {
    @Binding var selection: Bool?
    let yesLabel: String
    let noLabel: String

    var body: some View {
        HStack(spacing: CivicaSpacing.md) {
            yesNoButton(yesLabel, isSelected: selection == true) {
                selection = true
            }
            yesNoButton(noLabel, isSelected: selection == false) {
                selection = false
            }
        }
    }

    private func yesNoButton(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(isSelected ? CivicaColors.onPrimaryText : CivicaColors.ink)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(isSelected ? CivicaColors.pinePrimary : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(
                            isSelected ? CivicaColors.pinePrimary : CivicaColors.hairline,
                            lineWidth: isSelected ? 2 : 1
                        )
                )
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Single numeric input. Use `.dollars` for money (prefixes "$" via
/// the placeholder; rendering as a number; backend parses).
struct CivicaQuestionNumberInput: View {
    enum Kind { case integer, dollars }

    @Binding var value: String
    let kind: Kind
    let placeholder: String

    var body: some View {
        HStack(spacing: CivicaSpacing.sm) {
            if kind == .dollars {
                Text("$")
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.graphite)
            }
            TextField(placeholder, text: $value)
                .font(CivicaTypography.cardTitle.monospacedDigit())
                .keyboardType(kind == .dollars ? .decimalPad : .numberPad)
                .foregroundStyle(CivicaColors.ink)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
        .frame(minHeight: 56)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }
}

/// Multi-line free-text input. Capped at `maxLines` visible rows
/// before scrolling; never auto-grows beyond that to keep the
/// continue button in thumb reach.
struct CivicaQuestionFreeText: View {
    @Binding var text: String
    let placeholder: String
    var maxLines: Int = 4

    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.ink)
            .lineLimit(1...maxLines)
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 56, alignment: .topLeading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
    }
}

#if DEBUG
struct CivicaQuestionScreen_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Choices
            StatefulPreviewWrapper("") { binding in
                CivicaQuestionScreen(
                    progress: .init(current: 1, total: 3),
                    title: "How many people live in your household?",
                    helper: "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
                    primaryActionTitle: "Continue",
                    primaryActionEnabled: !binding.wrappedValue.isEmpty,
                    onPrimary: {},
                    secondaryActionTitle: "I'm not sure",
                    onSecondary: {}
                ) {
                    CivicaQuestionChoices(
                        options: ["Just me", "2 people", "3 people", "4 or more"],
                        selection: Binding(
                            get: { binding.wrappedValue.isEmpty ? nil : binding.wrappedValue },
                            set: { binding.wrappedValue = $0 ?? "" }
                        )
                    )
                }
            }
            .previewDisplayName("Choices")

            // Yes / no
            StatefulPreviewWrapper(Bool?.none) { binding in
                CivicaQuestionScreen(
                    progress: .init(current: 2, total: 3),
                    title: "Is anyone in your household 60 or older, or living with a disability?",
                    helper: "This matters for SNAP — older adults and people with disabilities get extra deductions.",
                    primaryActionTitle: "Continue",
                    primaryActionEnabled: binding.wrappedValue != nil,
                    onPrimary: {}
                ) {
                    CivicaQuestionYesNo(
                        selection: binding,
                        yesLabel: "Yes",
                        noLabel: "No"
                    )
                }
            }
            .previewDisplayName("Yes / no")
        }
    }
}

// Lightweight stateful wrapper for previews — SwiftUI previews can't
// directly host @State, so wrap bindings here. Stays in the file so
// downstream previews stay self-contained.
private struct StatefulPreviewWrapper<Value, Content: View>: View {
    @State private var value: Value
    let content: (Binding<Value>) -> Content

    init(_ initial: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        self._value = State(initialValue: initial)
        self.content = content
    }

    var body: some View {
        content($value)
    }
}
#endif
