import CoreGraphics

/// Form field stroke widths per the design canvas form-state board.
///
/// Default: 1pt. Focused or error: 1.5pt. Pair the error state with
/// `CivicaColors.destructive` plus an explicit sigil + label (color alone
/// is never enough — the canvas requires color + sigil + label, with
/// `accessibilityHint` describing what's wrong).
public enum CivicaBorder {
    /// 1pt — default field outline.
    public static let fieldDefault: CGFloat = 1
    /// 1.5pt — focused or error state. Used with brick (focused/required) or destructive (error).
    public static let fieldActive:  CGFloat = 1.5
}
