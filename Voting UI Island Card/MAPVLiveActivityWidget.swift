import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

struct MAPVLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MAPVLiveActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    CivicaMiniLogo(size: 24)
                    Text(context.attributes.electionTitle)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    statusPill(for: context.state)
                }

                DayTimelineView(
                    now: context.state.now,
                    pollingOpen: context.state.pollingOpen,
                    pollingClose: context.state.pollingClose
                )

                HStack(spacing: 10) {
                    Label(distanceText(for: context.state), systemImage: "location.circle.fill")
                    Label(etaText(for: context.state), systemImage: "clock.fill")
                    Spacer(minLength: 0)
                    Text("Closes \(closingCountdownText(for: context.state))")
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            }
            .padding(10)
            .widgetURL(destinationURL(for: context))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        CivicaMiniLogo(size: 22)
                        Image(systemName: statusIcon(for: context.state.status))
                            .font(.caption2.weight(.bold))
                        Text(context.state.statusPillText)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(distanceText(for: context.state))
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                        Text(etaText(for: context.state))
                            .font(.caption2.monospacedDigit())
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        DayTimelineView(
                            now: context.state.now,
                            pollingOpen: context.state.pollingOpen,
                            pollingClose: context.state.pollingClose
                        )
                        HStack(spacing: 6) {
                            Image(systemName: "mappin.and.ellipse")
                            Text(context.state.pollingPlaceShortName)
                                .lineLimit(1)
                                .minimumScaleFactor(0.74)
                            Spacer(minLength: 4)
                            Text("Closes \(closingCountdownText(for: context.state))")
                                .font(.caption2.monospacedDigit())
                                .lineLimit(1)
                                .minimumScaleFactor(0.74)
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                CivicaMiniLogo(size: 18)
            } compactTrailing: {
                Text(compactETAText(for: context.state))
                    .font(.caption2.monospacedDigit())
                    .lineLimit(1)
            } minimal: {
                Image(systemName: "map.fill")
            }
            .widgetURL(destinationURL(for: context))
        }
    }

    private func statusPill(for state: MAPVLiveActivityAttributes.ContentState) -> some View {
        HStack(spacing: 4) {
            Image(systemName: statusIcon(for: state.status))
                .font(.caption2.weight(.bold))
            Text(state.statusPillText)
                .font(.caption2.weight(.bold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(pillColor(for: state.statusColorToken))
        .clipShape(Capsule())
    }

    private func distanceText(for state: MAPVLiveActivityAttributes.ContentState) -> String {
        guard let miles = state.distanceMiles else { return "-- mi away" }
        return String(format: "%.1f mi away", miles)
    }

    private func etaText(for state: MAPVLiveActivityAttributes.ContentState) -> String {
        guard let eta = state.etaMinutes else { return "ETA --" }
        return "ETA \(eta)m"
    }

    private func compactETAText(for state: MAPVLiveActivityAttributes.ContentState) -> String {
        guard let eta = state.etaMinutes else { return "--m" }
        return "\(eta)m"
    }

    private func closingCountdownText(for state: MAPVLiveActivityAttributes.ContentState) -> String {
        let remaining = Int(state.pollingClose.timeIntervalSince(state.now))
        guard remaining > 0 else { return "closed" }
        let hours = remaining / 3600
        let minutes = (remaining % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    private func destinationURL(for context: ActivityViewContext<MAPVLiveActivityAttributes>) -> URL? {
        if let directions = context.state.directionsURL, let url = URL(string: directions) {
            return url
        }

        let trimmed = context.attributes.pollingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
            return URL(string: "http://maps.apple.com/?daddr=\(encoded)")
        }

        return URL(string: context.state.deepLinkURL)
    }

    private func pillColor(for token: MAPVStatusColorToken) -> Color {
        switch token {
        case .blue: return Color(hex: "#246AA8")
        case .green: return Color(hex: "#176E49")
        case .orange: return Color(hex: "#9A5A14")
        case .red: return Color(hex: "#C84637")
        case .gray: return Color(hex: "#5A5F66")
        case .indigo: return Color(hex: "#4F46A5")
        }
    }

    private func statusIcon(for status: MAPVDisplayStatus) -> String {
        switch status {
        case .scheduled:
            return "calendar"
        case .open:
            return "checkmark.circle"
        case .enRoute:
            return "location.fill"
        case .closingSoon:
            return "exclamationmark.circle"
        case .closed:
            return "lock.fill"
        case .completed:
            return "checkmark.circle.fill"
        case .missed:
            return "xmark.circle.fill"
        }
    }
}

private struct DayTimelineView: View {
    let now: Date
    let pollingOpen: Date
    let pollingClose: Date

    var body: some View {
        let dayStart = Calendar.current.startOfDay(for: pollingOpen)
        let dayEnd = dayStart.addingTimeInterval(24 * 60 * 60)
        let openProgress = normalizedProgress(for: pollingOpen, start: dayStart, end: dayEnd)
        let closeProgress = max(openProgress, normalizedProgress(for: pollingClose, start: dayStart, end: dayEnd))
        let nowProgress = normalizedProgress(for: now, start: dayStart, end: dayEnd)

        return VStack(spacing: 4) {
            GeometryReader { geo in
                let width = geo.size.width
                let horizontalInset: CGFloat = 4
                let trackWidth = max(0, width - (horizontalInset * 2))
                let openX = horizontalInset + (trackWidth * openProgress)
                let closeX = horizontalInset + (trackWidth * closeProgress)
                let nowX = horizontalInset + (trackWidth * nowProgress)

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(.gray.opacity(0.25))
                        .frame(width: trackWidth, height: 8)
                        .offset(x: horizontalInset)

                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "#176E49").opacity(0.85), Color(hex: "#9A5A14").opacity(0.9)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, closeX - openX), height: 8)
                        .offset(x: openX)

                    Circle()
                        .fill(Color.white)
                        .frame(width: 10, height: 10)
                        .overlay(
                            Circle()
                                .stroke(Color.black.opacity(0.55), lineWidth: 1)
                        )
                        .offset(x: min(max(nowX - 5, horizontalInset), width - horizontalInset - 10))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(height: 12)

            HStack {
                Text("00:00")
                Spacer()
                Text("24:00")
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
        }
    }

    private func normalizedProgress(for date: Date, start: Date, end: Date) -> CGFloat {
        let total = end.timeIntervalSince(start)
        guard total > 0 else { return 0 }
        let elapsed = date.timeIntervalSince(start)
        return CGFloat(max(0, min(elapsed / total, 1)))
    }
}

private extension Color {
    init(hex: String) {
        let cleaned = hex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")

        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r = Double((value & 0xFF0000) >> 16) / 255
        let g = Double((value & 0x00FF00) >> 8) / 255
        let b = Double(value & 0x0000FF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

private struct CivicaMiniLogo: View {
    let size: CGFloat

    var body: some View {
        let stripe = Color(red: 223.0 / 255.0, green: 88.0 / 255.0, blue: 69.0 / 255.0)
        let background = Color(red: 0.68, green: 0.84, blue: 0.90)
        let motifWidth = size * 0.7
        let barHeight = max(1.4, size * 0.08)
        let gap = max(1.0, size * 0.04)
        let topWidth = motifWidth * 0.56

        return ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(background)

            VStack(spacing: gap) {
                HStack {
                    Spacer(minLength: 0)
                    Rectangle()
                        .fill(stripe)
                        .frame(width: topWidth, height: barHeight)
                }
                .frame(width: motifWidth)

                HStack {
                    Spacer(minLength: 0)
                    Rectangle()
                        .fill(stripe)
                        .frame(width: topWidth, height: barHeight)
                }
                .frame(width: motifWidth)

                HStack {
                    Spacer(minLength: 0)
                    Rectangle()
                        .fill(stripe)
                        .frame(width: topWidth, height: barHeight)
                }
                .frame(width: motifWidth)

                Rectangle()
                    .fill(stripe)
                    .frame(width: motifWidth, height: barHeight)
                Rectangle()
                    .fill(stripe)
                    .frame(width: motifWidth, height: barHeight)
                Rectangle()
                    .fill(stripe)
                    .frame(width: motifWidth, height: barHeight)
            }
            .frame(width: motifWidth)
        }
        .frame(width: size, height: size)
        .overlay(
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .stroke(Color.white.opacity(0.8), lineWidth: 0.5)
        )
    }
}
