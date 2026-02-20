import SwiftUI
import WidgetKit

@main
struct Voting_UI_Island_CardBundle: WidgetBundle {
    var body: some Widget {
        Voting_UI_Island_Card()
        Voting_UI_Island_CardControl()
        Voting_UI_Island_CardLiveActivity()
        MAPVLiveActivityWidget()
    }
}
