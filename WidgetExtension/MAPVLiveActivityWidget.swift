import SwiftUI
import WidgetKit

private struct WidgetExtensionEntry: TimelineEntry {
    let date: Date
}

private struct WidgetExtensionProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetExtensionEntry {
        WidgetExtensionEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetExtensionEntry) -> Void) {
        completion(WidgetExtensionEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetExtensionEntry>) -> Void) {
        completion(Timeline(entries: [WidgetExtensionEntry(date: Date())], policy: .never))
    }
}

struct MAPVLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MAPVLiveActivityWidget", provider: WidgetExtensionProvider()) { _ in
            Text("VoteNow")
        }
        .configurationDisplayName("VoteNow")
        .description("VoteNow widget extension")
    }
}
