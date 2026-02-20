import ActivityKit
import SwiftUI
import WidgetKit

struct MAPVLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MAPVLiveActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.electionTitle)
                    .font(.headline)
                    .lineLimit(1)
                Text(context.state.primaryCountdownText)
                    .font(.title3.monospacedDigit())
                Text(context.state.statusPillText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(10)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.statusPillText)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.primaryCountdownText)
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.pollingPlaceName)
                        .lineLimit(1)
                }
            } compactLeading: {
                Text("Vote")
            } compactTrailing: {
                Text(context.state.primaryCountdownText)
                    .monospacedDigit()
            } minimal: {
                Text("V")
            }
        }
    }
}
