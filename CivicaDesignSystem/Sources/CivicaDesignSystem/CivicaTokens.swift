import CoreGraphics

public enum CivicaSpacing {
    public static let xs:  CGFloat = 4
    public static let sm:  CGFloat = 8
    public static let md:  CGFloat = 12
    public static let lg:  CGFloat = 16
    public static let xl:  CGFloat = 24
    public static let xxl: CGFloat = 32
}

public enum CivicaRadius {
    public static let sm:   CGFloat = 8
    public static let md:   CGFloat = 10   // matches existing button radius
    public static let lg:   CGFloat = 12   // matches CivicaColors.cardCornerRadius
    public static let xl:   CGFloat = 16
    public static let pill: CGFloat = 999

    // MARK: - Civica v1 brand (HANDOFF.md, locked May 10, 2026)
    // "No 8/12/16. Sharp on purpose." Migration in progress —
    // sm/md/lg/xl remain until consumers are swept to .control/.card.

    /// 3pt — controls, chips, inline buttons.
    public static let control: CGFloat = 3
    /// 4pt — cards, containers, sheets.
    public static let card:    CGFloat = 4
}
