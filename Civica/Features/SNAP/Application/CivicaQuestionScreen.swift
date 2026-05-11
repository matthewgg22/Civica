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
struct CivicaQuestionScreenProgress: Equatable {
    let current: Int
    let total: Int
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
    let affordance: () -> Affordance

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
        self.affordance = affordance
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    if let progress {
                        progressChip(progress)
                    }
                    Text(title)
                        .font(CivicaTypography.cardHero)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)

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
    }

    private func progressChip(_ p: Progress) -> some View {
        Text(CivicaQuestionStrings.progressLabel(current: p.current, total: p.total, language: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
            .accessibilityLabel(CivicaQuestionStrings.progressAccessibilityLabel(current: p.current, total: p.total, language: language))
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
                            .foregroundStyle(selection == option ? CivicaColors.brickPrimary : CivicaColors.graphite)
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
                                selection == option ? CivicaColors.brickPrimary : CivicaColors.hairline,
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
                        .fill(isSelected ? CivicaColors.brickPrimary : CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(
                            isSelected ? CivicaColors.brickPrimary : CivicaColors.hairline,
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
