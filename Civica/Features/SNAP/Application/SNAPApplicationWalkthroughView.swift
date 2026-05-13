import CivicaDesignSystem
import SwiftUI

// 3-step "what to do next" walkthrough for completing the official
// state SNAP application via the active state's apply portal
// (BenefitsCal for CA, DTA Connect for MA, etc.).
//
// Renders below the application-PDF generator. Order matters: get the
// packet → open the state portal → use the packet as a reference while
// answering the official application's questions.

struct SNAPApplicationWalkthroughView: View {
    /// USPS state code for the active draft. Drives portal name and
    /// the apply URL. Nil falls back to the launch state via
    /// SNAPAgencyDirectory.
    let stateCode: String?

    @Environment(\.openURL) private var openURL

    init(stateCode: String? = nil) {
        self.stateCode = stateCode
    }

    private var portalName: String {
        let name = SNAPAgencyDirectory.portalName(for: stateCode)
        return name.isEmpty ? "your state portal" : name
    }

    private var portalURL: URL {
        CivicaExternalLinks.applyPortal(for: stateCode)
    }

    private var portalShortURL: String {
        SNAPAgencyDirectory.portalShortURL(for: stateCode)
    }

    private var agencyShort: String {
        SNAPAgencyDirectory.agencyShortName(for: stateCode, language: .english)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text("Submit to \(SNAPAgencyDirectory.agencyFullName(for: stateCode, language: .english))")
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.ink)

            step(
                number: 1,
                title: "Open \(portalName)",
                detail: "Go to \(portalShortURL) on your phone or computer.",
                action: {
                    openURL(portalURL)
                },
                actionLabel: "Open \(portalName)"
            )

            step(
                number: 2,
                title: "Apply for SNAP",
                detail: "Tap Apply for SNAP and create or sign into your \(portalName) account.",
                action: nil,
                actionLabel: nil
            )

            step(
                number: 3,
                title: "Use your packet as a reference",
                detail: "Answer the official application's questions using the summary you just saved. Upload the documents listed on the last page when \(agencyShort) asks for them.",
                action: nil,
                actionLabel: nil
            )

            footnote
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func step(
        number: Int,
        title: String,
        detail: String,
        action: (() -> Void)?,
        actionLabel: String?
    ) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Text("\(number)")
                .font(CivicaTypography.subheadBold)
                .foregroundColor(CivicaColors.onPrimaryText)
                .frame(width: 28, height: 28)
                .background(CivicaColors.brickPrimary)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.ink)
                Text(detail)
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.graphite)
                if let action = action, let label = actionLabel {
                    Button(action: action) {
                        Text(label)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundColor(CivicaColors.brickPrimary)
                    }
                }
            }
        }
    }

    private var footnote: some View {
        Text("Need help? Most \(agencyShort) offices have community navigators who can walk you through the application in person.")
            .font(CivicaTypography.caption)
            .foregroundColor(CivicaColors.graphite)
            .padding(.top, CivicaSpacing.xs)
    }
}

#if DEBUG
struct SNAPApplicationWalkthroughView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPApplicationWalkthroughView()
            .padding()
            .background(CivicaColors.paper)
    }
}
#endif
