import CivicaDesignSystem
import SwiftUI

// Hero card at the top of the RecertCompanion dashboard.
//
// Design review D3 (IA Pass 1): the dashboard previously buried the
// "what state am I in?" signal under the date card and notification
// permission view. This card answers two questions on first glance:
//
//   1. How long until my recert?    (or: is it overdue / unscheduled?)
//   2. How many things do I need to do?
//
// And provides a single context-aware CTA so the user always has one
// obvious next step.

struct StatusSummaryCard: View {

    /// Days until the next recert. Nil when no recert date is set.
    /// Negative when the recert is overdue.
    let daysUntilRecert: Int?

    /// Count of upcoming actions on the ExpirationCalendar — typically
    /// `forecast.documentsNeedingReplacement`.
    let actionsNeeded: Int

    /// Localization driver. Passed in so this view stays a pure
    /// function of inputs (no env reads — easier to preview + test).
    let language: CivicaLanguage

    /// Tap on the primary CTA. The parent decides where to route based
    /// on the same logic that picks the CTA label.
    let onPrimaryAction: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(heroLine)
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(heroColor)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            Text(actionsLine)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: onPrimaryAction) {
                Text(ctaLabel)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.paper)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.brickPrimary)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(ctaLabel)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    // MARK: - Computed copy

    var heroLine: String {
        guard let days = daysUntilRecert else {
            return RecertCompanionStrings.statusUnscheduled.value(in: language)
        }
        if days < 0 {
            let overdue = -days
            if overdue == 1 {
                return RecertCompanionStrings.statusOneDayOverdue.value(in: language)
            }
            return String(
                format: RecertCompanionStrings.statusOverdueDays.value(in: language),
                overdue
            )
        }
        if days == 0 {
            return RecertCompanionStrings.statusToday.value(in: language)
        }
        if days == 1 {
            return RecertCompanionStrings.statusInOneDay.value(in: language)
        }
        return String(
            format: RecertCompanionStrings.statusInDays.value(in: language),
            days
        )
    }

    var actionsLine: String {
        if actionsNeeded <= 0 {
            return RecertCompanionStrings.statusNoActions.value(in: language)
        }
        if actionsNeeded == 1 {
            return RecertCompanionStrings.statusOneActionNeeded.value(in: language)
        }
        return String(
            format: RecertCompanionStrings.statusActionsNeeded.value(in: language),
            actionsNeeded
        )
    }

    /// CTA picked by the same state-machine that the parent uses to
    /// route the tap. Kept here so the label and the routing stay
    /// trivially in sync.
    var ctaLabel: String {
        switch primaryActionKind {
        case .contactNavigator:
            return RecertCompanionStrings.statusCTAContactNavigator.value(in: language)
        case .startPhantom:
            return RecertCompanionStrings.statusCTAStartPhantom.value(in: language)
        case .viewCalendar:
            return RecertCompanionStrings.statusCTAViewCalendar.value(in: language)
        }
    }

    /// Hero text leans amber when overdue, ink otherwise. We don't
    /// recolor the whole card — that's the overdue banner's job above
    /// the body. The hero shift is enough to register here.
    private var heroColor: Color {
        if let days = daysUntilRecert, days < 0 {
            return CivicaColors.warningAmber
        }
        return CivicaColors.ink
    }

    enum PrimaryActionKind {
        case contactNavigator
        case startPhantom
        case viewCalendar
    }

    var primaryActionKind: PrimaryActionKind {
        guard let days = daysUntilRecert else {
            // No date yet — push them toward the calendar, which will
            // render the no-date placeholder. (We don't want the
            // "start phantom" CTA on an unscheduled recert.)
            return .viewCalendar
        }
        if days < 0 { return .contactNavigator }
        if days <= RecertCompanionRoot.phantomEligibleWindowDays { return .startPhantom }
        return .viewCalendar
    }
}

#if DEBUG
#Preview("Default — 30 days, 2 actions") {
    StatusSummaryCard(
        daysUntilRecert: 30,
        actionsNeeded: 2,
        language: .english,
        onPrimaryAction: {}
    )
    .padding()
    .background(CivicaColors.paper)
}

#Preview("Overdue") {
    StatusSummaryCard(
        daysUntilRecert: -5,
        actionsNeeded: 1,
        language: .english,
        onPrimaryAction: {}
    )
    .padding()
    .background(CivicaColors.paper)
}

#Preview("Unscheduled") {
    StatusSummaryCard(
        daysUntilRecert: nil,
        actionsNeeded: 0,
        language: .english,
        onPrimaryAction: {}
    )
    .padding()
    .background(CivicaColors.paper)
}

#Preview("xxxLarge") {
    StatusSummaryCard(
        daysUntilRecert: 30,
        actionsNeeded: 2,
        language: .english,
        onPrimaryAction: {}
    )
    .dynamicTypeSize(.xxxLarge)
    .padding()
    .background(CivicaColors.paper)
}
#endif
