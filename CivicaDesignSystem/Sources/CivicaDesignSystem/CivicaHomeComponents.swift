import SwiftUI

// Shared building blocks for the three-phase main screen (Enroll /
// Pending / Enrolled). Each phase view assembles its own composition
// from these pieces; the components themselves are status-agnostic.
//
// Codified during the May 2026 plan-design-review three-phase rewrite
// of CivicaEntryView, SNAPWaitingRoomView, and SNAPDecisionApprovedView.

// MARK: - CivicaPhase

/// Three lifecycle states the main screen renders.
///
/// Enroll covers `.notStarted` plus the active-case pre-submission
/// states (`.screenerInProgress` through `.packetGenerated`).
/// Pending covers `.submittedToState` through `.interviewCompleted`.
/// Enrolled covers `.decisionApproved`. Denial and recert keep their
/// own dedicated flows outside this enum.
public enum CivicaPhase: String, CaseIterable, Sendable {
    case enroll
    case pending
    case enrolled
}

// MARK: - CivicaPhaseTab

/// Pinned three-segment journey indicator. Two modes:
///
///   • `.lockedJourney(current:)` — production mode. Shows where
///     the user is in their CalFresh journey: past phases get a
///     small checkmark, current phase is highlighted in a pine
///     pill, future phases get a lock glyph and are visibly
///     disabled. No tap handler — the tab is a status indicator,
///     not navigation. Past phases stay non-tappable until per-
///     phase "history" surfaces exist; landing there with no
///     content would be worse than not landing there at all.
///
///   • `.freeToggle(current:onChange:)` — DEBUG mode. All three
///     segments interactive, the handler swaps the rendered
///     phase without mutating SNAPApplicationStatusStore. Used by
///     engineers and QA to flip phases at runtime without
///     scrubbing status state.
///
/// Resolved during the May 2026 plan-design-review C2 follow-up.
/// The "free toggle in production" alternative was rejected — real
/// users tapping into a phase they haven't earned would land on
/// empty or inconsistent surfaces (Phase 3 with no EBT account,
/// Phase 2 with no submission timestamp). That degrades the UX
/// more than no tab at all.
public struct CivicaPhaseTab: View {
    public enum Mode {
        case lockedJourney(current: CivicaPhase)
        case freeToggle(current: CivicaPhase, onChange: (CivicaPhase) -> Void)
    }

    let mode: Mode

    public init(mode: Mode) {
        self.mode = mode
    }

    /// Free-toggle convenience init (preserves the v1.0 call site
    /// signature so the DEBUG-gated tab in each Phase view doesn't
    /// need an update).
    public init(current: CivicaPhase, onChange: @escaping (CivicaPhase) -> Void) {
        self.mode = .freeToggle(current: current, onChange: onChange)
    }

    /// Locked-journey convenience init.
    public init(lockedJourneyAt current: CivicaPhase) {
        self.mode = .lockedJourney(current: current)
    }

    public var body: some View {
        HStack(spacing: 3) {
            ForEach(CivicaPhase.allCases, id: \.self) { phase in
                segmentButton(phase)
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(CivicaColors.ink.opacity(0.05))
        )
    }

    private var current: CivicaPhase {
        switch mode {
        case .lockedJourney(let c):  return c
        case .freeToggle(let c, _):  return c
        }
    }

    private func phaseState(_ phase: CivicaPhase) -> PhaseSegmentState {
        let order: [CivicaPhase] = [.enroll, .pending, .enrolled]
        guard let segIdx = order.firstIndex(of: phase),
              let currIdx = order.firstIndex(of: current) else { return .future }
        if segIdx < currIdx { return .past }
        if segIdx == currIdx { return .current }
        return .future
    }

    private enum PhaseSegmentState { case past, current, future }

    @ViewBuilder
    private func segmentButton(_ phase: CivicaPhase) -> some View {
        switch mode {
        case .freeToggle(_, let onChange):
            freeToggleSegment(phase: phase, onChange: onChange)
        case .lockedJourney:
            lockedSegment(phase: phase)
        }
    }

    /// Free-toggle button: every segment tappable, current shown in a
    /// white pill with pine text + soft shadow.
    private func freeToggleSegment(
        phase: CivicaPhase,
        onChange: @escaping (CivicaPhase) -> Void
    ) -> some View {
        let active = (phase == current)
        return Button {
            onChange(phase)
        } label: {
            Text(label(for: phase))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(active ? CivicaColors.pinePrimary : CivicaColors.graphite)
                .frame(maxWidth: .infinity, minHeight: 28)
                .padding(.horizontal, CivicaSpacing.sm)
        }
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(active ? CivicaColors.surfacePrimary : Color.clear)
                .shadow(
                    color: active ? CivicaColors.ink.opacity(0.10) : .clear,
                    radius: 2, x: 0, y: 1
                )
        )
        .buttonStyle(.plain)
        .accessibilityLabel("\(label(for: phase)) phase")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    /// Locked-journey segment: past = ✓ + pine text, current = pine
    /// pill, future = lock glyph + muted text. None are tappable.
    @ViewBuilder
    private func lockedSegment(phase: CivicaPhase) -> some View {
        let state = phaseState(phase)
        HStack(spacing: 4) {
            switch state {
            case .past:
                Image(systemName: "checkmark")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.pinePrimary)
                Text(label(for: phase))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
            case .current:
                Text(label(for: phase))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
            case .future:
                Image(systemName: "lock.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.muted)
                Text(label(for: phase))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.muted)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 28)
        .padding(.horizontal, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(state == .current ? CivicaColors.surfacePrimary : Color.clear)
                .shadow(
                    color: state == .current ? CivicaColors.ink.opacity(0.10) : .clear,
                    radius: 2, x: 0, y: 1
                )
        )
        .accessibilityLabel(accessibilityLabel(for: phase, state: state))
        .accessibilityAddTraits(state == .current ? .isSelected : [])
    }

    private func accessibilityLabel(for phase: CivicaPhase, state: PhaseSegmentState) -> String {
        let name = label(for: phase)
        switch state {
        case .past:    return "\(name) phase, completed"
        case .current: return "\(name) phase, current step"
        case .future:  return "\(name) phase, locked"
        }
    }

    private func label(for phase: CivicaPhase) -> String {
        switch phase {
        case .enroll:   return "Enroll"
        case .pending:  return "Pending"
        case .enrolled: return "Enrolled"
        }
    }
}

// MARK: - CivicaActionRow

/// Conditional county-driven row pattern: documents requested,
/// inbound messages, and similar action prompts. Pine left-border
/// signals "informational + actionable" — distinct from warning
/// surface (process caution) and terracotta surface (urgent
/// neutral). Renders only when state warrants; the no-data state
/// has no row at all.
public struct CivicaActionRow: View {
    let icon: String
    let primary: String
    let secondary: String?
    let action: () -> Void

    public init(
        icon: String,
        primary: String,
        secondary: String? = nil,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.primary = primary
        self.secondary = secondary
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: icon)
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.ink)
                    .frame(width: 22, alignment: .leading)
                    .accessibilityHidden(true)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(primary)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .multilineTextAlignment(.leading)
                    if let secondary {
                        Text(secondary)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                    .padding(.top, 4)
            }
            .padding(.vertical, CivicaSpacing.md)
            .padding(.horizontal, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(CivicaColors.pinePrimary)
                    .frame(width: 3)
            }
            .overlay(
                Rectangle()
                    .stroke(CivicaColors.hairline, lineWidth: 1)
            )
            .clipShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(secondary.map { "\(primary). \($0)" } ?? primary)
    }
}

// MARK: - CivicaPhaseTimeline

/// Four-milestone horizontal timeline used by Phase 2 (Pending).
/// Submitted → In review → Interview → Decision. Matches the
/// vocabulary in the "What happens next" sheet so the visual
/// language is consistent when the sheet opens.
public struct CivicaPhaseTimeline: View {
    public enum Milestone: Int, CaseIterable {
        case submitted, inReview, interview, decision
    }

    let current: Milestone
    let labels: [String]
    let onMilestoneTap: ((Milestone) -> Void)?

    public init(
        current: Milestone,
        labels: [String],
        onMilestoneTap: ((Milestone) -> Void)? = nil
    ) {
        self.current = current
        // Pad / trim to 4 to keep the layout predictable even if a
        // caller passes a wrong-length label set.
        var resolved = labels
        while resolved.count < 4 { resolved.append("") }
        self.labels = Array(resolved.prefix(4))
        self.onMilestoneTap = onMilestoneTap
    }

    public var body: some View {
        VStack(spacing: 8) {
            GeometryReader { proxy in
                ZStack {
                    // base connector
                    Rectangle()
                        .fill(CivicaColors.ink.opacity(0.10))
                        .frame(height: 2)
                    // completed connector — done -> midpoint of current.
                    // Animated so a status advance fills smoothly to
                    // the next milestone instead of snapping.
                    Rectangle()
                        .fill(CivicaColors.pinePrimary)
                        .frame(
                            width: completedWidth(in: proxy.size.width),
                            height: 2
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .animation(.easeInOut(duration: 0.65), value: current)
                    HStack(spacing: 0) {
                        ForEach(Milestone.allCases, id: \.self) { m in
                            dotButton(m)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .frame(height: 26)
            HStack(spacing: 0) {
                ForEach(Array(labels.enumerated()), id: \.offset) { idx, label in
                    let m = Milestone(rawValue: idx)!
                    Text(label)
                        .font(CivicaTypography.caption)
                        .foregroundStyle(state(of: m) == .future ? CivicaColors.muted : CivicaColors.ink)
                        .frame(maxWidth: .infinity, alignment: alignment(forIndex: idx, total: labels.count))
                }
            }
        }
    }

    private enum DotState { case done, current, future }
    private func state(of m: Milestone) -> DotState {
        if m.rawValue < current.rawValue { return .done }
        if m.rawValue == current.rawValue { return .current }
        return .future
    }

    /// Wraps the milestone dot in a tap target so the parent can
    /// open a detail sheet on tap. If `onMilestoneTap` is nil the dot
    /// stays a static view (preserves the original timeline contract).
    @ViewBuilder
    private func dotButton(_ m: Milestone) -> some View {
        if let onMilestoneTap {
            Button { onMilestoneTap(m) } label: {
                milestoneDot(m)
                    // Bigger hit-target than the visual dot so taps on
                    // older / smaller fingers still register.
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(labels[m.rawValue])
            .accessibilityAddTraits(state(of: m) == .current ? [.isButton, .isSelected] : .isButton)
        } else {
            milestoneDot(m)
        }
    }

    @ViewBuilder
    private func milestoneDot(_ m: Milestone) -> some View {
        let s = state(of: m)
        switch s {
        case .done:
            // Reduced visual weight on done — smaller dot, no
            // checkmark — so the current stage stays the focal point
            // of the timeline. Earlier treatment (18pt + solid pine +
            // checkmark) flooded the screen with green; with two
            // milestones done you saw five pine elements above the
            // fold. Smaller filled dot still reads as "complete."
            Circle()
                .fill(CivicaColors.pinePrimary)
                .frame(width: 12, height: 12)
        case .current:
            // Current is the timeline's focal point: larger than done,
            // bold pine ring + pine inner dot so it reads as "you are
            // here." Bigger than the previous 18pt so the visual
            // hierarchy (current > done > future) is unambiguous.
            Circle()
                .fill(CivicaColors.paper)
                .frame(width: 22, height: 22)
                .overlay(
                    Circle()
                        .stroke(CivicaColors.pinePrimary, lineWidth: 3)
                )
                .overlay(
                    Circle()
                        .fill(CivicaColors.pinePrimary)
                        .frame(width: 9, height: 9)
                )
        case .future:
            Circle()
                .stroke(CivicaColors.ink.opacity(0.22), lineWidth: 1.5)
                .background(Circle().fill(CivicaColors.paper))
                .frame(width: 12, height: 12)
        }
    }

    private func completedWidth(in total: CGFloat) -> CGFloat {
        // dots are at positions 1/8, 3/8, 5/8, 7/8 of the strip;
        // the completed line should reach the midpoint of the current dot.
        let segments: CGFloat = CGFloat(Milestone.allCases.count) - 1
        let progress = (CGFloat(current.rawValue)) / segments
        return total * progress
    }

    private func alignment(forIndex idx: Int, total: Int) -> Alignment {
        if idx == 0 { return .leading }
        if idx == total - 1 { return .trailing }
        return .center
    }
}

// MARK: - CivicaEBTBalanceHeroCard

/// Dark-pine EBT balance hero. Extracted from the legacy
/// EBTBalanceDashboardView so Phase 3 of the main screen can render
/// the same card without view-coupling, and so the dashboard can
/// keep using it as its own header.
///
/// Visual contract: dark pine surface, wheat-gold accent on the
/// cents fragment of the dollar amount, eyebrow + monospace
/// timestamp at top, NEXT DEPOSIT and PROJECTED TO LAST split row
/// at the bottom separated by a thin warm-white rule. Stays
/// information-dense without feeling cluttered — the design review
/// flagged this as one of the surfaces that "already feels right"
/// and should be preserved.
public struct CivicaEBTBalanceHeroCard: View {
    let balanceDollars: Int
    let balanceCents: Int
    let updatedTimestamp: String
    let nextDepositAmount: String
    let nextDepositDate: String
    let projectedThrough: String

    public init(
        balanceDollars: Int,
        balanceCents: Int,
        updatedTimestamp: String,
        nextDepositAmount: String,
        nextDepositDate: String,
        projectedThrough: String
    ) {
        self.balanceDollars = balanceDollars
        self.balanceCents = balanceCents
        self.updatedTimestamp = updatedTimestamp
        self.nextDepositAmount = nextDepositAmount
        self.nextDepositDate = nextDepositDate
        self.projectedThrough = projectedThrough
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("FOOD BALANCE")
                    .font(CivicaTypography.codeChip)
                    .kerning(1.8)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.62))
                Spacer(minLength: CivicaSpacing.sm)
                HStack(spacing: 5) {
                    Circle()
                        .fill(CivicaColors.onPrimaryText.opacity(0.55))
                        .frame(width: 6, height: 6)
                    Text(updatedTimestamp.uppercased())
                        .font(CivicaTypography.codeChip)
                        .kerning(1.0)
                        .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.55))
                }
            }
            .padding(.bottom, CivicaSpacing.sm)

            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("$\(balanceDollars)")
                    .font(CivicaTypography.currencyHero)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                Text(String(format: ".%02d", balanceCents))
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.65))
            }
            .padding(.bottom, CivicaSpacing.md)

            Rectangle()
                .fill(CivicaColors.onPrimaryText.opacity(0.16))
                .frame(height: 1)
                .padding(.bottom, CivicaSpacing.md)

            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("NEXT DEPOSIT")
                        .font(CivicaTypography.codeChip)
                        .kerning(1.2)
                        .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.55))
                    Text("\(nextDepositAmount) · \(nextDepositDate)")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("PROJECTED TO LAST")
                        .font(CivicaTypography.codeChip)
                        .kerning(1.2)
                        .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.55))
                    Text(projectedThrough)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                }
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.pinePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Food balance \(balanceDollars) dollars and \(balanceCents) cents. Updated \(updatedTimestamp). Next deposit \(nextDepositAmount) on \(nextDepositDate), projected to last \(projectedThrough)."
        )
    }
}
