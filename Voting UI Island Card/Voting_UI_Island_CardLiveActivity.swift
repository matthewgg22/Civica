//
//  Voting_UI_Island_CardLiveActivity.swift
//  Voting UI Island Card
//
//  Created by Matthew Greer-Gentis on 2/14/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct Voting_UI_Island_CardAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct Voting_UI_Island_CardLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: Voting_UI_Island_CardAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension Voting_UI_Island_CardAttributes {
    fileprivate static var preview: Voting_UI_Island_CardAttributes {
        Voting_UI_Island_CardAttributes(name: "World")
    }
}

extension Voting_UI_Island_CardAttributes.ContentState {
    fileprivate static var smiley: Voting_UI_Island_CardAttributes.ContentState {
        Voting_UI_Island_CardAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: Voting_UI_Island_CardAttributes.ContentState {
         Voting_UI_Island_CardAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: Voting_UI_Island_CardAttributes.preview) {
   Voting_UI_Island_CardLiveActivity()
} contentStates: {
    Voting_UI_Island_CardAttributes.ContentState.smiley
    Voting_UI_Island_CardAttributes.ContentState.starEyes
}
