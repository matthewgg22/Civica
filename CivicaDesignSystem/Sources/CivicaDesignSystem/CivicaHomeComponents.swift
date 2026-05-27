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

/// Pinned three-segment journey indicator. Currently rendered in
/// DEBUG builds only — production semantics (production-journey-
/// indicator with locked future phases, vs free toggle for demos)
/// is still pending product decision. DEBUG users (engineers, QA,
/// demo flows) get a free toggle so they can flip phases without
/// mutating the status store.
public struct CivicaPhaseTab: View {
    let current: CivicaPhase
    let onChange: (CivicaPhase) -> Void

    public init(current: CivicaPhase, onChange: @escaping (CivicaPhase) -> Void) {
        self.current = current
        self.onChange = onChange
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

    private func segmentButton(_ phase: CivicaPhase) -> some View {
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
                    .font(.system(size: 18))
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
                    .font(.system(size: 12, weight: .semibold))
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

    public init(current: Milestone, labels: [String]) {
        self.current = current
        // Pad / trim to 4 to keep the layout predictable even if a
        // caller passes a wrong-length label set.
        var resolved = labels
        while resolved.count < 4 { resolved.append("") }
        self.labels = Array(resolved.prefix(4))
    }

    public var body: some View {
        VStack(spacing: 8) {
            GeometryReader { proxy in
                ZStack {
                    // base connector
                    Rectangle()
                        .fill(CivicaColors.ink.opacity(0.10))
                        .frame(height: 2)
                    // completed connector — done -> midpoint of current
                    Rectangle()
                        .fill(CivicaColors.pinePrimary)
                        .frame(
                            width: completedWidth(in: proxy.size.width),
                            height: 2
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 0) {
                        ForEach(Milestone.allCases, id: \.self) { m in
                            milestoneDot(m)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .frame(height: 22)
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

    @ViewBuilder
    private func milestoneDot(_ m: Milestone) -> some View {
        let s = state(of: m)
        switch s {
        case .done:
            Circle()
                .fill(CivicaColors.pinePrimary)
                .frame(width: 18, height: 18)
                .overlay {
                    Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(CivicaColors.onPrimaryText)
                }
        case .current:
            Circle()
                .fill(CivicaColors.pinePrimary)
                .frame(width: 18, height: 18)
                .overlay(
                    Circle()
                        .stroke(CivicaColors.pinePrimary.opacity(0.20), lineWidth: 5)
                )
        case .future:
            Circle()
                .stroke(CivicaColors.ink.opacity(0.22), lineWidth: 1.5)
                .background(Circle().fill(CivicaColors.paper))
                .frame(width: 14, height: 14)
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
                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                    .kerning(1.8)
                    .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.62))
                Spacer(minLength: CivicaSpacing.sm)
                HStack(spacing: 5) {
                    Circle()
                        .fill(CivicaColors.onPrimaryText.opacity(0.55))
                        .frame(width: 6, height: 6)
                    Text(updatedTimestamp.uppercased())
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .kerning(1.0)
                        .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.55))
                }
            }
            .padding(.bottom, CivicaSpacing.sm)

            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("$\(balanceDollars)")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(CivicaColors.onPrimaryText)
                Text(String(format: ".%02d", balanceCents))
                    .font(.system(size: 28, weight: .semibold))
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
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .kerning(1.2)
                        .foregroundStyle(CivicaColors.onPrimaryText.opacity(0.55))
                    Text("\(nextDepositAmount) · \(nextDepositDate)")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("PROJECTED TO LAST")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
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
