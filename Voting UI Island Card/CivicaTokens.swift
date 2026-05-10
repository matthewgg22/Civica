import CoreGraphics

enum CivicaSpacing {
    static let xs:  CGFloat = 4
    static let sm:  CGFloat = 8
    static let md:  CGFloat = 12
    static let lg:  CGFloat = 16
    static let xl:  CGFloat = 24
    static let xxl: CGFloat = 32
}

enum CivicaRadius {
    /// 3pt — controls, chips, inline buttons.
    static let control: CGFloat = 3
    /// 4pt — cards, containers.
    static let card:    CGFloat = 4
    /// 99pt — status pills.
    static let pill:    CGFloat = 999
}
