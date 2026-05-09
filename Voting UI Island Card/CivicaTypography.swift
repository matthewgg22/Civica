import SwiftUI

enum CivicaTypography {
    /// 34/41 bold — page header (PageHeader title, overlay titles).
    static let pageTitle           = Font.largeTitle.weight(.bold)
    /// 22/28 semibold — card hero ("Make a Plan to Vote", "Next election").
    static let cardHero            = Font.title2.weight(.semibold)
    /// 20/25 bold — small card title / subsection header.
    static let cardTitle           = Font.title3.weight(.bold)
    /// 17/22 semibold — list/section headers, primary card titles.
    static let sectionHeader       = Font.headline
    /// 17/22 bold — heaviest section header.
    static let sectionHeaderBold   = Font.headline.weight(.bold)
    /// 17/22 regular — body text, list row title.
    static let body                = Font.body
    /// 15/20 medium — emphasis subhead, stat callout.
    static let subhead             = Font.subheadline.weight(.medium)
    /// 15/20 semibold — strongly emphasized subhead.
    static let subheadStrong       = Font.subheadline.weight(.semibold)
    /// 15/20 bold — heaviest subhead.
    static let subheadBold         = Font.subheadline.weight(.bold)
    /// 16/21 regular — supporting copy under a row title.
    static let support             = Font.callout
    /// 16/21 semibold — strongly emphasized supporting copy.
    static let supportStrong       = Font.callout.weight(.semibold)
    /// 16/21 bold — heaviest supporting copy.
    static let supportBold         = Font.callout.weight(.bold)
    /// 13/18 regular — fine print.
    static let footnote            = Font.footnote
    /// 13/18 semibold — emphasized fine print.
    static let footnoteStrong      = Font.footnote.weight(.semibold)
    /// 12/16 regular — meta, timestamps, small captions.
    static let caption             = Font.caption
    /// 12/16 semibold — strongly emphasized meta.
    static let captionStrong       = Font.caption.weight(.semibold)
    /// 12/16 bold — heaviest meta.
    static let captionBold         = Font.caption.weight(.bold)
    /// 11/14 monospace — token chips, race codes (HR-3214).
    static let codeChip            = Font.system(size: 11, weight: .semibold, design: .monospaced)
}
