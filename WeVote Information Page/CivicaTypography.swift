import SwiftUI

enum CivicaTypography {
    /// 34/41 bold — page header (PageHeader title, overlay titles).
    static let pageTitle      = Font.largeTitle.weight(.bold)
    /// 22/28 semibold — card hero ("Make a Plan to Vote", "Next election").
    static let cardHero       = Font.title2.weight(.semibold)
    /// 17/22 semibold — list/section headers, primary card titles.
    static let sectionHeader  = Font.headline
    /// 17/22 regular — body text, list row title.
    static let body           = Font.body
    /// 15/20 medium — emphasis subhead, stat callout.
    static let subhead        = Font.subheadline.weight(.medium)
    /// 13/18 regular — supporting copy under a row title.
    static let support        = Font.callout
    /// 12/16 regular — meta, timestamps, small captions.
    static let caption        = Font.caption
    /// 11/14 monospace — token chips, race codes (HR-3214).
    static let codeChip       = Font.system(size: 11, weight: .semibold, design: .monospaced)
}
