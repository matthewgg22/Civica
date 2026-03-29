import SwiftUI

struct RankedChoiceVotingView: View {
    let title: String
    let candidateCount: Int
    let defaultMuted: Bool
    let idleTimeoutSeconds: TimeInterval
    let isEmbedded: Bool

    init(
        title: String = "Ranked-Choice Voting",
        candidateCount: Int = 4,
        defaultMuted: Bool = false,
        idleTimeoutSeconds: TimeInterval = 30,
        isEmbedded: Bool = false
    ) {
        self.title = title
        self.candidateCount = max(4, min(4, candidateCount))
        self.defaultMuted = defaultMuted
        self.idleTimeoutSeconds = idleTimeoutSeconds
        self.isEmbedded = isEmbedded
    }

    var body: some View {
        MarbleSimulationView(
            title: title,
            candidateCount: candidateCount,
            defaultMuted: defaultMuted,
            idleTimeoutSeconds: idleTimeoutSeconds,
            isEmbedded: isEmbedded
        )
    }
}

struct RankedChoiceVotingView_Previews: PreviewProvider {
    static var previews: some View {
        RankedChoiceVotingView(candidateCount: 4)
    }
}
