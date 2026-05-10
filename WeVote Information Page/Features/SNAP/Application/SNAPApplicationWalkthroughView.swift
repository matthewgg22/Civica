import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: 3-step "what to do next" walkthrough
// for completing the official MA SNAP application in DTA Connect.
//
// Renders below the application-PDF generator. Order matters: get the
// packet → open DTA Connect → use the packet as a reference while
// answering the official application's questions.

struct SNAPApplicationWalkthroughView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text("Submit to Massachusetts DTA")
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.textPrimary)

            step(
                number: 1,
                title: "Open DTA Connect",
                detail: "Go to dtaconnect.eohhs.mass.gov on your phone or computer.",
                action: {
                    if let url = URL(string: "https://dtaconnect.eohhs.mass.gov") {
                        Task { @MainActor in await UIApplication.shared.open(url) }
                    }
                },
                actionLabel: "Open DTA Connect"
            )

            step(
                number: 2,
                title: "Apply for SNAP",
                detail: "Tap Apply for SNAP and create or sign into your DTA Connect account.",
                action: nil,
                actionLabel: nil
            )

            step(
                number: 3,
                title: "Use your packet as a reference",
                detail: "Answer the official application's questions using the summary you just saved. Upload the documents listed on the last page when DTA asks for them.",
                action: nil,
                actionLabel: nil
            )

            footnote
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.xl))
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
                .background(CivicaColors.ctaBlue)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.textPrimary)
                Text(detail)
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.textSecondary)
                if let action = action, let label = actionLabel {
                    Button(action: action) {
                        Text(label)
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundColor(CivicaColors.ctaBlue)
                    }
                }
            }
        }
    }

    private var footnote: some View {
        Text("Need help? Most DTA offices have community navigators who can walk you through the application in person.")
            .font(CivicaTypography.caption)
            .foregroundColor(CivicaColors.textSecondary)
            .padding(.top, CivicaSpacing.xs)
    }
}

#if DEBUG
struct SNAPApplicationWalkthroughView_Previews: PreviewProvider {
    static var previews: some View {
        SNAPApplicationWalkthroughView()
            .padding()
            .background(CivicaColors.canvasBackground)
    }
}
#endif
