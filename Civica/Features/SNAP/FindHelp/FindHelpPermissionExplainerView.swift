import CivicaDesignSystem
import SwiftUI

// HANDOFF map · B1 — "Why we ask · pre-permission."
//
// The Civica screen that runs BEFORE the iOS dialog. The HANDOFF
// brief is explicit about why this exists: "We earn location access
// by being clear about what we don't do with it." The "What we don't
// do" section gets the same visual weight as "What we do," not
// shrunken fine-print.
//
// Two CTAs: brick primary "Share my location" (triggers the iOS
// dialog), graphite-link secondary "Use a zip code instead" (routes
// to the existing zip fallback flow without ever asking for
// location). Both are first-class — privacy-respecting alternative
// isn't buried.

struct FindHelpPermissionExplainerView: View {
    let language: CivicaLanguage
    let onShareLocation: () -> Void
    let onUseZipInstead: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                    eyebrow
                    title
                    body_
                    whatWeDoCard
                    whatWeDontDoCard
                    Text(FindHelpStrings.permissionWithoutSharing.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(CivicaSpacing.xl)
            }
            actionFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    // MARK: - Header

    private var eyebrow: some View {
        Text(FindHelpStrings.permissionEyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    private var title: some View {
        Text(FindHelpStrings.permissionTitle.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var body_: some View {
        Text(FindHelpStrings.permissionBody.value(in: language))
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - "What we do" / "What we don't do" cards
    //
    // HANDOFF #5 single-component, three-skins rule applies in spirit:
    // both cards are the same shape (rounded surface, 3-pt accent
    // left-border, mono uppercase eyebrow, body) — only the accent
    // color differs (Teal for what-we-do, Ink for what-we-don't).
    // Equal weight is the point.

    private var whatWeDoCard: some View {
        explainerCard(
            eyebrow: FindHelpStrings.permissionDoEyebrow.value(in: language),
            body: FindHelpStrings.permissionDoBody.value(in: language),
            accent: CivicaColors.pinePrimary
        )
    }

    private var whatWeDontDoCard: some View {
        explainerCard(
            eyebrow: FindHelpStrings.permissionDontEyebrow.value(in: language),
            body: FindHelpStrings.permissionDontBody.value(in: language),
            accent: CivicaColors.ink
        )
    }

    private func explainerCard(eyebrow: String, body: String, accent: Color) -> some View {
        HStack(alignment: .top, spacing: 0) {
            Rectangle()
                .fill(accent)
                .frame(width: 3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(eyebrow)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(accent)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(body)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(CivicaSpacing.lg)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(eyebrow). \(body)")
    }

    // MARK: - Action footer

    private var actionFooter: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                FindHelpStrings.permissionShareCTA.value(in: language),
                action: onShareLocation
            )
            CivicaSecondaryButton(
                title: FindHelpStrings.permissionZipCTA.value(in: language),
                action: onUseZipInstead
            )
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.md)
        .padding(.bottom, CivicaSpacing.lg)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(CivicaColors.hairline).frame(height: 1)
        }
    }
}

#if DEBUG
struct FindHelpPermissionExplainerView_Previews: PreviewProvider {
    static var previews: some View {
        FindHelpPermissionExplainerView(
            language: .english,
            onShareLocation: {},
            onUseZipInstead: {}
        )
    }
}
#endif
