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

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    init(stateCode: String? = nil) {
        self.stateCode = stateCode
    }

    private var portalName: String {
        let name = SNAPAgencyDirectory.portalName(for: stateCode)
        if !name.isEmpty { return name }
        return language == .spanish ? "el portal estatal" : "your state portal"
    }

    private var portalURL: URL {
        CivicaExternalLinks.applyPortal(for: stateCode)
    }

    private var portalShortURL: String {
        SNAPAgencyDirectory.portalShortURL(for: stateCode)
    }

    private var agencyShort: String {
        SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPApplicationWalkthroughStrings.submitTo(stateCode: stateCode, language: language))
                .font(CivicaTypography.cardTitle)
                .foregroundColor(CivicaColors.ink)

            step(
                number: 1,
                title: SNAPApplicationWalkthroughStrings.openPortalTitle(portal: portalName, language: language),
                detail: SNAPApplicationWalkthroughStrings.openPortalDetail(shortURL: portalShortURL, language: language),
                action: {
                    openURL(portalURL)
                },
                actionLabel: SNAPApplicationWalkthroughStrings.openPortalTitle(portal: portalName, language: language)
            )

            step(
                number: 2,
                title: SNAPApplicationWalkthroughStrings.applyForSNAP.value(in: language),
                detail: SNAPApplicationWalkthroughStrings.applyForSNAPDetail(portal: portalName, language: language),
                action: nil,
                actionLabel: nil
            )

            step(
                number: 3,
                title: SNAPApplicationWalkthroughStrings.useYourPacket.value(in: language),
                detail: SNAPApplicationWalkthroughStrings.useYourPacketDetail(agencyShort: agencyShort, language: language),
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
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.onPrimaryText)
                .frame(width: 28, height: 28)
                .background(CivicaColors.pinePrimary)
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
                            .foregroundColor(CivicaColors.pinePrimary)
                    }
                }
            }
        }
    }

    private var footnote: some View {
        Text(SNAPApplicationWalkthroughStrings.footnote(agencyShort: agencyShort, language: language))
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
