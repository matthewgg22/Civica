import SwiftUI

/// Typography ladder, rendered in Hanken Grotesk per HANDOFF.md §1.
/// Weights: 400 (Regular), 500 (Medium), 600 (SemiBold). The handoff caps UI
/// type at 600 — `.bold`-flavored tokens (e.g. `pageTitle`, `cardTitle`) render
/// in SemiBold rather than synthetic bold, so visual hierarchy must come from
/// size/color, not extra weight.
///
/// Sizes use `relativeTo:` so Dynamic Type still scales the ladder. Numeric-
/// prone tokens (body, footnote, caption tiers) include `.monospacedDigit()`
/// to satisfy the handoff's tabular-nums money rule wherever the font is used.
public enum CivicaTypography {
    private static let regular  = "HankenGrotesk-Regular"
    private static let medium   = "HankenGrotesk-Medium"
    private static let semibold = "HankenGrotesk-SemiBold"

    /// 32/40 monospaced — hero currency display for income/expenses entry
    /// screens. Monospaced (tabular) so digit columns stay aligned as the
    /// user types. Reuse across SNAPIncomeFlow, SNAPExpensesFlow, and
    /// SNAPRecoveryView; do not pair with body copy.
    public static let currencyHero        = Font.custom(semibold, size: 32, relativeTo: .largeTitle).monospacedDigit()
    /// 28/34 — page header (PageHeader title, overlay titles).
    /// Reduced from 34pt to 28pt 2026-05-13 per launch-test UX
    /// feedback: 34pt headers consumed too much vertical real estate
    /// on the estimator entry, survey question screens, and the
    /// per-page titles inside the application flow. 28pt keeps the
    /// title clearly the largest element on the page without pushing
    /// the affordance below the fold on smaller iPhones.
    public static let pageTitle           = Font.custom(semibold, size: 28, relativeTo: .largeTitle)
    /// 22/28 — card hero ("Make a Plan to Vote", "Next election").
    public static let cardHero            = Font.custom(semibold, size: 22, relativeTo: .title2)
    /// 20/25 — small card title / subsection header.
    public static let cardTitle           = Font.custom(semibold, size: 20, relativeTo: .title3)
    /// 20/25 — alias of `cardTitle` (same Hanken SemiBold weight; the handoff
    /// caps weight at SemiBold, so a "quieter card title" is identical to a
    /// regular one — differentiation belongs in hierarchy/color, not weight).
    /// Deprecated 2026-05-29 per audit DS-2; use `cardTitle` directly.
    @available(*, deprecated, renamed: "cardTitle")
    public static let cardSubtitle        = Font.custom(semibold, size: 20, relativeTo: .title3)
    /// 17/22 — list/section headers, primary card titles.
    public static let sectionHeader       = Font.custom(semibold, size: 17, relativeTo: .headline)
    /// 17/22 — alias of `sectionHeader`. Deprecated 2026-05-29 per audit DS-2.
    @available(*, deprecated, renamed: "sectionHeader")
    public static let sectionHeaderBold   = Font.custom(semibold, size: 17, relativeTo: .headline)
    /// 17/22 — body text, list row title.
    public static let body                = Font.custom(regular, size: 17, relativeTo: .body).monospacedDigit()
    /// 17/22 — emphasized body, primary stat in a row.
    public static let bodyStrong          = Font.custom(semibold, size: 17, relativeTo: .body).monospacedDigit()
    /// 15/20 — emphasis subhead, stat callout.
    public static let subhead             = Font.custom(medium, size: 15, relativeTo: .subheadline)
    /// 15/20 — strongly emphasized subhead.
    public static let subheadStrong       = Font.custom(semibold, size: 15, relativeTo: .subheadline)
    /// 15/20 — alias of `subheadStrong`. Deprecated 2026-05-29 per audit DS-2.
    @available(*, deprecated, renamed: "subheadStrong")
    public static let subheadBold         = Font.custom(semibold, size: 15, relativeTo: .subheadline)
    /// 16/21 — supporting copy under a row title.
    public static let support             = Font.custom(regular, size: 16, relativeTo: .callout).monospacedDigit()
    /// 16/21 — strongly emphasized supporting copy.
    public static let supportStrong       = Font.custom(semibold, size: 16, relativeTo: .callout).monospacedDigit()
    /// 16/21 — heaviest supporting copy (same Hanken weight as supportStrong).
    public static let supportBold         = Font.custom(semibold, size: 16, relativeTo: .callout).monospacedDigit()
    /// 13/18 — fine print.
    public static let footnote            = Font.custom(regular, size: 13, relativeTo: .footnote).monospacedDigit()
    /// 13/18 — fine print needing slight emphasis (form helper text).
    public static let footnoteMedium      = Font.custom(medium, size: 13, relativeTo: .footnote).monospacedDigit()
    /// 13/18 — emphasized fine print.
    public static let footnoteStrong      = Font.custom(semibold, size: 13, relativeTo: .footnote).monospacedDigit()
    /// 12/16 — meta, timestamps, small captions.
    public static let caption             = Font.custom(regular, size: 12, relativeTo: .caption).monospacedDigit()
    /// 12/16 — strongly emphasized meta.
    public static let captionStrong       = Font.custom(semibold, size: 12, relativeTo: .caption).monospacedDigit()
    /// 12/16 — heaviest meta (same Hanken weight as captionStrong).
    public static let captionBold         = Font.custom(semibold, size: 12, relativeTo: .caption).monospacedDigit()
    /// 11/14 monospace — token chips, race codes (HR-3214). Stays on system
    /// monospaced (ui-monospace / SF Mono) per HANDOFF.md §1: "ui-monospace,
    /// SF Mono, IBM Plex Mono. Metadata/labels/eyebrows only — never body."
    public static let codeChip            = Font.system(size: 11, weight: .semibold, design: .monospaced)
}
