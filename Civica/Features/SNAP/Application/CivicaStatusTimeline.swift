import CivicaDesignSystem
import SwiftUI

// Reusable vertical timeline (HANDOFF #5: "Single component, three
// skins. Used in submitted, recert, decision."). One concrete data
// shape; visual variation comes from the `Step.state` enum and the
// optional `accent` parameter on the view.
//
// Lives in the Civica target for now. Once recert + decision skins
// are battle-tested, promote to CivicaDesignSystem so VoteNow can
// reuse it too.

struct CivicaStatusTimeline: View {
    let steps: [Step]
    let accent: Color

    init(steps: [Step], accent: Color = CivicaColors.pinePrimary) {
        self.steps = steps
        self.accent = accent
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                row(step: step, isLast: index == steps.count - 1)
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Step model

    struct Step: Identifiable, Equatable {
        let id: String
        let title: String
        let detail: String?
        let state: State
        let timestamp: String?

        enum State: Equatable {
            case complete
            case current
            case future
            case blocked  // user action required to advance
        }

        init(
            id: String,
            title: String,
            detail: String? = nil,
            state: State,
            timestamp: String? = nil
        ) {
            self.id = id
            self.title = title
            self.detail = detail
            self.state = state
            self.timestamp = timestamp
        }
    }

    // MARK: - Row rendering

    private func row(step: Step, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            VStack(spacing: 0) {
                marker(for: step)
                if !isLast {
                    Rectangle()
                        .fill(connectorColor(for: step))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 28)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    Text(step.title)
                        .font(titleFont(for: step))
                        .foregroundStyle(titleColor(for: step))
                    Spacer()
                    if let timestamp = step.timestamp {
                        Text(timestamp)
                            .font(CivicaTypography.footnote.monospacedDigit())
                            .foregroundStyle(CivicaColors.graphite)
                    }
                }
                if let detail = step.detail {
                    Text(detail)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.bottom, isLast ? 0 : CivicaSpacing.lg)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel(step))
    }

    // MARK: - Marker (the circle/dot on the rail)

    private func marker(for step: Step) -> some View {
        ZStack {
            Circle()
                .fill(markerFill(for: step))
                .frame(width: 28, height: 28)
            Circle()
                .strokeBorder(markerBorder(for: step), lineWidth: step.state == .future ? 1 : 0)
                .frame(width: 28, height: 28)
            Image(systemName: markerIcon(for: step))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(markerIconColor(for: step))
        }
    }

    // MARK: - Color / typography variations per state

    private func markerFill(for step: Step) -> Color {
        switch step.state {
        // Completed milestones land on teal — positive-outcome cue
        // per HANDOFF, instead of repeating the brand brick that
        // dominates every CTA on the same screens.
        case .complete: return CivicaColors.amberPrimary
        // Current step uses the wheatPop token
        // ("this is where you are right now") so the eye reads it
        // as a distinct "you are here" rather than a duplicate of
        // either completed (teal) or the screen's primary CTA (pine).
        case .current:  return CivicaColors.wheatPop
        case .future:   return CivicaColors.surfacePrimary
        case .blocked:  return CivicaColors.warningAmber
        }
    }

    private func markerBorder(for step: Step) -> Color {
        switch step.state {
        case .future: return CivicaColors.hairline
        default: return .clear
        }
    }

    private func markerIconColor(for step: Step) -> Color {
        switch step.state {
        case .complete, .current, .blocked: return CivicaColors.onPrimaryText
        case .future: return CivicaColors.graphite
        }
    }

    private func markerIcon(for step: Step) -> String {
        switch step.state {
        case .complete: return "checkmark"
        case .current:  return "circle.fill"
        case .future:   return "circle"
        case .blocked:  return "exclamationmark"
        }
    }

    private func connectorColor(for step: Step) -> Color {
        switch step.state {
        // Match the completed-marker tint so the connector line
        // visually "carries" completion forward.
        case .complete: return CivicaColors.amberPrimary
        case .current:  return CivicaColors.hairline
        case .future:   return CivicaColors.hairline
        case .blocked:  return CivicaColors.warningAmber.opacity(0.4)
        }
    }

    private func titleColor(for step: Step) -> Color {
        switch step.state {
        case .complete: return CivicaColors.ink
        case .current:  return CivicaColors.ink
        case .future:   return CivicaColors.graphite
        case .blocked:  return CivicaColors.ink
        }
    }

    private func titleFont(for step: Step) -> Font {
        switch step.state {
        case .current, .blocked: return CivicaTypography.subheadStrong
        default:                 return CivicaTypography.subhead
        }
    }

    // MARK: - Accessibility

    private func accessibilityLabel(_ step: Step) -> String {
        let stateWord: String
        switch step.state {
        case .complete: stateWord = "Completed"
        case .current:  stateWord = "In progress"
        case .future:   stateWord = "Upcoming"
        case .blocked:  stateWord = "Action needed"
        }
        var parts = [stateWord, step.title]
        if let detail = step.detail { parts.append(detail) }
        if let timestamp = step.timestamp { parts.append(timestamp) }
        return parts.joined(separator: ". ")
    }
}

#if DEBUG
struct CivicaStatusTimeline_Previews: PreviewProvider {
    static var previews: some View {
        CivicaStatusTimeline(steps: [
            .init(id: "screener",
                  title: "Eligibility screener",
                  detail: "Estimated $135/mo",
                  state: .complete,
                  timestamp: "Apr 14"),
            .init(id: "packet",
                  title: "Application packet generated",
                  detail: "1 paystub + ID confirmed",
                  state: .complete,
                  timestamp: "Apr 14"),
            .init(id: "submitted",
                  title: "Submitted to DTA Connect",
                  detail: "Open dtaconnect.eohhs.mass.gov to file",
                  state: .blocked),
            .init(id: "interview",
                  title: "Phone interview",
                  state: .future),
            .init(id: "decision",
                  title: "Decision",
                  state: .future),
        ])
        .padding(CivicaSpacing.xl)
        .background(CivicaColors.paper)
    }
}
#endif
