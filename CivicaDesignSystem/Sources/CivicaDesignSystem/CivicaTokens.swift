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
    /// 3pt — controls, chips, inline buttons.
    public static let control: CGFloat = 3
    /// 4pt — cards, containers, sheets.
    public static let card:    CGFloat = 4
    /// 99pt — status pills.
    public static let pill:    CGFloat = 999
}
