import CivicaDesignSystem
import SwiftUI

// Minimal Civica-side PageHeader. The VoteNow target has a richer
// version with the Civica logo orbit + WhyVote tap; that one pulls in
// a chain of VoteNow-only dependencies (CivicaLogoIcon, WhyVote*
// overlay infrastructure, AppShell.xcstrings keys). For SNAP screens
// inside the Civica app we just need the title rendering, so this
// shim provides the same call shape (`PageHeader(title: "…")`) without
// the VoteNow chrome.
//
// TODO: when CivicaDesignSystem grows a real `PageHeader` component,
// remove this shim and have both apps consume that one.

struct PageHeader: View {
    let title: Text
    var iconSize: CGFloat = 56
    var enableWhyVoteTap: Bool = false

    init(title: Text, iconSize: CGFloat = 56, enableWhyVoteTap: Bool = false) {
        self.title = title
        self.iconSize = iconSize
        self.enableWhyVoteTap = enableWhyVoteTap
    }

    init(title: String, iconSize: CGFloat = 56, enableWhyVoteTap: Bool = false) {
        self.title = Text(verbatim: title)
        self.iconSize = iconSize
        self.enableWhyVoteTap = enableWhyVoteTap
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            title
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Spacer()
        }
        .padding(.vertical, CivicaSpacing.xs)
    }
}
